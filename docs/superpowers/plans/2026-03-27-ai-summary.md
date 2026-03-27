# AI Report Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered analysis to the summary page and PDF report, with a top-level summary banner, contextual inline callouts, and async loading that never blocks calculations.

**Architecture:** A Next.js API route reads Codex OAuth tokens (or falls back to OPENAI_API_KEY), calls OpenAI with all calculation results, and returns structured JSON. The client fires the request automatically after calculations complete and distributes the response across the summary tab and print report.

**Tech Stack:** Next.js 16 route handlers, OpenAI SDK, Zustand, React, Tailwind CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/api/openai-auth.ts` | Read Codex OAuth token from `~/.codex/auth.json` or fall back to `OPENAI_API_KEY` |
| Create | `src/lib/api/openai.ts` | Initialize OpenAI client, expose `callOpenAI()` for both API surfaces |
| Create | `src/lib/api/ai-summary-prompt.ts` | System prompt, user prompt builder, response schema type |
| Create | `src/app/api/ai-summary/route.ts` | POST route handler — receives data, calls OpenAI, returns JSON |
| Modify | `src/store/project-store.ts` | Add `aiSummary`, `aiSummaryLoading`, `aiSummaryError` state + actions |
| Create | `src/components/summary/ai-summary-banner.tsx` | Top-of-summary executive summary with loading/error states |
| Create | `src/components/summary/ai-callout.tsx` | Reusable inline callout component |
| Modify | `src/components/main-tabs.tsx` | Wire AI banner + callouts into summary tab |
| Modify | `src/components/input/action-buttons.tsx` | Trigger `fetchAiSummary()` after `setResults()` |
| Modify | `src/components/print-report.tsx` | Add AI Analysis page to PDF report |

---

### Task 1: Install OpenAI SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install openai package**

Run from the `app/` directory:
```bash
npm install openai
```

- [ ] **Step 2: Verify installation**

Run: `node -e "require('openai'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add openai SDK dependency"
```

---

### Task 2: Auth Layer — `openai-auth.ts`

**Files:**
- Create: `src/lib/api/openai-auth.ts`
- Test: `src/__tests__/lib/api/openai-auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/api/openai-auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test resolveOpenAICredentials() which reads env vars and optionally ~/.codex/auth.json
// Since file system access is involved, we mock fs/promises

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'fs/promises';
import { resolveOpenAICredentials } from '@/lib/api/openai-auth';

const mockReadFile = vi.mocked(readFile);

