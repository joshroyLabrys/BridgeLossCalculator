# Bridge Loss Calculator (BLC)

An in-browser hydraulic engineering workstation for performing bridge waterway adequacy assessments. BLC replaces the fragmented workflow of spreadsheets, manual HEC-RAS cross-checks, and ad hoc calculations with a single integrated tool that runs entirely client-side -- no backend servers, no user accounts, no installation required.

The application implements four independent hydraulic analysis methods (Energy, Momentum, Yarnell, WSPRO), supports direct import of HEC-RAS geometry and flow files, and produces regulatory-compliant PDF reports with optional AI-generated narratives. It is designed specifically for Australian hydraulic engineering practice, with built-in support for TMR, VicRoads, DPIE, and ARR regulatory frameworks.

## Who is this for?

- **Hydraulic engineers** performing bridge waterway adequacy assessments under Australian standards, who need a faster alternative to juggling HEC-RAS output, spreadsheets, and manual calculation checks.
- **QA/QC reviewers** checking HEC-RAS models, who want an independent calculation tool that can import the same geometry and flow files and compare results side-by-side with root cause diagnostics.
- **Engineering firms** that need standardized assessment workflows compliant with TMR (Queensland), VicRoads (Victoria), DPIE (NSW), and ARR (national) regulations, with traceable calculation steps and exportable reports.

## What can it do?

### Four independent hydraulic methods

BLC runs Energy, Momentum, Yarnell, and WSPRO calculations simultaneously for every flow profile. Each method produces a full iteration log with step-by-step calculation traces, Froude numbers, and convergence diagnostics. The application automatically detects the flow regime (free-surface, pressure, or overtopping) and switches to the appropriate formulation -- orifice flow for submerged openings, combined orifice-plus-weir for overtopping conditions. A method suitability advisor recommends which methods are appropriate given the bridge geometry and flow conditions.

### HEC-RAS and CSV import

Drag-and-drop import of HEC-RAS `.g0X` geometry files and `.f0X` flow files. The parser extracts cross-section stations, elevations, Manning's n values, bank stations, bridge opening geometry, pier data, and flow profiles directly from native HEC-RAS file formats. CSV survey data import is also supported for cross-section station/elevation/roughness input. Imported data populates the full input form with no manual re-entry.

### ARR Data Hub hydrology integration

A built-in map interface (Leaflet) lets engineers pick a catchment location anywhere in Australia and fetch design rainfall data from the ARR Data Hub. The rational method calculator computes peak discharge estimates using time-of-concentration methods, with the results feeding directly into flow profiles for the hydraulic analysis.

### Pier scour and contraction scour assessment

Implements the CSU/HEC-18 pier scour equation accounting for pier shape, attack angle, bed condition, and grain size. Contraction scour is calculated for both live-bed and clear-water conditions using Laursen's equations. Scour depths are reported per pier and per flow profile, with a visual scour diagram showing the cross-section with scour holes.

### Bridge adequacy decision engine

An automated pass/fail verdict engine evaluates freeboard, velocity limits, afflux thresholds, and scour depths against jurisdiction-specific criteria. The engine produces a structured adequacy result with individual pass/fail indicators for each criterion, an overall verdict, and explanatory notes identifying which limits were exceeded and by how much.

### Regulatory compliance checklists

Pre-built checklists for TMR, VicRoads, DPIE, and ARR frameworks with checkable items that track completion of required assessments. Each checklist is tailored to the selected jurisdiction's specific requirements for bridge waterway adequacy reporting, including debris assessment, scour assessment, freeboard requirements, and documentation standards.

### Automated QA/QC comparison against HEC-RAS

When HEC-RAS results are imported alongside geometry and flow data, BLC computes its own independent results and generates a side-by-side comparison table. Differences are flagged with magnitude and direction, and the system provides root cause suggestions for discrepancies (e.g., coefficient differences, geometry simplification, roughness handling).

### AI-powered report narrative generation

An optional OpenAI integration generates section-by-section report narratives from the calculation results. The narrative editor allows engineers to select individual report sections (methodology, results, adequacy, recommendations), choose a technical or summary tone, and edit the generated text before export. An AI chat panel provides conversational access to the analysis results for ad hoc questions.

### Photorealistic 3D bridge visualization

A Three.js scene renders the bridge, terrain, and water surface in 3D using the actual cross-section geometry and calculated water levels. The visualization includes Gerstner wave animation on the water surface, PBR (physically-based rendering) materials, and post-processing effects including god rays. The scene captures can be embedded directly into PDF reports.

### What-If scenario testing

Live parameter sliders allow engineers to adjust Manning's n multiplier, debris blockage percentage, contraction and expansion coefficients, and discharge multiplier. The modified results recompute in real time and display deltas against the baseline, making it straightforward to test sensitivity to input assumptions without modifying the primary analysis.

### Debris visualization and ARR guidance

