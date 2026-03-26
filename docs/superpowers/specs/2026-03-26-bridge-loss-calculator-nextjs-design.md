# Bridge Loss Calculator — Next.js Design Spec

**Date:** 2026-03-26
**Author:** Joshua / Claude
**Purpose:** Next.js web app for independent bridge hydraulic loss calculations to validate HEC-RAS output

---

## 1. Overview

A client-side Next.js web application that computes bridge hydraulic losses using four standard methods (Energy, Momentum, Yarnell, WSPRO), then presents results alongside manually-entered HEC-RAS values for QA comparison. The tool targets practicing hydraulic/civil engineers who need to verify HEC-RAS bridge modeling results.

This is a port of the original Excel VBA spec to a modern web stack, preserving all calculation logic and engineering workflows while improving the UI, portability, and maintainability.

### Key Constraints

- **Platform:** Next.js (App Router) with shadcn/ui components, deployed as a static site
- **Runtime:** Fully client-side — no backend, no database, no user accounts
- **User profile:** Form-based UI with structured sections, no spreadsheet editing
- **Input:** Manual entry via forms (station/elevation pairs, bridge dimensions, flow data)
- **Output:** Step-by-step calculation views, summary comparison tables, Recharts-powered charts
- **Persistence:** JSON export/import for saving and loading projects
- **Charting:** Recharts for all visualizations

### Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router, static export) |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Charts | Recharts |
| Calculation Engine | Pure TypeScript (no UI dependencies) |
| Testing | Vitest (engine), Playwright (E2E) |

---

## 2. App Structure

Single-page application with a tabbed layout. Three main tabs, with sub-tabs where needed.

### 2.1 Top Bar

Always visible. Contains:
- App title: "Bridge Loss Calculator"
- **Import JSON** button — file picker, loads project state
- **Export JSON** button — downloads current project state

### 2.2 Main Tabs

| Tab | Purpose |
|-----|---------|
| **Input** | All user inputs organized in four sub-tabs |
| **Method Results** | Step-by-step calculations per method |
| **Summary & Charts** | Comparison tables, % differences, charts |

### 2.3 Input Tab Sub-Tabs

| Sub-Tab | Content |
|---------|---------|
| **Cross-Section** | Station/elevation table + live preview chart |
| **Bridge Geometry** | Opening geometry form + pier data table + optional low chord profile |
| **Flow Profiles** | Up to 10 flow profiles table |
| **Coefficients** | Energy coefficients, Yarnell K, iteration settings, method selection checkboxes |

### 2.4 Method Results Tab Sub-Tabs

One sub-tab per method: **Energy**, **Momentum**, **Yarnell**, **WSPRO**. Each shows:
- Method header with governing equation and reference citation
- Accordion per flow profile (collapsible)
- Each accordion contains: input echo, step-by-step calculation, iteration log (collapsible), results, TUFLOW FLCs

### 2.5 Summary & Charts Tab

Single scrollable page with comparison tables and charts (detailed in Section 6).

---

## 3. Input Forms

### 3.1 Cross-Section (Sub-Tab 1)

**Layout:** Split — data entry table on left, live Recharts cross-section preview on right.

**Table columns** (dynamic rows, up to 50):

| Column | Type | Description |
|--------|------|-------------|
| Point # | Auto | Row index |
| Station (ft) | Number input | Horizontal distance from left reference |
| Elevation (ft) | Number input | Vertical elevation at station |
| Manning's n | Number input | Roughness coefficient (varies per subsection) |
| Bank Station | Select | "Left Bank", "Right Bank", or "—" |

- **Add Row** button appends a new row
- **Delete Row** button (icon) on each row
- Bank stations define channel vs. overbank boundaries
- Manning's n between bank stations applies to the channel; outside applies to overbanks
- **Live preview** updates the Recharts cross-section plot as data is entered

### 3.2 Bridge Geometry (Sub-Tab 2)

**Opening Geometry** — form fields:

| Field | Type | Description |
|-------|------|-------------|
| Low Chord Elevation (Left) | Number | Bottom of bridge deck at left abutment (ft) |
| Low Chord Elevation (Right) | Number | Bottom of bridge deck at right abutment (ft) |
| High Chord Elevation | Number | Top of bridge deck / roadway surface (ft) |
| Left Abutment Station | Number | Horizontal station of left abutment face (ft) |
| Right Abutment Station | Number | Horizontal station of right abutment face (ft) |
| Left Abutment Slope | Number | Abutment slope in H:V ratio |
| Right Abutment Slope | Number | Abutment slope in H:V ratio |
| Skew Angle | Number | Bridge crossing angle relative to flow (degrees, 0 = perpendicular) |

