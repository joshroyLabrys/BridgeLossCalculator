# Simulation and Visualization Components

This directory contains the hydraulic simulation visualization, energy grade line diagram, debris tools, and the parameter optimizer. These appear under the **Simulation** tab.

## Components

### SimulationTab (Legacy)

**File:** `simulation-tab.tsx`

This was the original standalone simulation tab component. Its layout and logic have been **inlined into `main-tabs.tsx`** as part of a refactor to consolidate tab state. The file still exists and exports `SimulationTab`, but the main application uses the inlined version.

The layout pattern (now in main-tabs) works as follows:
- A flex row with the main 3D scene on the left and a What-If sidebar on the right.
- Profile and method selectors in the sidebar.
- What-If slider controls that modify parameters and re-run the engine in real-time.
- Impact deltas showing how WSEL, head loss, velocity, and Froude change from baseline.
- Flow regime change alerts when the What-If modifications push the bridge into a different regime.

### EnergyGradeDiagram

**File:** `energy-grade-diagram.tsx`

A D3-based longitudinal profile diagram showing the energy grade line (EGL) and hydraulic grade line (HGL) through four standard cross-sections.

**Sections (upstream to downstream):**
- Section 4 -- approach section (upstream of contraction).
- Section 3 (BU) -- bridge upstream face.
- Section 2 (BD) -- bridge downstream face.
- Section 1 -- exit section (downstream of expansion).

**Visual elements:**
- Ground profile (area fill + line) using a smooth thalweg derived from bridge invert and channel slope.
- Water fill between ground and HGL.
- HGL line (pastel blue, solid).
- EGL line (pastel orange, dashed) with an EGL-HGL band fill.
- Bridge deck rectangle with pier overlays.
- Section divider lines (dashed vertical).
- Velocity head dimension lines (V2/2g bars at sections 4 and 1).
- Total head loss dimension line.
- Flow direction arrow.
- Legend (inset box on desktop, badges on mobile).
- Section data table with WSEL, velocity, Froude, and EGL at each section.

**Mobile responsiveness:**
Below 500px width, the component switches to a compact mode: smaller margins, no SVG legend (replaced by HTML badge row), no velocity head bars, no SVG data table (replaced by a 2x2 HTML card grid below the chart). The `isMobile` flag is detected from container width via `getBoundingClientRect()`.

Uses `ResizeObserver` to redraw on container resize.

### DebrisMat

**File:** `debris-mat.tsx`

A Three.js mesh representing debris blockage at the bridge upstream face. Renders as a rough brown slab spanning from the left abutment inward, filling the specified percentage of the opening between WSEL and low chord.

The geometry is a `BoxGeometry` with vertex displacement on the front face for a rough, organic appearance. Uses `MeshStandardMaterial` with high roughness and zero metalness for a natural debris look. Returns null when blockage is 0% or when WSEL exceeds low chord (pressure flow -- debris is submerged).

### DebrisGuidance

**File:** `debris-guidance.tsx`

A collapsible card providing ARR-recommended debris blockage percentages.

**Calculation:**
- Base blockage by waterway width: <5m = 50%, 5-20m = 33%, >20m = 20%.
- Vegetation density modifier: Low (x0.5), Medium (x1.0), High (x1.5).
- Upstream bridge presence: +10% if upstream bridges exist.
- Clamped to 100%.

Shows a formula breakdown and a "Use Recommended" button that applies the calculated percentage to the What-If debris slider. Displays the bridge span in metres (converted from feet) and the width category.

### OptimizerCard

**File:** `optimizer-card.tsx`

A parameter optimization tool that sweeps a single parameter to find the value that meets a target metric threshold.

**Sweep parameters:** Opening Width, Low Chord Elevation, Manning's n multiplier, Discharge multiplier, Debris %.

**Target metrics:** Minimum Freeboard, Maximum Afflux, Maximum Bridge Velocity.

**How it works:**
1. User selects a parameter to vary and a target metric with threshold.
2. Clicking "Find Optimal" runs `runOptimization()` from `@/engine/optimizer`, which performs a parametric sweep.
3. Results are displayed as a D3 mini-chart showing the sweep line (blue), threshold line (amber dashed), and optimal point (green dot).
4. A result badge shows whether the threshold is achievable and the optimal value.
5. For Opening Width specifically, an "Apply" button updates the bridge geometry abutment stations to match the optimal width.

### Additional Files

- **`simulation-controls.tsx`** -- play/pause and speed controls for the 3D scene animation (retained for the controls API though animation state is managed in the parent).
- **`hydraulic-profile-chart.tsx`** -- chart component for hydraulic profile visualization.
- **`particle-engine.ts`** -- particle system engine for spray and mist effects in the 3D scene.
