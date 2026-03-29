# Calculation Engine

## Purpose

This directory contains the pure calculation engine for hydraulic bridge analysis. It has zero UI dependencies and zero framework imports -- every module is plain TypeScript that operates on typed inputs and returns typed outputs. The engine can be used standalone in a Node.js script, a worker thread, or imported directly by the UI layer.

The engine answers one core question: given a cross-section, bridge geometry, and a set of flow conditions, what is the upstream water surface elevation (WSEL), and what are the resulting hydraulic conditions at the bridge?

## Architecture

All calculations follow a single pipeline:

```
Inputs                      Orchestration                     Outputs
-------------------------   ----------------------------      -------------------------
CrossSectionPoint[]    ---> runAllMethods()              ---> CalculationResults
BridgeGeometry         --->   per profile:               --->   energy:  MethodResult[]
FlowProfile[]          --->     per enabled method:      --->   momentum: MethodResult[]
Coefficients           --->       run{Energy|Momentum|   --->   yarnell: MethodResult[]
                                    Yarnell|WSPRO}()     --->   wspro:   MethodResult[]
```

The entry point is `runAllMethods()` in `index.ts`. It iterates over every flow profile and every enabled method, returning a `CalculationResults` object that maps method names to arrays of `MethodResult` -- one per flow profile.

Each method function follows the same contract:

1. Compute downstream hydraulic properties from the given WSEL.
2. Detect the flow regime (free-surface, pressure, or overtopping).
3. If pressure or overtopping, delegate to the appropriate specialized solver.
4. Otherwise, solve for the upstream WSEL using the method-specific equations.
5. If the free-surface solver produces a WSEL above the low chord, re-evaluate the regime and delegate to pressure/overtopping if needed.
6. Return a `MethodResult` with all computed values, the iteration log, and any errors.

Sensitivity analysis is handled by `runWithSensitivity()`, which scales Manning's n values up and down by a user-specified percentage and runs the full calculation suite for each.

## Units

**Everything inside the engine is imperial (US customary).** The UI converts to and from metric at the boundary using `src/lib/units.ts`. If you are calling the engine directly, supply values in:

| Quantity       | Unit    |
|----------------|---------|
| Length/Elev    | ft      |
| Area           | ft^2    |
| Velocity       | ft/s    |
| Discharge      | cfs     |
| Slope          | ft/ft   |
| Manning's n    | dimensionless |
| Angle          | degrees |

Gravitational acceleration is `32.174 ft/s^2`.

## Types

All types are defined in `types.ts`. The major ones:

### CrossSectionPoint

A single survey point in the cross-section.

| Field        | Type                          | Description                                    |
|-------------|-------------------------------|------------------------------------------------|
| `station`   | `number`                      | Horizontal distance from an arbitrary datum (ft) |
| `elevation` | `number`                      | Vertical elevation (ft)                        |
| `manningsN` | `number`                      | Manning's roughness coefficient at this point  |
| `bankStation` | `'left' \| 'right' \| null` | Marks this point as a bank station for subsection splitting |

### BridgeGeometry

Defines the physical bridge structure.

| Field                  | Type              | Description |
|------------------------|-------------------|-------------|
| `lowChordLeft`         | `number`          | Low chord elevation at the left abutment (ft) |
| `lowChordRight`        | `number`          | Low chord elevation at the right abutment (ft) |
| `highChord`            | `number`          | Top-of-deck elevation (ft) -- threshold for overtopping |
| `leftAbutmentStation`  | `number`          | Station of the left abutment (ft) |
| `rightAbutmentStation` | `number`          | Station of the right abutment (ft) |
| `skewAngle`            | `number`          | Bridge skew angle relative to flow (degrees) |
| `contractionLength`    | `number`          | Reach length upstream of bridge for energy loss (ft) |
| `expansionLength`      | `number`          | Reach length downstream of bridge for energy loss (ft) |
| `orificeCd`            | `number`          | Orifice discharge coefficient for pressure flow (typically 0.8) |
| `weirCw`               | `number`          | Weir discharge coefficient for overtopping flow |
| `deckWidth`            | `number`          | Width of deck perpendicular to flow (ft) -- used as weir length |
| `piers`                | `Pier[]`          | Array of pier definitions |
| `lowChordProfile`      | `LowChordPoint[]` | Optional detailed low chord profile for non-flat soffits |

### FlowProfile

A single design flow event.

| Field          | Type     | Description |
|----------------|----------|-------------|
| `name`         | `string` | Display name (e.g., "100-yr ARI") |
| `ari`          | `string` | Return period / AEP label (e.g., "1% AEP") |
| `discharge`    | `number` | Flow rate (cfs) |
| `dsWsel`       | `number` | Known downstream water surface elevation (ft) |
| `channelSlope` | `number` | Channel bed slope (ft/ft) -- used by momentum method |

### Coefficients

User-configurable analysis parameters.