describe('resolveOpenAICredentials', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_OAUTH_TOKEN;
    mockReadFile.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns platform key when OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test123';
    const creds = await resolveOpenAICredentials();
    expect(creds).toEqual({ type: 'platform', apiKey: 'sk-test123' });
  });

  it('returns oauth token when OPENAI_OAUTH_TOKEN is set', async () => {
    process.env.OPENAI_OAUTH_TOKEN = 'jwt-token-abc';
    const creds = await resolveOpenAICredentials();
    expect(creds).toEqual({ type: 'codex', token: 'jwt-token-abc', accountId: undefined });
  });

  it('prefers OPENAI_API_KEY over OPENAI_OAUTH_TOKEN', async () => {
    process.env.OPENAI_API_KEY = 'sk-test123';
    process.env.OPENAI_OAUTH_TOKEN = 'jwt-token-abc';
    const creds = await resolveOpenAICredentials();
    expect(creds.type).toBe('platform');
  });

  it('reads ~/.codex/auth.json when no env vars set', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      auth_mode: 'oauth',
      tokens: {
        access_token: 'jwt-from-file',
        refresh_token: 'refresh',
        account_id: 'acct-123',
      },
    }));
    const creds = await resolveOpenAICredentials();
    expect(creds).toEqual({ type: 'codex', token: 'jwt-from-file', accountId: 'acct-123' });
  });

  it('returns null when no credentials found', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const creds = await resolveOpenAICredentials();
    expect(creds).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/__tests__/lib/api/openai-auth.test.ts`
Expected: FAIL — module `@/lib/api/openai-auth` not found

- [ ] **Step 3: Write the implementation**

Create `src/lib/api/openai-auth.ts`:

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export type OpenAICredentials =
  | { type: 'platform'; apiKey: string }
  | { type: 'codex'; token: string; accountId: string | undefined }

export async function resolveOpenAICredentials(): Promise<OpenAICredentials | null> {
  // Priority 1: Platform API key
  if (process.env.OPENAI_API_KEY) {
    return { type: 'platform', apiKey: process.env.OPENAI_API_KEY };
  }

  // Priority 2: OAuth token from env
  if (process.env.OPENAI_OAUTH_TOKEN) {
    return { type: 'codex', token: process.env.OPENAI_OAUTH_TOKEN, accountId: undefined };
  }

  // Priority 3: Read from ~/.codex/auth.json
  try {
    const authPath = join(homedir(), '.codex', 'auth.json');
    const raw = await readFile(authPath, 'utf-8');
    const auth = JSON.parse(raw);
    const token = auth?.tokens?.access_token;
    if (token) {
      return { type: 'codex', token, accountId: auth.tokens.account_id };
    }
  } catch {
    // File not found or unreadable — fall through
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/__tests__/lib/api/openai-auth.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/openai-auth.ts src/__tests__/lib/api/openai-auth.test.ts
git commit -m "feat: add OpenAI credential resolution (Codex OAuth + platform key)"
```

---

### Task 3: OpenAI Client — `openai.ts`

**Files:**
- Create: `src/lib/api/openai.ts`
- Test: `src/__tests__/lib/api/openai.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/api/openai.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/openai-auth', () => ({
  resolveOpenAICredentials: vi.fn(),
}));

vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
      responses: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  };
});

import { resolveOpenAICredentials } from '@/lib/api/openai-auth';
import { callOpenAI } from '@/lib/api/openai';
import OpenAI from 'openai';

const mockResolve = vi.mocked(resolveOpenAICredentials);

describe('callOpenAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when no credentials found', async () => {
    mockResolve.mockResolvedValue(null);
    await expect(callOpenAI('system', 'user')).rejects.toThrow('No OpenAI credentials configured');
  });

  it('creates client with platform config when type is platform', async () => {
    mockResolve.mockResolvedValue({ type: 'platform', apiKey: 'sk-test' });

    // Mock the chat completions response
    const mockInstance = new OpenAI({ apiKey: 'test' });
    (mockInstance.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      choices: [{ message: { content: '{"overall":"test"}' } }],
    });
    vi.mocked(OpenAI).mockReturnValue(mockInstance as any);

    const result = await callOpenAI('system prompt', 'user prompt');
    expect(result).toBe('{"overall":"test"}');
    expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test' });
  });

  it('creates client with codex config when type is codex', async () => {
    mockResolve.mockResolvedValue({ type: 'codex', token: 'jwt-abc', accountId: 'acct-1' });

    const mockInstance = new OpenAI({ apiKey: 'test' });
    (mockInstance.responses.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"overall":"codex"}' }] }],
    });
    vi.mocked(OpenAI).mockReturnValue(mockInstance as any);

    const result = await callOpenAI('system prompt', 'user prompt');
    expect(result).toBe('{"overall":"codex"}');
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'jwt-abc',
      baseURL: 'https://chatgpt.com/backend-api/codex',
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/__tests__/lib/api/openai.test.ts`
Expected: FAIL — module `@/lib/api/openai` not found

- [ ] **Step 3: Write the implementation**

Create `src/lib/api/openai.ts`:

```typescript
import OpenAI from 'openai';
import { resolveOpenAICredentials } from './openai-auth';

export async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const creds = await resolveOpenAICredentials();
  if (!creds) {
    throw new Error(
      'No OpenAI credentials configured. Set OPENAI_API_KEY, OPENAI_OAUTH_TOKEN, or run `codex login`.'
    );
  }

  if (creds.type === 'platform') {
    const client = new OpenAI({ apiKey: creds.apiKey });
    const response = await client.chat.completions.create({
      model: 'gpt-5.4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    return response.choices[0].message.content ?? '';
  }

  // Codex OAuth path — uses Responses API
  const client = new OpenAI({
    apiKey: creds.token,
    baseURL: 'https://chatgpt.com/backend-api/codex',
    defaultHeaders: {
      version: '0.80.0',
      'x-codex-beta-features': 'unified_exec,shell_snapshot',
      originator: 'codex_exec',
      ...(creds.accountId ? { 'chatgpt-account-id': creds.accountId } : {}),
    },
  });

  const response = await client.responses.create({
    model: 'gpt-5.4',
    instructions: systemPrompt,
    input: userPrompt,
    text: { format: { type: 'json_object' } },
    temperature: 0.3,
  });

  const outputMessage = response.output.find((o: any) => o.type === 'message');
  const textBlock = outputMessage?.content?.find((c: any) => c.type === 'output_text');
  return textBlock?.text ?? '';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/__tests__/lib/api/openai.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/openai.ts src/__tests__/lib/api/openai.test.ts
git commit -m "feat: add OpenAI client with dual API surface (Codex + Platform)"
```

---

### Task 4: Prompt & Response Schema — `ai-summary-prompt.ts`

**Files:**
- Create: `src/lib/api/ai-summary-prompt.ts`

- [ ] **Step 1: Write the type and prompt builder**

Create `src/lib/api/ai-summary-prompt.ts`:

```typescript
export interface AiSummaryResponse {
  overall: string;
  callouts: {
    regime: string | null;
    freeboard: string | null;
    comparison: string | null;
    afflux: string | null;
    hecras: string | null;
  };
}

export const AI_SYSTEM_PROMPT = `You are a senior hydraulic engineer reviewing independent bridge loss calculations for QA verification of a HEC-RAS model.

Your audience is another hydraulic engineer. Use proper terminology: afflux, Froude number, freeboard, WSEL, pressure flow, overtopping. Be direct and specific — cite actual values from the data.

You will receive JSON containing bridge geometry, flow profiles, and results from four independent calculation methods (Energy, Momentum, Yarnell, WSPRO).

Respond with JSON matching this exact schema:
{
  "overall": "2-4 sentence executive summary of the most important findings",
  "callouts": {
    "regime": "1-2 sentence insight about flow regime classification, or null if unremarkable",
    "freeboard": "1-2 sentence insight about freeboard/clearance, or null if unremarkable",
    "comparison": "1-2 sentence insight about method agreement/divergence, or null if unremarkable",
    "afflux": "1-2 sentence insight about afflux trends across profiles, or null if unremarkable",
    "hecras": "1-2 sentence insight about HEC-RAS comparison, or null if no HEC-RAS data provided"
  }
}

Rules:
- Return null for any callout where there is nothing noteworthy. Do NOT manufacture concerns.
- Reference specific profile names, discharge values, and numeric results.
- Flag convergence failures, regime transitions, method divergence >10%, low/negative freeboard.
- Note if Yarnell results should be disregarded (only valid for free-surface flow).
- Keep each callout to 1-2 sentences. The overall summary should be 2-4 sentences.
- Return ONLY valid JSON. No markdown, no code fences.`;

export interface AiSummaryPayload {
  bridgeGeometry: {
    lowChordLeft: number;
    lowChordRight: number;
    highChord: number;
    span: number;
    pierCount: number;
    debrisBlockagePct: number;
  };
  flowProfiles: {
    name: string;
    ari: string;
    discharge: number;
    dsWsel: number;
  }[];
  methods: {
    [method: string]: {
      profileName: string;
      upstreamWsel: number;
      totalHeadLoss: number;
      approachVelocity: number;
      froudeApproach: number;
      flowRegime: string;
      converged: boolean;
      bridgeOpeningArea: number;
      tuflowPierFLC: number;
      tuflowSuperFLC: number | null;
      error: string | null;
    }[];
  };
  freeboard: {
    profileName: string;
    freeboard: number;
    status: string;
  }[] | null;
  hecRasComparison: {
    profileName: string;
    upstreamWsel: number | null;
    headLoss: number | null;
  }[] | null;
  sensitivityEnabled: boolean;
}

export function buildUserPrompt(payload: AiSummaryPayload): string {
  return JSON.stringify(payload);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/ai-summary-prompt.ts
git commit -m "feat: add AI summary prompt template and response schema"
```

---

### Task 5: API Route Handler — `route.ts`

**Files:**
- Create: `src/app/api/ai-summary/route.ts`

- [ ] **Step 1: Create the route handler**

Create `src/app/api/ai-summary/route.ts`:

```typescript
import { callOpenAI } from '@/lib/api/openai';
import { AI_SYSTEM_PROMPT, buildUserPrompt, type AiSummaryPayload, type AiSummaryResponse } from '@/lib/api/ai-summary-prompt';

export async function POST(request: Request) {
  try {
    const payload: AiSummaryPayload = await request.json();
    const userPrompt = buildUserPrompt(payload);
    const raw = await callOpenAI(AI_SYSTEM_PROMPT, userPrompt);

    const parsed: AiSummaryResponse = JSON.parse(raw);

    // Validate shape
    if (typeof parsed.overall !== 'string' || typeof parsed.callouts !== 'object') {
      return Response.json(
        { error: 'Invalid response structure from AI' },
        { status: 502 }
      );
    }

    return Response.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message.includes('No OpenAI credentials')) {
      return Response.json({ error: message }, { status: 401 });
    }

    console.error('AI summary error:', err);
    return Response.json(
      { error: `AI analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify the route is accessible**

Run: `cd app && npx next build 2>&1 | tail -20`
Expected: Build succeeds, `/api/ai-summary` route is listed

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai-summary/route.ts
git commit -m "feat: add POST /api/ai-summary route handler"
```

---

### Task 6: Zustand Store — Add AI Summary State

**Files:**
- Modify: `src/store/project-store.ts:14-40,72-83,85-121`

- [ ] **Step 1: Add AI summary types and state to the store**

In `src/store/project-store.ts`, add the import at the top:

```typescript
import type { AiSummaryResponse } from '@/lib/api/ai-summary-prompt';
```

Add to the `ProjectStore` interface (after line 24, before `updateCrossSection`):

```typescript
  aiSummary: AiSummaryResponse | null;
  aiSummaryLoading: boolean;
  aiSummaryError: string | null;
```

Add to the interface methods (after `setActiveMainTab`):

```typescript
  fetchAiSummary: () => Promise<void>;
  clearAiSummary: () => void;
```

Add to `initialState` (after `activeMainTab`):

```typescript
  aiSummary: null as AiSummaryResponse | null,
  aiSummaryLoading: false,
  aiSummaryError: null as string | null,
```

Add the action implementations inside `create<ProjectStore>((set, get) => ({`, after the `setActiveMainTab` action:

```typescript
  fetchAiSummary: async () => {
    const state = get();
    if (!state.results) return;

    set({ aiSummaryLoading: true, aiSummaryError: null, aiSummary: null });

    const bridge = state.bridgeGeometry;
    const payload = {
      bridgeGeometry: {
        lowChordLeft: bridge.lowChordLeft,
        lowChordRight: bridge.lowChordRight,
        highChord: bridge.highChord,
        span: bridge.rightAbutmentStation - bridge.leftAbutmentStation,
        pierCount: bridge.piers.length,
        debrisBlockagePct: state.coefficients.debrisBlockagePct,
      },
      flowProfiles: state.flowProfiles.map((p) => ({
        name: p.name,
        ari: p.ari,
        discharge: p.discharge,
        dsWsel: p.dsWsel,
      })),
      methods: Object.fromEntries(
        (['energy', 'momentum', 'yarnell', 'wspro'] as const).map((m) => [
          m,
          state.results![m].map((r) => ({
            profileName: r.profileName,
            upstreamWsel: r.upstreamWsel,
            totalHeadLoss: r.totalHeadLoss,
            approachVelocity: r.approachVelocity,
            froudeApproach: r.froudeApproach,
            flowRegime: r.flowRegime,
            converged: r.converged,
            bridgeOpeningArea: r.inputEcho.bridgeOpeningArea,
            tuflowPierFLC: r.tuflowPierFLC,
            tuflowSuperFLC: r.tuflowSuperFLC,
            error: r.error,
          })),
        ])
      ),
      freeboard: state.results!.energy.length > 0
        ? (() => {
            // Inline freeboard calc to avoid importing engine in store
            // We'll compute a simplified version from energy results
            const energyResults = state.results!.energy;
            return energyResults.map((r) => {
              const lowChord = Math.min(bridge.lowChordLeft, bridge.lowChordRight);
              const fb = lowChord - r.upstreamWsel;
              return {
                profileName: r.profileName,
                freeboard: fb,
                status: fb > 1 ? 'clear' : fb > 0 ? 'low' : r.flowRegime === 'overtopping' ? 'overtopping' : 'pressure',
              };
            });
          })()
        : null,
      hecRasComparison: state.hecRasComparison.length > 0
        ? state.hecRasComparison.map((c) => ({
            profileName: c.profileName,
            upstreamWsel: c.upstreamWsel,
            headLoss: c.headLoss,
          }))
        : null,
      sensitivityEnabled: state.coefficients.manningsNSensitivityPct != null &&
        state.coefficients.manningsNSensitivityPct > 0,
    };

    try {
      const response = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        set({ aiSummaryError: err.error || `HTTP ${response.status}`, aiSummaryLoading: false });
        return;
      }

      const data = await response.json();
      set({ aiSummary: data, aiSummaryLoading: false });
    } catch (err) {
      set({
        aiSummaryError: err instanceof Error ? err.message : 'Network error',
        aiSummaryLoading: false,
      });
    }
  },

  clearAiSummary: () => set({ aiSummary: null, aiSummaryLoading: false, aiSummaryError: null }),
```

Also update the `clearResults` action to also clear AI summary:

```typescript
  clearResults: () => set({ results: null, aiSummary: null, aiSummaryLoading: false, aiSummaryError: null }),
```

And update the `reset` action — `initialState` already includes the new fields so it will reset automatically.

- [ ] **Step 2: Verify the app compiles**

Run: `cd app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/store/project-store.ts
git commit -m "feat: add AI summary state and fetch action to Zustand store"
```

---

### Task 7: AI Summary Banner Component

**Files:**
- Create: `src/components/summary/ai-summary-banner.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/summary/ai-summary-banner.tsx`:

```typescript
'use client';

import { useProjectStore } from '@/store/project-store';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

export function AiSummaryBanner() {
  const aiSummary = useProjectStore((s) => s.aiSummary);
  const loading = useProjectStore((s) => s.aiSummaryLoading);
  const error = useProjectStore((s) => s.aiSummaryError);
  const [dismissed, setDismissed] = useState(false);

  if (!loading && !aiSummary && !error) return null;

  if (error && dismissed) return null;

  if (error) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 py-3 px-4">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-400 font-medium">AI analysis unavailable</p>
            <p className="text-xs text-amber-400/70 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setDismissed(true)} className="text-amber-400/50 hover:text-amber-400">
            <X className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4 px-4">
          <Sparkles className="h-4 w-4 text-primary animate-pulse mt-0.5 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-primary/10 animate-pulse" />
            <div className="h-3 w-full rounded bg-primary/10 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-primary/10 animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!aiSummary) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex items-start gap-3 py-4 px-4">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/60 mb-1.5">AI Analysis</p>
          <p className="text-sm text-foreground leading-relaxed">{aiSummary.overall}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/summary/ai-summary-banner.tsx
git commit -m "feat: add AI summary banner component with loading/error states"
```

---

### Task 8: AI Callout Component

**Files:**
- Create: `src/components/summary/ai-callout.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/summary/ai-callout.tsx`:

```typescript
'use client';

import { Sparkles } from 'lucide-react';

interface AiCalloutProps {
  text: string | null;
  loading: boolean;
}

export function AiCallout({ text, loading }: AiCalloutProps) {
  if (!loading && !text) return null;

  if (loading) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 mt-3">
        <Sparkles className="h-3.5 w-3.5 text-primary/40 animate-pulse mt-0.5 shrink-0" />
        <div className="h-3 w-2/3 rounded bg-primary/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 mt-3">
      <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
      <p className="text-sm text-foreground/80 leading-relaxed">{text}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/summary/ai-callout.tsx
git commit -m "feat: add reusable AI callout component"
```

---

### Task 9: Wire AI Components into Summary Tab

**Files:**
- Modify: `src/components/main-tabs.tsx:1-19,179-191`

- [ ] **Step 1: Add imports and wire up**

In `src/components/main-tabs.tsx`, add imports alongside the existing summary imports:

```typescript
import { AiSummaryBanner } from '@/components/summary/ai-summary-banner';
import { AiCallout } from '@/components/summary/ai-callout';
```

Replace the summary tab content (lines 179-191) with:

```tsx
      <TabsContent value="summary" className="flex-1 px-6 py-5 space-y-8">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Assessment Summary</h2>
          <p className="text-sm text-muted-foreground max-w-prose text-pretty">
            Independent bridge loss calculations for QA verification. Four methods are compared —
            significant divergence may indicate a flow regime transition and warrants investigation.
          </p>
        </div>
        <AiSummaryBanner />
        <div>
          <RegimeMatrix />
          <AiCallout
            text={useProjectStore.getState().aiSummary?.callouts.regime ?? null}
            loading={useProjectStore.getState().aiSummaryLoading}
          />
        </div>
        <div>
          <ComparisonTables />
          <AiCallout
            text={useProjectStore.getState().aiSummary?.callouts.comparison ?? null}
            loading={useProjectStore.getState().aiSummaryLoading}
          />
          <AiCallout
            text={useProjectStore.getState().aiSummary?.callouts.hecras ?? null}
            loading={useProjectStore.getState().aiSummaryLoading}
          />
        </div>
        <div>
          <AffluxCharts />
          <AiCallout
            text={useProjectStore.getState().aiSummary?.callouts.afflux ?? null}
            loading={useProjectStore.getState().aiSummaryLoading}
          />
        </div>
        <div>
          <FreeboardCheck />
          <AiCallout
            text={useProjectStore.getState().aiSummary?.callouts.freeboard ?? null}
            loading={useProjectStore.getState().aiSummaryLoading}
          />
        </div>
      </TabsContent>
```

**Important:** The above uses `useProjectStore.getState()` which won't re-render. We need to use hooks instead. Create a small wrapper inside `MainTabs` or extract the summary content. The cleanest approach: extract the summary tab body into its own component.

Create a `SummaryTab` component either inline in main-tabs.tsx or as a separate file. Since we want to keep changes minimal, add it inline at the bottom of `main-tabs.tsx`, before the default export or inside the file:

Actually, the simpler approach — use selectors in the existing `MainTabs` component. Add these selectors near the other store selectors:

```typescript
const aiSummary = useProjectStore((s) => s.aiSummary);
const aiLoading = useProjectStore((s) => s.aiSummaryLoading);
```

Then use `aiSummary?.callouts.regime ?? null` and `aiLoading` in the JSX.

The full updated summary tab JSX:

```tsx
      <TabsContent value="summary" className="flex-1 px-6 py-5 space-y-8">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Assessment Summary</h2>
          <p className="text-sm text-muted-foreground max-w-prose text-pretty">
            Independent bridge loss calculations for QA verification. Four methods are compared —
            significant divergence may indicate a flow regime transition and warrants investigation.
          </p>
        </div>
        <AiSummaryBanner />
        <div>
          <RegimeMatrix />
          <AiCallout text={aiSummary?.callouts.regime ?? null} loading={aiLoading} />
        </div>
        <div>
          <ComparisonTables />
          <AiCallout text={aiSummary?.callouts.comparison ?? null} loading={aiLoading} />
          <AiCallout text={aiSummary?.callouts.hecras ?? null} loading={aiLoading} />
        </div>
        <div>
          <AffluxCharts />
          <AiCallout text={aiSummary?.callouts.afflux ?? null} loading={aiLoading} />
        </div>
        <div>
          <FreeboardCheck />
          <AiCallout text={aiSummary?.callouts.freeboard ?? null} loading={aiLoading} />
        </div>
      </TabsContent>
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/main-tabs.tsx
git commit -m "feat: wire AI summary banner and callouts into summary tab"
```

---

### Task 10: Trigger AI Fetch After Calculations

**Files:**
- Modify: `src/components/input/action-buttons.tsx:72-93`

- [ ] **Step 1: Add fetchAiSummary to the run handler**

In `src/components/input/action-buttons.tsx`, add a new selector near line 24:

```typescript
const fetchAiSummary = useProjectStore((s) => s.fetchAiSummary);
const clearAiSummary = useProjectStore((s) => s.clearAiSummary);
```

In the `handleRunAll` function, add `clearAiSummary()` at the beginning (before `setIsProcessing(true)`) and `fetchAiSummary()` after `setActiveMainTab('summary')` inside the setTimeout callback. The fire-and-forget call to `fetchAiSummary()` should NOT be awaited — it runs in the background:

Updated `handleRunAll` (the setTimeout callback body):

```typescript
    setTimeout(() => {
      const calcResults = runAllMethods(crossSection, bridgeGeometry, flowProfiles, coefficients);
      setResults(calcResults);
      if (coefficients.manningsNSensitivityPct != null) {
        const sensResults = runWithSensitivity(crossSection, bridgeGeometry, flowProfiles, coefficients);
        setSensitivityResults(sensResults);
      } else {
        setSensitivityResults(null);
      }
      setIsProcessing(false);
      setActiveMainTab('summary');
      toast.success('Processing complete', {
        description: 'All methods have been calculated. Viewing summary.',
      });
      // Fire AI analysis in background — non-blocking
      fetchAiSummary();
    }, 50);
```

Also add `clearAiSummary();` at the start of `handleRunAll`, right after `setErrors([]);`:

```typescript
  function handleRunAll() {
    const validationErrors = validateInputs(crossSection, bridgeGeometry, flowProfiles);
    if (validationErrors.length > 0) { setErrors(validationErrors.map((e) => e.message)); return; }
    setErrors([]);
    clearAiSummary();
    setIsProcessing(true);
    // ... rest unchanged
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/input/action-buttons.tsx
git commit -m "feat: trigger AI summary fetch automatically after calculations"
```

---

### Task 11: Add AI Analysis to Print Report

**Files:**
- Modify: `src/components/print-report.tsx:78-84,345-349`

- [ ] **Step 1: Add AI summary to the print report**

In `src/components/print-report.tsx`, add a store selector for AI summary near the other selectors (around line 84):

```typescript
const aiSummary = useProjectStore((s) => s.aiSummary);
const aiSummaryLoading = useProjectStore((s) => s.aiSummaryLoading);
```

Add a new page before the closing `</div>` of the print-report (before line 347), after the Method Comparison page:

```tsx
      {/* ═══ PAGE: AI Analysis ═══ */}
      {(aiSummary || aiSummaryLoading) && results && (
        <Page section="AI Analysis" page={nextPage()} date={date} reportTitle={title}>
          <SectionTitle number={6} title="AI Analysis" />
          <SectionDesc>
            Automated review of calculation results by AI. This analysis is supplementary —
            engineering judgement should always take precedence.
          </SectionDesc>

          {aiSummaryLoading ? (
            <p className="text-[10px] text-gray-400 italic mt-2">AI analysis pending…</p>
          ) : aiSummary ? (
            <div className="space-y-3 mt-2">
              <div>
                <h3 className="text-[11px] font-semibold text-gray-700 mb-1">Summary</h3>
                <p className="text-[10px] text-gray-600 leading-snug max-w-[160mm]">{aiSummary.overall}</p>
              </div>

              {aiSummary.callouts.regime && (
                <div>
                  <h3 className="text-[10px] font-semibold text-gray-600 mb-0.5">Flow Regime</h3>
                  <p className="text-[10px] text-gray-500 leading-snug max-w-[160mm]">{aiSummary.callouts.regime}</p>
                </div>
              )}

              {aiSummary.callouts.freeboard && (
                <div>
                  <h3 className="text-[10px] font-semibold text-gray-600 mb-0.5">Freeboard</h3>
                  <p className="text-[10px] text-gray-500 leading-snug max-w-[160mm]">{aiSummary.callouts.freeboard}</p>
                </div>
              )}

              {aiSummary.callouts.comparison && (
                <div>
                  <h3 className="text-[10px] font-semibold text-gray-600 mb-0.5">Method Comparison</h3>
                  <p className="text-[10px] text-gray-500 leading-snug max-w-[160mm]">{aiSummary.callouts.comparison}</p>
                </div>
              )}

              {aiSummary.callouts.afflux && (
                <div>
                  <h3 className="text-[10px] font-semibold text-gray-600 mb-0.5">Afflux Trends</h3>
                  <p className="text-[10px] text-gray-500 leading-snug max-w-[160mm]">{aiSummary.callouts.afflux}</p>
                </div>
              )}

              {aiSummary.callouts.hecras && (
                <div>
                  <h3 className="text-[10px] font-semibold text-gray-600 mb-0.5">HEC-RAS Comparison</h3>
                  <p className="text-[10px] text-gray-500 leading-snug max-w-[160mm]">{aiSummary.callouts.hecras}</p>
                </div>
              )}

              <p className="text-[8px] text-gray-300 italic mt-4">
                Generated by GPT-5.4. This analysis is for reference only and does not constitute engineering advice.
              </p>
            </div>
          ) : null}
        </Page>
      )}
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd app && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/print-report.tsx
git commit -m "feat: add AI analysis page to PDF print report"
```

---

### Task 12: End-to-End Smoke Test

- [ ] **Step 1: Run all existing tests**

Run: `cd app && npx vitest run`
Expected: All tests pass (no regressions)

- [ ] **Step 2: Manual smoke test**

Run: `cd app && npm run dev`

1. Open the app in browser
2. Load a test bridge
3. Click "Run All Methods"
4. Verify: navigates to Summary tab, AI banner shows loading skeleton
5. Verify: callout skeletons appear below each section
6. Wait for AI response (or verify error banner if no credentials configured)
7. If AI responds: verify banner shows overall summary, callouts appear below relevant sections
8. Click "PDF" button — verify AI Analysis page appears in print preview
9. Re-run calculations — verify AI state clears and re-fetches

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete AI report summary integration"
```
