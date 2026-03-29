# Summary and Overview Components

This directory contains components that present cross-method comparisons and high-level analysis summaries. These appear primarily under the **Analysis > Overview** sub-tab.

## Components

### RegimeMatrix

**File:** `regime-matrix.tsx`

A matrix table showing the flow regime classification for every combination of method and flow profile.

- Rows: flow profiles. Columns: methods (Energy, Momentum, Yarnell, WSPRO).
- Each cell contains a regime badge: **F** (Free Surface, blue), **P** (Pressure, orange), or **O** (Overtopping, purple).
- When methods disagree on regime for a given profile, a warning is displayed, because regime disagreement indicates the bridge is operating near a transition point and results should be interpreted carefully.

### ComparisonTables

**File:** `comparison-tables.tsx`

Side-by-side method result tables with optional HEC-RAS comparison.

Displays a table per flow profile with rows for each enabled method showing:
- Method name with color dot.
- Upstream WSEL, head loss, approach velocity, Froude number.
- If HEC-RAS comparison data exists, shows the HEC-RAS WSEL and head loss with percentage difference badges (green <5%, amber 5-10%, red >10%).

Uses the `HecRasInputRow` component to allow inline editing of HEC-RAS reference values directly from the overview table.

### AffluxCharts

**File:** `afflux-charts.tsx`

D3-rendered charts plotting afflux (head loss) versus discharge for each method.

- One chart with all methods overlaid, each in its signature color.
- HEC-RAS reference points shown as red dots if available.
- Responsive layout with `ResizeObserver`.
- Legend showing method names and colors.
- CSV download button to export the chart data.
- Axes labeled with the active unit system.

### FreeboardCheck

**File:** `freeboard-check.tsx`

A summary table showing freeboard clearance for each flow profile.

Uses the `computeFreeboard()` engine function to determine:
- Worst-case WSEL across all methods.
- Freeboard = low chord - worst-case WSEL.
- Status: CLEAR (green), LOW (amber), PRESSURE (red), OVERTOPPING (purple).

Displayed as a table with columns: Profile, ARI, Q, WSEL, Low Chord, Freeboard, Status badge.

### MethodSuitability

**File:** `method-suitability.tsx`

AI-assessed method applicability flags based on the actual flow conditions.

Uses `assessMethodSuitability()` from the engine, which evaluates each method against conditions like:
- Yarnell is not valid for pressure flow.
- WSPRO may have reduced accuracy at high blockage ratios.
- Momentum method may not converge for certain configurations.

Each method gets a suitability level:
- **ok** (green dot) -- method is appropriate.
- **caution** (amber dot) -- method may have reduced accuracy; reason displayed.
- **not-applicable** / **error** (red dot) -- method should not be relied upon.

### AiSummaryBanner

**File:** `ai-summary-banner.tsx`

A card displaying the AI-generated analysis overview.

**States:**
- **Loading** -- pulsing sparkle icon with skeleton placeholders.
- **Error** -- amber warning card with error message and dismiss button.
- **Loaded** -- displays the AI summary content with a sparkle icon. The summary is fetched automatically after calculations complete (triggered by `fetchAiSummary()` in the store).

### ScenarioComparison

**File:** `scenario-comparison.tsx`

Side-by-side comparison of saved scenarios.

Two dropdown selectors let the user pick any two saved scenarios. The comparison table shows per-method, per-profile differences in WSEL and afflux, with delta values indicating which scenario produces higher water levels.

Scenarios are saved via the store's `saveScenario()` action, which captures a snapshot of cross-section, bridge geometry, flow profiles, coefficients, results, and HEC-RAS comparison data.

### Supporting Files

- **`ai-callout.tsx`** -- reusable AI insight callout cards (single, grouped, inline, and grouped-inline variants) used throughout the analysis views.
- **`hecras-input-row.tsx`** -- inline editable table row component for entering HEC-RAS reference values. Used by both ComparisonTables and QaqcPanel.