**Pier Data Table** (up to 10 piers):

| Column | Type | Description |
|--------|------|-------------|
| Pier # | Auto | Index |
| Station (ft) | Number | Centerline station |
| Width (ft) | Number | Pier width perpendicular to flow |
| Shape | Select | Square, Round-nose, Cylindrical, Sharp |

Pier shape selection auto-populates the Yarnell K coefficient (overridable in Coefficients tab).

**Low Chord Profile** (optional collapsible section):
Station/elevation table defining the low chord shape across the opening. If left blank, the tool linearly interpolates between left and right low chord elevations.

### 3.3 Flow Profiles (Sub-Tab 3)

Table with up to 10 flow profiles:

| Column | Type | Description |
|--------|------|-------------|
| Profile Name | Text | User label (e.g., "10-yr", "100-yr") |
| Q (cfs) | Number | Discharge |
| DS WSEL (ft) | Number | Known downstream water surface elevation |
| Channel Slope (ft/ft) | Number | Energy grade line slope |
| Contraction Reach Length (ft) | Number | DS face to DS section (default: bridge opening width) |
| Expansion Reach Length (ft) | Number | US face to US section (default: bridge opening width) |

### 3.4 Coefficients & Settings (Sub-Tab 4)

**Energy Method:**
- Contraction Coefficient (Cc) — default 0.3
- Expansion Coefficient (Ce) — default 0.5

**Yarnell Method:**
- Pier Shape Coefficient (K) — auto-populated from pier shape, with manual override toggle

**Iteration Settings:**
- Max Iterations — default 100
- Convergence Tolerance — default 0.01 ft
- Initial US WSEL Guess Offset — default 0.5 ft (added to DS WSEL)

**Methods to Run:**
- Checkboxes: Energy, Momentum, Yarnell, WSPRO (all checked by default)

### 3.5 Action Buttons

Located at the bottom of the Input tab, always visible:
- **Plot Cross-Section** — switches to a full cross-section view with bridge overlay
- **Clear Results** — wipes all calculated results
- **Run All Methods** — primary action button, executes all selected methods for all profiles

---

## 4. Data Model

### 4.1 TypeScript Types

```typescript
interface CrossSectionPoint {
  station: number;
  elevation: number;
  manningsN: number;
  bankStation: 'left' | 'right' | null;
}

interface Pier {
  station: number;
  width: number;
  shape: 'square' | 'round-nose' | 'cylindrical' | 'sharp';
}

interface LowChordPoint {
  station: number;
  elevation: number;
}

interface BridgeGeometry {
  lowChordLeft: number;
  lowChordRight: number;
  highChord: number;
  leftAbutmentStation: number;
  rightAbutmentStation: number;
  leftAbutmentSlope: number;
  rightAbutmentSlope: number;
  skewAngle: number;
  piers: Pier[];
  lowChordProfile: LowChordPoint[];
}

interface FlowProfile {
  name: string;
  discharge: number;
  dsWsel: number;
  channelSlope: number;
  contractionLength: number;
  expansionLength: number;
}

interface Coefficients {
  contractionCoeff: number;    // default 0.3
  expansionCoeff: number;      // default 0.5
  yarnellK: number | null;     // null = auto from pier shape
  maxIterations: number;       // default 100
  tolerance: number;           // default 0.01
  initialGuessOffset: number;  // default 0.5
  methodsToRun: {
    energy: boolean;
    momentum: boolean;
    yarnell: boolean;
    wspro: boolean;
  };
}

type FlowRegime = 'free-surface' | 'pressure' | 'overtopping';

interface IterationStep {
  iteration: number;
  trialWsel: number;
  computedWsel: number;
  error: number;
}

interface MethodResult {
  profileName: string;
  upstreamWsel: number;
  totalHeadLoss: number;
  approachVelocity: number;
  bridgeVelocity: number;
  froudeApproach: number;
  froudeBridge: number;
  flowRegime: FlowRegime;
  iterationLog: IterationStep[];
  converged: boolean;
  calculationSteps: CalculationStep[];
  tuflowPierFLC: number;
  tuflowSuperFLC: number | null;  // null for free-surface
  error: string | null;
}

interface CalculationStep {
  stepNumber: number;
  description: string;
  formula: string;
  intermediateValues: Record<string, number>;  // labeled intermediate results
  result: number;
  unit: string;
}

interface HecRasComparison {
  profileName: string;
  upstreamWsel: number | null;
  headLoss: number | null;
  pierFLC: number | null;
  superFLC: number | null;
}

interface ProjectState {
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  flowProfiles: FlowProfile[];
  coefficients: Coefficients;
  results: {
    energy: MethodResult[];
    momentum: MethodResult[];
    yarnell: MethodResult[];
    wspro: MethodResult[];
  } | null;
  hecRasComparison: HecRasComparison[];
}
```

