# BLC Application -- Developer Guide

This is the Next.js 16 application that implements the Bridge Loss Calculator. This document covers the internal architecture, development setup, and conventions for anyone working on the codebase.

## IMPORTANT: Read AGENTS.md before writing code

This project runs on **Next.js 16**, which has breaking changes relative to earlier versions. APIs, conventions, and file structure may differ from what you expect. Before writing or modifying any code, read the relevant guide in `node_modules/next/dist/docs/` and heed all deprecation notices. The `AGENTS.md` file at the app root contains this requirement -- it exists for a reason.

## Project structure

```
app/
  src/
    app/                        Next.js App Router (pages, layout, route handlers)
    engine/                     Pure calculation logic (no React, no DOM, no side effects)
      methods/
        energy.ts               Standard step energy equation
        momentum.ts             Momentum balance method
        yarnell.ts              Yarnell pier loss equation
        wspro.ts                FHWA WSPRO method
      scour/
        pier-scour.ts           CSU/HEC-18 pier scour
        contraction-scour.ts    Laursen live-bed and clear-water contraction scour
      hydrology/
        rational-method.ts      Rational method peak discharge
        time-of-concentration.ts  Tc estimation methods
      adequacy/
        decision-engine.ts      Pass/fail verdict engine per jurisdiction
      reach/
        reach-solver.ts         Multi-bridge reach solver with tailwater cascade
      import/
        csv-survey-parser.ts    CSV station/elevation/roughness parser
      geometry.ts               Cross-section geometry (area, wetted perimeter, top width, conveyance, hydraulic radius, alpha)
      bridge-geometry.ts        Bridge opening area, pier blockage, low chord interpolation
      hydraulics.ts             Velocity, velocity head, Froude number, friction slope, friction loss
      flow-regime.ts            Free-surface / pressure / overtopping detection
      pressure-flow.ts          Orifice flow formulation
      overtopping-flow.ts       Combined orifice + weir flow
      iteration.ts              Bisection/secant solver with convergence tracking
      optimizer.ts              Automated parameter optimization
      simulation-profile.ts     Hydraulic profile builder for EGL diagrams
      deck-profile.ts           Deck geometry interpolation
      tuflow-flc.ts             TUFLOW FLC coefficient estimation
      method-suitability.ts     Method applicability advisor
      types.ts                  All shared TypeScript interfaces
      index.ts                  Re-exports and runAllMethods orchestrator
    components/
      main-tabs.tsx             Root component: 6-tab layout and all state wiring
      top-bar.tsx               Project name, unit toggle, save/load buttons
      cross-section-chart.tsx   SVG cross-section visualization
      hazard-overlay.tsx        Hazard category overlay on charts
      pdf-report.tsx            PDF document definition (@react-pdf/renderer)
      pdf-charts.tsx            Chart rendering for PDF context
      input/                    Data entry forms
        cross-section-form.tsx  Station/elevation/n table with add/delete/paste
        bridge-geometry-form.tsx  Bridge opening, piers, deck, abutments
        flow-profiles-form.tsx  Multi-profile flow data entry
        coefficients-form.tsx   Loss coefficients, iteration settings, method toggles
        action-buttons.tsx      Calculate, clear, sensitivity analysis buttons
      data/
        import-panel.tsx        HEC-RAS file import interface
        reach-manager.tsx       Multi-bridge reach definition and management
      hydrology/
        arr-lookup.tsx          ARR Data Hub API integration
        catchment-calculator.tsx  Rational method UI with Tc methods
        leaflet-map.tsx         Leaflet map component for location picking
      analysis/
        qaqc-panel.tsx          HEC-RAS comparison with discrepancy diagnosis
        qaqc-memo-pdf.tsx       QA/QC memo PDF export
        scour-panel.tsx         Scour assessment interface
        scour-diagram.tsx       Visual scour depth diagram
      results/
        method-tabs.tsx         Tabbed method result selector
        method-view.tsx         Individual method result display
        calculation-steps.tsx   Step-by-step calculation trace with KaTeX formulas
        iteration-log.tsx       Convergence iteration table
        convergence-chart.tsx   Iteration convergence visualization
        profile-accordion.tsx   Collapsible flow profile results
      summary/
        comparison-tables.tsx   Cross-method comparison matrix
        regime-matrix.tsx       Flow regime grid (free-surface/pressure/overtopping)
        freeboard-check.tsx     Freeboard adequacy summary
        scenario-comparison.tsx Saved scenario delta table
        afflux-charts.tsx       Afflux vs. discharge charts (D3)
        ai-summary-banner.tsx   AI-generated results summary
        ai-callout.tsx          AI callout components (inline and grouped)
        method-suitability.tsx  Method applicability recommendations
      assessment/
        adequacy-panel.tsx      Pass/fail verdict display per criterion
        regulatory-checklist.tsx  Jurisdiction-specific compliance checklist
      simulation/
        simulation-tab.tsx      Simulation tab layout (legacy, now inlined in main-tabs)
        simulation-controls.tsx Profile and method selectors for simulation
        energy-grade-diagram.tsx  Longitudinal EGL/HGL/bed/bridge profile (D3)
        hydraulic-profile-chart.tsx  Hydraulic profile visualization
        optimizer-card.tsx      Parameter optimization interface
        debris-guidance.tsx     ARR debris loading recommendations
        debris-mat.tsx          Debris blockage visualization
        particle-engine.ts      Particle system for water effects
        scene-3d/
          simulation-scene.tsx  React Three Fiber scene root with camera, lighting, postprocessing
          bridge-mesh.tsx       Bridge deck and abutment geometry
          terrain-mesh.tsx      Cross-section terrain surface
          water-mesh.tsx        Animated water surface with Gerstner waves
      what-if/
        what-if-controls.tsx    Parameter adjustment sliders
        what-if-panel.tsx       What-If results comparison panel
      report/
        narrative-editor.tsx    AI narrative generation and editing
        export-panel.tsx        PDF export with section selection, JSON save/load
        history-panel.tsx       Snapshot timeline with diff viewer
      import/
        drop-zone.tsx           Drag-and-drop file upload area
        hecras-import-dialog.tsx  HEC-RAS file mapping and import dialog
      ai-chat/
        chat-panel.tsx          Conversational AI interface for analysis questions
      ui/                       shadcn/ui primitives (Button, Card, Tabs, Select, etc.)
    store/
      project-store.ts          Zustand store: all application state and actions
    lib/
      units.ts                  Unit conversion (metric/imperial) and label formatting
      constants.ts              Physical and engineering constants
      utils.ts                  General utility functions
      validation.ts             Input validation rules
      hecras-parser.ts          HEC-RAS .g0X/.f0X file parser
      json-io.ts                Project serialization/deserialization
      test-bridges.ts           Sample bridge data for development and testing
      api/
        openai.ts               OpenAI client wrapper
        openai-auth.ts          API key management (browser memory only)
        ai-summary-prompt.ts    Prompt template for results summary
        ai-chat-prompt.ts       Prompt template for conversational chat
        narrative-prompts.ts    Prompt templates for report section narratives
    config/
      regulatory-checklists.ts  Checklist definitions for TMR, VicRoads, DPIE, ARR
    __tests__/                  Test files mirroring src/ structure
      engine/
        adequacy/               Decision engine tests
        hydrology/              Rational method, Tc tests
        import/                 CSV parser tests
        reach/                  Reach solver tests
        scour/                  Pier and contraction scour tests
        method-suitability.test.ts
        optimizer.test.ts
      lib/
        api/                    OpenAI integration tests
        hecras-parser.test.ts
  tests/                        Additional top-level test files
  public/                       Static assets
  AGENTS.md                     AI agent instructions (Next.js 16 compatibility warning)
  CLAUDE.md                     Claude Code configuration (references AGENTS.md)
  vitest.config.ts              Test runner configuration
  next.config.ts                Next.js configuration
  tsconfig.json                 TypeScript configuration
  eslint.config.mjs             ESLint configuration
  postcss.config.mjs            PostCSS configuration (Tailwind)
  components.json               shadcn/ui component registry
```

