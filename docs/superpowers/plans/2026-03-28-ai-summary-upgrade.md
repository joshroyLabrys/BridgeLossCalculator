# AI Summary Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the AI summary from a lightweight summarizer to a principal-engineer-quality review that assesses input quality, coefficient appropriateness, confidence levels, and gives actionable recommendations.

**Architecture:** Expand the payload with cross-section stats, hydraulic ratios, and coefficients. Upgrade the system prompt with two-tier structure (executive review + domain callouts). Add `recommendations` as a top-level response field and `geometry`/`coefficients` as new callout keys. Wire new callouts into existing UI pattern.

**Tech Stack:** TypeScript, React, Zustand, @react-pdf/renderer, OpenAI API (GPT-5.4)

---

### Task 1: Upgrade response type and payload type

**Files:**
- Modify: `app/src/lib/api/ai-summary-prompt.ts:1-87`

- [ ] **Step 1: Replace `AiSummaryResponse` interface**

Replace lines 1-10 of `app/src/lib/api/ai-summary-prompt.ts` with:

```ts
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
  };
}
```

- [ ] **Step 2: Replace `AiSummaryPayload` interface**

Replace lines 42-83 of `app/src/lib/api/ai-summary-prompt.ts` with:

```ts
export interface AiSummaryPayload {
  bridgeGeometry: {
    lowChordLeft: number;
    lowChordRight: number;
    highChord: number;
    span: number;
    pierCount: number;
    debrisBlockagePct: number;
    skewAngle: number;
    contractionLength: number;
    expansionLength: number;
    deckWidth: number;
  };
  crossSectionStats: {
    pointCount: number;
    stationRange: [number, number];
    manningsN: { min: number; max: number; channel: number };
    hasBankStations: boolean;
    minElevation: number;
    maxElevation: number;
  };
  hydraulicRatios: {
    openingRatio: number;
    contractionRatio: number;
    pierBlockageRatio: number;
  } | null;
  coefficients: {
    contraction: number;
    expansion: number;
    yarnellK: number | null;
    maxIterations: number;
    tolerance: number;
    freeboardThreshold: number;
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
      bridgeVelocity: number;
      froudeApproach: number;
      froudeBridge: number;
      flowRegime: string;
      converged: boolean;
      iterationCount: number;
      bridgeOpeningArea: number;
      pierBlockage: number;
      hydraulicRadius: number;
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
```

- [ ] **Step 3: Verify types compile**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -v openai-auth.test`

Expected: Type errors in `project-store.ts` (payload shape mismatch) and possibly `route.ts`. That's expected — we fix those in later tasks.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/api/ai-summary-prompt.ts
git commit -m "feat(ai-summary): expand response and payload types

Add recommendations top-level field, geometry/coefficients callouts,
cross-section stats, hydraulic ratios, and expanded method fields."
```

---

### Task 2: Upgrade the system prompt

**Files:**
- Modify: `app/src/lib/api/ai-summary-prompt.ts:12-40`

- [ ] **Step 1: Replace the `AI_SYSTEM_PROMPT` constant**

Replace the `AI_SYSTEM_PROMPT` (lines 12-40) with:

```ts
export const AI_SYSTEM_PROMPT = `You are a principal hydraulic engineer conducting a peer review of independent bridge loss calculations for QA verification of a HEC-RAS model.

Your audience is another hydraulic engineer. Use proper terminology: afflux, Froude number, freeboard, WSEL, pressure flow, overtopping, opening ratio, contraction coefficient. Be direct, specific, and cite actual values from the data.

You will receive JSON containing bridge geometry, cross-section statistics, hydraulic ratios, coefficients, flow profiles, and results from four independent calculation methods (Energy, Momentum, Yarnell, WSPRO).

Respond with JSON matching this exact schema:
{
  "overall": ["finding 1", "finding 2", "...up to 4"],
  "recommendations": ["action 1", "action 2", "...up to 3"],
  "callouts": {
    "geometry": ["..."] or null,
    "coefficients": ["..."] or null,
    "regime": ["..."] or null,
    "comparison": ["..."] or null,
    "afflux": ["..."] or null,
    "freeboard": ["..."] or null,
    "hecras": ["..."] or null
  }
}

