# Method Suitability & AI Callout Cleanup — Design Spec

**Date:** 2026-03-29
**Goal:** Add deterministic method applicability flags, AI-generated suitability assessment, and reduce visual clutter of AI callouts in the Summary tab.

**Audience:** Hydraulic engineers who need to know which calculation methods are trustworthy for their specific bridge geometry and flow conditions.

---

## Problem

1. The Summary tab has 6 visually-identical AI callout cards (bordered, blue-tinted, Sparkles icon, "AI Insight" header). They clutter the page and blend together.
2. The tool gives no indication when a method is being used outside its valid range — e.g., Yarnell under pressure flow, or Energy at high Froude numbers. Engineers must know this from domain knowledge.

## Design Principles

- **Contextual notes stay inline** — callouts about regime, afflux, freeboard, etc. remain near the section they describe. But they become visually lighter (no card border, no icon).
- **Big-picture goes to the top** — the AI Summary banner is the one prominent card. Method suitability (both deterministic and AI-generated) lives there.
- **Deterministic flags are not AI** — applicability rules are computed from actual results. They don't depend on the AI being available or correct.

---

## Feature 1: Lighter Inline Callouts

Replace the current `AiCallout` card-style component (used for geometry, regime, comparison, afflux, freeboard callouts) with a new `AiCalloutInline` variant.

### Current style
- Bordered card (`border border-primary/15 bg-primary/5`)
- Sparkles icon
- "AI Insight" header
- Full bullet list

### New inline style
- No border, no background
- Small `MessageSquare` icon (muted, 3px) instead of Sparkles
- No "AI Insight" header — just the bullet text
- Slightly smaller text (`text-xs` instead of `text-sm`)
- Same `AnimatedCallout` wrapper for mount/unmount animation
- Left border accent only: `border-l-2 border-primary/20 pl-3`

This applies to the 5 section-level callouts:
- Geometry (standalone above RegimeMatrix)
- Regime (inside RegimeMatrix)
- Comparison + Coefficients + HEC-RAS (inside ComparisonTables — keep grouped but use inline style)
- Afflux (inside AffluxCharts)
- Freeboard (inside FreeboardCheck)

The `AiSummaryBanner` keeps its current prominent card style — it's the one AI card on the page.

---

## Feature 2: Deterministic Method Applicability Flags

A new `MethodSuitability` component placed after the AI Summary banner in the Summary tab.

### Data layer (`src/engine/method-suitability.ts`)

Pure function, no React:

```typescript
export type SuitabilityLevel = 'ok' | 'caution' | 'not-applicable' | 'error';

export interface MethodFlag {
  method: 'energy' | 'momentum' | 'yarnell' | 'wspro';
  level: SuitabilityLevel;
  reason: string | null;
  profile: string;  // worst-case profile name
}

export function assessMethodSuitability(
  results: CalculationResults,
  bridgeGeometry: BridgeGeometry
): MethodFlag[]
```

### Applicability rules

Each rule is checked per profile. The **worst-case** across all profiles determines the flag level.

**Yarnell:**
- `not-applicable` if any profile has `flowRegime !== 'free-surface'` — reason: "Pressure/overtopping flow detected for {profile}"
- `caution` if any profile has `inputEcho.pierBlockage / (inputEcho.bridgeOpeningArea + inputEcho.pierBlockage) > 0.15` — reason: "High pier blockage ratio ({ratio}%) for {profile}"

**Energy:**
- `caution` if any profile has `froudeApproach > 0.8` — reason: "High approach Froude ({value}) for {profile}"
- `caution` if any profile has `froudeBridge > 0.9` — reason: "High bridge Froude ({value}) for {profile}"
- `caution` if any profile has `converged === false` — reason: "Did not converge for {profile}"

**Momentum:**
- `caution` if any profile has `froudeBridge > 0.9` — reason: "High bridge Froude ({value}) for {profile}"
- `caution` if any profile has `converged === false` — reason: "Did not converge for {profile}"

