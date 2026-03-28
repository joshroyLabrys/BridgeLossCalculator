# Engineering Workstation Expansion — Design Spec

## Overview

Transform the Bridge Loss Calculator from a single-purpose backwater tool into a full hydraulic engineering workstation. Ten new features organized behind a two-level top navigation, covering the entire bridge assessment workflow from data import through to report delivery.

**Target user:** Hydraulic engineers in Australia performing bridge waterway adequacy assessments under TMR, VicRoads, DPIE, and ARR guidelines.

**Constraints:**
- In-browser only (no backend/server)
- Mobile-compatible (latest phones)
- No user accounts or cloud infrastructure
- External API calls limited to ARR Data Hub (free, public)

---

## 1. Navigation Restructure

### Top-level tabs (6)

Replace the current 4-tab layout (`Input | Results | Summary | Simulation`) with 6 workflow-ordered tabs:

```
Data · Hydrology · Analysis · Assessment · Simulation · Report
```

Same horizontal tab bar style as current, centered below the header brand row.

### Second-level sub-tabs

Each top tab reveals a second row of sub-tabs below it (underline style, same as current Input sub-tabs). Horizontally scrollable on mobile.

| Tab | Sub-tabs |
|-----|----------|
| **Data** | Cross-Section, Bridge, Flow Profiles, Coefficients, Import, Reach* |
| **Hydrology** | ARR Lookup, Catchment |
| **Analysis** | Overview, Methods, Scour, QA/QC |
| **Assessment** | Adequacy, Regulatory, Scenarios |
| **Simulation** | 3D Model, Energy Grade, What-If |
| **Report** | Narrative, Export, History |

*Reach sub-tab only visible when multi-bridge mode is enabled.

### Header bar

Unchanged: brand/logo, unit toggle (Metric/Imperial), action icon buttons (Import JSON, Export JSON, Save Scenario, PDF). Import/Export buttons remain in header for quick access alongside the dedicated Import sub-tab.

When 2+ bridges exist (reach analysis), a bridge selector dropdown appears next to the unit toggle: `Bridge 1: Main Rd ▾` with badge showing `2/3`.

### Migration from current tabs

- Current "Input" → **Data** (sub-tabs unchanged: Cross-Section, Bridge, Flow Profiles, Coefficients)
- Current "Results" → **Analysis > Methods**
- Current "Summary" splits:
  - Regime Matrix, Comparison Tables, Afflux Charts, Method Suitability → **Analysis > Overview**
  - Freeboard Check, AI Summary Banner → **Assessment > Adequacy**
  - Scenario Comparison → **Assessment > Scenarios**
- Current "Simulation" → **Simulation** (sub-tabs: 3D Model, Energy Grade)
- Current What-If floating panel → **Simulation > What-If** (full sub-tab)
- Current AI Chat FAB → remains as floating button, available on all tabs

### Mobile behavior

Top tabs: horizontal scroll with snap. Sub-tabs: horizontal scroll with snap, second row. Both use the existing `scroll-snap-x` class pattern.

---

## 2. Data Tab — Import Features

### Sub-tab: Import

Full-page drop zone covering the entire sub-tab area. File type auto-detected by extension.

#### HEC-RAS Import (enhanced from existing)