═══ TIER 1 — EXECUTIVE REVIEW ═══

"overall" (2-4 bullets): Frame findings by CONFIDENCE LEVEL. Use method agreement as a proxy — 4 methods within 5% = high confidence. State what the engineer can trust and what needs investigation.
Examples of good overall bullets:
- "High confidence in Q100 afflux estimate — all four methods agree within 3% (0.42-0.43 ft)."
- "Low confidence for PMF: methods diverge 22% and pressure flow detected. Recommend sensitivity analysis."
- "Opening ratio is 0.38 — severe constriction. One-dimensional methods may underestimate losses."

"recommendations" (1-3 bullets): Specific, actionable next steps. NOT generic advice like "review inputs" or "check results". Cite the specific parameter, value, or condition that motivates the recommendation.
Examples of good recommendations:
- "Reduce Cc from 0.5 to 0.3 — gradual abutment geometry with no piers typically warrants lower contraction."
- "Run Manning's n sensitivity ±20% — results are sensitive to n at this Froude number (0.85)."
- "Verify survey data through bridge opening — only 3 points define the 40 ft span."

═══ TIER 2 — SECTION CALLOUTS ═══

Each callout: 1-3 bullets or null. Do NOT manufacture concerns — return null if nothing noteworthy.

"geometry" — Cross-section and bridge opening assessment:
- Is the point count adequate? Fewer than ~5 points through the bridge opening may produce unreliable area calculations.
- Is Manning's n reasonable? Channel n typically 0.025-0.060 for natural streams. Flag values outside typical ranges.
- Comment on opening ratio (bridgeOpeningArea / total flow area). Below 0.5 is severe constriction — note method reliability implications. Below 0.25 is extreme.
- Flag if bank stations are missing (hasBankStations = false) — affects subsection calculations.
- Note skew angle effects if > 15°.
- Comment on contraction/expansion reach lengths relative to bridge span.

"coefficients" — Coefficient appropriateness:
- Contraction coefficient Cc: typical range 0.1 (gradual, no piers) to 0.6 (abrupt, heavy piers). Flag if outside typical range or mismatched to geometry.
- Expansion coefficient Ce: typical range 0.3 to 0.8. Flag if unusually high/low.
- If Yarnell K is set, check if it matches pier shape (square ~2.0, round-nose ~0.9, cylindrical ~1.2).
- If any method's iterationCount is > 80% of maxIterations, flag potential convergence concerns.
- Comment on tolerance appropriateness if Froude > 0.7 (may need tighter tolerance near critical flow).

"regime" — Flow regime observations:
- Flag unexpected regime transitions between profiles (e.g. free-surface at Q50 but pressure at Q100).
- Comment on Froude numbers approaching 1.0 — the transition zone (0.8-1.2) is where methods are least reliable.
- If bridge velocity suggests choking (significantly higher than approach), note it.
- Note if Yarnell results should be disregarded (only valid for free-surface flow with Fr < 0.8).

"comparison" — Method agreement analysis:
- Quantify the spread: (max - min) as percentage of mean. Flag if > 10%.
- If one method is a consistent outlier across profiles, identify it and suggest why.
- Note if bridge velocity is unreasonably high (> 2x approach velocity may indicate geometry issues).
- Comment on TUFLOW FLC values if they diverge significantly from the computed head loss.

"afflux" — Afflux trend analysis:
- Is the afflux-discharge relationship behaving as expected? Free-surface afflux typically increases roughly with Q^2.
- Flag unexpected jumps between profiles — often indicates a regime transition.
- Note the absolute afflux range and whether it's within typical bounds for this opening ratio.

"freeboard" — Freeboard risk assessment:
- Frame in terms of risk: which profiles are critical? What's the margin of safety?
- Explicit language: "freeboard is adequate for all profiles" or "PMF overtops by 0.3 ft — deck drainage and structural assessment required."
- Note if freeboard is marginal (< 0.5 ft) for any design event.

"hecras" — HEC-RAS validation:
- ONLY comment if HEC-RAS comparison data was actually provided. If hecRasComparison is null or empty, MUST return null.
- Do NOT mention the absence of HEC-RAS data.
- Compare WSEL and head loss differences. Flag discrepancies > 5%.

