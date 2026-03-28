# Method Suitability & Callout Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic method applicability flags, AI suitability assessment, and lighten inline AI callouts in the Summary tab.

**Architecture:** Three independent changes: (1) a pure-logic engine module assessing method suitability from results data, (2) an AI prompt update adding a suitability callout, (3) a visual cleanup replacing card-style inline callouts with lighter text-only variants. The suitability engine has no React dependency; the UI components consume its output.

**Tech Stack:** React 19, Zustand, Tailwind CSS v4, Vitest, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-03-29-method-suitability-and-callout-cleanup-design.md`

**IMPORTANT:** This project uses Next.js 16. All new components must be `'use client'`.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/engine/method-suitability.ts` | Pure logic: assess method applicability from results + geometry |
| `src/__tests__/engine/method-suitability.test.ts` | Tests for suitability rules |
| `src/components/summary/method-suitability.tsx` | UI: render applicability flags |

### Modified files
| File | Change |
|------|--------|
| `src/components/summary/ai-callout.tsx` | Add `AiCalloutInline` and `AiCalloutGroupedInline` exports |
| `src/components/summary/ai-summary-banner.tsx` | Add suitability section between findings and recommendations |
| `src/lib/api/ai-summary-prompt.ts` | Add `suitability` to `AiSummaryResponse` type and prompt text |
| `src/components/main-tabs.tsx` | Switch callouts to inline variants; add `MethodSuitability` component |

---

## Task 1: Method Suitability Engine

Build the pure-logic module that assesses method applicability from results.

