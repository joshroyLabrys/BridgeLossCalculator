# Engineering Workstation Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Bridge Loss Calculator into a full hydraulic engineering workstation with 10 new features across data import, hydrology, scour analysis, bridge adequacy, regulatory compliance, AI reporting, and multi-bridge reach analysis.

**Architecture:** Expand existing Zustand store with new slices for hydrology, scour, adequacy, regulatory, narrative, and snapshots. Restructure from 4-tab to 6-tab two-level navigation. Each feature is a self-contained module with its own engine files, types, and UI components.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand 5, Vitest, D3, Three.js/R3F, @react-pdf/renderer, Leaflet (new), Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-29-engineering-workstation-design.md`

---

## Execution Order

### Phase 1 — Foundation (sequential, must complete first)
- **Task 1:** Types & Store Expansion
- **Task 2:** Navigation Restructure (6-tab two-level nav)

### Phase 2 — Features (parallel, all independent)
- **Task 3:** Import Panel (HEC-RAS enhanced + CSV parser)
- **Task 4:** Hydrology Tab (ARR Data Hub + Catchment calculator)
- **Task 5:** Scour Engine + Panel
- **Task 6:** Bridge Adequacy Decision Engine + Panel
- **Task 7:** Regulatory Checklist
- **Task 8:** QA/QC Enhancements
- **Task 9:** AI Narrative Editor
- **Task 10:** Snapshot History + Diff View
- **Task 11:** Debris Visualization + Guidance

### Phase 3 — Integration (sequential, depends on Phase 2)
- **Task 12:** Multi-Bridge Reach Analysis
- **Task 13:** Enhanced PDF Export

---

### Task 1: Types & Store Expansion

**Files:**
- Modify: `app/src/engine/types.ts`
- Modify: `app/src/store/project-store.ts`
- Create: `app/src/engine/scour/types.ts`
- Create: `app/src/engine/hydrology/types.ts`

**What to build:**

Add all new types to `engine/types.ts`:

```typescript
// Scour types
export type BedMaterial = 'sand' | 'gravel' | 'cobble' | 'clay' | 'rock';

export interface ScourInputs {
  bedMaterial: BedMaterial;
  d50: number;           // mm
  d95: number;           // mm
  upstreamBedElevation: number;
  countermeasure: 'none' | 'riprap' | 'sheet-pile' | 'gabions' | 'other';
}

export interface PierScourResult {
  pierIndex: number;
  station: number;
  width: number;
  k1: number;
  k2: number;
  k3: number;
  scourDepth: number;
  criticalBedElevation: number;
}

export interface ContractionScourResult {
  type: 'live-bed' | 'clear-water';
  criticalVelocity: number;
  approachVelocity: number;
  contractedDepth: number;
  existingDepth: number;
  scourDepth: number;
  criticalBedElevation: number;
}

export interface ScourResults {
  profileName: string;
  pierScour: PierScourResult[];
  contractionScour: ContractionScourResult;
  totalWorstCase: number;
}

// Hydrology types
export interface IFDTable {
  durations: number[];       // minutes
  aeps: string[];            // '1%', '2%', etc.
  intensities: number[][];   // [duration][aep] in mm/hr
}

export interface HydrologyState {
  location: { lat: number; lng: number } | null;
  catchmentArea: number;
  streamLength: number;
  equalAreaSlope: number;
  ifdData: IFDTable | null;
  tcMethod: 'bransby-williams' | 'friends' | 'manual';
  tcManual: number;
  runoffCoefficient: number;
  calculatedDischarges: { aep: string; q: number }[];
}

// Adequacy types
export interface AdequacyResult {
  profileName: string;
  ari: string;
  discharge: number;
  worstCaseWsel: number;
  regime: FlowRegime;
  freeboard: number;
  status: 'clear' | 'low' | 'pressure' | 'overtopping';
}

export interface AdequacyResults {
  profiles: AdequacyResult[];
  pressureOnsetQ: number | null;
  overtoppingOnsetQ: number | null;
  zeroFreeboardQ: number | null;
  verdict: string;
  verdictSeverity: 'pass' | 'warning' | 'fail';
}