═══ RULES ═══
- Return ONLY valid JSON. No markdown, no code fences, no commentary outside the JSON.
- Each bullet is one sentence. Cite specific values.
- Reference specific profile names and discharge values.
- If everything looks clean and well-configured, say so — do not manufacture concerns.
- Return null for any callout where there is genuinely nothing noteworthy.`;
```

- [ ] **Step 2: Verify file compiles**

Run: `cd app && npx tsc --noEmit 2>&1 | grep ai-summary-prompt`

Expected: No errors in this file.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/api/ai-summary-prompt.ts
git commit -m "feat(ai-summary): upgrade system prompt to principal engineer review

Two-tier structure: executive review with confidence framing,
plus domain-specific callout instructions for geometry, coefficients,
regime, comparison, afflux, freeboard, and HEC-RAS."
```

---

### Task 3: Expand payload assembly in the store

**Files:**
- Modify: `app/src/store/project-store.ts:133-196`

- [ ] **Step 1: Replace the payload assembly in `fetchAiSummary`**

Replace lines 139-196 (from `const bridge = state.bridgeGeometry;` through the closing of `sensitivityEnabled`) with:

```ts
    const bridge = state.bridgeGeometry;
    const cs = state.crossSection;
    const coeffs = state.coefficients;

    // Cross-section statistics
    const stations = cs.map((p) => p.station);
    const elevations = cs.map((p) => p.elevation);
    const nValues = cs.map((p) => p.manningsN).filter((n) => n > 0);
    const channelNValues = cs
      .filter((p) => !p.bankStation) // points between bank stations are "channel"
      .map((p) => p.manningsN)
      .filter((n) => n > 0);

    // Hydraulic ratios from first profile's energy result
    let hydraulicRatios: { openingRatio: number; contractionRatio: number; pierBlockageRatio: number } | null = null;
    const firstEnergy = state.results!.energy[0];
    if (firstEnergy && !firstEnergy.error) {
      const approachArea = firstEnergy.inputEcho.flowArea;
      const bridgeArea = firstEnergy.inputEcho.bridgeOpeningArea;
      const pierBlock = firstEnergy.inputEcho.pierBlockage;
      const grossBridgeArea = bridgeArea + pierBlock;
      hydraulicRatios = {
        openingRatio: approachArea > 0 ? bridgeArea / approachArea : 0,
        contractionRatio: approachArea > 0 ? 1 - bridgeArea / approachArea : 0,
        pierBlockageRatio: grossBridgeArea > 0 ? pierBlock / grossBridgeArea : 0,
      };
    }

    const payload = {
      bridgeGeometry: {
        lowChordLeft: bridge.lowChordLeft,
        lowChordRight: bridge.lowChordRight,
        highChord: bridge.highChord,
        span: bridge.rightAbutmentStation - bridge.leftAbutmentStation,
        pierCount: bridge.piers.length,
        debrisBlockagePct: coeffs.debrisBlockagePct,
        skewAngle: bridge.skewAngle,
        contractionLength: bridge.contractionLength,
        expansionLength: bridge.expansionLength,
        deckWidth: bridge.deckWidth,
      },
      crossSectionStats: {
        pointCount: cs.length,
        stationRange: [stations.length > 0 ? Math.min(...stations) : 0, stations.length > 0 ? Math.max(...stations) : 0] as [number, number],
        manningsN: {
          min: nValues.length > 0 ? Math.min(...nValues) : 0,
          max: nValues.length > 0 ? Math.max(...nValues) : 0,
          channel: channelNValues.length > 0 ? channelNValues[Math.floor(channelNValues.length / 2)] : (nValues.length > 0 ? nValues[0] : 0),
        },
        hasBankStations: cs.some((p) => p.bankStation === 'left') && cs.some((p) => p.bankStation === 'right'),
        minElevation: elevations.length > 0 ? Math.min(...elevations) : 0,
        maxElevation: elevations.length > 0 ? Math.max(...elevations) : 0,
      },
      hydraulicRatios,
      coefficients: {
        contraction: coeffs.contractionCoeff,
        expansion: coeffs.expansionCoeff,
        yarnellK: coeffs.yarnellK,
        maxIterations: coeffs.maxIterations,
        tolerance: coeffs.tolerance,
        freeboardThreshold: coeffs.freeboardThreshold,
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
            bridgeVelocity: r.bridgeVelocity,
            froudeApproach: r.froudeApproach,
            froudeBridge: r.froudeBridge,
            flowRegime: r.flowRegime,
            converged: r.converged,
            iterationCount: r.iterationLog.length,
            bridgeOpeningArea: r.inputEcho.bridgeOpeningArea,
            pierBlockage: r.inputEcho.pierBlockage,
            hydraulicRadius: r.inputEcho.hydraulicRadius,
            tuflowPierFLC: r.tuflowPierFLC,
            tuflowSuperFLC: r.tuflowSuperFLC,
            error: r.error,
          })),
        ])
      ),
      freeboard: state.results!.energy.length > 0
        ? (() => {
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
      sensitivityEnabled: coeffs.manningsNSensitivityPct != null &&
        coeffs.manningsNSensitivityPct > 0,
    };
```

- [ ] **Step 2: Verify types compile**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -v openai-auth.test`

Expected: Clean (no errors in store or prompt files).

- [ ] **Step 3: Commit**

```bash
git add app/src/store/project-store.ts
git commit -m "feat(ai-summary): expand payload with cross-section stats, ratios, coefficients

Adds crossSectionStats, hydraulicRatios, coefficients block, and
expanded method fields (bridgeVelocity, froudeBridge, iterationCount,
pierBlockage, hydraulicRadius) to the AI summary payload."
```

---

### Task 4: Update API route validation

**Files:**
- Modify: `app/src/app/api/ai-summary/route.ts:10-18`

- [ ] **Step 1: Update validation to include `recommendations`**

Replace lines 10-18 with:

```ts
    const parsed: AiSummaryResponse = JSON.parse(raw);

    // Validate shape — overall and recommendations must be arrays, callouts must be an object
    if (!Array.isArray(parsed.overall) || typeof parsed.callouts !== 'object') {
      return Response.json(
        { error: 'Invalid response structure from AI' },
        { status: 502 }
      );
    }

    // Ensure recommendations is always an array (graceful fallback)
    if (!Array.isArray(parsed.recommendations)) {
      parsed.recommendations = [];
    }
```

- [ ] **Step 2: Verify types compile**

Run: `cd app && npx tsc --noEmit 2>&1 | grep route.ts`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/ai-summary/route.ts
git commit -m "feat(ai-summary): validate recommendations array in API response

Gracefully defaults to empty array if AI omits recommendations."
```

---

### Task 5: Upgrade the AI Summary Banner with recommendations

**Files:**
- Modify: `app/src/components/summary/ai-summary-banner.tsx`

- [ ] **Step 1: Replace the success state rendering**

Replace lines 54-70 (the final return block that renders the success card) with:

```tsx
  const overallItems = Array.isArray(aiSummary.overall) ? aiSummary.overall : [aiSummary.overall];
  const recItems = Array.isArray(aiSummary.recommendations) ? aiSummary.recommendations : [];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-4 px-4 space-y-3">
        {/* Overall findings */}
        <div className="flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/60 mb-1.5">AI Analysis</p>
            <ul className="space-y-1">
              {overallItems.map((item, i) => (
                <li key={i} className="text-sm text-foreground leading-relaxed flex items-baseline gap-2">
                  <span className="text-primary/40 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recommendations */}
        {recItems.length > 0 ? (
          <div className="flex items-start gap-3 border-t border-primary/10 pt-3">
            <svg className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/60 mb-1.5">Recommendations</p>
              <ul className="space-y-1">
                {recItems.map((item, i) => (
                  <li key={i} className="text-sm text-foreground/90 leading-relaxed flex items-baseline gap-2">
                    <span className="text-amber-400/50 shrink-0">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit 2>&1 | grep ai-summary-banner`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/summary/ai-summary-banner.tsx
git commit -m "feat(ai-summary): add recommendations block to banner

Numbered recommendations with amber accent, visually separated
from the overall findings by a divider."
```

---

### Task 6: Wire geometry callout and update comparison grouping

**Files:**
- Modify: `app/src/components/main-tabs.tsx:237-249`

- [ ] **Step 1: Update the Summary tab callout wiring**

Replace lines 237-249 (from `<AiSummaryBanner />` through `<FreeboardCheck ...>`) with:

```tsx
        <AiSummaryBanner />
        <AiCallout text={aiSummary?.callouts.geometry ?? null} loading={aiLoading} />
        <RegimeMatrix callout={<AiCallout text={aiSummary?.callouts.regime ?? null} loading={aiLoading} />} />
        <ComparisonTables callout={
          <AiCalloutGrouped
            loading={aiLoading}
            sections={[
              { label: 'Method Agreement', text: aiSummary?.callouts.comparison ?? null },
              { label: 'Coefficients', text: aiSummary?.callouts.coefficients ?? null },
              { label: 'HEC-RAS Comparison', text: aiSummary?.callouts.hecras ?? null },
            ]}
          />
        } />
        <AffluxCharts callout={<AiCallout text={aiSummary?.callouts.afflux ?? null} loading={aiLoading} />} />
        <FreeboardCheck callout={<AiCallout text={aiSummary?.callouts.freeboard ?? null} loading={aiLoading} />} />
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit 2>&1 | grep main-tabs`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/main-tabs.tsx
git commit -m "feat(ai-summary): wire geometry callout and coefficients into summary

Geometry callout positioned as input quality gate above regime matrix.
Coefficients grouped with method comparison and HEC-RAS callouts."
```

---

### Task 7: Update PDF report AI Analysis section

**Files:**
- Modify: `app/src/components/pdf-report.tsx:557-605`

- [ ] **Step 1: Replace the AI Analysis section**

Replace lines 557-605 (the entire `{/* ── 8. AI Analysis ── */}` block) with:

```tsx
        {/* ── 8. AI Analysis ── */}
        {aiSummary ? (
          <>
            <Divider />
            <Sec num={next()} title="AI Analysis" desc="Automated peer review of inputs and results. Supplementary only — engineering judgement takes precedence.">
              <Text style={s.subTitle}>Key Findings</Text>
              {aiSummary.overall.map((item, i) => <Bullet key={i} text={item} color="#374151" />)}

              {Array.isArray(aiSummary.recommendations) && aiSummary.recommendations.length > 0 ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={s.subTitle}>Recommendations</Text>
                  {aiSummary.recommendations.map((item, i) => <Bullet key={i} text={`${i + 1}. ${item}`} color="#b45309" />)}
                </View>
              ) : null}

              {aiSummary.callouts.geometry ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Input Geometry</Text>
                  {aiSummary.callouts.geometry.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.coefficients ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Coefficients</Text>
                  {aiSummary.callouts.coefficients.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.regime ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Flow Regime</Text>
                  {aiSummary.callouts.regime.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.comparison ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Method Comparison</Text>
                  {aiSummary.callouts.comparison.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.afflux ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Afflux Trends</Text>
                  {aiSummary.callouts.afflux.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.freeboard ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Freeboard</Text>
                  {aiSummary.callouts.freeboard.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.hecras ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>HEC-RAS Comparison</Text>
                  {aiSummary.callouts.hecras.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              <Text style={{ fontSize: 6, color: C.textMuted, fontStyle: 'italic', marginTop: 10 }}>
                Generated by AI. For reference only — does not constitute engineering advice.
              </Text>
            </Sec>
          </>
        ) : null}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit 2>&1 | grep pdf-report`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/pdf-report.tsx
git commit -m "feat(ai-summary): add geometry, coefficients, recommendations to PDF

Recommendations displayed prominently with numbered amber bullets.
Geometry and coefficients sections added to AI Analysis."
```

---

### Task 8: Full build verification

**Files:** None (verification only)

- [ ] **Step 1: Type check**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -v openai-auth.test`

Expected: No errors.

- [ ] **Step 2: Production build**

Run: `cd app && npx next build 2>&1 | tail -15`

Expected: `✓ Compiled successfully` and all pages generated.

- [ ] **Step 3: Verify no regressions in test suite**

Run: `cd app && npx vitest run 2>&1 | tail -20`

Expected: All existing tests pass. (The AI summary integration test may need the fixture updated — if `VALID_AI_RESPONSE` fixture doesn't include `recommendations`, update it to match the new schema.)