Supported file types:
- `.g01`–`.g09` — Geometry files: extracts cross-section points (station, elevation, Manning's n), bridge geometry (deck elevations, piers, abutments, skew angle, contraction/expansion lengths)
- `.f01`–`.f09` — Flow files: extracts discharge values, profile names, AEP/ARI labels → populates Flow Profiles
- `.r01`–`.r09` — Results files: extracts computed WSEL, velocity, Froude per profile → populates HEC-RAS comparison in QA/QC

After parsing, display a preview panel:
- Tree-view of extracted data grouped by type (geometry, flow, results)
- Checkboxes to select which elements to import
- "Apply" button with confirmation dialog if existing data will be overwritten
- "Undo import" button available for 30 seconds (stores previous project state temporarily)

Error handling:
- Progress bar during parsing
- Error panel showing file line number and issue description if parsing fails
- Graceful partial import — successfully parsed sections import even if others fail

#### CSV/Survey Import (new)

For cross-section survey data:
- Upload `.csv` or `.txt` file
- Auto-detect delimiter (comma, tab, space) and header row presence
- Preview table (first 20 rows) with column mapping dropdowns:
  - "Station" column (required)
  - "Elevation" column (required)
  - "Manning's N" column (optional)
- Supports 12D format (Station, Offset, Elevation) and Civil3D cross-section exports
- Toggle: "Append to existing" or "Replace existing" cross-section data
- Validation: checks for monotonically increasing stations, reasonable elevation range

#### Auto-routing by extension

| Extension | Parser | Destination |
|-----------|--------|-------------|
| `.g01`–`.g09` | HEC-RAS geometry | Data tab forms |
| `.f01`–`.f09` | HEC-RAS flow | Flow Profiles |
| `.r01`–`.r09` | HEC-RAS results | Analysis > QA/QC comparison |
| `.csv`, `.txt` | CSV survey | Cross-Section |
| `.json` | Project JSON | Full project restore |

---

## 3. Hydrology Tab — ARR Data Hub

### Sub-tab: ARR Lookup

**Input panel:**
- Latitude / Longitude text inputs (decimal degrees)
- Lightweight map embed (Leaflet + OpenStreetMap tiles, no API key): click to set location, or type coordinates
- Catchment area input (km²)
- "Fetch IFD Data" button

**API call:** ARR Data Hub public API endpoint for IFD data at the given coordinates.

**Results panel:**
- IFD table: rows = durations (5min, 10min, 15min, 30min, 1hr, 2hr, 3hr, 6hr, 12hr, 24hr, 48hr, 72hr), columns = AEPs (50%, 20%, 10%, 5%, 2%, 1%)
- Intensities in mm/hr
- Critical duration row highlighted based on estimated time of concentration
- RFFE (Regional Flood Frequency Estimation) results if available from ARR for that location

**Offline fallback:** If API unreachable, show informational message with link to ARR Data Hub website. Manual IFD entry still available in Catchment sub-tab.

### Sub-tab: Catchment

**Time of concentration estimators:**
- Bransby-Williams: `tc = 0.0883 × L / (A^0.1 × S^0.2)` where L = stream length (km), A = catchment area (km²), S = equal-area slope (m/km)
- Friends equation: `tc = 0.76 × A^0.38`
- Manual override input
- All three shown, user selects which to use

**Rational method calculator:**
- `Q = C × I × A / 360` (Q in m³/s, I in mm/hr, A in km²)
- Runoff coefficient C: dropdown with ARR Book 5 land-use values (rural: 0.1–0.4, suburban: 0.4–0.7, urban: 0.7–0.9) or manual entry
- Intensity I: auto-populated from IFD table at selected AEP + critical duration. Manual override available.
- Area A: carried from ARR Lookup tab

**Output:**
- Table of Q for each AEP (1%, 2%, 5%, 10%, 20%, 50%)
- **"Send to Flow Profiles"** button: creates flow profile entries in Data > Flow Profiles with:
  - Name: e.g., "1% AEP (ARR)"
  - ARI label: auto-populated
  - Discharge: calculated Q
  - Downstream WSEL: left blank (user fills in, or from HEC-RAS import)
  - Channel slope: left blank (user fills in)

---

## 4. Analysis Tab

### Sub-tab: Overview

Migrated from current Summary tab:
- Regime Matrix (with AI callout)
- Comparison Tables (with AI callouts for method agreement, coefficients, HEC-RAS)
- Afflux Charts (with AI callout)
- Method Suitability panel
- AI geometry callout

Layout unchanged from current Summary. Same components, new location.

### Sub-tab: Methods

Migrated from current Results tab:
- Four method tabs: Energy, Momentum, Yarnell, WSPRO
- Each shows: upstream WSEL, head loss, velocities, Froude numbers, flow regime, iteration log, calculation steps, TUFLOW FLC, input echo
- Completely unchanged.

### Sub-tab: Scour (new)

#### Scour Inputs section (top)

Additional inputs not already captured elsewhere:
- **Bed material**: dropdown — Non-cohesive Sand, Gravel, Cobble, Cohesive Clay, Rock
- **D50 grain size** (mm): numeric input with hint values per material (Sand: 0.1–2mm, Gravel: 2–64mm, etc.)
- **D95 grain size** (mm): optional, for armoring check
- **Upstream bed elevation at bridge** (ft or m): numeric input, defaults to lowest cross-section elevation at bridge opening
- **Existing countermeasure**: dropdown — None, Riprap, Sheet Pile, Gabions, Other (informational, for report only)

#### Pier Scour Results (CSU/HEC-18)

Per pier, calculated using:
```
ys = 2.0 × K1 × K2 × K3 × a^0.65 × y1^0.35 × Fr1^0.43
```

Where:
- K1 = pier nose shape factor: auto-derived from pier shape in bridge geometry (square: 1.1, round-nose: 1.0, cylindrical: 1.0, sharp: 0.9)
- K2 = flow angle correction: `(cos(θ) + L/a × sin(θ))^0.65` where θ = skew angle from bridge geometry
- K3 = bed condition factor: 1.1 for clear-water, variable for live-bed (from bed form lookup)
- a = pier width (from bridge geometry)
- y1 = approach flow depth (from hydraulic results)
- Fr1 = approach Froude number (from hydraulic results)

Display as table: one row per pier showing station, width, K1, K2, K3, scour depth, critical bed elevation (existing bed minus scour depth).

Applied for each flow profile — profile selector at top of section.

#### Contraction Scour Results

First, classify: compare approach velocity against critical velocity for D50 to determine live-bed vs clear-water.

Critical velocity: `Vc = 6.19 × y1^(1/6) × D50^(1/3)` (imperial units)

**Live-bed equation:**
```
y2/y1 = (Q2/Q1)^(6/7) × (W1/W2)^(k1)
ys = y2 - y0
```
Where k1 depends on V*/ω (shear velocity ratio to fall velocity): 0.59, 0.64, or 0.69.

**Clear-water equation:**
```
y2 = [0.025 × Q²/(Dm^(2/3) × W²)]^(3/7)
ys = y2 - y0
```

Display: contracted flow depth, existing depth, contraction scour depth, critical bed elevation.

#### Summary card (top of sub-tab)

- Total scour per pier = pier scour + contraction scour
- Worst-case total scour depth highlighted
- Simple 2D SVG cross-section diagram showing: original bed (brown line), scoured bed (dashed red line), pier rectangles, bridge deck, water surface. Not 3D — just a clean informational sketch.

### Sub-tab: QA/QC (enhanced)

**HEC-RAS comparison (enhanced from current):**
- Data auto-populated when `.r01` results file imported via Data > Import
- Side-by-side table per profile:
  - Columns: Parameter, This App, HEC-RAS, Difference, % Difference
  - Parameters: Upstream WSEL, Head Loss, Velocity, Froude Number
  - Cell color coding: green (<5%), amber (5–10%), red (>10%)
- Overall QA verdict badge: "PASS — All within 5%" or "REVIEW REQUIRED — N parameters exceed 10%"

**Root cause suggestions:**
When divergence >10%, display an AI-generated one-liner per row explaining likely cause:
- "Yarnell method not valid for pressure flow — compare Energy method instead"
- "High skew angle may cause coefficient sensitivity — verify contraction coefficient"
- "Manning's n difference between models — check channel vs overbank roughness"

**QA/QC memo export:**
- Button to generate standalone one-page PDF
- Contains: project name, date, comparison table, verdict, root cause notes
- Suitable for attaching to a submission as a QA record

---

## 5. Assessment Tab

### Sub-tab: Adequacy (new + migrated)

#### Decision Engine card (top, prominent)

For each AEP, determines:
- Worst-case upstream WSEL across all enabled methods
- Flow regime classification: FREE-SURFACE / PRESSURE / OVERTOPPING
- Freeboard value

Critical threshold interpolation:
- Q at pressure flow onset (WSEL reaches low chord)
- Q at overtopping onset (WSEL reaches high chord)
- Q at zero freeboard (WSEL reaches low chord minus freeboard threshold)

**Headline verdict** — large colored badge:
- Green: "Bridge adequate to 1% AEP — free-surface flow, 0.45m freeboard"
- Amber: "Pressure flow at 1% AEP — adequate to 2% AEP"
- Red: "Bridge overtops at 2% AEP — fails TMR criteria"

**Rating curve chart:**
- X-axis: Discharge (m³/s)
- Y-axis: Water level (m AHD) or Afflux (m)
- Lines: worst-case WSEL envelope, low chord (horizontal), high chord (horizontal)
- Shaded zones: green (free-surface), amber (pressure), red (overtopping)
- Vertical lines at critical Q thresholds with labels

#### Freeboard table (migrated, enhanced)

Per AEP row:
- Discharge, worst-case WSEL, low chord, freeboard, status badge (CLEAR / LOW / PRESSURE / OVERTOPPING)
- Freeboard threshold from regulatory settings (configurable)
- Color-coded pass/fail

#### Migrated components
- AI Summary Banner
- Method Suitability panel

### Sub-tab: Regulatory (new)

**Jurisdiction selector:** dropdown — TMR (Queensland), VicRoads, DPIE (NSW), ARR General

Selecting a jurisdiction populates a checklist. Each item has:
- Requirement description
- Auto-check status (where computable) or manual checkbox
- Pass (green check) / Fail (red X) / Manual (grey checkbox) / Not Assessed (dash)

**TMR checklist items (example):**
- [ ] Freeboard ≥ 300mm at 1% AEP → auto-checks from freeboard results
- [ ] No pressure flow at defined design AEP → auto-checks from regime classification
- [ ] Velocity × depth product within limits → auto-checks from hydraulic results
- [ ] Manning's n sensitivity ±20% assessed → auto-checks if sensitivity results exist
- [ ] Debris blockage considered (ARR guidelines) → auto-checks if debris % > 0
- [ ] Scour assessment completed → auto-checks if scour results exist
- [ ] Survey data verified → manual checkbox
- [ ] Tailwater conditions confirmed → manual checkbox
- [ ] Independent QA/QC check completed → auto-checks if QA/QC comparison data exists

**VicRoads, DPIE, ARR General** — similar checklists with jurisdiction-specific thresholds and requirements.

Checklist state saved with project data and snapshots.

Exportable as a compliance summary section in the PDF report.

### Sub-tab: Scenarios

Migrated from current Summary: Scenario Comparison component.

Enhanced: each scenario row now shows a one-line delta summary vs baseline (e.g., "Manning's n +20%, Debris 30% → WSEL +0.15m, Freeboard reduced to 0.12m").

---

## 6. Simulation Tab

### Sub-tab: 3D Model

Existing photorealistic 3D scene — unchanged. Render feature toggles remain.

### Sub-tab: Energy Grade

Existing EGL diagram — unchanged.

### Sub-tab: What-If (migrated from floating panel)

Full sub-tab layout (more space than the floating panel):

**Controls (left column):**
- Manning's n multiplier slider (0.5–2.0, default 1.0)
- Debris blockage % slider (0–100, default from coefficients)
- Contraction coefficient slider
- Expansion coefficient slider
- Discharge multiplier slider (0.5–2.0)
- Profile selector dropdown
- Method selector dropdown

**Live results (right column):**
- Upstream WSEL with delta from baseline
- Head loss with delta
- Velocity with delta
- Froude number with delta
- Regime change warning if parameters shift flow regime
- Green deltas = lower losses, red = higher

**Debris visualization:**
When debris % > 0:
- "Show in 3D" button opens a split view or navigates to 3D Model sub-tab
- 3D model renders a debris mat at bridge upstream face:
  - Brown/timber textured rectangle
  - Spans between low chord and water surface
  - Width = blockage % of opening width (from one side)
  - MeshStandardMaterial with roughness 0.9, brown color

**Debris guidance panel** (collapsible, below controls):
- ARR-recommended blockage percentages:
  - Waterway width <5m: 50%
  - Waterway width 5–20m: 33%
  - Waterway width >20m: 20%
- Modifiers for vegetation density (low: ×0.5, medium: ×1.0, high: ×1.5)
- Modifier for upstream bridges (present: +10%)
- Calculated recommended value
- "Use recommended" button sets the debris slider

---

## 7. Report Tab

### Sub-tab: Narrative (new)

**Tone selector** at top: "Technical" (formal, for regulatory submissions) / "Summary" (plain language, for client reports)

**Report sections** as collapsible cards, each with:
- Section title and description
- Status indicator: Empty (grey) / Generated (blue) / Edited (green)
- "Generate" button — AI writes section using project data as context
- Editable rich text area (Markdown rendered)
- "Regenerate" button — rewrites from scratch (with confirmation if edited)

**Sections:**
1. **Introduction & Scope** — project description, bridge location, assessment purpose, standards referenced
2. **Methodology** — calculation methods enabled, assumptions, software used, input data sources
3. **Hydraulic Analysis** — results interpretation per AEP, regime classifications, method agreement/divergence discussion
4. **Scour Assessment** — pier and contraction scour results, critical elevations, countermeasure status (only shown if scour analysis completed)
5. **Bridge Adequacy** — pass/fail summary, critical discharge thresholds, freeboard status, headline verdict
6. **Sensitivity & Uncertainty** — Manning's n sensitivity results, debris scenario impacts, parameter uncertainty discussion
7. **Conclusions & Recommendations** — overall verdict, recommended actions, conditions/caveats

**AI context:** Each section's generation prompt receives all relevant computed results, inputs, and regulatory checklist status. Every number in the narrative must come from actual computed values — no hallucinated figures. The tone selector adjusts formality and technical depth.

**"Generate All"** button at top: generates all empty sections in sequence. Does not overwrite sections that have already been edited.

### Sub-tab: Export

**PDF Report (enhanced):**
- Section selection: checkboxes for each report section to include/exclude
- Sections available:
  - Cover page (project name, date, jurisdiction)
  - Table of contents
  - Input summary (cross-section, bridge geometry, flow profiles)
  - Hydraulic analysis (method results, calculation steps)
  - Analysis overview (comparison tables, afflux charts, regime matrix)
  - Scour assessment
  - Adequacy & freeboard
  - Regulatory compliance checklist
  - AI narrative sections (if generated)
  - Appendices (iteration logs, detailed calculation steps)
- "Generate PDF" button

**Other exports:**
- JSON project export (existing, relocated here)
- QA/QC memo PDF (standalone one-page comparison)
- Regulatory compliance summary PDF (standalone checklist)
- CSV data export: cross-section points, results table

### Sub-tab: History (new)

**Save snapshot:**
- "Save Snapshot" button
- Dialog: snapshot name (text input), optional note (text area)
- Captures entire project state: all inputs, results, coefficients, checklist state, narrative sections

**Snapshot list:**
- Chronological, most recent first
- Each row: name, timestamp, one-line key values summary (e.g., "Q100 WSEL: 45.2m, Freeboard: 0.3m")
- Actions per row: Restore, Compare, Delete

**Restore:**
- Loads snapshot state, replacing current project data
- Confirmation dialog: "This will replace all current project data. Continue?"

**Compare:**
- Select two snapshots via checkboxes, click "Compare"
- Diff view: side-by-side table of changed inputs (changed cells highlighted)
- Delta table for key results: WSEL, head loss, freeboard — showing old value, new value, change

**Storage:**
- Browser localStorage
- Limit: 20 snapshots per project
- Warning at 18 snapshots: "Approaching limit"
- Export/import snapshots as JSON backup file

---

## 8. Multi-Bridge Reach Analysis

### Data model

Project contains an array of 1–5 bridges. Each bridge has:
- Name (user-entered, e.g., "Main Road Bridge")
- Chainage (position along waterway, meters)
- Its own: cross-section geometry, bridge geometry, pier configuration, coefficients
- Shared: flow profiles (same flood events apply to all bridges)

Default: single bridge (backwards compatible with existing projects).

### Enabling reach mode

**Data tab** — toggle at top: "Single Bridge" / "Reach Analysis"

When "Reach Analysis" selected:
- **Reach sub-tab** appears in Data tab
- Bridge selector dropdown appears in header

### Reach sub-tab

- List of bridges: name, chainage, low chord, configuration status (complete ✅ / incomplete ⚠️)
- Add bridge button (max 5)
- Remove bridge (with confirmation)
- Drag to reorder (or chainage-based auto-sort)
- Reach schematic: simple SVG — horizontal line representing waterway with flow direction arrow, bridge icons at their chainages, labeled

### Bridge selector (header)

- Dropdown: "Bridge 1: Main Rd ▾"
- Badge: "2/3" (viewing bridge 2 of 3)
- Switching bridge updates all tabs to show that bridge's data and results

### Calculation

- "Run Calc" processes all bridges downstream to upstream
- First (most downstream) bridge uses user-specified downstream WSEL from flow profiles
- Each subsequent upstream bridge uses the computed upstream WSEL of the downstream bridge as its tailwater
- If a bridge is incompletely configured, it is skipped with a warning
- Results stored per-bridge in the project store

### Assessment impact

- Adequacy sub-tab: reach summary card at top showing:
  - Which bridge is the bottleneck (highest afflux / first to overtop)
  - Cumulative afflux across the reach
  - Per-bridge verdict in a compact table
- Regulatory checklist applies per-bridge (select bridge via header dropdown)

### Constraints

- Maximum 5 bridges per reach
- No floodplain storage or attenuation between bridges — simple backwater cascade (upstream WSEL of bridge N = downstream WSEL of bridge N+1)
- Each bridge can have different geometry and coefficients
- Flow profiles shared across all bridges

---

## 9. File Structure (New/Modified)

### New engine files
- `src/engine/scour/pier-scour.ts` — CSU/HEC-18 pier scour equation
- `src/engine/scour/contraction-scour.ts` — Live-bed and clear-water contraction scour
- `src/engine/scour/types.ts` — Scour input/result types
- `src/engine/hydrology/rational-method.ts` — Rational method Q = CIA/360
- `src/engine/hydrology/time-of-concentration.ts` — Bransby-Williams, Friends equations
- `src/engine/hydrology/types.ts` — Hydrology types (IFD data, catchment params)
- `src/engine/reach/reach-solver.ts` — Multi-bridge downstream-to-upstream cascade
- `src/engine/adequacy/decision-engine.ts` — Pass/fail classification, critical Q interpolation
- `src/engine/import/hecras-geometry-parser.ts` — Enhanced .g01 parser (cross-section + bridge + piers)
- `src/engine/import/hecras-flow-parser.ts` — .f01 parser
- `src/engine/import/hecras-results-parser.ts` — .r01 parser
- `src/engine/import/csv-survey-parser.ts` — CSV/TXT cross-section parser

### New component files
- `src/components/hydrology/arr-lookup.tsx` — ARR Data Hub lookup with map
- `src/components/hydrology/catchment-calculator.tsx` — Rational method + Tc calculator
- `src/components/analysis/scour-panel.tsx` — Scour inputs + results display
- `src/components/analysis/scour-diagram.tsx` — 2D SVG scour cross-section sketch
- `src/components/analysis/qaqc-panel.tsx` — Enhanced QA/QC comparison + memo export
- `src/components/assessment/adequacy-panel.tsx` — Decision engine + rating curve chart
- `src/components/assessment/regulatory-checklist.tsx` — Jurisdiction checklists
- `src/components/report/narrative-editor.tsx` — Section-by-section AI narrative
- `src/components/report/export-panel.tsx` — Enhanced PDF export with section selection
- `src/components/report/history-panel.tsx` — Snapshot save/restore/compare
- `src/components/data/import-panel.tsx` — Unified import sub-tab (HEC-RAS + CSV)
- `src/components/data/reach-manager.tsx` — Multi-bridge list + reach schematic
- `src/components/simulation/debris-mat.tsx` — 3D debris visualization
- `src/components/simulation/debris-guidance.tsx` — ARR debris recommendation panel

### Modified files
- `src/components/main-tabs.tsx` — Complete restructure to 6 tabs with sub-tabs
- `src/store/project-store.ts` — Multi-bridge data model, snapshots, hydrology state, scour state, narrative state, regulatory checklist state
- `src/engine/types.ts` — New types for scour, hydrology, reach, adequacy, regulatory
- `src/engine/index.ts` — Updated run function for multi-bridge cascade
- `src/components/pdf-report.tsx` — New sections: scour, adequacy, regulatory, narrative
- `src/components/simulation/scene-3d/simulation-scene.tsx` — Debris mat rendering
- `src/components/import/hecras-import-dialog.tsx` — Enhanced to handle geometry + flow + results parsing

### New dependencies
- `leaflet` + `react-leaflet` — Map embed for ARR location picker
- No other new dependencies expected

---

## 10. State Management Changes

The Zustand project store expands to support:

```typescript
interface ProjectStore {
  // Existing (unchanged)
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  flowProfiles: FlowProfile[];
  coefficients: Coefficients;
  results: Results | null;
  // ... existing fields ...

  // Multi-bridge
  bridges: BridgeProject[];          // Array of bridge configs (1-5)
  activeBridgeIndex: number;         // Which bridge is selected
  reachMode: boolean;                // Single vs reach toggle
  reachResults: ReachResults | null; // Per-bridge results after cascade

  // Hydrology
  hydrology: {
    location: { lat: number; lng: number } | null;
    catchmentArea: number;
    ifdData: IFDTable | null;
    tcMethod: 'bransby-williams' | 'friends' | 'manual';
    tcManual: number;
    runoffCoefficient: number;
    calculatedDischarges: { aep: string; q: number }[];
  };

  // Scour
  scourInputs: {
    bedMaterial: BedMaterial;
    d50: number;
    d95: number;
    upstreamBedElevation: number;
    countermeasure: string;
  };
  scourResults: ScourResults | null;

  // Assessment
  adequacyResults: AdequacyResults | null;
  regulatoryJurisdiction: 'tmr' | 'vicroads' | 'dpie' | 'arr';
  regulatoryChecklist: ChecklistItem[];

  // Report
  narrativeSections: NarrativeSection[];
  narrativeTone: 'technical' | 'summary';

  // History
  snapshots: ProjectSnapshot[];
}
```

Each `BridgeProject` contains its own `crossSection`, `bridgeGeometry`, `coefficients`, and per-bridge `results`. Flow profiles remain shared at the project level.

---

## 11. Parallelization Strategy

These features are largely independent and can be built by parallel subagents:

**Independent tracks (can run in parallel):**
- Track A: Navigation restructure + tab migration
- Track B: HEC-RAS enhanced parser + CSV parser + Import panel
- Track C: ARR Data Hub + Catchment calculator + Hydrology tab
- Track D: Scour engine + Scour panel
- Track E: Decision engine + Adequacy panel
- Track F: Regulatory checklist data + panel
- Track G: QA/QC enhancements + memo export
- Track H: AI narrative editor + generation
- Track I: Snapshot history + diff view
- Track J: Debris visualization + guidance

**Sequential dependencies:**
- Track A (navigation) should complete first — all other tracks need to know where their components mount
- Track K: Multi-bridge reach (depends on Track A for bridge selector, and existing engine for cascade logic)
- Track L: Enhanced PDF export (depends on Tracks D, E, F, H for new sections to include)
- Track M: State management updates (should be done early, as all tracks depend on store shape)

**Recommended execution order:**
1. First: Track M (store) + Track A (navigation) — foundation
2. Parallel: Tracks B, C, D, E, F, G, H, I, J — all independent features
3. Last: Track K (multi-bridge) + Track L (PDF export) — integration