// Regulatory types
export type Jurisdiction = 'tmr' | 'vicroads' | 'dpie' | 'arr';

export interface ChecklistItem {
  id: string;
  requirement: string;
  jurisdiction: Jurisdiction;
  autoCheck: boolean;       // can be auto-evaluated
  status: 'pass' | 'fail' | 'manual-pass' | 'manual-fail' | 'not-assessed';
}

// Narrative types
export interface NarrativeSection {
  id: string;
  title: string;
  description: string;
  content: string;
  status: 'empty' | 'generated' | 'edited';
}

// Snapshot types
export interface ProjectSnapshot {
  id: string;
  name: string;
  note: string;
  timestamp: number;
  summaryLine: string;
  state: SerializedProjectState;
}

export interface SerializedProjectState {
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  flowProfiles: FlowProfile[];
  coefficients: Coefficients;
  results: CalculationResults | null;
  hecRasComparison: HecRasComparison[];
  scourInputs: ScourInputs;
  scourResults: ScourResults[] | null;
  adequacyResults: AdequacyResults | null;
  regulatoryJurisdiction: Jurisdiction;
  regulatoryChecklist: ChecklistItem[];
  narrativeSections: NarrativeSection[];
  narrativeTone: 'technical' | 'summary';
  hydrology: HydrologyState;
}

// Multi-bridge types
export interface BridgeProject {
  id: string;
  name: string;
  chainage: number;
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  coefficients: Coefficients;
  results: CalculationResults | null;
  scourInputs: ScourInputs;
  scourResults: ScourResults[] | null;
}

