# AI Summary Upgrade — Principal Engineer Review Quality

**Date:** 2026-03-28
**Status:** Approved
**Approach:** B — Two-tier structured prompt, single API call

## Problem

The current AI summary is a lightweight summarizer — it reports what the numbers say but doesn't assess whether the inputs are reasonable, the coefficients are appropriate, or the results are trustworthy. A principal hydraulic engineer reviewing bridge loss calculations needs:

- Input quality assessment (cross-section adequacy, Manning's n plausibility, opening ratio)
- Coefficient appropriateness checks (are Cc/Ce sensible for this geometry?)
- Confidence framing (can I trust these numbers, or do they need more investigation?)
- Actionable recommendations (not "review inputs" but "reduce Cc to 0.3 given gradual abutments")

The current payload also omits data a reviewer would immediately check: Manning's n values, opening ratio, contraction/expansion coefficients, bridge velocity, Froude at bridge, iteration counts.

## Design

### 1. Expanded Payload

All data already exists in the store — no new engine computations.

**New `crossSectionStats` block:**

```ts
crossSectionStats: {
  pointCount: number;
  stationRange: [number, number];
  manningsN: { min: number; max: number; channel: number };
  hasBankStations: boolean;
  minElevation: number;
  maxElevation: number;
}
```

**New `hydraulicRatios` block (computed from first profile's energy result):**

```ts
hydraulicRatios: {
  openingRatio: number;       // bridge area / approach area
  contractionRatio: number;   // 1 - openingRatio
  pierBlockageRatio: number;  // pier blockage / gross bridge area
}
```

**Expanded `bridgeGeometry`** — add `skewAngle`, `contractionLength`, `expansionLength`, `deckWidth`.

**Expanded method results** — add `bridgeVelocity`, `froudeBridge`, `iterationCount` (from `iterationLog.length`), `pierBlockage`, `hydraulicRadius` (both from `inputEcho`).

**New `coefficients` block** (currently not sent at all):

```ts
coefficients: {
  contraction: number;
  expansion: number;
  yarnellK: number | null;
  maxIterations: number;
  tolerance: number;
  freeboardThreshold: number;
}
```

### 2. Response Schema

```ts
interface AiSummaryResponse {
  overall: string[];              // 2-4 confidence-framed executive findings
  recommendations: string[];      // 1-3 actionable next steps (top-level, not a callout)
  callouts: {
    geometry: string[] | null;    // cross-section quality, opening ratio, Manning's n
    coefficients: string[] | null; // Cc/Ce appropriateness, sensitivity
    regime: string[] | null;      // flow regime observations
    comparison: string[] | null;  // method agreement analysis
    afflux: string[] | null;      // afflux trend analysis
    freeboard: string[] | null;   // freeboard risk assessment
    hecras: string[] | null;      // HEC-RAS validation
  };
}
```

Changes from current:
- `recommendations` promoted to top-level array (not a callout key)
- `geometry` and `coefficients` are new callout keys
- `overall` bullets are now confidence-framed rather than plain observations

### 3. Prompt Structure — Two Tiers

Single API call, single prompt. The system prompt has two distinct instruction blocks.

**Tier 1 — Executive Review** (drives `overall` + `recommendations`):
- Frame findings by confidence level: what can the engineer trust, what needs investigation
- Use method agreement as a proxy for confidence (4 methods within 5% = high confidence)
- Recommendations must be specific and actionable, not generic
- If everything looks clean, say so — do not manufacture concerns

**Tier 2 — Section Callouts** (drives 7 callout keys):

Each callout gets domain-specific instructions:

- **`geometry`**: Point count adequacy through bridge opening. Manning's n reasonableness for channel type. Opening ratio assessment — if <50%, flag severe constriction and note method reliability implications. Missing bank stations. Skew angle effects.
- **`coefficients`**: Are Cc/Ce within typical ranges (Cc: 0.1-0.6, Ce: 0.3-0.8)? Is Yarnell K appropriate for pier shape? If iteration count is close to maxIterations, flag convergence concerns. Tolerance appropriateness.
- **`regime`**: Existing behavior, plus: flag unexpected regime transitions between profiles. Comment on Froude numbers approaching 1.0 (critical flow transition zone). Note if bridge velocity suggests choking.
- **`comparison`**: Existing behavior, plus: quantify spread (max-min as % of mean). Flag if one method is a consistent outlier. Note unreasonably high bridge velocities. Comment on TUFLOW FLC values if they diverge from head loss.
- **`afflux`**: Existing behavior, plus: is afflux-discharge relationship behaving as expected (roughly parabolic for free-surface)? Flag unexpected jumps suggesting regime change between profiles.
- **`freeboard`**: Existing behavior, plus: risk framing — which profiles are critical. Explicit margin-of-safety language.
- **`hecras`**: Unchanged — only comment if HEC-RAS data provided.

### 4. UI Changes

**`AiSummaryBanner` upgrade:**
- `overall` bullets render as before (now confidence-framed)
- New `recommendations` block below, visually distinct (different accent/icon) to separate "what we found" from "what to do next"

**Summary tab callout layout:**

```
AiSummaryBanner
  └── overall (confidence-framed findings)
  └── recommendations (actionable next steps)

[geometry callout — standalone, above regime matrix]
  Input quality gate: "inputs look good" or "warning: sparse survey"

RegimeMatrix
  └── AiCallout: regime

ComparisonTables
  └── AiCalloutGrouped: [comparison, coefficients, hecras]
      (coefficients grouped here — bad coefficients cause method divergence)

AffluxCharts
  └── AiCallout: afflux

FreeboardCheck
  └── AiCallout: freeboard
```

**Geometry callout placement rationale:** Positioned at the top of the Summary tab, just below the banner. Acts as a gateway — if geometry is suspect, everything downstream is suspect. The engineer should see this before digging into results.

**PDF report:** The AI Analysis section renders all non-null callouts. Add `recommendations` at the top (before section callouts), then `geometry` and `coefficients` in their natural order. No new structural changes — just more entries in the existing mapping.

### 5. Backward Compatibility

- Response validation: existing check (`Array.isArray(parsed.overall) && typeof parsed.callouts === 'object'`) stays. New fields are additive.
- `recommendations` fallback: if missing from response, treat as empty array. Banner just doesn't show the recommendations block.
- Payload: only sent to AI, no stored schema to migrate. More fields don't break anything.
- Token budget: ~1-2k additional tokens per call. Well within GPT-5.4 limits.

### 6. Files Changed

| File | Change |
|---|---|
| `app/src/lib/api/ai-summary-prompt.ts` | New response type, expanded payload type, upgraded system prompt |
| `app/src/store/project-store.ts` | Expanded payload assembly (cross-section stats, coefficients, hydraulic ratios, extra method fields) |
| `app/src/components/summary/ai-summary-banner.tsx` | Add recommendations block below overall |
| `app/src/components/main-tabs.tsx` | Add geometry callout, add coefficients to comparison grouped callout |
| `app/src/components/pdf-report.tsx` | Add geometry, coefficients, recommendations to AI Analysis section |
| `app/src/app/api/ai-summary/route.ts` | Validate recommendations array in response |

No new files. No new dependencies. No engine changes.