### 4.2 State Management

Zustand store holding the `ProjectState`. Actions:
- `updateCrossSection(points)` — replaces cross-section data
- `updateBridgeGeometry(geom)` — replaces bridge geometry
- `updateFlowProfiles(profiles)` — replaces flow profiles
- `updateCoefficients(coeffs)` — replaces coefficients
- `setResults(results)` — stores calculation output
- `clearResults()` — wipes results
- `updateHecRasComparison(data)` — updates manual HEC-RAS entries
- `exportProject()` — serializes state to JSON string
- `importProject(json)` — parses JSON and replaces entire state

### 4.3 JSON Export Format

The exported JSON is a serialized `ProjectState` with a version field for forward compatibility:

```json
{
  "version": 1,
  "crossSection": [...],
  "bridgeGeometry": {...},
  "flowProfiles": [...],
  "coefficients": {...},
  "hecRasComparison": [...]
}
```

Results are not exported — they are recomputed on import.

---

## 5. Calculation Engine

Pure TypeScript module with zero UI dependencies. All functions are pure (input → output, no side effects).

### 5.1 Module Structure

```
src/
  engine/
    geometry.ts          — flow area, wetted perimeter, hydraulic radius, top width, conveyance
    bridge-geometry.ts   — bridge opening area, pier blockage, net area, skew correction
    hydraulics.ts        — friction slope, Manning's equation, velocity head, Froude number
    iteration.ts         — bisection/secant solver with convergence tracking
    flow-regime.ts       — free surface / pressure / overtopping detection
    tuflow-flc.ts        — back-calculated TUFLOW form loss coefficients
    methods/
      energy.ts          — energy method (standard step, 4 cross-sections)
      momentum.ts        — momentum balance
      yarnell.ts         — Yarnell pier loss (direct for free surface)
      wspro.ts           — FHWA WSPRO method
    types.ts             — shared type definitions
    index.ts             — public API: runAllMethods(state) → results
```

### 5.2 Shared Hydraulic Functions

All methods depend on these geometric/hydraulic property computations:

| Function | Description |
|----------|-------------|
| `calcFlowArea(crossSection, wsel)` | Trapezoidal integration of cross-section below WSEL |
| `calcWettedPerimeter(crossSection, wsel)` | Sum of segment lengths below WSEL |
| `calcHydraulicRadius(crossSection, wsel)` | A / P |
| `calcTopWidth(crossSection, wsel)` | Water surface width |
| `calcConveyance(crossSection, wsel, manningsN)` | (1.486/n) × A × R^(2/3) per subsection, summed |
| `calcBridgeOpeningArea(bridgeGeom, crossSection, wsel)` | Net area below low chord minus pier blockage |
| `calcPierBlockage(piers, wsel)` | Total pier area below WSEL |
| `detectFlowRegime(wsel, lowChord, highChord)` | Returns FlowRegime enum |
| `calcTuflowPierFLC(pierHeadLoss, approachVelocity)` | h_pier / (V²/2g) |
| `calcTuflowSuperFLC(superHeadLoss, approachVelocity)` | h_super / (V²/2g), null for free-surface |

### 5.3 Iteration Engine

Bisection method with secant method acceleration:

1. Establish bounds: lower = DS WSEL, upper = DS WSEL + 10 ft
2. Bisect to narrow range
3. Switch to secant method once within 0.5 ft
4. Converge to tolerance (default 0.01 ft)
5. Log each iteration step to the result's `iterationLog` array
6. Flag if max iterations reached without convergence

### 5.4 Energy Method

**Reference:** HEC-RAS Hydraulic Reference Manual, Chapter 5

Standard step method computing energy balance between four cross-sections:
1. Section 1 (downstream) — cross-section geometry, offset by expansion reach length
2. Section BD (bridge downstream face) — cross-section clipped to bridge opening
3. Section BU (bridge upstream face) — cross-section clipped to bridge opening
4. Section 3 (upstream / approach) — cross-section geometry, offset by contraction reach length