## Architectural decisions

### Why Zustand instead of Redux

The application has a single store (`project-store.ts`) that holds all state: cross-section data, bridge geometry, flow profiles, coefficients, calculation results, HEC-RAS comparison data, hydrology state, scour inputs/results, adequacy results, regulatory checklist state, AI narratives, snapshots, reach configuration, and UI state (active tabs, unit system).

Zustand was chosen because:

1. **Minimal boilerplate.** The store is a single `create()` call with actions defined inline. There are no action types, action creators, reducers, or middleware to maintain. For a domain-heavy application where the complexity lives in the calculation engine rather than state management choreography, this directness is a significant advantage.
2. **Selector-based reactivity.** Components subscribe to exactly the slices they need via `useProjectStore((s) => s.crossSection)`. This provides fine-grained re-rendering without the ceremony of `mapStateToProps` or `useSelector` memoization.
3. **No provider required.** Zustand stores are plain JavaScript modules. There is no `<Provider>` wrapping the component tree, which simplifies the component hierarchy and makes the store accessible from non-React code (e.g., the engine could theoretically read state directly, though it currently receives inputs as function arguments).
4. **Serialization.** The store includes `exportProject()` and `importProject()` actions that serialize the full project state to JSON and restore it. Zustand's flat state shape makes this trivial compared to Redux's normalized entity patterns.