export interface ReachResults {
  bridgeResults: { bridgeId: string; results: CalculationResults }[];
  tailwaterCascade: { bridgeId: string; dsWsel: number; usWsel: number }[];
}
```

Expand project store with new state slices and actions:
- `hydrology: HydrologyState` with setters
- `scourInputs: ScourInputs` with `updateScourInputs`
- `scourResults: ScourResults[] | null` with `setScourResults`
- `adequacyResults: AdequacyResults | null` with `setAdequacyResults`
- `regulatoryJurisdiction: Jurisdiction` with `setJurisdiction`
- `regulatoryChecklist: ChecklistItem[]` with `updateChecklistItem`
- `narrativeSections: NarrativeSection[]` with `updateNarrativeSection`
- `narrativeTone` with setter
- `snapshots: ProjectSnapshot[]` with `saveSnapshot`, `restoreSnapshot`, `deleteSnapshot`
- `bridges: BridgeProject[]` with `addBridge`, `removeBridge`, `updateBridge`, `setActiveBridgeIndex`
- `activeBridgeIndex: number`
- `reachMode: boolean` with `setReachMode`
- `reachResults: ReachResults | null`
- `activeSubTab: Record<string, string>` for tracking sub-tab state per main tab

Change `activeMainTab` default from `'input'` to `'data'`.

- [ ] Step 1: Add all new types to `engine/types.ts`
- [ ] Step 2: Create `engine/scour/types.ts` re-exporting scour types
- [ ] Step 3: Create `engine/hydrology/types.ts` re-exporting hydrology types
- [ ] Step 4: Expand `project-store.ts` with all new state slices, defaults, and actions
- [ ] Step 5: Run `npm run build` to verify no type errors
- [ ] Step 6: Commit

---

### Task 2: Navigation Restructure

**Files:**
- Modify: `app/src/components/main-tabs.tsx` — Complete rewrite to 6-tab two-level nav
- Modify: `app/src/store/project-store.ts` — Update default tab names

**What to build:**

Replace the current 4-tab structure with 6 workflow-ordered tabs. Each top tab reveals sub-tabs on a second row.

Tab structure:
```
Data:       Cross-Section | Bridge | Flow Profiles | Coefficients | Import | Reach*
Hydrology:  ARR Lookup | Catchment
Analysis:   Overview | Methods | Scour | QA/QC
Assessment: Adequacy | Regulatory | Scenarios
Simulation: 3D Model | Energy Grade | What-If
Report:     Narrative | Export | History
```

*Reach only visible when `reachMode === true`.

Migration:
- Input tab content → Data tab (same sub-tabs: Cross-Section, Bridge, Flow Profiles, Coefficients)
- Results tab content → Analysis > Methods sub-tab
- Summary tab content splits:
  - RegimeMatrix, ComparisonTables, AffluxCharts, MethodSuitability, AI geometry callout → Analysis > Overview
  - FreeboardCheck, AiSummaryBanner → Assessment > Adequacy
  - ScenarioComparison → Assessment > Scenarios
- Simulation tab → Simulation > 3D Model + Energy Grade (existing content split)
- What-If sidebar → Simulation > What-If sub-tab (full width)

New sub-tabs get placeholder content ("Coming soon — [Feature Name]") until their respective tasks implement them:
- Data > Import
- Data > Reach
- Hydrology > ARR Lookup
- Hydrology > Catchment
- Analysis > Scour
- Analysis > QA/QC (enhanced version, for now show existing)
- Assessment > Adequacy (for now show existing freeboard)
- Assessment > Regulatory
- Report > Narrative
- Report > Export
- Report > History

Header bar changes:
- Brand row unchanged
- Bridge selector dropdown (hidden when reachMode is false)
- Action buttons stay in header

Use the store's `activeMainTab` and new `activeSubTab` record to track navigation state.

- [ ] Step 1: Update store with `activeSubTab` tracking and new default tab values
- [ ] Step 2: Rewrite main-tabs.tsx with 6-tab structure and sub-tab routing
- [ ] Step 3: Move existing components to their new tab locations
- [ ] Step 4: Add placeholder components for unimplemented sub-tabs
- [ ] Step 5: Verify existing functionality works in new locations (no broken imports)
- [ ] Step 6: Run `npm run build`
- [ ] Step 7: Commit

---

### Task 3: Import Panel

**Files:**
- Create: `app/src/components/data/import-panel.tsx`
- Create: `app/src/engine/import/csv-survey-parser.ts`
- Modify: `app/src/lib/hecras-parser.ts` — Add results file parsing
- Modify: `app/src/components/import/hecras-import-dialog.tsx` — Enhance for .r01 support

**What to build:**

**CSV Survey Parser** (`engine/import/csv-survey-parser.ts`):
- Parse CSV/TXT with auto-detected delimiter (comma, tab, space)
- Auto-detect header row (first row with non-numeric values)
- Return parsed rows as `{ station: number, elevation: number, manningsN?: number }[]`
- Export `parseCsvSurvey(text: string, mapping: ColumnMapping): CrossSectionPoint[]`
- Export `detectDelimiter(text: string): string`
- Export `detectHeaders(text: string, delimiter: string): string[]`

**HEC-RAS Results Parser** (addition to existing `hecras-parser.ts`):
- Parse `.r01` files for: profile WSEL, velocity, Froude at each cross-section
- Export `parseHecRasResults(text: string): HecRasResultsData`
- Results map to `HecRasComparison[]` type

**Import Panel** (`components/data/import-panel.tsx`):
- Full-page drag-and-drop zone
- File type auto-detection by extension
- For HEC-RAS files: opens existing dialog (enhanced)
- For CSV files: shows inline preview with column mapping dropdowns
- For JSON: triggers existing project import
- Append/Replace toggle for CSV
- Validation messages for bad data

- [ ] Step 1: Write tests for CSV parser (delimiter detection, header detection, parsing)
- [ ] Step 2: Implement CSV parser
- [ ] Step 3: Write tests for HEC-RAS results parser
- [ ] Step 4: Implement HEC-RAS results parser
- [ ] Step 5: Build import-panel.tsx component
- [ ] Step 6: Wire into Data > Import sub-tab
- [ ] Step 7: Run build + tests
- [ ] Step 8: Commit

---

### Task 4: Hydrology Tab

**Files:**
- Create: `app/src/engine/hydrology/rational-method.ts`
- Create: `app/src/engine/hydrology/time-of-concentration.ts`
- Create: `app/src/components/hydrology/arr-lookup.tsx`
- Create: `app/src/components/hydrology/catchment-calculator.tsx`

**Dependencies to install:** `leaflet`, `react-leaflet`, `@types/leaflet`

**What to build:**

**Time of Concentration** (`engine/hydrology/time-of-concentration.ts`):
```typescript
export function bransbyWilliams(streamLength: number, catchmentArea: number, slope: number): number {
  // tc = 0.0883 × L / (A^0.1 × S^0.2)  — tc in hours
  return 0.0883 * streamLength / (Math.pow(catchmentArea, 0.1) * Math.pow(slope, 0.2));
}

