# Data Input Forms

This directory contains all form components for defining the hydraulic inputs to a bridge analysis. These forms are presented under the **Data** tab and represent the minimum information required before running calculations.

All forms read from and write to the Zustand project store. Values are stored internally in imperial units (feet, cfs); the display layer handles metric conversion via `toDisplay`/`toImperial` from `@/lib/units`.

## Components

### CrossSectionForm

**File:** `cross-section-form.tsx`

Defines the channel cross-section as a table of station-elevation-Manning's n points with optional bank station markers (left/right).

**Features:**
- Editable table with columns: row number, Station, Elevation, Manning's n, Bank designation, and a delete button.
- **Add Row** button appends a new point with default Manning's n of 0.035.
- **Import CSV** button accepts `.csv`, `.txt`, or `.tsv` files. The parser reads columns as station, elevation, optional Manning's n, and optional bank label (`left`/`right`). Unrecognized Manning's n values default to 0.035.
- Live **Preview** chart (using `CrossSectionChart`) updates as the user types.
- **Bridge Overlay** chart below the preview shows the cross-section with bridge geometry, pier locations, downstream water surface, per-method upstream WSEL lines, and an optional **Hazard Overlay** toggle that appears after results are computed.

### BridgeGeometryForm

**File:** `bridge-geometry-form.tsx`

Defines bridge opening geometry in two cards:

1. **Opening Geometry** -- low chord elevations (left and right), high chord elevation, left/right abutment stations, skew angle, contraction length, and expansion length. Also includes pressure/overtopping parameters: orifice Cd, weir Cw, and deck width (used when WSEL exceeds low chord).

2. **Pier Data** -- a table of piers with station, width, and nose shape (square, round-nose, cylindrical, sharp). The shape selection feeds directly into Yarnell K factor lookup and HEC-18 pier scour K1 correction.

3. **Low Chord Profile** (collapsible, optional) -- custom station-elevation pairs for a non-linear low chord. If left empty, the engine linearly interpolates between left and right low chord elevations.

### FlowProfilesForm

**File:** `flow-profiles-form.tsx`

Defines up to 10 discharge scenarios, each with:
- **Name** -- free text identifier (e.g., "Q100").
- **ARI/AEP** -- text label for the average recurrence interval or annual exceedance probability.
- **Q** -- discharge in the active unit system (m3/s or cfs).
- **DS WSEL** -- downstream water surface elevation (the boundary condition).
- **Channel Slope** -- used for normal depth approximation in some methods.

The table enforces a maximum of 10 profiles. Profiles are stored in the order entered and processed sequentially by all calculation methods.

### CoefficientsForm

**File:** `coefficients-form.tsx`

Controls method coefficients and solver settings in a single card:

- **Method Toggles** -- color-coded toggle buttons for Energy, Momentum, Yarnell, and WSPRO. Only enabled methods run when the user clicks "Run All Methods."
- **Energy Coefficients** -- contraction coefficient (Cc) and expansion coefficient (Ce).
- **Yarnell K** -- nullable; if left blank ("Auto"), the engine derives K from pier shape. Manual override available.
- **Debris Blockage (%)** -- 0-100, clamped. Reduces the effective bridge opening area.
- **Solver Settings** -- max iterations, convergence tolerance, initial guess offset, Manning's n sensitivity percentage (nullable; "Off" skips sensitivity runs), alpha override (nullable; "Auto" computes from velocity distribution), and freeboard threshold.

### ActionButtons

**File:** `action-buttons.tsx`

Three primary actions plus a test bridge dialog:

1. **Load Test Bridge** -- opens a full-screen dialog with a grid of pre-defined test bridges. Each bridge card shows a looping video preview, name, location, and description. Selecting a bridge and clicking "Load" populates all input forms (converting from metric authoring units to imperial engine units), immediately runs all methods, triggers AI summary generation, and navigates to the Analysis tab.

2. **Clear** -- resets results and sensitivity results to null, clears validation errors.

3. **Run All Methods** -- the primary action:
   - Validates inputs via `validateInputs()`. Blocking errors prevent execution; warnings are displayed but do not block.
   - Clears any existing AI summary.
   - Shows a loading spinner ("Processing...") while computation runs in a deferred `setTimeout` (allowing the UI to paint the loading state).
   - Calls `runAllMethods()` with current cross-section, bridge geometry, flow profiles, and coefficients.
   - If Manning's n sensitivity is enabled, also calls `runWithSensitivity()`.
   - Stores results, navigates to the Analysis tab, shows a success toast, and triggers `fetchAiSummary()`.

The action bar is sticky at the bottom of the Data tab panel for easy access while scrolling through input forms.
