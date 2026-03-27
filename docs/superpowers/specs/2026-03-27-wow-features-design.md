# Wow-Factor Features Design

## Overview

A set of visual and interactive features designed to make the Bridge Loss Calculator stand out in professional engineering demos. Target audience: hydraulic/civil engineers evaluating the tool against HEC-RAS and spreadsheets.

**Build now:** Features 1-4
**Build later:** Feature 5

---

## Feature 1: Animated Hydraulic Simulation (Showstopper)

### Placement
- New 4th tab in the main header: **Input | Method Results | Summary | Simulation**
- This tab will later also house Feature 5 (3D Bridge Viz) as a toggle/sub-tab

### View
A 2D longitudinal profile (side-on view of the bridge). Static geometry (bed, bridge, water surface) rendered with D3/SVG. Particle animation rendered on a Canvas overlay for performance:

- **Channel bed**: Profile rendered as the lowest elevation path from cross-section data
- **Bridge structure**: Deck as a solid rectangle between low chord and high chord elevations, piers dropping down, abutments on sides
- **Water surface**: Animated line/fill showing upstream and downstream WSEL with the constriction effect visible under the bridge
- **Particles**: Small circles flowing left-to-right through the channel, speed proportional to local velocity. They bunch up and accelerate through the bridge opening

### Flow Regime Visual Effects
- **Free-surface**: Smooth particle flow, water surface visible below deck
- **Pressure flow**: Water surface meets deck, particles become turbulent/chaotic under bridge, subtle pulsing glow on submerged deck
- **Overtopping**: Particles arc over deck top, waterfall-style cascade on downstream side

### Controls
- **Flow profile selector**: Dropdown or segmented control to pick which flow profile (e.g. "1% AEP - 450 m³/s")
- **Method selector**: Toggle which method's results drive the water surface (Energy / Momentum / Yarnell / WSPRO), or "All" to show ghost lines for each
- **Play/Pause**: Particles animate continuously, can be paused
- **Speed slider**: Control particle animation speed (0.5x to 3x)

### Data Source
All data comes from already-computed results in the Zustand store + input geometry. No new calculations needed. The simulation is purely a visualization of existing results. Tab is disabled / shows a message if calculations haven't been run yet.

---

## Feature 2: Animated Convergence Visualizer

### Placement
Replaces or enhances the existing "Iteration Log" section within each method's results tab. The static iteration table remains below the animation for engineers who want raw numbers.

### Visualization
A D3 animated chart:
- **X-axis**: Iteration number (1, 2, 3...)
- **Y-axis**: WSEL guess value
- **Animated line**: Draws itself point-by-point as if the solver is running in real-time. Bounces high, overshoots low, settles toward the converged value
- **Target line**: Dashed horizontal line at the final converged WSEL
- **Tolerance band**: Shaded region around the target showing the convergence tolerance
- **Terminal states**:
  - **Converged**: Line enters tolerance band, subtle pulse/glow, "Converged" badge
  - **Diverged**: Line dramatically flies off screen, "Diverged" warning

### Trigger
Auto-plays when the user opens that method's results. Replay button to watch again.

---

## Feature 3: Flood Hazard Heatmap on Cross-Section

### Placement
Enhancement to the existing D3 cross-section chart on the Input tab. A toggle button above the chart: "Show Hazard Overlay."

### Visualization
- Existing cross-section profile stays as-is
- When toggled on, the filled area below the water surface is colored by TUFLOW flood hazard classification
- Color bands mapped to depth x velocity thresholds:
  - **H1 (safe)**: Green
  - **H2 (low)**: Yellow
  - **H3 (moderate)**: Orange
  - **H4 (high)**: Red
  - **H5 (extreme)**: Deep red / dark
- Hazard classification varies across the cross-section because depth changes at each station point (deeper in main channel, shallower on floodplains)
- Small legend showing hazard categories

### Requirements
- A flow profile must be selected — dropdown next to the toggle for profile selection
- If results haven't been run yet, the toggle is disabled with tooltip: "Run calculations first"
- Hover any point in the colored zone to see depth, velocity, and hazard class at that station

---

## Feature 4: "What If" Instant Scenarios

### Placement
Floating panel/drawer that slides in from the right edge of the screen. Accessible from any tab via a persistent icon button in the header (beaker/flask icon). Overlays the current view without disrupting it.

### How It Works
- Engineer must have already run a baseline calculation
- Panel shows curated set of the most impactful adjustable parameters:
  - **Manning's n**: Slider with +/- %
  - **Add/remove a pier**: Quick toggle
  - **Deck elevation**: +/- offset input
  - **Debris blockage %**: Slider
  - **Discharge**: Override for quick single-value check
- On any change, results re-calculate instantly (all in-browser, engine is fast)

### Delta Display
Each output shows baseline vs. new value with color-coded difference:
- Red = worse (e.g. "Upstream WSEL: 12.45m -> 12.72m (+0.27m)")
- Green = improved (e.g. "Freeboard: 0.3m -> 0.58m (+0.28m)")

### Key Outputs Shown
- Upstream WSEL (per method)
- Afflux / head loss
- Freeboard
- Flow regime (badge changes if regime transitions)

### Scope
Curated parameters only (the 5 listed above). Engineers who want full control use the Input tab. This is for quick "what happens if..." exploration.

---

## Feature 5: 3D Interactive Bridge Visualization (LATER - Not building now)

### Placement
Sub-tab or toggle within the Simulation tab (alongside Feature 1).

### Vision
Three.js-powered real-time 3D render of the bridge, channel, and water surface built from engineer's actual input data:
- Orbit, pan, zoom around the bridge structure
- Water surface animates to show each flow profile (watch the 1% AEP flood rise vs. the 10-year)
- Piers, abutments, low chord, deck all rendered from geometry inputs
- Color-coded flow regime: blue for free-surface, orange glow for pressure flow, red for overtopping with water cascading over the deck
- Toggle between methods to see how upstream WSEL differs
- Click a pier to highlight its blockage contribution

### Estimated Effort
~1-2 weeks. To be designed and planned in a separate session.