**Files:**
- Create: `src/engine/method-suitability.ts`
- Create: `src/__tests__/engine/method-suitability.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/engine/method-suitability.test.ts
import { describe, it, expect } from 'vitest';
import { assessMethodSuitability, type MethodFlag } from '@/engine/method-suitability';
import type { CalculationResults, BridgeGeometry, MethodResult } from '@/engine/types';

function makeResult(overrides: Partial<MethodResult> = {}): MethodResult {
  return {
    profileName: 'Q100',
    upstreamWsel: 102,
    totalHeadLoss: 0.5,
    approachVelocity: 2.0,
    bridgeVelocity: 3.0,
    froudeApproach: 0.4,
    froudeBridge: 0.5,
    flowRegime: 'free-surface',
    flowCalculationType: 'free-surface',
    iterationLog: [],
    converged: true,
    calculationSteps: [],
    tuflowPierFLC: 0,
    tuflowSuperFLC: null,
    inputEcho: {
      flowArea: 100,
      hydraulicRadius: 2,
      bridgeOpeningArea: 60,
      pierBlockage: 5,
    },
    error: null,
    ...overrides,
  };
}

const BRIDGE: BridgeGeometry = {
  lowChordLeft: 103, lowChordRight: 103, highChord: 105,
  leftAbutmentStation: 30, rightAbutmentStation: 70,
  skewAngle: 0, contractionLength: 50, expansionLength: 50,
  orificeCd: 0.8, weirCw: 1.4, deckWidth: 10,
  piers: [{ station: 50, width: 2, shape: 'round-nose' }],
  lowChordProfile: [],
};

describe('assessMethodSuitability', () => {
  it('returns OK for all methods when conditions are normal', () => {
    const results: CalculationResults = {
      energy: [makeResult()],
      momentum: [makeResult()],
      yarnell: [makeResult()],
      wspro: [makeResult()],
    };
    const flags = assessMethodSuitability(results, BRIDGE);
    expect(flags.every(f => f.level === 'ok')).toBe(true);
  });

  it('flags Yarnell as not-applicable under pressure flow', () => {
    const results: CalculationResults = {
      energy: [makeResult({ flowRegime: 'pressure' })],
      momentum: [makeResult({ flowRegime: 'pressure' })],
      yarnell: [makeResult({ flowRegime: 'pressure', error: 'Not Applicable' })],
      wspro: [makeResult({ flowRegime: 'pressure' })],
    };
    const flags = assessMethodSuitability(results, BRIDGE);
    const yarnell = flags.find(f => f.method === 'yarnell');
    expect(yarnell?.level).toBe('not-applicable');
    expect(yarnell?.reason).toContain('Pressure');
  });

  it('flags Energy as caution when Froude is high', () => {
    const results: CalculationResults = {
      energy: [makeResult({ froudeApproach: 0.85 })],
      momentum: [makeResult()],
      yarnell: [makeResult()],
      wspro: [makeResult()],
    };
    const flags = assessMethodSuitability(results, BRIDGE);
    const energy = flags.find(f => f.method === 'energy');
    expect(energy?.level).toBe('caution');
    expect(energy?.reason).toContain('Froude');
  });

  it('flags methods with errors as error level', () => {
    const results: CalculationResults = {
      energy: [makeResult({ error: 'Diverged' })],
      momentum: [makeResult()],
      yarnell: [makeResult()],
      wspro: [makeResult()],
    };
    const flags = assessMethodSuitability(results, BRIDGE);
    const energy = flags.find(f => f.method === 'energy');
    expect(energy?.level).toBe('error');
    expect(energy?.reason).toBe('Diverged');
  });

  it('flags non-converged methods as caution', () => {
    const results: CalculationResults = {
      energy: [makeResult({ converged: false })],
      momentum: [makeResult()],
      yarnell: [makeResult()],
      wspro: [makeResult()],
    };
    const flags = assessMethodSuitability(results, BRIDGE);
    const energy = flags.find(f => f.method === 'energy');
    expect(energy?.level).toBe('caution');
    expect(energy?.reason).toContain('converge');
  });

  it('uses worst-case profile for flags', () => {
    const results: CalculationResults = {
      energy: [
        makeResult({ profileName: 'Q10', froudeApproach: 0.3 }),
        makeResult({ profileName: 'Q100', froudeApproach: 0.9 }),
      ],
      momentum: [makeResult(), makeResult()],
      yarnell: [makeResult(), makeResult()],
      wspro: [makeResult(), makeResult()],
    };
    const flags = assessMethodSuitability(results, BRIDGE);
    const energy = flags.find(f => f.method === 'energy');
    expect(energy?.level).toBe('caution');
    expect(energy?.profile).toBe('Q100');
  });

  it('flags WSPRO as caution for severe constriction', () => {
    const results: CalculationResults = {
      energy: [makeResult({ inputEcho: { flowArea: 100, hydraulicRadius: 2, bridgeOpeningArea: 20, pierBlockage: 5 } })],
      momentum: [makeResult()],
      yarnell: [makeResult()],
      wspro: [makeResult()],
    };
    const flags = assessMethodSuitability(results, BRIDGE);
    const wspro = flags.find(f => f.method === 'wspro');
    expect(wspro?.level).toBe('caution');
    expect(wspro?.reason).toContain('constriction');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/__tests__/engine/method-suitability.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the suitability engine**

```typescript
// src/engine/method-suitability.ts
import type { CalculationResults, BridgeGeometry, MethodResult } from './types';

export type SuitabilityLevel = 'ok' | 'caution' | 'not-applicable' | 'error';

export interface MethodFlag {
  method: 'energy' | 'momentum' | 'yarnell' | 'wspro';
  level: SuitabilityLevel;
  reason: string | null;
  profile: string;
}

const LEVEL_PRIORITY: Record<SuitabilityLevel, number> = {
  ok: 0,
  caution: 1,
  'not-applicable': 2,
  error: 3,
};

type MethodKey = 'energy' | 'momentum' | 'yarnell' | 'wspro';

interface Check {
  level: SuitabilityLevel;
  reason: string;
  profile: string;
}

function worstCheck(checks: Check[]): { level: SuitabilityLevel; reason: string | null; profile: string } {
  if (checks.length === 0) return { level: 'ok', reason: null, profile: '' };
  checks.sort((a, b) => LEVEL_PRIORITY[b.level] - LEVEL_PRIORITY[a.level]);
  return checks[0];
}