### Why D3 for certain charts instead of Recharts

Both D3 and Recharts are used in this project, for different chart types:

- **D3** is used for the afflux charts, energy grade line (EGL) diagrams, and any visualization that requires custom SVG path rendering, non-standard axis formatting, or precise control over the coordinate mapping between engineering units and pixel space. The EGL diagram, for example, draws a smooth thalweg profile, bridge opening geometry, water surface profiles, and energy grade lines -- shapes that do not map cleanly to Recharts' cartesian chart model.
- **Recharts** is used for simpler data-series charts like convergence plots where the standard line/scatter chart model fits directly.

The general rule: if the chart is fundamentally an X-Y data series plot, use Recharts. If it requires custom geometry, multiple coordinate systems, or engineering-specific shapes (cross-sections, bridge profiles, scour holes), use D3.

### Why client-side only

The entire application runs in the browser with no backend server. This decision was driven by:

1. **Data sensitivity.** Bridge geometry, flow data, and assessment results may be commercially sensitive or government-controlled. Running entirely client-side means no project data ever leaves the engineer's machine (except for optional OpenAI API calls, which are clearly disclosed and user-initiated).
2. **Offline capability.** Field engineers and remote offices frequently have limited or no internet access. A static export can be served from any file server or opened locally.
3. **Zero deployment friction.** No databases, no authentication, no server provisioning. The production build is a static site that can be hosted on any CDN, internal file share, or even opened from disk.
4. **Calculation speed.** The hydraulic calculations are computationally lightweight (milliseconds per method per profile). There is no performance reason to offload computation to a server.

The only external network call is the optional OpenAI API integration for narrative generation and the ARR Data Hub fetch for hydrology data.

## Environment setup

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm** (included with Node.js)

### Installation

```bash
cd app
npm install
```

### Environment variables

No environment variables are required. The OpenAI API key for AI features is entered by the user in the browser at runtime and stored only in browser memory for the duration of the session. It is never written to disk, localStorage, or environment files.

If you want to pre-configure an API key for development (so you do not have to re-enter it each session), you can set it in the browser console, but there is no `.env` file mechanism -- this is intentional to prevent accidental key leakage in version control.

### Development server

```bash
npm run dev
```

Opens at `http://localhost:3000`. Hot module replacement is active -- changes to components, engine code, and styles reflect immediately.

### Production build

```bash
npm run build
```

Generates a static export in the `out/` directory. This is the production artifact -- a set of HTML, JS, and CSS files that can be served by any static file server.

## How to add a new calculation method

The engine is designed so that adding a new hydraulic method requires changes in only three places:

### 1. Create the method implementation

Add a new file in `src/engine/methods/`. Follow the pattern established by `energy.ts`:

```typescript
// src/engine/methods/newmethod.ts
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients, MethodResult } from '../types';

export function runNewMethod(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  // Implementation here.
  // Must return a MethodResult with all required fields.
  // Use the geometry, hydraulics, and iteration utilities from the engine.
}
```

Every method receives the same four inputs and returns a `MethodResult`. The `MethodResult` interface (defined in `types.ts`) includes upstream water surface elevation, total head loss, velocities, Froude numbers, flow regime, iteration log, convergence flag, calculation steps, and TUFLOW FLC values. Your method must populate all of these fields.

Use the shared geometry functions (`calcFlowArea`, `calcWettedPerimeter`, `calcConveyance`, etc. from `geometry.ts`) and hydraulic utilities (`calcVelocity`, `calcFroudeNumber`, `calcFrictionSlope`, etc. from `hydraulics.ts`) rather than reimplementing them. Use the `solve()` function from `iteration.ts` for iterative convergence.

### 2. Register the method in the orchestrator

In `src/engine/index.ts`, import your method and add it to `runAllMethods()`:

```typescript
import { runNewMethod } from './methods/newmethod';

// In runAllMethods():
if (coefficients.methodsToRun.newmethod) {
  results.newmethod.push(runNewMethod(crossSection, bridge, profile, coefficients));
}
```

You will also need to add `newmethod` to the `CalculationResults` interface in `types.ts` and add the `newmethod: boolean` toggle to the `methodsToRun` field in the `Coefficients` interface.

### 3. Add the UI toggle

In `src/components/input/coefficients-form.tsx`, add a checkbox for the new method in the method selection section. The component reads from `coefficients.methodsToRun` and writes back via `updateCoefficients`.

The results display (`method-tabs.tsx`, `comparison-tables.tsx`, `regime-matrix.tsx`) will automatically pick up the new method because they iterate over the keys of `CalculationResults`. The 3D visualization and EGL diagram also derive from the selected method's results and will work without modification.

### 4. Add tests

Create `src/__tests__/engine/methods/newmethod.test.ts` with at least:
- A known-answer test against a hand-calculated or published example
- A convergence test verifying the iteration log ends with `converged: true`
- An edge case test (e.g., zero discharge, very wide/narrow opening)

## How to add a new UI tab or sub-tab

The tab structure is defined in `src/components/main-tabs.tsx`. This is a large file because it is the top-level orchestrator that wires state to all sub-components.

### Adding a sub-tab to an existing main tab

1. **Set the default.** Add an entry in the `SUB_TAB_DEFAULTS` record at the top of `main-tabs.tsx` if your sub-tab should be the default for its parent, or leave the existing default.

2. **Add the trigger.** In the JSX for the parent tab's `TabsList`, add a new `TabsTrigger`:

```tsx
<TabsTrigger value="my-subtab">My Sub-Tab</TabsTrigger>
```

3. **Add the content.** Below the triggers, add a `TabsContent`:

```tsx
<TabsContent value="my-subtab">
  <MySubTabComponent />
</TabsContent>
```

4. **Create the component.** Place it in the appropriate domain directory under `src/components/` (e.g., `analysis/my-subtab.tsx`). Import it at the top of `main-tabs.tsx`.

### Adding a new main tab

1. Add the tab value to `MAIN_TAB_VALUES` set and `SUB_TAB_DEFAULTS` in `main-tabs.tsx`.
2. Add a `TabsTrigger` in the main tab list.
3. Add a `TabsContent` block with its own nested `Tabs` for sub-tabs.
4. Follow the same sub-tab pattern described above.

## Testing

### Framework

Tests use **Vitest** with **jsdom** environment and **Testing Library** for component tests. Configuration is in `vitest.config.ts`.

### What is tested

The test suite focuses on the calculation engine and data handling:

- **Engine methods** -- Known-answer tests for each hydraulic method against hand calculations or published examples.
- **Scour calculations** -- Pier scour and contraction scour against HEC-18 reference values.
- **Hydrology** -- Rational method and time-of-concentration calculations.
- **Adequacy engine** -- Decision engine pass/fail logic for different jurisdictions and edge cases.
- **Reach solver** -- Multi-bridge tailwater cascade correctness.
- **Optimizer** -- Parameter optimization convergence.
- **Method suitability** -- Correct recommendations for various geometry/flow conditions.
- **Parsers** -- HEC-RAS file parsing and CSV survey import for various file formats and edge cases.
- **OpenAI integration** -- API client configuration, authentication handling, and prompt construction.

### Running tests

```bash
npm run test          # Single run, exits with pass/fail
npm run test:watch    # Watch mode, re-runs on file changes
```

### Adding tests

Place test files in `src/__tests__/` mirroring the source directory structure. Name files `*.test.ts` for pure logic or `*.test.tsx` for component tests. Tests are automatically discovered by the glob pattern in `vitest.config.ts`:

```
tests/**/*.test.ts
tests/**/*.test.tsx
src/__tests__/**/*.test.ts
src/__tests__/**/*.test.tsx
```

For engine tests, import the function under test directly and assert against known values:

```typescript
import { describe, it, expect } from 'vitest';
import { runEnergy } from '@/engine/methods/energy';
import { someBridgeFixture } from './fixtures';

describe('runEnergy', () => {
  it('matches hand-calculated result for simple rectangular opening', () => {
    const result = runEnergy(fixture.crossSection, fixture.bridge, fixture.profile, fixture.coefficients);
    expect(result.upstreamWsel).toBeCloseTo(105.23, 2);
    expect(result.converged).toBe(true);
  });
});
```

## Build and deployment

### Static export

```bash
npm run build
```

This produces the `out/` directory containing a complete static site. Deploy by copying the contents of `out/` to any static hosting service (Vercel, Netlify, S3, GitHub Pages, or an internal file server).

### No server-side rendering

The application is entirely client-rendered. There are no API routes, no server components that fetch data, and no server-side rendering beyond the initial static HTML shell. The `next.config.ts` is intentionally minimal -- no special configuration is needed.

### Asset considerations

The Three.js 3D visualization and D3 charts are the largest JavaScript bundles. Next.js code-splitting ensures these are loaded only when the user navigates to the Simulation or Analysis tabs. The PDF renderer (@react-pdf/renderer) is also dynamically imported on demand to avoid bloating the initial page load.

## Key files to understand first

If you are new to this codebase, start with these files in order:

1. **`src/engine/types.ts`** -- Every shared interface. This is the vocabulary of the entire application.
2. **`src/engine/index.ts`** -- The orchestrator that runs all methods. Shows how the four methods are invoked uniformly.
3. **`src/store/project-store.ts`** -- The complete application state shape and all actions. This is the single source of truth.
4. **`src/components/main-tabs.tsx`** -- The top-level component that wires everything together. Large file, but it shows the complete tab structure and data flow.
5. **`src/engine/methods/energy.ts`** -- A representative method implementation. Once you understand one method, the others follow the same pattern.
6. **`src/lib/hecras-parser.ts`** -- The HEC-RAS file parser. Critical for understanding the import workflow.

## Conventions

- **Engine purity.** Nothing in `src/engine/` may import from React, the DOM, or any UI library. Engine functions are pure: inputs in, results out, no side effects. This makes them independently testable and reusable.
- **Units at the boundary.** All internal calculations use Imperial (US customary) units. Conversion to metric happens at the display layer via `toDisplay()` and `unitLabel()` from `src/lib/units.ts`. Never convert units inside engine functions.
- **State flows down.** Components read from the Zustand store via selectors. They write back via store actions. There is no prop drilling beyond one level, and no component-local state for data that other components need.
- **Calculation steps are first-class.** Every method must populate the `calculationSteps` array in its `MethodResult` with human-readable descriptions, LaTeX formulas, intermediate values, and results. These are displayed in the UI and included in PDF reports. They are not optional debug output -- they are the auditable record of the calculation.