export function friends(catchmentArea: number): number {
  // tc = 0.76 × A^0.38  — tc in hours
  return 0.76 * Math.pow(catchmentArea, 0.38);
}
```

**Rational Method** (`engine/hydrology/rational-method.ts`):
```typescript
export function rationalMethod(C: number, I: number, A: number): number {
  // Q = C × I × A / 360  — Q in m³/s, I in mm/hr, A in km²
  return (C * I * A) / 360;
}

export function lookupIntensity(ifdData: IFDTable, durationMin: number, aep: string): number {
  // Interpolate IFD table for given duration and AEP
  // ...
}
```

**ARR Lookup Component** (`components/hydrology/arr-lookup.tsx`):
- Leaflet map (OpenStreetMap tiles, no API key)
- Click map or type lat/lng to set location
- Catchment area input
- "Fetch IFD Data" button → calls ARR Data Hub API
- IFD results table with highlighted critical duration row
- Offline fallback message with link to ARR website

**Catchment Calculator** (`components/hydrology/catchment-calculator.tsx`):
- Three Tc estimators shown (Bransby-Williams, Friends, manual) with radio selection
- Input fields: stream length, slope (for Bransby-Williams)
- Runoff coefficient dropdown (ARR Book 5 land-use values)
- Results table: Q per AEP
- "Send to Flow Profiles" button → creates FlowProfile entries in store

- [ ] Step 1: Write tests for time-of-concentration functions
- [ ] Step 2: Implement time-of-concentration
- [ ] Step 3: Write tests for rational method
- [ ] Step 4: Implement rational method + IFD lookup
- [ ] Step 5: Install leaflet dependencies
- [ ] Step 6: Build ARR lookup component
- [ ] Step 7: Build catchment calculator component
- [ ] Step 8: Wire into Hydrology tab sub-tabs
- [ ] Step 9: Run build + tests
- [ ] Step 10: Commit

---

### Task 5: Scour Engine + Panel

**Files:**
- Create: `app/src/engine/scour/pier-scour.ts`
- Create: `app/src/engine/scour/contraction-scour.ts`
- Create: `app/src/components/analysis/scour-panel.tsx`
- Create: `app/src/components/analysis/scour-diagram.tsx`

**What to build:**

**Pier Scour** (`engine/scour/pier-scour.ts`):
```typescript
// CSU/HEC-18 equation: ys = 2.0 × K1 × K2 × K3 × a^0.65 × y1^0.35 × Fr1^0.43
export function pierShapeFactor(shape: Pier['shape']): number {
  // square: 1.1, round-nose: 1.0, cylindrical: 1.0, sharp: 0.9
}
export function flowAngleFactor(skewAngle: number, pierLength: number, pierWidth: number): number {
  // K2 = (cos(θ) + L/a × sin(θ))^0.65
}
export function bedConditionFactor(isLiveBed: boolean): number {
  // 1.1 for clear-water, 1.1 for plane-bed live-bed
}
export function calculatePierScour(pier: Pier, y1: number, Fr1: number, skewAngle: number, bedElevation: number, isLiveBed: boolean): PierScourResult
```

**Contraction Scour** (`engine/scour/contraction-scour.ts`):
```typescript
// Critical velocity: Vc = 6.19 × y1^(1/6) × D50^(1/3) (imperial, ft and ft/s)
export function criticalVelocity(y1: number, d50ft: number): number
export function liveBedScour(y1: number, Q1: number, Q2: number, W1: number, W2: number, k1: number): ContractionScourResult
export function clearWaterScour(Q: number, Dm: number, W: number, y0: number): ContractionScourResult
export function calculateContractionScour(inputs: ContractionScourInputs): ContractionScourResult
```

**Scour Panel** (`components/analysis/scour-panel.tsx`):
- Scour inputs form at top (bed material dropdown, D50, D95, bed elevation, countermeasure)
- Profile selector dropdown
- Pier scour results table: per pier with all K factors and scour depth
- Contraction scour results card
- Total scour summary card at top

**Scour Diagram** (`components/analysis/scour-diagram.tsx`):
- SVG cross-section showing: original bed (brown), scoured bed (dashed red), pier rectangles, bridge deck, water surface
- D3-based, similar style to existing cross-section chart

- [ ] Step 1: Write tests for pier scour K-factors and equation
- [ ] Step 2: Implement pier scour
- [ ] Step 3: Write tests for contraction scour (live-bed and clear-water)
- [ ] Step 4: Implement contraction scour
- [ ] Step 5: Build scour panel component with inputs and results
- [ ] Step 6: Build scour diagram SVG
- [ ] Step 7: Wire into Analysis > Scour sub-tab
- [ ] Step 8: Run build + tests
- [ ] Step 9: Commit

---

### Task 6: Bridge Adequacy Decision Engine + Panel

**Files:**
- Create: `app/src/engine/adequacy/decision-engine.ts`
- Create: `app/src/components/assessment/adequacy-panel.tsx`

**What to build:**

**Decision Engine** (`engine/adequacy/decision-engine.ts`):
```typescript
export function computeAdequacy(
  results: CalculationResults,
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  freeboardThreshold: number,
  jurisdiction: Jurisdiction
): AdequacyResults
```

Logic:
- For each profile, find worst-case WSEL across all methods
- Classify regime per profile
- Interpolate: Q at pressure onset, Q at overtopping onset, Q at zero freeboard
- Generate verdict string based on jurisdiction requirements
- verdictSeverity: 'pass' if all AEPs clear, 'warning' if pressure at design AEP, 'fail' if overtopping

**Adequacy Panel** (`components/assessment/adequacy-panel.tsx`):
- Large verdict badge at top (green/amber/red) with verdict text
- Rating curve chart (D3): Q vs WSEL with low chord and high chord horizontal lines, shaded regime zones
- Freeboard table (migrated from current FreeboardCheck, enhanced)
- Migrated: AiSummaryBanner, MethodSuitability
- Critical Q threshold callouts

- [ ] Step 1: Write tests for decision engine (all regime classifications, interpolation)
- [ ] Step 2: Implement decision engine
- [ ] Step 3: Build adequacy panel with verdict, rating curve, freeboard table
- [ ] Step 4: Migrate AiSummaryBanner and MethodSuitability to new location
- [ ] Step 5: Wire into Assessment > Adequacy sub-tab
- [ ] Step 6: Run build + tests
- [ ] Step 7: Commit

---

### Task 7: Regulatory Checklist

**Files:**
- Create: `app/src/config/regulatory-checklists.ts`
- Create: `app/src/components/assessment/regulatory-checklist.tsx`

**What to build:**

**Checklist Data** (`config/regulatory-checklists.ts`):
- Export checklist definitions per jurisdiction (TMR, VicRoads, DPIE, ARR General)
- Each item: id, requirement text, autoCheck flag, evaluator function
- Auto-check evaluators receive project state and return pass/fail

TMR items:
- Freeboard ≥ 300mm at 1% AEP
- No pressure flow at design AEP
- V×d product check
- Manning's n sensitivity ±20% assessed
- Debris blockage considered
- Scour assessment completed
- Survey data verified (manual)
- Tailwater confirmed (manual)
- Independent QA/QC check completed

**Regulatory Panel** (`components/assessment/regulatory-checklist.tsx`):
- Jurisdiction dropdown at top
- Checklist with auto/manual status indicators
- Progress bar showing completion
- Manual checkboxes for non-auto items
- Checklist state persisted in store

- [ ] Step 1: Define checklist data for all 4 jurisdictions with evaluator functions
- [ ] Step 2: Build regulatory checklist component
- [ ] Step 3: Wire auto-check evaluators to project state
- [ ] Step 4: Wire into Assessment > Regulatory sub-tab
- [ ] Step 5: Run build
- [ ] Step 6: Commit

---

### Task 8: QA/QC Enhancements

**Files:**
- Create: `app/src/components/analysis/qaqc-panel.tsx`
- Modify: `app/src/components/summary/comparison-tables.tsx` (reference for existing HEC-RAS comparison)

**What to build:**

**Enhanced QA/QC Panel** (`components/analysis/qaqc-panel.tsx`):
- Side-by-side comparison table per profile: This App vs HEC-RAS
- Columns: Parameter, App Value, HEC-RAS Value, Δ, %Δ
- Parameters: Upstream WSEL, Head Loss, Velocity, Froude
- Cell color: green (<5%), amber (5-10%), red (>10%)
- Overall verdict badge
- Root cause suggestion per row when >10% divergence (AI-generated one-liner using existing /api/ai-summary endpoint pattern)
- QA/QC memo export button → generates one-page PDF using @react-pdf/renderer

- [ ] Step 1: Build QA/QC panel component with comparison table
- [ ] Step 2: Add color-coded divergence cells
- [ ] Step 3: Add verdict badge logic
- [ ] Step 4: Add root cause AI suggestions (call existing AI endpoint pattern)
- [ ] Step 5: Add QA/QC memo PDF export
- [ ] Step 6: Wire into Analysis > QA/QC sub-tab
- [ ] Step 7: Run build
- [ ] Step 8: Commit

---

### Task 9: AI Narrative Editor

**Files:**
- Create: `app/src/components/report/narrative-editor.tsx`
- Create: `app/src/lib/api/narrative-prompts.ts`
- Create: `app/src/app/api/ai-narrative/route.ts`

**What to build:**

**Narrative Prompts** (`lib/api/narrative-prompts.ts`):
- Per-section system prompts that receive project data context
- 7 sections: Introduction, Methodology, Hydraulic Analysis, Scour, Adequacy, Sensitivity, Conclusions
- Each prompt includes actual computed values — no hallucinated figures
- Tone parameter adjusts formality

**API Route** (`app/api/ai-narrative/route.ts`):
- POST endpoint receiving: sectionId, projectData, tone
- Uses OpenAI client (already in project) to generate section text
- Returns generated markdown text

**Narrative Editor** (`components/report/narrative-editor.tsx`):
- Tone selector: Technical / Summary
- 7 collapsible section cards
- Each card: title, description, status badge, Generate/Regenerate button, editable textarea
- "Generate All" button generates all empty sections sequentially
- Sections that depend on missing data (e.g., Scour section when no scour results) show "Run scour analysis first"
- Content stored in store's `narrativeSections`

- [ ] Step 1: Define narrative prompt templates for all 7 sections
- [ ] Step 2: Create API route for narrative generation
- [ ] Step 3: Build narrative editor component with collapsible cards
- [ ] Step 4: Wire generation, editing, and regeneration
- [ ] Step 5: Wire into Report > Narrative sub-tab
- [ ] Step 6: Run build
- [ ] Step 7: Commit

---

### Task 10: Snapshot History + Diff View

**Files:**
- Create: `app/src/components/report/history-panel.tsx`
- Modify: `app/src/store/project-store.ts` — snapshot actions (already stubbed in Task 1)

**What to build:**

**History Panel** (`components/report/history-panel.tsx`):
- "Save Snapshot" button → dialog with name + note inputs
- Snapshot captures full serialized project state
- Summary line auto-generated from key results (e.g., "Q100 WSEL: 45.2m, Freeboard: 0.3m")
- Snapshot list: name, timestamp, summary, actions (Restore, Delete)
- Compare mode: select 2 snapshots via checkboxes, "Compare" button
- Diff view: side-by-side table of changed inputs (highlighted), delta table for results
- Storage: localStorage with `bridge-calc-snapshots-{projectName}` key
- Limit: 20 snapshots, warning at 18
- Export/import snapshots as JSON

- [ ] Step 1: Implement snapshot save/restore/delete in store (serialize full state to localStorage)
- [ ] Step 2: Build history panel with snapshot list
- [ ] Step 3: Build save dialog
- [ ] Step 4: Build diff/compare view
- [ ] Step 5: Wire into Report > History sub-tab
- [ ] Step 6: Run build
- [ ] Step 7: Commit

---

### Task 11: Debris Visualization + Guidance

**Files:**
- Create: `app/src/components/simulation/debris-mat.tsx`
- Create: `app/src/components/simulation/debris-guidance.tsx`
- Modify: `app/src/components/simulation/scene-3d/simulation-scene.tsx` — Add debris mesh

**What to build:**

**Debris Mat** (`simulation/debris-mat.tsx`):
- R3F mesh: brown box positioned at upstream bridge face
- Between water surface and low chord
- Width = blockage % × opening width
- MeshStandardMaterial with brown color, high roughness

**Debris Guidance** (`simulation/debris-guidance.tsx`):
- Collapsible panel with ARR-recommended blockage percentages
- Waterway width thresholds: <5m (50%), 5-20m (33%), >20m (20%)
- Vegetation density modifier dropdown
- Upstream bridges modifier
- Calculated recommended value
- "Use recommended" button updates debris slider

Wire debris mat into 3D scene when debris % > 0.
Wire guidance panel into Simulation > What-If sub-tab.

- [ ] Step 1: Build debris mat mesh component
- [ ] Step 2: Build debris guidance panel
- [ ] Step 3: Integrate debris mat into simulation scene
- [ ] Step 4: Wire guidance into What-If sub-tab
- [ ] Step 5: Run build
- [ ] Step 6: Commit

---

### Task 12: Multi-Bridge Reach Analysis

**Files:**
- Create: `app/src/engine/reach/reach-solver.ts`
- Create: `app/src/components/data/reach-manager.tsx`
- Modify: `app/src/components/main-tabs.tsx` — Bridge selector in header
- Modify: `app/src/engine/index.ts` — Multi-bridge cascade run

**What to build:**

**Reach Solver** (`engine/reach/reach-solver.ts`):
```typescript
export function runReachAnalysis(
  bridges: BridgeProject[],
  profiles: FlowProfile[],
): ReachResults
```
- Process bridges downstream to upstream
- First bridge uses profile's dsWsel
- Each upstream bridge uses previous bridge's computed upstream WSEL

**Reach Manager** (`components/data/reach-manager.tsx`):
- Single/Reach toggle
- Bridge list with name, chainage, status
- Add/remove/reorder bridges
- SVG reach schematic

**Header integration:**
- Bridge selector dropdown when reachMode is true
- Switching bridge updates active bridge index

- [ ] Step 1: Write tests for reach solver cascade
- [ ] Step 2: Implement reach solver
- [ ] Step 3: Build reach manager component
- [ ] Step 4: Add bridge selector to header
- [ ] Step 5: Wire reach toggle and bridge switching into store
- [ ] Step 6: Run build + tests
- [ ] Step 7: Commit

---

### Task 13: Enhanced PDF Export

**Files:**
- Create: `app/src/components/report/export-panel.tsx`
- Modify: `app/src/components/pdf-report.tsx` — Add new sections

**What to build:**

**Export Panel** (`components/report/export-panel.tsx`):
- Section checkboxes for PDF content selection
- Available sections: Cover, TOC, Inputs, Hydraulic Analysis, Overview, Scour, Adequacy, Regulatory, AI Narrative, Appendices
- Generate PDF button
- Other exports: JSON, QA/QC memo PDF, Regulatory summary PDF, CSV data

**PDF Report enhancements:**
- New pages: Scour assessment, Adequacy verdict + rating curve, Regulatory checklist, AI narrative sections
- Cover page with jurisdiction
- Table of contents

- [ ] Step 1: Build export panel with section selection UI
- [ ] Step 2: Add scour section to PDF report
- [ ] Step 3: Add adequacy section to PDF report
- [ ] Step 4: Add regulatory checklist section to PDF report
- [ ] Step 5: Add AI narrative sections to PDF report
- [ ] Step 6: Wire into Report > Export sub-tab
- [ ] Step 7: Run build
- [ ] Step 8: Commit