| Field                     | Type     | Description |
|---------------------------|----------|-------------|
| `contractionCoeff`        | `number` | Energy loss coefficient for contraction (typically 0.3) |
| `expansionCoeff`          | `number` | Energy loss coefficient for expansion (typically 0.5) |
| `yarnellK`                | `number \| null` | Manual Yarnell K override; null = auto from pier shape |
| `maxIterations`           | `number` | Maximum solver iterations (default 100) |
| `tolerance`               | `number` | Convergence tolerance in ft (default 0.01) |
| `initialGuessOffset`      | `number` | Initial trial WSEL offset above dsWsel (ft) |
| `debrisBlockagePct`       | `number` | Debris blockage as % of net opening area (0-100) |
| `manningsNSensitivityPct` | `number \| null` | Sensitivity range for Manning's n (e.g., 20 = +/-20%) |
| `alphaOverride`           | `number \| null` | Manual velocity distribution coefficient; null = computed |
| `freeboardThreshold`      | `number` | Minimum acceptable freeboard (ft) |
| `methodsToRun`            | `object` | Flags for which methods to execute |

### MethodResult

The output of a single method for a single flow profile.

| Field                 | Type                | Description |
|-----------------------|---------------------|-------------|
| `profileName`         | `string`            | Which flow profile this result is for |
| `upstreamWsel`        | `number`            | Computed upstream water surface elevation (ft) |
| `totalHeadLoss`       | `number`            | Total head loss across the bridge (ft) |
| `approachVelocity`    | `number`            | Upstream approach velocity (ft/s) |
| `bridgeVelocity`      | `number`            | Velocity through the bridge opening (ft/s) |
| `froudeApproach`      | `number`            | Froude number at the approach section |
| `froudeBridge`        | `number`            | Froude number at the bridge section |
| `flowRegime`          | `FlowRegime`        | `'free-surface'`, `'pressure'`, or `'overtopping'` |
| `flowCalculationType` | `string`            | `'free-surface'`, `'orifice'`, or `'orifice+weir'` |
| `iterationLog`        | `IterationStep[]`   | Full convergence history |
| `converged`           | `boolean`           | Whether the solver reached tolerance |
| `calculationSteps`    | `CalculationStep[]` | Step-by-step audit trail with formulas and intermediate values |
| `tuflowPierFLC`       | `number`            | Back-calculated TUFLOW pier form loss coefficient |
| `tuflowSuperFLC`      | `number \| null`    | Back-calculated TUFLOW superstructure FLC (null if free-surface) |
| `inputEcho`           | `object`            | Echo of key geometric inputs for verification |
| `error`               | `string \| null`    | Error message if calculation failed, null on success |

### CalculationResults

Top-level results container. Each key maps to an array of `MethodResult`, one per flow profile.

```typescript
interface CalculationResults {
  energy: MethodResult[];
  momentum: MethodResult[];
  yarnell: MethodResult[];
  wspro: MethodResult[];
}
```

## Core Modules

### `hydraulics.ts` -- Fundamental Hydraulic Calculations

Pure functions for basic hydraulic quantities:

- `calcVelocity(Q, A)` -- V = Q / A (ft/s)
- `calcVelocityHead(V, alpha)` -- alpha * V^2 / (2g) (ft)
- `calcFroudeNumber(V, A, T)` -- V / sqrt(g * D), where D = A/T
- `calcFrictionSlope(Q, K)` -- Sf = (Q/K)^2
- `calcFrictionLoss(L, Sf1, Sf2)` -- hf = L * (Sf1 + Sf2) / 2 (average friction slope method)

### `geometry.ts` -- Cross-Section Geometry

Computes geometric properties from cross-section survey data at a given WSEL. All functions clip segments to the water surface using `clipSegmentToWsel()`, which handles partial submersion by interpolating intersections.

- `calcFlowArea(xs, wsel)` -- Trapezoidal integration of submerged area (ft^2)
- `calcWettedPerimeter(xs, wsel)` -- Sum of slope-distances for wetted segments (ft)
- `calcTopWidth(xs, wsel)` -- Width of water surface (ft)
- `calcHydraulicRadius(xs, wsel)` -- A / P (ft)
- `calcConveyance(xs, wsel)` -- Manning's equation conveyance K = (1.486/n) * A * R^(2/3), split into left overbank, channel, and right overbank subsections by bank stations
- `calcAlpha(xs, wsel)` -- Velocity distribution coefficient alpha = sum(Ki^3/Ai^2) / (K_total^3/A_total^2)
- `calcSubsectionConveyances(xs, wsel)` -- Returns individual subsection areas and conveyances

### `bridge-geometry.ts` -- Bridge Opening Computations

Handles the bridge-specific geometry:

- `interpolateLowChord(bridge, station)` -- Interpolates the soffit elevation at any station, using either a detailed low chord profile or linear interpolation between abutment chords
- `calcPierBlockage(piers, xs, wsel)` -- Total pier blockage area: each pier is width * (WSEL - ground elevation at pier station)
- `calcBridgeOpeningArea(bridge, xs, wsel)` -- Gross flow area within the bridge opening, clipped to abutment boundaries
- `calcNetBridgeArea(bridge, xs, wsel, debrisPct)` -- Net area = gross - pier blockage, then applies debris blockage percentage and skew angle cosine correction