A debris guidance panel provides ARR-aligned recommendations for debris loading based on catchment characteristics. A debris mat visualization shows the blockage pattern on the bridge opening, and the blockage percentage feeds directly into the hydraulic calculations.

### Multi-bridge reach analysis

For assessments involving multiple bridges along a watercourse, the reach manager allows engineers to define a sequence of bridge crossings with tailwater cascade -- the upstream water level from one bridge becomes the downstream boundary for the next. Results are computed sequentially along the reach.

### PDF report export

A full-featured PDF generator (@react-pdf/renderer) produces reports with section selection, allowing engineers to include or exclude methodology descriptions, input data tables, calculation results, charts, adequacy verdicts, regulatory checklists, AI narratives, and 3D scene captures. Reports are generated entirely in the browser and downloaded as a single PDF file.

### Project snapshots with diff comparison

Engineers can save named snapshots of the complete project state at any point during an assessment. The history panel displays a timeline of snapshots with the ability to view differences between any two snapshots, tracking changes to inputs, coefficients, and results over time.

### Metric/Imperial unit toggle

All inputs, outputs, and charts support real-time switching between metric (SI) and Imperial (US customary) units. Internal calculations use a consistent unit system, with conversion applied at the display boundary. The toggle is available globally from the top bar.

### Mobile responsive

The interface adapts to smaller screens with a responsive tab layout, scrollable panels, and touch-friendly controls, allowing field engineers to review results on tablets or phones.

## Project structure

```
TheTools/
  README.md                  This file
  app/                       Next.js 16 application (the main product)
    src/
      engine/                Core calculation logic (pure TypeScript, no UI dependencies)
        methods/             Energy, Momentum, Yarnell, WSPRO implementations
        scour/               Pier scour (CSU/HEC-18) and contraction scour
        hydrology/           Rational method, time of concentration
        adequacy/            Pass/fail decision engine
        reach/               Multi-bridge reach solver
        import/              CSV survey parser
      components/            React components organized by feature domain
        input/               Cross-section, bridge geometry, flow profile, coefficient forms
        data/                Import panel, reach manager
        hydrology/           ARR lookup, catchment calculator, map
        analysis/            QA/QC panel, scour panel and diagram
        results/             Method result views, iteration logs, convergence charts
        summary/             Comparison tables, afflux charts, regime matrix, freeboard
        assessment/          Adequacy panel, regulatory checklists
        simulation/          3D scene, energy grade diagram, debris, optimizer, controls
          scene-3d/          Three.js meshes (bridge, terrain, water)
        what-if/             What-If controls and panel
        report/              Narrative editor, export panel, history panel
        import/              HEC-RAS drop zone and import dialog
        ai-chat/             AI chat panel
        ui/                  Shared UI primitives (shadcn/ui)
      store/                 Zustand state management (project-store.ts)
      lib/                   Utilities, parsers, unit conversion
        api/                 OpenAI integration (auth, prompts, summary)
      config/                Regulatory checklist definitions
      app/                   Next.js App Router pages
    tests/                   Additional test files
    public/                  Static assets
  docs/                      Design specs and implementation plans
    superpowers/plans/       Feature design documents
  bridge.html                Legacy standalone HTML prototype
  BridgeLossCalculator.xlsm  Original Excel spreadsheet the app replaces
```

## How to run it

```bash
cd app
npm install
npm run dev       # Development server at http://localhost:3000
npm run build     # Production build (static export)
npm run test      # Run test suite (Vitest)
npm run test:watch # Run tests in watch mode
npm run lint      # ESLint
```

### Environment variables (optional)

The AI narrative generation feature requires an OpenAI API key. The key is entered by the user in the browser at runtime (stored in browser memory only, never persisted to disk or sent to any server other than OpenAI). No environment variables are required for the core hydraulic calculations.

## Tech stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 16, React 19 | Application shell, routing, static export |
| Language | TypeScript 5 | Type safety across engine and UI |
| State | Zustand 5 | Single-store state management with selectors |
| Charts | D3.js (d3-scale, d3-shape, d3-array, d3-selection, d3-axis) | Afflux charts, energy grade line diagrams, rating curves |
| Charts (simple) | Recharts | Convergence charts, simpler data visualizations |
| 3D | Three.js, React Three Fiber, Drei, React Three Postprocessing | Bridge/terrain/water 3D scene with PBR and effects |
| PDF | @react-pdf/renderer | Client-side PDF report generation |
| Maps | Leaflet, React-Leaflet | ARR Data Hub location picker |
| Math rendering | KaTeX | Equation display in calculation steps |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| UI primitives | shadcn/ui (via @base-ui/react) | Tabs, buttons, cards, selects, dialogs |
| Icons | Lucide React | Consistent icon set |
| AI | OpenAI SDK | Optional narrative generation and chat |
| Testing | Vitest, Testing Library, jsdom | Unit and integration tests |

## Navigation structure

