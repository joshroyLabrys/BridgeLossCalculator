# Engineering Features Design

**Date:** 2026-03-27
**Goal:** Add 6 engineering features to the Bridge Loss Calculator without increasing input complexity. Total new inputs: 4 fields.

---

## Feature 1: ARI/AEP Labels

### Type Changes
Add optional `ari?: string` field to `FlowProfile` in `engine/types.ts`.

### UI
- Flow Profiles table: new column "ARI/AEP" between Name and Q. Free text input (e.g., "1% AEP", "Q100", "PMF").
- The label propagates everywhere the profile name appears: results accordion headers, summary table columns, chart legends, freeboard check table, PDF report. Display format: "{name} ({ari})" when ari is set, "{name}" when blank.

### Engine
No changes.

---

## Feature 2: Debris Blockage

### Type Changes
Add `debrisBlockagePct: number` (0-100, default 0) to `Coefficients` in `engine/types.ts`.

### UI
- Coefficients tab: new section "Debris Blockage" with a single percentage input field. Label: "Opening Blockage (%)". Default 0.
- Profile accordion Input Echo: show "Gross Opening Area" and "Net Opening Area" (after blockage) instead of just "Bridge Opening Area".

### Engine
In each method's calculation, after computing the bridge opening area, reduce it by `(1 - debrisBlockagePct / 100)`. This affects:
- `bridge-geometry.ts` where bridge opening area is computed
- All four methods consume the net area

The blockage reduces the opening area uniformly. Pier blockage is computed separately and stacks on top (total blockage = pier area + debris reduction of remaining area).

---

## Feature 3: Manning's n Sensitivity

### Type Changes
Add to `Coefficients` in `engine/types.ts`:
- `manningsNSensitivity: boolean` (default false)
- `manningsNSensitivityPct: number` (default 20, meaning ±20%)

### UI
- Coefficients tab: new section "Manning's n Sensitivity" with a checkbox "Run sensitivity analysis" and a percentage input "Variation (±%)" that appears when enabled.
- Profile accordion: when sensitivity is enabled, each result shows the base value plus "Range: [low] – [high]" in muted text.
- Summary comparison table: add two sub-columns per profile for the sensitivity bounds, styled in lighter text.
- Afflux rating curve: draw a shaded band around each method line showing the low/high envelope.

### Engine
New function `runWithSensitivity()` in `engine/index.ts`:
- Takes the same inputs as `runAllMethods`
- Runs three times: base n, n × (1 - pct/100), n × (1 + pct/100)
- Returns `{ base: CalculationResults, low: CalculationResults, high: CalculationResults }`

The sensitivity modifies ALL Manning's n values in the cross-section proportionally (multiply each point's n by the factor).

### Store
Add `sensitivityResults: { low: CalculationResults; high: CalculationResults } | null` to the store alongside existing `results`.

---

## Feature 4: Freeboard / Overtopping Check

### Type Changes
None.

### UI
New card in Summary tab, positioned first (above the comparison table): "Freeboard Check".

Table columns: Profile | ARI | Q | DS WSEL | US WSEL | Low Chord | Freeboard | Status

- **US WSEL** uses Energy method result (industry standard for freeboard checks).
- **Low Chord** interpolated at channel centerline from bridge geometry.
- **Freeboard** = Low Chord − US WSEL.
- **Status badge:**
  - Green "CLEAR" if freeboard > 1 ft
  - Amber "LOW" if 0 < freeboard ≤ 1 ft
  - Red "PRESSURE" if freeboard ≤ 0 and WSEL < high chord
  - Purple "OVERTOPPING" if WSEL ≥ high chord

Below the table: "Estimated Q at zero freeboard: X cfs (interpolated)" — linearly interpolated from multi-profile results. If freeboard is positive for all profiles, show "All profiles have positive freeboard." If negative for all, show "All profiles exceed low chord."

### Engine
New pure function `computeFreeboard()` in a new file `engine/freeboard.ts`:
- Input: energy method results array, bridge geometry, flow profiles
- Output: array of `{ profileName, ari, discharge, dsWsel, usWsel, lowChord, freeboard, status }` plus the interpolated zero-freeboard Q.

---

## Feature 5: Afflux Rating Curve

### Type Changes
None.

### UI
New card in Summary tab after Freeboard Check: "Afflux Rating Curve".

**Chart 1: Q vs Afflux (head loss)**
- D3 chart, same visual style as cross-section chart (dark theme, same tooltip pattern)
- X-axis: Discharge (Q in cfs)
- Y-axis: Afflux / Head Loss (ft)
- Lines: one per method, method colors (blue/green/amber/purple), solid
- Dots: data points at each flow profile's Q
- If Manning's n sensitivity enabled: shaded band around each line (low to high)
- If HEC-RAS head loss values entered: red dots plotted for comparison
- Tooltip: Q, afflux per method
- Legend below chart