Uses the single input cross-section at all four locations (simplified hand-calculation approach).

Steps per profile:
1. Compute hydraulic properties at downstream section using DS WSEL
2. Estimate friction losses (Manning's equation) between sections
3. Compute contraction loss: h_c = Cc × |Δ(αV²/2g)|
4. Compute expansion loss: h_e = Ce × |Δ(αV²/2g)|
5. Iterate on upstream WSEL until energy balance converges: WS_us = WS_ds + h_f + h_c + h_e

### 5.5 Momentum Method

**Reference:** HEC-RAS Hydraulic Reference Manual, Chapter 5

Momentum balance across the bridge opening:
1. Compute hydrostatic pressure forces upstream and downstream of bridge
2. Compute momentum flux (ρQV) at upstream and downstream faces
3. Account for weight component along channel slope
4. Account for friction force on bed and walls
5. Account for pier/abutment drag forces
6. Iterate on upstream WSEL until momentum equation balances: ΣF = ΔM

### 5.6 Yarnell Method

**Reference:** Yarnell, D.L. (1934), "Bridge Piers as Channel Obstructions"

Governing equation:
```
Δy = K × (K + 5 - 0.6) × (α + 15α⁴) × (V²/2g)
```

Where K = pier shape coefficient (Square: 1.25, Round-nose: 0.9, Cylindrical: 1.0, Sharp: 0.7), α = pier obstruction ratio, V = downstream velocity.

Direct (non-iterative) for free-surface flow. Flags "Not Applicable" for pressure/overtopping.

### 5.7 WSPRO Method

**Reference:** FHWA Report FHWA-IP-87-7

Uses bridge opening ratio, eccentricity, and Froude number corrections:
1. Compute bridge opening ratio M = K_q / K_total (conveyance ratio)
2. Compute eccentricity factor
3. Look up base coefficient C_b from M
4. Apply Froude number correction
5. Apply eccentricity correction
6. Compute backwater: Δh = C × α₁ × (V₁²/2g)

### 5.8 Flow Regime Handling

| Regime | Condition | Calculation Path |
|--------|-----------|-----------------|
| **Free Surface** | WSEL < Low Chord | Standard open-channel bridge loss equations |
| **Pressure Flow** | Low Chord < WSEL < High Chord | Orifice-type flow equations (sluice gate analogy) |
| **Overtopping** | WSEL > High Chord | Weir flow over deck + pressure/orifice flow through opening |

Each method switches logic based on detected regime.

### 5.9 Error Handling

- Input validation before running: missing data, negative values, inconsistent geometry
- Each method catches division-by-zero, negative area, supercritical flow
- Errors stored in `MethodResult.error` with descriptive messages
- Summary table marks errored cells with "ERR" badge

---

## 6. Summary & Charts Tab

### 6.1 Comparison Tables

**Upstream WSEL Table** — methods (rows) × profiles (columns):
- One row per method (Energy, Momentum, Yarnell, WSPRO)
- Gold-highlighted HEC-RAS row with editable number inputs for manual entry
- Auto-calculated % difference row (computed on head loss Δh, not WSEL)
- Conditional formatting: green (<5%), yellow (5–10%), red (>10%)
- Absolute difference row (ft)

**Head Loss Table** — same matrix format for Δh values.

**TUFLOW Form Loss Coefficients Table** — methods × profiles:
- Pier FLC and Superstructure FLC per method per profile
- Superstructure FLC shows "N/A" for free-surface flow
- Gold HEC-RAS row for manual comparison entry

**Additional Tables:**
- Velocity comparison (approach velocity per method × profile)
- Froude number comparison
- Bridge opening ratio

### 6.2 Flow Regime Matrix

Method × profile matrix showing regime badges:
- F = Free surface (blue)
- P = Pressure flow (orange)
- O = Overtopping (purple)
- Mismatches between methods or vs. HEC-RAS highlighted in red

### 6.3 Charts (Recharts)

**Chart 1: Cross-Section Profile with Water Surfaces**
- `AreaChart` or custom SVG for ground line from station/elevation data
- Bridge deck overlay (low chord and high chord as reference lines)
- Piers as rectangular reference areas
- Color-coded horizontal lines per method for selected profile
- Dropdown to switch between flow profiles

**Chart 2: Head Loss Comparison Bar Chart**
- `BarChart` with grouped bars: one group per flow profile, one bar color per method
- HEC-RAS value shown as a `ReferenceLine` per group

**Chart 3: Upstream WSEL Comparison**
- `LineChart`: x-axis = discharge, y-axis = US WSEL
- One `Line` per method + HEC-RAS

---

## 7. Method Results Tab

### 7.1 Layout

Sub-tabs for each method: Energy, Momentum, Yarnell, WSPRO.

Each method tab shows:

**Method Header:**
- Method name, governing equation (rendered text), reference citation

**Flow Profile Accordions** (one per profile, collapsible):

Each accordion header shows at a glance:
- Profile name and discharge
- Convergence badge: "CONVERGED" (green) or "NOT CONVERGED" (red)
- Flow regime badge: "FREE SURFACE" (blue), "PRESSURE" (orange), "OVERTOPPING" (purple)
- US WSEL and Δh values

Each accordion body contains:

1. **Input Echo** — key computed hydraulic properties in a 4-column grid (flow area, hydraulic radius, bridge opening area, pier blockage)
2. **Step-by-Step Calculation** — monospace formatted equations showing each computation step with intermediate values
3. **Iteration Log** — collapsible table showing iteration #, trial WSEL, computed WSEL, error, convergence status
4. **Results** — final values: US WSEL, head loss, velocities, Froude numbers
5. **TUFLOW FLCs** — pier FLC and superstructure FLC

---

## 8. Project Structure

```
src/
  app/
    layout.tsx             — root layout with top bar
    page.tsx               — single page with main tab container
    globals.css            — Tailwind + shadcn theme
  components/
    top-bar.tsx            — app header with import/export buttons
    main-tabs.tsx          — Input / Method Results / Summary tabs container
    input/
      cross-section-form.tsx   — station/elevation table + live preview
      bridge-geometry-form.tsx — opening geometry form + pier table
      flow-profiles-form.tsx   — flow profiles table
      coefficients-form.tsx    — coefficients and method selection
      action-buttons.tsx       — Run All / Clear / Plot buttons
    results/
      method-tabs.tsx          — Energy/Momentum/Yarnell/WSPRO sub-tabs
      method-view.tsx          — single method display with header + accordions
      profile-accordion.tsx    — collapsible flow profile result
      calculation-steps.tsx    — step-by-step calculation renderer
      iteration-log.tsx        — collapsible iteration table
    summary/
      comparison-tables.tsx    — WSEL, head loss, TUFLOW FLC tables
      regime-matrix.tsx        — flow regime comparison matrix
      hecras-input-row.tsx     — editable gold HEC-RAS comparison row
      charts.tsx               — all three Recharts charts
    cross-section-chart.tsx    — reusable Recharts cross-section visualization
  engine/
    (as described in Section 5.1)
  store/
    project-store.ts           — Zustand store with ProjectState
  lib/
    json-io.ts                 — export/import JSON helpers with validation
    validation.ts              — input validation logic
    constants.ts               — default coefficients, pier shape K values
```

---

## 9. User Workflow

1. Open the app in a browser
2. **Input tab → Cross-Section:** Enter station/elevation points, verify with live preview
3. **Input tab → Bridge Geometry:** Enter opening dimensions and pier data
4. **Input tab → Flow Profiles:** Enter discharge and downstream WSEL per profile
5. **Input tab → Coefficients:** Review defaults, adjust if needed, select methods
6. Click **Run All Methods**
7. **Method Results tab:** Review step-by-step calculations per method per profile
8. **Summary tab:** Enter HEC-RAS values in gold rows for comparison
9. Review comparison tables and charts for discrepancies
10. **Export JSON** to save work for later

---

## 10. Assumptions and Limitations

Carried forward from the original spec — these are hydraulic modeling constraints, not platform limitations:

- **Steady-state flow only** — no unsteady/hydrograph routing
- **1D calculations** — no 2D flow distribution effects
- **Subcritical flow assumed** — supercritical conditions flagged but not fully solved
- **No roadway overtopping weir geometry** — uses simplified rectangular weir for overtopping
- **Single bridge opening** — no multiple-opening or relief bridge support
- **No ice or debris loading** — clean opening assumed
- **English units only** — ft, cfs, ft/ft
- **Up to 50 cross-section points, 10 piers, 10 flow profiles** — practical limits (can be raised later if needed since we're no longer bound by Excel)