function checkEnergy(results: MethodResult[]): Check[] {
  const checks: Check[] = [];
  for (const r of results) {
    if (r.error) {
      checks.push({ level: 'error', reason: r.error, profile: r.profileName });
      continue;
    }
    if (!r.converged) {
      checks.push({ level: 'caution', reason: `Did not converge for ${r.profileName}`, profile: r.profileName });
    }
    if (r.froudeApproach > 0.8) {
      checks.push({ level: 'caution', reason: `High approach Froude (${r.froudeApproach.toFixed(2)}) for ${r.profileName}`, profile: r.profileName });
    }
    if (r.froudeBridge > 0.9) {
      checks.push({ level: 'caution', reason: `High bridge Froude (${r.froudeBridge.toFixed(2)}) for ${r.profileName}`, profile: r.profileName });
    }
  }
  return checks;
}

function checkMomentum(results: MethodResult[]): Check[] {
  const checks: Check[] = [];
  for (const r of results) {
    if (r.error) {
      checks.push({ level: 'error', reason: r.error, profile: r.profileName });
      continue;
    }
    if (!r.converged) {
      checks.push({ level: 'caution', reason: `Did not converge for ${r.profileName}`, profile: r.profileName });
    }
    if (r.froudeBridge > 0.9) {
      checks.push({ level: 'caution', reason: `High bridge Froude (${r.froudeBridge.toFixed(2)}) for ${r.profileName}`, profile: r.profileName });
    }
  }
  return checks;
}

function checkYarnell(results: MethodResult[], allResults: CalculationResults): Check[] {
  const checks: Check[] = [];
  // Yarnell validity depends on flow regime from any method — use energy as reference
  const refResults = allResults.energy.length > 0 ? allResults.energy : results;
  for (const r of refResults) {
    if (r.flowRegime !== 'free-surface') {
      checks.push({
        level: 'not-applicable',
        reason: `${r.flowRegime === 'pressure' ? 'Pressure' : 'Overtopping'} flow detected for ${r.profileName}`,
        profile: r.profileName,
      });
    }
  }
  for (const r of results) {
    if (r.error) {
      checks.push({ level: 'error', reason: r.error, profile: r.profileName });
    }
  }
  // Check pier blockage ratio
  for (const r of results) {
    if (r.error) continue;
    const gross = r.inputEcho.bridgeOpeningArea + r.inputEcho.pierBlockage;
    if (gross > 0) {
      const ratio = r.inputEcho.pierBlockage / gross;
      if (ratio > 0.15) {
        checks.push({
          level: 'caution',
          reason: `High pier blockage (${(ratio * 100).toFixed(0)}%) for ${r.profileName}`,
          profile: r.profileName,
        });
      }
    }
  }
  return checks;
}

function checkWspro(results: MethodResult[], allResults: CalculationResults): Check[] {
  const checks: Check[] = [];
  for (const r of results) {
    if (r.error) {
      checks.push({ level: 'error', reason: r.error, profile: r.profileName });
      continue;
    }
    if (!r.converged) {
      checks.push({ level: 'caution', reason: `Did not converge for ${r.profileName}`, profile: r.profileName });
    }
  }
  // Check opening ratio from energy results (most reliable area calc)
  const energyRef = allResults.energy[0];
  if (energyRef && !energyRef.error && energyRef.inputEcho.flowArea > 0) {
    const openingRatio = energyRef.inputEcho.bridgeOpeningArea / energyRef.inputEcho.flowArea;
    if (openingRatio < 0.3) {
      checks.push({
        level: 'caution',
        reason: `Severe constriction (opening ratio ${(openingRatio * 100).toFixed(0)}%)`,
        profile: energyRef.profileName,
      });
    }
  }
  return checks;
}

/**
 * Assess method suitability based on results and bridge geometry.
 * Returns one flag per method with the worst-case level across all profiles.
 */
