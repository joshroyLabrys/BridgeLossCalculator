# FlowSuite Hydrology Module — Design Spec

## Overview

A guided hydrology workflow that takes an engineer from catchment parameters through to design flood discharges, following the ARR2019 methodology. Six-step wizard interface. Clark unit hydrograph engine with full ensemble temporal pattern processing. Produces design flows that feed directly into BLC via localStorage.

**Route:** `flowsuite.app/hydro`
**Target user:** Australian hydraulic engineers performing design flood estimation for bridge waterway assessments
**Standard:** Australian Rainfall and Runoff 2019 (ARR2019)

## Constraints

- In-browser only, no backend
- All calculations in metric (mm, km², m³/s, hours)
- No DEM processing — engineer provides catchment parameters from their GIS
- ARR data primarily via file upload (engineer's existing datahub download)
- API fetch as convenience fallback
- Shares @flowsuite/engine, @flowsuite/ui, @flowsuite/data packages with BLC

---

## 1. Process Flow

```
REAL-LIFE STEP                          HYDRO APP STEP
─────────────────────────────────────   ──────────────────────────────
1. Define catchment in GIS              → Step 1: CATCHMENT
   Get area, stream length, slope          Manual entry + location picker

2. Download ARR Data Hub output         → Step 2: ARR DATA
   IFD, temporal patterns, losses          Upload datahub .txt file (or API fetch)

3. Determine storm losses               → Step 3: LOSSES
   IL, CL, pre-burst, ARF                 Auto-populated, engineer can override

4. Estimate time of concentration       → Step 4: TIME OF CONCENTRATION
   Empirical formulas                      3 methods shown, engineer picks one

5. Run design storms                    → Step 5: DESIGN STORMS
   All AEPs × durations × patterns         Clark UH engine, auto-find critical duration

6. Produce design flows table           → Step 6: DESIGN FLOWS
   Final Q per AEP                         Summary table + Send to BLC + Export
```

---

## 2. Wizard UI

Six steps with a progress bar at top. Back/forward navigation. Each step validates before allowing forward progression.

### Step 1: Catchment

**Inputs:**
- Catchment name (text, for labelling)
- Location: lat/lng text inputs + Leaflet map with click-to-place marker (reuse LeafletMap from BLC). Determines ARR region.
- Catchment area (km²) — required
- Main stream length (km) — required
- Equal-area slope (m/km) — required

**Guidance panel** (right side desktop, below on mobile):
- Brief explanation of each parameter
- "These values come from your GIS analysis"

**Validation:** All numeric fields > 0. Location optional but recommended.

### Step 2: ARR Data

**Primary: file upload**
- Drag-and-drop zone: "Upload your ARR Data Hub output file"
- Parses the standard datahub text file format
- Extracts: IFD table, temporal patterns (10 per AEP group), areal reduction factors, storm losses (IL, CL), pre-burst depths

**Secondary: API fetch**
- "Or fetch from ARR Data Hub" link
- Uses lat/lng from Step 1
- Falls back gracefully if API unavailable

**Post-parse display:**
- IFD table (durations x AEPs) — read-only confirmation
- Temporal patterns count: "10 patterns loaded per AEP group"
- Loss parameter summary
- ARF values
- Green checkmarks per parsed section
- Warning badges for any missing/malformed sections

### Step 3: Losses

**All fields pre-populated from ARR data, all editable:**

| Parameter | Source | Notes |
|-----------|--------|-------|
| Storm initial loss (mm) | ARR median | Per AEP if available |
| Continuing loss (mm/hr) | ARR | Typically constant across AEPs |
| Pre-burst depth (mm) | ARR | Per AEP × duration |
| Areal reduction factor | ARR | Per AEP × duration |
| Impervious fraction (%) | Manual | Default 0 for rural catchments |

**Guidance:** "ARR2019 recommends these values for your location. Override only with site-specific calibration data."
**Warning badge** if user deviates >50% from ARR values.

### Step 4: Time of Concentration

**Three methods auto-calculated from Step 1 inputs:**
- Bransby-Williams: `tc = 0.0883 × L / (A^0.1 × S^0.2)` — result in hours + minutes
- Friends: `tc = 0.76 × A^0.38` — result in hours + minutes
- Manual override input

**Radio selector** to adopt one value. Selected method highlighted.

**Storage coefficient R:**
- Default: `R = 1.5 × Tc` (standard Australian practice for ungauged catchments)
- Editable override

**Critical duration search range:**
- Auto: 0.5×Tc to 2.0×Tc, rounded to standard ARR durations
- Standard durations: 10, 15, 20, 30, 45, 60, 90, 120, 180, 270, 360, 540, 720, 1080, 1440, 2160, 2880, 4320 minutes
- Engineer can narrow or expand

### Step 5: Design Storms

**"Run Analysis" button** triggers computation.

**Computation (per AEP):**
For each AEP (50%, 20%, 10%, 5%, 2%, 1%):
  For each duration in search range:
    1. Point rainfall depth = IFD intensity × duration
    2. Areal rainfall = point × ARF
    3. For each of 10 temporal patterns:
       a. Build hyetograph: areal depth × pattern fractions
       b. Apply losses (pre-burst → IL → CL → impervious)
       c. Route through Clark UH (Tc, R parameters)
       d. Record peak Q
    4. Median peak Q across 10 patterns
  Critical duration = duration with highest median Q

**Results display:**

1. **Summary card (top):** Per AEP — critical duration, median peak Q. Table format.

2. **Hydrograph chart (D3):**
   - 10 ensemble hydrographs for selected AEP + critical duration
   - Median in bold primary color
   - Min/max as shaded band
   - Dropdown to switch AEP
   - X: time (hours), Y: discharge (m³/s)

3. **Full results matrix (expandable):**
   - Rows = durations, columns = AEPs
   - Cells = median peak Q
   - Critical duration cells highlighted
   - Click cell to expand: see all 10 pattern results

### Step 6: Design Flows

**Summary table:**

| AEP | ARI | Critical Duration | Design Q (m³/s) | Ensemble Range |
|-----|-----|-------------------|-----------------|----------------|
| 50% | 2yr | 45 min | 12.4 | 10.1 – 15.8 |
| 20% | 5yr | 1 hr | 28.7 | 24.2 – 33.1 |
| 10% | 10yr | 1 hr | 45.2 | 39.8 – 51.4 |
| 5% | 20yr | 1.5 hr | 62.1 | 54.3 – 70.8 |
| 2% | 50yr | 1.5 hr | 89.3 | 78.6 – 101.2 |
| 1% | 100yr | 2 hr | 112.5 | 98.4 – 128.7 |

**Actions:**
- "Send to BLC" → writes to localStorage (`flowsuite:hydro:latest-flows`), navigates to `/blc`
- "Export JSON" → downloads `.json` file
- "Export CSV" → downloads `.csv`
- "Copy to clipboard" → table data as TSV

**Optional: Flood Frequency Analysis (collapsible section)**
- "Cross-check with gauge data"
- Paste or upload annual maximum series (year, Q)
- Fits Log Pearson III distribution
- Shows FFA estimates alongside rainfall-based estimates
- Flags divergence >30%

---

## 3. Clark Unit Hydrograph Engine

Located in `@flowsuite/engine` at `packages/engine/src/hydrology/`.

### Parameters
- **Tc** — time of concentration (hours)
- **R** — storage delay coefficient (hours). Default: 1.5 × Tc.
- **Timestep** — 0.1 × Tc (min 1 min, max 15 min), auto-selected

### Computation Pipeline (per storm)

```
1. DESIGN RAINFALL DEPTH
   depth_mm = IFD_intensity(duration, AEP) × duration_hours
   areal_depth = depth_mm × ARF(duration, AEP)

2. TEMPORAL DISTRIBUTION
   For each timestep i:
     rain[i] = areal_depth × pattern_fraction[i]
   → rainfall hyetograph (mm per timestep)

3. EXCESS RAINFALL (loss model)
   a. Subtract pre-burst from total depth budget
   b. Initial loss: accumulate rainfall until IL exhausted
   c. Continuing loss: subtract CL×dt from each remaining timestep
   d. Impervious: that fraction contributes rain with zero losses
   excess[i] = max(0, rain[i] - losses[i]) × (1 - fImp) + rain[i] × fImp

4. CLARK TIME-AREA ROUTING
   Linear time-area curve: A(t) = t/Tc for t ≤ Tc
   Instantaneous UH: translate excess rainfall by time-area fractions

5. LINEAR RESERVOIR ROUTING
   Storage equation: S = R × Q
   Routing: Q[i+1] = C1 × I[i+1] + C2 × I[i] + C3 × Q[i]
   where C1 = C2 = dt/(2R + dt), C3 = (2R - dt)/(2R + dt)
   → routed hydrograph

6. EXTRACT RESULTS
   Peak Q (m³/s), time to peak (hours), runoff volume (ML),
   runoff coefficient (volume_out / volume_in)
```

### Key Engine Files

```
hydrology/clark-uh.ts
  - clarkUnitHydrograph(excessRainfall: number[], tc: number, r: number, dt: number): number[]
  - routeLinearReservoir(inflow: number[], r: number, dt: number): number[]

hydrology/loss-model.ts
  - applyLosses(rainfall: number[], il: number, cl: number, preBurst: number, impervious: number, dt: number): number[]

hydrology/design-storm-runner.ts
  - runDesignStorms(config: DesignStormConfig): DesignStormResults
  - Orchestrates: all AEPs × durations × 10 patterns
  - Returns: critical duration per AEP, median Q, full hydrograph data

hydrology/arr-parser.ts
  - parseARRDataHub(text: string): ARRDataHubOutput
  - Lenient parser — handles missing sections gracefully

hydrology/flood-frequency.ts
  - fitLogPearsonIII(annualMaxima: number[]): FFAResult
  - Fits LP3 distribution, returns Q per AEP
```

---

## 4. ARR Data Hub File Parser

### Input Format

The ARR datahub output is a plain text file with sections delimited by headers. Key sections:

```
[Site Details]
Latitude: -27.4698
Longitude: 153.0251
...

[IFD Depths]
Duration,50%,20%,10%,5%,2%,1%
1min,8.2,11.4,14.1,...
2min,...
...

[Temporal Patterns]
AEP Group: Frequent
Duration: 60 min
Pattern 1: 0.02,0.05,0.08,0.12,0.18,0.22,0.15,0.10,0.05,0.02,0.01
Pattern 2: ...
...

[Areal Reduction Factors]
Duration,50%,20%,10%,5%,2%,1%
60min,0.95,0.94,...
...

[Losses]
Storm Initial Loss (median): 25 mm
Continuing Loss: 2.4 mm/hr
Pre-burst (1% AEP, 60min): 12.5 mm
...
```

### Output Type

```typescript
interface ARRDataHubOutput {
  siteDetails: {
    lat: number;
    lng: number;
    name: string;
  };
  ifd: {
    durations: number[];     // minutes
    aeps: string[];          // '50%', '20%', etc.
    depths: number[][];      // [durationIdx][aepIdx] in mm
  };
  temporalPatterns: {
    group: 'frequent' | 'infrequent' | 'rare';
    durationMin: number;
    patterns: number[][];    // 10 arrays, each sums to ~1.0
  }[];
  arf: {
    durations: number[];
    aeps: string[];
    factors: number[][];     // [durationIdx][aepIdx]
  };
  losses: {
    initialLoss: number;     // mm (median)
    continuingLoss: number;  // mm/hr
    preBurst: {
      aep: string;
      durationMin: number;
      depth: number;         // mm
    }[];
  };
  warnings: string[];        // any parsing issues
}
```

Parser is lenient — missing sections produce warnings, not errors. Partial results are usable.

---

## 5. Hydrology Types

Added to `@flowsuite/engine` types:

```typescript
// ── Hydrology engine types ──

interface DesignStormConfig {
  ifd: ARRDataHubOutput['ifd'];
  temporalPatterns: ARRDataHubOutput['temporalPatterns'];
  arf: ARRDataHubOutput['arf'];
  losses: {
    initialLoss: number;
    continuingLoss: number;
    preBurst: ARRDataHubOutput['losses']['preBurst'];
    imperviousFraction: number;
  };
  tc: number;              // hours
  r: number;               // hours (storage coefficient)
  catchmentArea: number;   // km²
  aeps: string[];          // which AEPs to run
  durationRange: number[]; // durations to test (minutes)
}

interface StormRunResult {
  aep: string;
  durationMin: number;
  patternIndex: number;
  peakQ: number;           // m³/s
  timeToPeak: number;      // hours
  runoffVolume: number;    // ML
  runoffCoefficient: number;
  hydrograph: { time: number; q: number }[];
}

interface DesignStormResults {
  runs: StormRunResult[];
  summary: {
    aep: string;
    criticalDurationMin: number;
    medianPeakQ: number;
    minPeakQ: number;
    maxPeakQ: number;
    medianHydrograph: { time: number; q: number }[];
  }[];
}

interface FFAResult {
  annualMaxima: { year: number; q: number }[];
  logPearsonIII: {
    mean: number;
    stdDev: number;
    skew: number;
  };
  quantiles: { aep: string; q: number; confidenceLow: number; confidenceHigh: number }[];
}

interface HydroFlowExport {
  projectName: string;
  catchmentArea: number;
  location: { lat: number; lng: number } | null;
  timestamp: number;
  flows: {
    aep: string;
    ari: string;
    criticalDurationMin: number;
    designQ: number;
    ensembleMin: number;
    ensembleMax: number;
  }[];
}
```

---

## 6. App File Structure

```
packages/engine/src/hydrology/
├── clark-uh.ts                # Clark UH convolution + linear reservoir routing
├── loss-model.ts              # IL/CL/pre-burst/impervious loss application
├── design-storm-runner.ts     # Orchestrator: all AEPs × durations × patterns
├── arr-parser.ts              # ARR datahub file parser
├── flood-frequency.ts         # Log Pearson III FFA
├── rational-method.ts         # Existing
├── time-of-concentration.ts   # Existing
└── types.ts                   # Hydrology-specific types (above)

apps/web/src/app/hydro/
├── page.tsx                   # Wizard container + step state management
├── store.ts                   # Zustand store (independent from BLC)
├── components/
│   ├── wizard-nav.tsx         # Progress bar + back/forward/step indicators
│   ├── step-catchment.tsx     # Step 1: location, area, length, slope
│   ├── step-arr-data.tsx      # Step 2: file upload + API fetch + parsed display
│   ├── step-losses.tsx        # Step 3: editable loss parameters
│   ├── step-tc.tsx            # Step 4: Tc methods + R coefficient + duration range
│   ├── step-design-storms.tsx # Step 5: run button + results + hydrograph chart
│   ├── step-design-flows.tsx  # Step 6: summary table + send/export actions
│   ├── hydrograph-chart.tsx   # D3 ensemble hydrograph visualization
│   ├── ifd-table.tsx          # IFD display component (read-only table)
│   ├── results-matrix.tsx     # Expandable duration × AEP results grid
│   └── ffa-panel.tsx          # Optional flood frequency cross-check
```

---

## 7. BLC Integration

### Sending data (Hydro → BLC)

"Send to BLC" button in Step 6:
1. Serializes `HydroFlowExport` to JSON
2. Writes to `localStorage` key `flowsuite:hydro:latest-flows`
3. Navigates to `/blc`

### Receiving data (BLC)

When BLC page loads, check for `flowsuite:hydro:latest-flows`:
- If present, show import banner at top of Data tab
- Banner: "Design flows from Hydrology — [N] profiles ready" with Import and Dismiss buttons
- Import creates FlowProfile entries: name = "1% AEP (Hydro)", ari = "1%", discharge = designQ, dsWsel and channelSlope left blank
- Dismiss clears the localStorage key

### Export button (standalone)

"Export JSON" and "Export CSV" buttons in Step 6 download the data as files. Can be imported into BLC manually via the Import panel, or used in other software.

---

## 8. Landing Page Update

Change the Hydrology card in the launcher from "Soon" (disabled) to "Available" (clickable link to `/hydro`).

---

## 9. Hydro Store

Independent Zustand store at `apps/web/src/app/hydro/store.ts`:

```typescript
interface HydroStore {
  // Step 1
  projectName: string;
  location: { lat: number; lng: number } | null;
  catchmentArea: number;
  streamLength: number;
  equalAreaSlope: number;

  // Step 2
  arrData: ARRDataHubOutput | null;
  arrWarnings: string[];

  // Step 3
  adoptedLosses: {
    initialLoss: number;
    continuingLoss: number;
    preBurst: { aep: string; durationMin: number; depth: number }[];
    imperviousFraction: number;
  };
  arfOverrides: Record<string, number>;  // "duration-aep" → factor

  // Step 4
  tcMethod: 'bransby-williams' | 'friends' | 'manual';
  tcManual: number;
  rCoefficient: number;
  durationRange: number[];  // selected durations to test

  // Step 5
  results: DesignStormResults | null;
  isRunning: boolean;

  // Step 6
  ffaData: { year: number; q: number }[] | null;
  ffaResults: FFAResult | null;

  // Navigation
  currentStep: number;  // 0-5

  // Actions
  setStep: (step: number) => void;
  setCatchment: (data: Partial<Pick<HydroStore, 'projectName' | 'location' | 'catchmentArea' | 'streamLength' | 'equalAreaSlope'>>) => void;
  setArrData: (data: ARRDataHubOutput) => void;
  updateLosses: (losses: Partial<HydroStore['adoptedLosses']>) => void;
  setTcMethod: (method: HydroStore['tcMethod']) => void;
  setTcManual: (value: number) => void;
  setRCoefficient: (value: number) => void;
  setDurationRange: (durations: number[]) => void;
  setResults: (results: DesignStormResults) => void;
  setIsRunning: (running: boolean) => void;
  setFFAData: (data: { year: number; q: number }[]) => void;
  setFFAResults: (results: FFAResult) => void;
  reset: () => void;
}
```