### `flow-regime.ts` -- Automatic Flow Regime Classification

A single function `detectFlowRegime(wsel, lowChord, highChord)` that returns:

- `'free-surface'` when WSEL is at or below the low chord
- `'pressure'` when WSEL is between the low chord and the high chord
- `'overtopping'` when WSEL exceeds the high chord (deck top)

### `iteration.ts` -- Hybrid Bisection/Secant Solver

The solver used by all iterative methods. It finds the WSEL where `|trial - objectiveFn(trial)| < tolerance`.

**Phase 1 (Bisection):** While the search range exceeds 0.5 ft, bisection narrows the bounds reliably.

**Phase 2 (Secant):** Once the range is within 0.5 ft, the secant method provides faster (superlinear) convergence. Falls back to bisection if the secant denominator is near zero.

Default limits: 100 max iterations, 0.01 ft tolerance. Returns a `SolverResult` with the converged solution, a boolean convergence flag, and the full iteration log.

### `pressure-flow.ts` -- Pressure Flow (Orifice Equation)

When the water surface contacts the low chord, flow transitions to pressure (orifice) conditions. The solver applies:

```
Q = Cd * A_net * sqrt(2g * deltaH)
```

Where `deltaH` is the head difference between upstream WSEL and the low chord, `Cd` is the orifice discharge coefficient (typically 0.8), and `A_net` is the net bridge opening area at the low chord elevation. The solver iterates to find the upstream WSEL that produces the correct discharge.

### `overtopping-flow.ts` -- Overtopping Flow (Orifice + Weir)

When WSEL exceeds the high chord, flow is split into two components:

- **Orifice flow** through the bridge opening: `Q_orf = Cd * A_net * sqrt(2g * deltaH)`
- **Weir flow** over the deck: `Q_weir = Cw * L_weir * H^1.5`

The solver iterates on upstream WSEL until `Q_orf + Q_weir = Q_total`.

### `freeboard.ts` -- Freeboard and Zero-Freeboard Discharge

Computes freeboard (low chord minus worst-case upstream WSEL across all methods) for each flow profile. Classifies each profile as:

- `'clear'` -- freeboard exceeds the threshold
- `'low'` -- positive freeboard but below the threshold
- `'pressure'` -- zero or negative freeboard (water contacts soffit)
- `'overtopping'` -- WSEL exceeds the high chord

Also interpolates the **zero-freeboard discharge** -- the Q at which freeboard transitions from positive to zero -- using linear interpolation between adjacent profiles.

### `tuflow-flc.ts` -- TUFLOW Form Loss Coefficients

Back-calculates form loss coefficients (FLCs) compatible with TUFLOW 2D hydraulic models:

- `calcTuflowPierFLC(headLoss, velocity)` -- FLC = h_loss / (V^2 / 2g)
- `calcTuflowSuperFLC(headLoss, velocity, regime)` -- Returns null for free-surface flow; otherwise computes the superstructure FLC

These allow engineers to extract calibrated FLC values from this tool's 1D results and apply them in their 2D TUFLOW models.

### `simulation-profile.ts` -- Hydraulic Profile for 3D Visualization

Builds a `HydraulicProfile` object that structures the calculation results into three spatial zones (approach, bridge, exit) with bed elevations, water surface elevations, velocities, and depths at each zone. This data structure drives the 3D visualization scene and the energy grade line diagram. It also carries the full cross-section geometry for accurate terrain rendering.

## How to Add a New Calculation Method

1. **Create the method file.** Add `src/engine/methods/your-method.ts`. Export a function with the standard signature:

   ```typescript
   export function runYourMethod(
     crossSection: CrossSectionPoint[],
     bridge: BridgeGeometry,
     profile: FlowProfile,
     coefficients: Coefficients
   ): MethodResult { ... }
   ```

2. **Handle all three flow regimes.** Detect the regime using `detectFlowRegime()`. For pressure and overtopping, delegate to `runPressureFlow()` and `runOvertoppingFlow()` respectively. Implement only the free-surface logic in your method.

3. **Use the solver for iterative methods.** Import `solve()` from `iteration.ts`. Supply an `objectiveFn` that, given a trial WSEL, computes what the WSEL should be based on your method's equations. The solver finds the fixed point.

4. **Re-evaluate the regime after solving.** If your free-surface solver produces a WSEL above the low chord, call `detectFlowRegime()` again and delegate to the pressure/overtopping solver.

5. **Populate the full MethodResult.** Include calculation steps for the audit trail, compute Froude numbers, TUFLOW FLCs, and the input echo.

6. **Register the method.** In `types.ts`, add your method key to `CalculationResults` and to `Coefficients.methodsToRun`. In `index.ts`, import your function and add it to the `runAllMethods()` loop.

7. **Add a test bridge.** Use the V-Channel Benchmark in `src/lib/test-bridges.ts` to verify your method produces expected results.