**Chart 2: Q vs Upstream WSEL**
- Same layout, X-axis Q, Y-axis US WSEL
- Lines per method + sensitivity envelope
- HEC-RAS US WSEL dots if entered

**CSV export button** on the card header. Exports columns: Q, ARI, Energy Afflux, Momentum Afflux, Yarnell Afflux, WSPRO Afflux, and if sensitivity enabled: Energy Low, Energy High, etc.

### Engine
No new engine code — data is extracted from existing results.

### Components
New file `components/summary/afflux-charts.tsx`:
- Two D3 charts following the same pattern as `cross-section-chart.tsx` (useRef + useEffect + ResizeObserver)
- CSV export function using Blob + download link

---

## Feature 6: PDF Report

### Type Changes
Add optional `projectName?: string` to the store (not in engine types — UI-only state).

### UI
- Top bar: new "Export PDF" button with `FileText` icon, next to Import/Export
- Small dialog when clicked: optional "Project Name" text input (pre-filled from store if set), then "Generate Report" button
- Triggers `window.print()` after preparing the print view

### Implementation
**No PDF library.** Uses `@media print` CSS + a dedicated print layout.

New file `components/print-report.tsx`:
- A component that renders the full report layout, hidden from normal view (`hidden print:block`)
- Rendered in `page.tsx` alongside the main app

**Print stylesheet additions to `globals.css`:**
- `@media print` block that hides the main app UI and shows only the report
- Dark-on-white color scheme for print
- Page break rules between sections
- Serif headings (Georgia), monospace data tables

**Report sections (each as a sub-component within print-report.tsx):**

1. **Cover page** — Title "Bridge Hydraulic Loss Assessment", project name, date, "Generated by Bridge Loss Calculator". Centered layout with accent blue divider line. `break-after: page`.
2. **Input Summary** — Cross-section data table, bridge geometry parameters (2-col grid), flow profiles table, coefficients summary. Condensed styling.
3. **Cross-Section Plot** — The D3 chart rendered as static SVG for print (no interactivity needed). May need a separate "print mode" render that outputs inline SVG.
4. **Freeboard Check** — The freeboard table with status text (badges render as bordered text for ink-friendly output).
5. **Method Comparison** — The unified summary table, reformatted for portrait print width.
6. **Afflux Rating Curve** — Static SVG charts.
7. **Flow Regime Matrix** — Badge table.
8. **Detailed Results** — Per-method, per-profile: key values (US WSEL, head loss, velocity, Froude, FLCs). No iteration logs. Condensed rows.
9. **Footer** — Page numbers via CSS `@page { @bottom-center { content: counter(page) } }`, "Generated by Bridge Loss Calculator" in footer.

**Print color scheme:**
- Background: white
- Text: near-black
- Accent: the slate-blue as section dividers and header accents
- Method colors: same but slightly darkened for print contrast
- Badges: bordered text, no filled backgrounds

### D3 Charts in Print
The D3 charts need to render static SVGs for print. Two approaches:
- **Preferred:** The chart components detect print mode via a prop or media query and skip interactivity (no tooltip, no crosshair, no hover overlay).
- Add a `printMode?: boolean` prop to `CrossSectionChart` and the new afflux charts. When true, they render immediately without ResizeObserver and at a fixed width (700px for portrait A4).

---

## File Summary

### New Files
- `engine/freeboard.ts` — freeboard computation
- `components/summary/freeboard-check.tsx` — freeboard table card
- `components/summary/afflux-charts.tsx` — D3 afflux rating curves + CSV export
- `components/print-report.tsx` — print layout with all report sections

### Modified Files
- `engine/types.ts` — add `ari` to FlowProfile, `debrisBlockagePct` + sensitivity fields to Coefficients
- `engine/index.ts` — add `runWithSensitivity()`, pass blockage through
- `engine/geometry.ts` — apply debris blockage to opening area
- `store/project-store.ts` — add `sensitivityResults`, `projectName`
- `components/input/flow-profiles-form.tsx` — ARI column
- `components/input/coefficients-form.tsx` — debris blockage + sensitivity sections
- `components/results/profile-accordion.tsx` — sensitivity range display, net/gross area
- `components/summary/comparison-tables.tsx` — sensitivity sub-columns
- `components/summary/charts.tsx` — replaced by afflux-charts.tsx or updated with sensitivity bands
- `components/top-bar.tsx` — PDF export button
- `app/page.tsx` — include print-report component
- `app/globals.css` — print stylesheet

### Unchanged
- All existing engine method files (energy, momentum, yarnell, wspro) — they receive net area, don't know about blockage
- `engine/types.ts` MethodResult interface — unchanged, sensitivity is separate results
- D3 cross-section chart — add `printMode` prop only
- UI component primitives (`components/ui/*`)