export function assessMethodSuitability(
  results: CalculationResults,
  _bridge: BridgeGeometry
): MethodFlag[] {
  const methods: Array<{ key: MethodKey; check: () => Check[] }> = [
    { key: 'energy', check: () => checkEnergy(results.energy) },
    { key: 'momentum', check: () => checkMomentum(results.momentum) },
    { key: 'yarnell', check: () => checkYarnell(results.yarnell, results) },
    { key: 'wspro', check: () => checkWspro(results.wspro, results) },
  ];

  return methods.map(({ key, check }) => {
    if (results[key].length === 0) {
      return { method: key, level: 'ok' as SuitabilityLevel, reason: null, profile: '' };
    }
    const worst = worstCheck(check());
    return { method: key, level: worst.level, reason: worst.reason, profile: worst.profile };
  });
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && npx vitest run src/__tests__/engine/method-suitability.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/engine/method-suitability.ts src/__tests__/engine/method-suitability.test.ts
git commit -m "feat: add deterministic method suitability engine"
```

---

## Task 2: Method Suitability UI Component

**Files:**
- Create: `src/components/summary/method-suitability.tsx`
- Modify: `src/components/main-tabs.tsx`

- [ ] **Step 1: Create the suitability UI component**

```typescript
// src/components/summary/method-suitability.tsx
'use client';

import { useMemo } from 'react';
import { useProjectStore } from '@/store/project-store';
import { assessMethodSuitability, type MethodFlag, type SuitabilityLevel } from '@/engine/method-suitability';
import { ShieldCheck, ShieldAlert, ShieldX, ShieldOff } from 'lucide-react';

const METHOD_LABELS: Record<string, string> = {
  energy: 'Energy',
  momentum: 'Momentum',
  yarnell: 'Yarnell',
  wspro: 'WSPRO',
};

const LEVEL_CONFIG: Record<SuitabilityLevel, {
  icon: typeof ShieldCheck;
  dotColor: string;
  textColor: string;
  label: string;
}> = {
  ok: { icon: ShieldCheck, dotColor: 'bg-emerald-500', textColor: 'text-emerald-400', label: 'OK' },
  caution: { icon: ShieldAlert, dotColor: 'bg-amber-500', textColor: 'text-amber-400', label: 'Caution' },
  'not-applicable': { icon: ShieldOff, dotColor: 'bg-red-500', textColor: 'text-red-400', label: 'N/A' },
  error: { icon: ShieldX, dotColor: 'bg-red-500', textColor: 'text-red-400', label: 'Error' },
};

export function MethodSuitability() {
  const results = useProjectStore((s) => s.results);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const coefficients = useProjectStore((s) => s.coefficients);

  const flags = useMemo(() => {
    if (!results) return [];
    return assessMethodSuitability(results, bridgeGeometry);
  }, [results, bridgeGeometry]);

  // Only show methods that were actually run
  const activeFlags = flags.filter(
    (f) => coefficients.methodsToRun[f.method] && results?.[f.method]?.length
  );

  if (activeFlags.length === 0) return null;

  // Don't show if everything is OK — only show when there's something noteworthy
  const hasIssues = activeFlags.some((f) => f.level !== 'ok');
  if (!hasIssues) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Method Applicability</div>
      <div className="flex flex-wrap gap-2">
        {activeFlags.map((flag) => {
          const config = LEVEL_CONFIG[flag.level];
          return (
            <div
              key={flag.method}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-2.5 py-1.5"
            >
              <div className={`h-2 w-2 rounded-full ${config.dotColor} shrink-0`} />
              <span className="text-xs font-medium text-foreground">{METHOD_LABELS[flag.method]}</span>
              {flag.reason && (
                <span className={`text-[11px] ${config.textColor}`}>{flag.reason}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add MethodSuitability to main-tabs**

In `src/components/main-tabs.tsx`, add import:
```typescript
import { MethodSuitability } from '@/components/summary/method-suitability';
```

Then add the component after `<AiSummaryBanner />` in the summary TabsContent:
```tsx
<AiSummaryBanner />
<MethodSuitability />
```

- [ ] **Step 3: Build check**

Run: `cd app && npm run build`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add src/components/summary/method-suitability.tsx src/components/main-tabs.tsx
git commit -m "feat: add method applicability flags to Summary tab"
```

---

## Task 3: Inline Callout Variants

Replace the card-style AI callouts with lighter inline text.

**Files:**
- Modify: `src/components/summary/ai-callout.tsx`
- Modify: `src/components/main-tabs.tsx`

- [ ] **Step 1: Add AiCalloutInline to ai-callout.tsx**

Add after the existing `AiCalloutGrouped` export, before the closing of the file:

```typescript
/**
 * Lightweight inline callout — no card border, no background, just annotated text.
 * Used for section-level callouts that sit inside existing summary components.
 */
export function AiCalloutInline({ text, loading }: AiCalloutProps) {
  const hasContent = loading || (text && (!Array.isArray(text) || text.length > 0));

  return (
    <AnimatedCallout visible={!!hasContent}>
      {loading ? (
        <div className="border-l-2 border-primary/20 pl-3 py-1">
          <div className="space-y-1.5">
            <div className="h-2.5 w-20 rounded bg-primary/10 animate-pulse" />
            <div className="h-2.5 w-full rounded bg-primary/10 animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="border-l-2 border-primary/20 pl-3 py-1">
          <ul className="space-y-0.5">
            {(Array.isArray(text) ? text : [text!]).map((item, i) => (
              <li key={i} className="text-xs text-foreground/70 leading-relaxed flex items-baseline gap-1.5">
                <span className="text-primary/30 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AnimatedCallout>
  );
}

/**
 * Lightweight grouped inline callout — multiple labelled sections with left border accent.
 */
export function AiCalloutGroupedInline({ sections, loading }: { sections: AiCalloutSection[]; loading: boolean }) {
  const activeSections = sections.filter((s) => s.text && (!Array.isArray(s.text) || s.text.length > 0));
  const hasContent = loading || activeSections.length > 0;

  return (
    <AnimatedCallout visible={hasContent}>
      {loading ? (
        <div className="border-l-2 border-primary/20 pl-3 py-1">
          <div className="space-y-1.5">
            <div className="h-2.5 w-20 rounded bg-primary/10 animate-pulse" />
            <div className="h-2.5 w-full rounded bg-primary/10 animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="border-l-2 border-primary/20 pl-3 py-1 space-y-2">
          {activeSections.map((section, i) => {
            const items = Array.isArray(section.text) ? section.text : [section.text!];
            return (
              <div key={section.label}>
                {i > 0 && <div className="border-t border-border/20 mb-1.5" />}
                <p className="text-[10px] font-medium text-primary/50 mb-0.5">{section.label}</p>
                <ul className="space-y-0.5">
                  {items.map((item, j) => (
                    <li key={j} className="text-xs text-foreground/70 leading-relaxed flex items-baseline gap-1.5">
                      <span className="text-primary/30 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </AnimatedCallout>
  );
}
```

- [ ] **Step 2: Switch main-tabs to use inline variants**

In `src/components/main-tabs.tsx`, update the import:
```typescript
import { AiCalloutInline, AiCalloutGroupedInline } from '@/components/summary/ai-callout';
```

Remove the old `AiCallout` and `AiCalloutGrouped` imports (they may still be used elsewhere — check first; if not used, remove entirely from the import).

Then replace the callout usages in the summary TabsContent:

Change:
```tsx
<AiCallout text={aiSummary?.callouts.geometry ?? null} loading={aiLoading} />
```
To:
```tsx
<AiCalloutInline text={aiSummary?.callouts.geometry ?? null} loading={aiLoading} />
```

Change:
```tsx
<RegimeMatrix callout={<AiCallout text={aiSummary?.callouts.regime ?? null} loading={aiLoading} />} />
```
To:
```tsx
<RegimeMatrix callout={<AiCalloutInline text={aiSummary?.callouts.regime ?? null} loading={aiLoading} />} />
```

Change:
```tsx
<ComparisonTables callout={
  <AiCalloutGrouped
    loading={aiLoading}
    sections={[...]}
  />
} />
```
To:
```tsx
<ComparisonTables callout={
  <AiCalloutGroupedInline
    loading={aiLoading}
    sections={[
      { label: 'Method Agreement', text: aiSummary?.callouts.comparison ?? null },
      { label: 'Coefficients', text: aiSummary?.callouts.coefficients ?? null },
      { label: 'HEC-RAS Comparison', text: aiSummary?.callouts.hecras ?? null },
    ]}
  />
} />
```

Change:
```tsx
<AffluxCharts callout={<AiCallout text={aiSummary?.callouts.afflux ?? null} loading={aiLoading} />} />
```
To:
```tsx
<AffluxCharts callout={<AiCalloutInline text={aiSummary?.callouts.afflux ?? null} loading={aiLoading} />} />
```

Change:
```tsx
<FreeboardCheck callout={<AiCallout text={aiSummary?.callouts.freeboard ?? null} loading={aiLoading} />} />
```
To:
```tsx
<FreeboardCheck callout={<AiCalloutInline text={aiSummary?.callouts.freeboard ?? null} loading={aiLoading} />} />
```

- [ ] **Step 3: Build check**

Run: `cd app && npm run build`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add src/components/summary/ai-callout.tsx src/components/main-tabs.tsx
git commit -m "feat: replace card-style AI callouts with lighter inline variants"
```

---

## Task 4: AI Suitability Prompt & Banner Update

Add the suitability callout to the AI prompt and display it in the summary banner.

**Files:**
- Modify: `src/lib/api/ai-summary-prompt.ts`
- Modify: `src/components/summary/ai-summary-banner.tsx`

- [ ] **Step 1: Update AiSummaryResponse type**

In `src/lib/api/ai-summary-prompt.ts`, add `suitability` to the callouts interface:

```typescript
export interface AiSummaryResponse {
  overall: string[];
  recommendations: string[];
  callouts: {
    geometry: string[] | null;
    coefficients: string[] | null;
    regime: string[] | null;
    freeboard: string[] | null;
    comparison: string[] | null;
    afflux: string[] | null;
    hecras: string[] | null;
    suitability: string[] | null;
  };
}
```

- [ ] **Step 2: Add suitability section to AI prompt**

In the same file, find the `AI_SYSTEM_PROMPT` string. After the `"hecras"` section and before the `═══ RULES ═══` line, add:

```
"suitability" — Method applicability assessment:
- Assess which of the four methods (Energy, Momentum, Yarnell, WSPRO) are appropriate for this specific bridge geometry and flow conditions.
- Yarnell is only valid for free-surface flow with moderate pier blockage (< 15%). Flag if used outside this range.
- Energy method assumes gradual transitions and becomes less reliable at high Froude numbers (> 0.8).
- Momentum is generally more robust for abrupt contractions but assumes hydrostatic pressure distribution.
- WSPRO is designed for wide floodplain bridges with moderate constriction; less reliable for severely constricted openings (opening ratio < 0.3).
- State which methods you would trust most for this analysis and why. 1-3 bullets.
- If all methods are appropriate, return null.
```

Also update the JSON schema example in the prompt to include `"suitability": ["..."] or null`.

- [ ] **Step 3: Update the summary banner to show suitability**

In `src/components/summary/ai-summary-banner.tsx`, add the suitability section between the overall findings and recommendations.

After the overall findings `</div>` and before the recommendations section, add:

```tsx
{/* Method suitability — AI assessment */}
{aiSummary.callouts.suitability && aiSummary.callouts.suitability.length > 0 && (
  <div className="flex items-start gap-3 border-t border-primary/10 pt-3">
    <ShieldAlert className="h-4 w-4 text-primary/60 mt-0.5 shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary/60 mb-1.5">Method Suitability</p>
      <ul className="space-y-1">
        {aiSummary.callouts.suitability.map((item, i) => (
          <li key={i} className="text-sm text-foreground/90 leading-relaxed flex items-baseline gap-2">
            <span className="text-primary/40 shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
)}
```

Add the `ShieldAlert` import to the lucide imports:
```typescript
import { Sparkles, AlertTriangle, X, ShieldAlert } from 'lucide-react';
```

- [ ] **Step 4: Build check**

Run: `cd app && npm run build`
Expected: Clean build

- [ ] **Step 5: Run all tests**

Run: `cd app && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/ai-summary-prompt.ts src/components/summary/ai-summary-banner.tsx
git commit -m "feat: add AI method suitability assessment to summary banner"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Suitability engine + tests | `method-suitability.ts`, tests |
| 2 | Suitability UI component | `method-suitability.tsx`, `main-tabs.tsx` |
| 3 | Inline callout variants | `ai-callout.tsx`, `main-tabs.tsx` |
| 4 | AI suitability prompt + banner | `ai-summary-prompt.ts`, `ai-summary-banner.tsx` |