The application is organized into six top-level tabs, each containing sub-tabs for specific tasks. This layout follows the natural workflow of a bridge waterway adequacy assessment from data entry through to reporting.

### Data tab

Where all geometric and hydraulic inputs are defined or imported.

- **Cross-Section** -- Station/elevation/Manning's n table with interactive chart preview. Supports manual entry and CSV import.
- **Bridge Geometry** -- Low chord profile, high chord elevation, abutment stations, skew angle, deck width, pier definitions (station, width, shape), contraction/expansion lengths, orifice and weir coefficients.
- **Flow Profiles** -- Design flows with name, ARI/AEP, discharge, downstream water surface elevation, and channel slope. Multiple profiles can be defined for different return periods.
- **Coefficients** -- Contraction/expansion coefficients, Yarnell K, iteration parameters (max iterations, tolerance, initial guess offset), debris blockage, Manning's n sensitivity, alpha override, freeboard threshold, and method selection toggles.
- **Import** -- HEC-RAS file drop zone (.g0X geometry, .f0X flow files) with import dialog for mapping cross-sections and flow profiles.
- **Reach** -- Multi-bridge reach manager for defining sequences of bridge crossings with cascading tailwater.

### Hydrology tab

- **ARR Lookup** -- Interactive map for selecting a catchment location and fetching ARR Data Hub design rainfall parameters.
- **Catchment Calculator** -- Rational method calculator using time-of-concentration estimates to compute peak discharges for multiple AEPs.

### Analysis tab

- **Overview** -- Method comparison tables showing upstream WSEL, afflux, velocities, and Froude numbers across all methods and flow profiles. Includes regime matrix, freeboard check, scenario comparison, afflux charts, method suitability assessment, and AI summary banner.
- **Method Details** -- Tabbed view of each method's detailed results including step-by-step calculation traces, iteration convergence logs, and input echo.
- **Scour** -- Pier scour and contraction scour results with visual scour diagram.
- **QA/QC** -- Side-by-side comparison of BLC results against imported HEC-RAS results with discrepancy flags and root cause suggestions.

### Assessment tab

- **Adequacy** -- Automated pass/fail verdict against jurisdiction-specific criteria (freeboard, velocity, afflux, scour).
- **Regulatory Checklist** -- Jurisdiction-specific compliance checklist (TMR, VicRoads, DPIE, ARR) with checkable items.

### Simulation tab

- **3D Model** -- Photorealistic Three.js visualization of the bridge, terrain, and water surface using actual geometry and calculated water levels.
- **Energy Grade Diagram** -- Longitudinal profile showing energy grade line, hydraulic grade line, channel bed, and bridge opening through the contraction/expansion reach.
- **What-If** -- Live parameter adjustment sliders with real-time result recomputation and delta display against baseline.
- **Optimizer** -- Automated parameter optimization tools.
- **Debris** -- ARR debris guidance and blockage visualization.

### Report tab

- **Narrative** -- AI-generated report sections with tone selection and manual editing. Section-by-section generation with preview.
- **Export** -- PDF report generation with section selection. Project JSON export/import for saving and sharing complete project state.
- **History** -- Snapshot timeline with diff comparison between saved states.

## Typical workflow

1. **Enter or import geometry.** Open the Data tab and either type cross-section coordinates and bridge geometry manually, paste CSV survey data, or drag-and-drop HEC-RAS .g0X and .f0X files to populate everything at once.

2. **Define flow profiles.** On the Data tab, enter one or more design flow profiles with discharge, downstream water surface elevation, ARI designation, and channel slope. Alternatively, use the Hydrology tab to fetch ARR design rainfall and compute peak discharges with the rational method.

3. **Configure coefficients and methods.** On the Data tab Coefficients sub-tab, set contraction/expansion loss coefficients, select which methods to run, and adjust iteration parameters if needed. Enable debris blockage or Manning's n sensitivity analysis if required.

4. **Run calculations.** Press the Calculate button. All selected methods execute simultaneously across all flow profiles. The application automatically detects the flow regime for each combination and applies the appropriate formulation.

5. **Review results.** Switch to the Analysis tab to see the method comparison matrix, regime matrix, afflux charts, and freeboard summary. Drill into individual method tabs for step-by-step calculation traces and convergence logs. Run QA/QC comparison if HEC-RAS results were imported.

6. **Assess adequacy.** On the Assessment tab, review the automated pass/fail verdict for each criterion under the selected jurisdiction. Complete the regulatory checklist to track compliance documentation requirements.

7. **Visualize and explore.** On the Simulation tab, examine the 3D bridge model, review the energy grade diagram along the reach, and use What-If sliders to test sensitivity to parameter changes in real time.

8. **Generate report.** On the Report tab, optionally generate AI narratives for each report section. Select which sections to include in the PDF, then export. Save project snapshots for version tracking, or export the full project as JSON for sharing or archival.

## License

This is a private project. All rights reserved.
