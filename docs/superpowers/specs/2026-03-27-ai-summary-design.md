# AI Report Summary — Design Spec

## Overview

Add AI-powered analysis to the Bridge Hydraulic Loss Calculator's summary page and PDF report. The AI summary provides an executive overview and contextual inline callouts next to each summary component, giving engineers specific insights about their calculation results — validating data, flagging concerns, and highlighting noteworthy patterns.

The AI analysis is non-blocking: it triggers automatically after calculations complete and loads asynchronously while all existing components render immediately.

## Auth & API Layer

### Files
- `src/lib/api/openai-auth.ts` — credential resolution
- `src/lib/api/openai.ts` — client initialization + `callOpenAI()`
- `src/app/api/ai-summary/route.ts` — Next.js POST route handler

### Auth Priority
1. **`OPENAI_API_KEY`** env var — standard Platform API key (required for Vercel)
2. **`OPENAI_OAUTH_TOKEN`** env var — Codex OAuth token (expires daily)
3. **`~/.codex/auth.json`** — auto-reads Codex OAuth token from disk (local dev only, written by `codex login`)
4. **Error** — returns error asking user to configure auth

### Deployment

- **Local dev:** No env vars needed. Run `codex login` to write `~/.codex/auth.json` — the auth layer reads it automatically.
- **Vercel:** Set `OPENAI_API_KEY` in the Vercel project environment variables. The Codex file path is not available in serverless environments.

See `app/.env.example` for reference.

### Codex OAuth Client Config
```typescript
const client = new OpenAI({
  apiKey: token,           // JWT access_token from auth.json
  baseURL: "https://chatgpt.com/backend-api/codex",
  defaultHeaders: {
    version: "0.80.0",
    "x-codex-beta-features": "unified_exec,shell_snapshot",
    originator: "codex_exec",
    "chatgpt-account-id": accountId,
  },
});
```

### Dual API Surface
- **Codex OAuth** → Responses API at `chatgpt.com/backend-api/codex`
- **Platform key** → Chat Completions API at `api.openai.com`

The `callOpenAI()` function handles both paths transparently.

### Model
`gpt-5.4`

### Route Handler
`POST /api/ai-summary` accepts calculation data as JSON body, constructs the prompt, calls OpenAI, returns structured AI response. No streaming for v1.

## Prompt Design

### System Prompt
Instructs the model to act as a senior hydraulic engineer reviewing bridge loss calculations. Direct tone, proper terminology (afflux, Froude, freeboard, etc.), flag concerns without hedging.

### User Prompt Payload
JSON containing:
- Bridge geometry (span, low/high chord, piers, debris blockage)
- Flow profiles (Q, ARI, downstream WSEL, slope)
- All 4 method results per profile (US WSEL, afflux, velocities, Froude, regime, convergence status)
- Freeboard values and status
- HEC-RAS comparison values and % differences (if entered)
- Sensitivity bounds (if enabled)

### Response Schema
```typescript
interface AiSummaryResponse {
  overall: string;              // 2-4 sentence executive summary
  callouts: {
    regime: string | null;      // Regime matrix insight
    freeboard: string | null;   // Freeboard insight
    comparison: string | null;  // Method agreement/divergence insight
    afflux: string | null;      // Afflux trend insight
    hecras: string | null;      // HEC-RAS comparison insight (null if no data)
  };
}
```

The prompt explicitly instructs: return `null` for any callout where there's nothing noteworthy. Each callout is 1-2 sentences max. The overall summary highlights the most important findings across all data.

## State Management

### Zustand Store Additions (`project-store.ts`)

```typescript
// State
aiSummary: AiSummaryResponse | null
aiSummaryLoading: boolean
aiSummaryError: string | null

// Actions
fetchAiSummary: () => Promise<void>
clearAiSummary: () => void
```

### Trigger Flow
1. User clicks "Run" in `action-buttons.tsx`
2. Calculations execute, `setResults()` is called
3. Immediately after `setResults()`, `fetchAiSummary()` fires automatically
4. Sets `aiSummaryLoading: true`, serializes relevant store data, POSTs to `/api/ai-summary`
5. On success: sets `aiSummary` with parsed response, `aiSummaryLoading: false`
6. On error: sets `aiSummaryError` with user-friendly message, `aiSummaryLoading: false`
7. On re-run: `clearAiSummary()` fires first, then cycle repeats

The AI request never blocks navigation or rendering.

## UI Components & Placement

### New Components

**`src/components/summary/ai-summary-banner.tsx`**
- Main summary block at the **top of the summary tab**, above all other components
- Displays `overall` text with an "AI Analysis" label
- Loading state: pulsing skeleton block
- Error state: dismissible banner with error message

**`src/components/summary/ai-callout.tsx`**
- Reusable inline callout component
- Props: `text: string | null`, `loading: boolean`
- Non-null text: compact card with colored left accent border
- Loading: single-line skeleton
- Null: renders nothing

### Callout Placement (Summary Tab)

| Callout key  | Placement                                                      |
|-------------|----------------------------------------------------------------|
| `regime`     | Below the regime matrix component                              |
| `freeboard`  | Below the freeboard check table                                |
| `comparison` | Below the comparison tables                                    |
| `afflux`     | Below the afflux charts                                        |
| `hecras`     | Below the HEC-RAS comparison rows (only if HEC-RAS data exists)|

### Callout Styling
- Muted background with colored left border
- Amber for concerns/warnings, blue for informational insights
- Consistent with existing Tailwind/shadcn patterns

### Print Report

New "AI Analysis" page in `print-report.tsx`, placed after method comparison pages:
- Contains `overall` summary text
- Lists all non-null callouts with section labels
- If `aiSummaryLoading` still true at print time: shows "AI analysis pending..."
- If `aiSummaryError` or no AI data: page is omitted entirely