**WSPRO:**
- `caution` if opening ratio < 0.3 (computed as `bridgeOpeningArea / flowArea` from first profile's energy result) — reason: "Severe constriction (opening ratio {value})"
- `caution` if any profile has `converged === false` — reason: "Did not converge for {profile}"

**All methods:**
- `error` if `result.error` is non-null — reason: the error string
- `error` overrides `caution`; `not-applicable` overrides `caution`

### UI component (`src/components/summary/method-suitability.tsx`)

Compact horizontal layout. Each method gets a pill/badge:

- **OK** — muted green dot, method name only
- **Caution** — amber dot + reason text
- **Not Applicable** — red dot + reason text
- **Error** — red dot + error text

Layout: grid or flex-wrap, 1-2 rows. Each item shows: colored dot + method label + reason (if any). On mobile, stack vertically.

No card wrapper — just a section with a heading: "Method Applicability"

---

## Feature 3: AI Suitability Assessment in Summary Banner

### Response type update

Add `suitability` to `AiSummaryResponse.callouts`:

```typescript
callouts: {
  geometry: string[] | null;
  coefficients: string[] | null;
  regime: string[] | null;
  freeboard: string[] | null;
  comparison: string[] | null;
  afflux: string[] | null;
  hecras: string[] | null;
  suitability: string[] | null;  // NEW
};
```

### AI prompt addition

Add a new section to the AI system prompt:

```
"suitability": Assess which methods are appropriate for this specific bridge geometry and flow conditions. Consider: Yarnell is only valid for free-surface flow with moderate pier blockage. Energy method assumes gradual transitions and becomes less reliable at high Froude numbers. Momentum is better for abrupt contractions. WSPRO is designed for wide floodplain bridges. State which methods you would trust most for this analysis and why. 1-3 bullets.
```

### Banner update

The `AiSummaryBanner` currently shows:
1. Overall findings
2. Recommendations

Change to:
1. Overall findings
2. **Method suitability** (new — from `callouts.suitability`)
3. Recommendations

The suitability section uses the same internal layout as the existing sections: a labelled header ("Method Suitability") with bullet points below, separated by a divider.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/engine/method-suitability.ts` | Pure logic: assess method applicability from results |
| `src/components/summary/method-suitability.tsx` | UI: render applicability flags |

### Modified files
| File | Change |
|------|--------|
| `src/components/summary/ai-callout.tsx` | Add `AiCalloutInline` and `AiCalloutGroupedInline` variants |
| `src/components/summary/ai-summary-banner.tsx` | Add suitability section between findings and recommendations |
| `src/lib/api/ai-summary-prompt.ts` | Add `suitability` to response type and prompt |
| `src/components/main-tabs.tsx` | Replace `AiCallout` with `AiCalloutInline` for section callouts; add `MethodSuitability` component |
| `src/components/summary/regime-matrix.tsx` | Update callout prop to use inline variant |
| `src/components/summary/comparison-tables.tsx` | Update callout prop to use inline variant |
| `src/components/summary/afflux-charts.tsx` | Update callout prop to use inline variant |
| `src/components/summary/freeboard-check.tsx` | Update callout prop to use inline variant |

### Unchanged
| File | Why |
|------|-----|
| `src/app/api/ai-summary/route.ts` | Response validation already accepts unknown keys in callouts; `suitability` will pass through |

---

## Scope Boundaries

- The deterministic flags use simple threshold-based rules. No machine learning or complex heuristics.
- The AI suitability assessment is advisory — it supplements the deterministic flags, not replaces them.
- No changes to the Results tab — flags live only in Summary.
- No changes to the AI chat system prompt — the chat can already answer suitability questions conversationally.
- The inline callout components (`AiCalloutInline`, `AiCalloutGroupedInline`) are new exports alongside the existing ones. The card-style variants (`AiCallout`, `AiCalloutGrouped`) remain available but are no longer used in the Summary tab.
