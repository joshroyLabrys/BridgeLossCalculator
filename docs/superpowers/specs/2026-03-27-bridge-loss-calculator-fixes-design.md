# Bridge Loss Calculator — Engine Corrections & Feature Completion

**Date:** 2026-03-27
**Status:** Draft
**Scope:** All three tiers — correctness, dead/misleading inputs, polish/UX

## Context

A principal-engineer review of the Bridge Loss Calculator identified 15 issues across hydraulic correctness, dead inputs, and UX gaps. This spec addresses all of them in a single coordinated pass (Approach B: Engine Extension + UI Cleanup).

**Target audience:** Practising hydraulic engineers who need a fast hand-check tool.
**Accuracy target:** Verification-grade for free-surface flow (within ~5% of HEC-RAS). Reasonable estimates for pressure flow.
**2D model target:** TUFLOW only (FLC outputs).
**Reference standards:** HEC-RAS Hydraulic Reference Manual, ARR 2019, Austroads Guide to Bridge Technology Part 8.

---

## 1. Engine Architecture — Flow Regime Dispatch

### Current behaviour
Each method (Energy, Momentum, Yarnell, WSPRO) runs its calculation regardless of flow regime. The regime is detected from DS WSEL vs low/high chord but does not change the physics. Pressure and overtopping results are computed using free-surface equations, giving incorrect answers.

### Design

Add a flow-regime dispatch layer that routes calculations:

```
runMethod(crossSection, bridge, profile, coefficients)
  ├── detectFlowRegime(dsWsel, lowChord, highChord)
  ├── FREE-SURFACE → existing method logic (with corrected equations)
  ├── PRESSURE → pressureFlow() [shared orifice solver]
  └── OVERTOPPING → overtoppingFlow() [shared orifice + weir solver]
```

**Key decisions:**

1. **Pressure/overtopping is method-independent.** When the bridge is submerged, the physics is orifice/weir flow — it does not vary by backwater method. All four methods return the same pressure/overtopping result, annotated as "Orifice" or "Orifice+Weir" in the output.

2. **Regime re-evaluation during iteration.** For Energy and Momentum methods that iterate on upstream WSEL, the regime is checked at each iteration step. If the trial WSEL crosses the low chord boundary during iteration, the solver transitions to the pressure flow equations mid-solve.

3. **Yarnell behaviour:** Returns "Not Applicable" for pressure/overtopping (unchanged). Yarnell is a free-surface-only empirical equation.

4. **WSPRO behaviour:** Returns the shared pressure/overtopping result when submerged. The WSPRO conveyance-ratio method does not apply to submerged conditions.

### New modules

- **`engine/pressure-flow.ts`** — Orifice equation solver.
  - `Q = Cd × A_net × √(2g × ΔH)` where ΔH = upstream energy head minus low chord elevation.
  - Iterates on upstream WSEL to find the level where orifice Q matches the input discharge.
  - Uses the existing `solve()` bisection/secant solver.

- **`engine/overtopping-flow.ts`** — Combined orifice + weir solver.
  - Splits total discharge: `Q_total = Q_orifice + Q_weir`.
  - Orifice: `Q_orifice = Cd × A_net × √(2g × ΔH)` (bridge opening fully submerged).
  - Weir: `Q_weir = Cw × L_weir × H^1.5` where H = WSEL minus high chord, L_weir = deck width adjusted for skew.
  - Iterates on upstream WSEL to find the level where `Q_orifice + Q_weir = Q_total`.

- **`engine/deck-profile.ts`** — Deck geometry utilities.
  - Computes effective weir length from deck width and skew angle.
  - Computes weir crest elevation (high chord).

### Type changes

Add to `BridgeGeometry`:
```typescript
orificeCd: number;       // default 0.8
weirCw: number;          // default 1.4
deckWidth: number;       // metres (stored as feet internally)
```

Add to `MethodResult`:
```typescript
flowCalculationType: 'free-surface' | 'orifice' | 'orifice+weir';
```

---

## 2. Equation Corrections

### 2a. Yarnell Equation

**Current (incorrect):**
```
Δy = K × (K + 5 - 0.6) × (α + 15α⁴) × V²/2g
```

**Corrected (HEC-RAS / Austroads standard):**
```
Δy = K × Fr₃² × (K + 5·Fr₃² - 0.6) × (α + 15α⁴) × y₃
```

Where:
- `Fr₃` = downstream Froude number = V₃ / √(g × y₃)
- `y₃` = downstream hydraulic depth = A₃ / T₃
- `α` = pier obstruction ratio = pier blockage area / total flow area
- `K` = pier shape coefficient (existing lookup table values are correct)

Two bugs fixed:
1. Froude number squared was missing from the first multiplier and inside the bracket (`5` should be `5·Fr²`).
2. Result scales by depth `y₃`, not velocity head `V²/2g`. These differ by `Fr²/2`.

### 2b. Energy Method — Bridge Velocity Iteration

**Current:** Bridge area and velocity computed once at DS WSEL, held constant during upstream WSEL iteration.

**Fix:** At each iteration step, recompute bridge section properties using the average of the trial WSEL and DS WSEL as the representative bridge water level. This matches the HEC-RAS standard step approach.

### 2c. Velocity Distribution Coefficient (Alpha)

**Current:** Hardcoded at `α₁ = 1.0` everywhere.

**Fix:** Auto-compute from conveyance-weighted subsection velocities:

```
α = Σ(Kᵢ³ / Aᵢ²) / (K_total³ / A_total²)
```

Where the summation is over the three subsections (LOB, channel, ROB) already computed in `calcConveyance()`.

New function: `calcAlpha(crossSection, wsel)` in `geometry.ts`.

Optional manual override: if the user enters a value in the Coefficients form, use it. If blank (null), auto-compute. This is for compound channels with wide floodplains where alpha can reach 1.5–2.5+.

### 2d. TUFLOW Superstructure FLC

**Current:** Always passes `superHeadLoss = 0` to `calcTuflowSuperFLC()`. The function exists but never computes a real value.

**Fix:** For pressure/overtopping regimes, compute:

```
FLC_super = (h_total - h_pier_freesurf) / (V²/2g)
```

Where `h_pier_freesurf` is estimated by computing what the free-surface afflux would have been at the same discharge (run the free-surface solver with WSEL capped at low chord). This isolates the superstructure contribution for TUFLOW's layered obstruction model.

Returns `null` for free-surface flow (no superstructure engagement) — unchanged.

---

## 3. Input Changes

### 3a. Bridge Geometry Form

**Removed fields:**
- `leftAbutmentSlope` — never referenced by any engine calculation.
- `rightAbutmentSlope` — never referenced by any engine calculation.

These are removed from `BridgeGeometry` type, the store defaults, the form, and JSON serialisation.

**Added fields (grouped under "Pressure / Overtopping" sub-section):**
- `orificeCd` — Orifice discharge coefficient. Default: 0.8. Range: 0.1–1.0.
- `weirCw` — Weir discharge coefficient. Default: 1.4. Dimensionless — same value regardless of unit system. Range: 0.5–3.0. Note: the standard metric weir equation uses `Cw` where `Q = Cw × L × H^1.5` (SI units). The engine converts internally as needed.
- `deckWidth` — Deck width for weir length calculation. Required when overtopping is expected.

The "Pressure / Overtopping" group has a subtitle: "Used when WSEL exceeds low chord".

**Moved fields:**
- `contractionLength` and `expansionLength` move from `FlowProfile` to `BridgeGeometry`.
- These are geometric properties of the reach, not flow-dependent. HEC-RAS treats them as fixed geometry.
- Single values shared across all profiles.

### 3b. Coefficients Form

**Added fields:**
- `alphaOverride: number | null` — Optional velocity distribution coefficient override. Default: `null` (auto-compute). Label: "Alpha (α₁)" with placeholder "Auto".
- `freeboardThreshold: number` — Low freeboard warning threshold. Default: 0.3 m (stored as ~0.984 ft internally). Label: "Low Freeboard Threshold" with unit.

### 3c. Flow Profiles Form

**Removed fields:**
- `contractionLength` — moved to Bridge Geometry.
- `expansionLength` — moved to Bridge Geometry.

The flow profiles table becomes: Name, ARI/AEP, Q, DS WSEL, Channel Slope. Five columns instead of seven — cleaner.

---

## 4. Validation

### New validation checks

| # | Check | Severity | Message |
|---|-------|----------|---------|
| 1 | DS WSEL below channel invert | Error | "DS WSEL ({val}) is below the lowest cross-section elevation ({val})" |
| 2 | DS WSEL above high chord + 10m | Warning | "DS WSEL appears unreasonably high — check units and datum" |
| 3 | Pier stations outside abutment range | Error | "Pier {n} station ({val}) is outside the bridge opening ({left}–{right})" |
| 4 | Abutment stations outside cross-section range | Error | "Left/Right abutment station is outside the cross-section extents" |
| 5 | Zero deck width when high chord < DS WSEL | Warning | "Deck width is zero — overtopping calculations will use zero weir length" |
| 6 | Contraction/expansion lengths ≤ 0 | Error | "Reach lengths must be positive" |
| 7 | Manning's n outside 0.01–0.3 | Warning | "Manning's n of {val} at station {sta} is unusual — verify" |
| 8 | Bridge velocity > 10 m/s (32.8 ft/s) | Warning | "Bridge velocity exceeds 10 m/s — check inputs" |

**Errors** block calculation. **Warnings** display in the validation panel but allow the user to proceed. Practising engineers may intentionally push boundaries.

---

## 5. Output Changes

### 5a. Freeboard Check

- Freeboard computed from the **envelope** of all enabled methods (worst-case upstream WSEL), not just Energy alone.
- "Low" threshold uses the configurable `freeboardThreshold` value from Coefficients.
- Footer shows the threshold value and notes it's configurable.
- Zero-freeboard Q interpolation unchanged.

### 5b. Method Comparison Table

- When a method result uses the shared pressure/overtopping solver, the value is annotated with a small label:
  - `ORF` for orifice (pressure flow)
  - `ORF+WR` for orifice + weir (overtopping flow)
- Energy, Momentum, and WSPRO converge to the same value for submerged conditions (shared solver).
- Yarnell shows "N/A" for non-free-surface (unchanged).

### 5c. TUFLOW FLC Section

- Pier FLC: unchanged calculation, now using corrected afflux values.
- Superstructure FLC: computed for pressure/overtopping regimes. Shows "—" for free-surface.
- Footnote explains the formula: `FLC_super = (h_total − h_pier_freesurf) / (V²/2g)`.

### 5d. Internal Units Note

- Subtle text next to the Metric/Imperial toggle: "Engine: US Customary internally".
- Informational only — no functional change. Helps engineers verifying intermediate calculation step values.

### 5e. Afflux Charts

- Rating curves and WSEL charts handle the regime transition naturally — the data points from pressure/overtopping will appear as a steeper curve beyond the transition point.
- No visual changes needed to the chart components themselves. The sensitivity bands continue to work.

---

## 6. Data Model Changes Summary

### `BridgeGeometry` type
```diff
+ orificeCd: number;              // default 0.8
+ weirCw: number;                 // default 1.4
+ deckWidth: number;              // default 0
+ contractionLength: number;      // moved from FlowProfile, default 0
+ expansionLength: number;        // moved from FlowProfile, default 0
- leftAbutmentSlope: number;
- rightAbutmentSlope: number;
```

### `FlowProfile` type
```diff
- contractionLength: number;      // moved to BridgeGeometry
- expansionLength: number;        // moved to BridgeGeometry
```

### `Coefficients` type
```diff
+ alphaOverride: number | null;   // default null (auto-compute)
+ freeboardThreshold: number;     // default 0.984 ft (0.3 m)
```

### `MethodResult` type
```diff
+ flowCalculationType: 'free-surface' | 'orifice' | 'orifice+weir';
```

### New files
- `engine/pressure-flow.ts`
- `engine/overtopping-flow.ts`
- `engine/deck-profile.ts`
- `calcAlpha()` added to `engine/geometry.ts`

### JSON serialisation
- `json-io.ts` updated to handle the new fields, removed fields, and migrated fields (contraction/expansion lengths).
- Backward compatibility: if importing an old project JSON that has `contractionLength` in flow profiles, migrate them to bridge geometry (use the value from the first profile).

---

## 7. Test Bridges

Existing test bridges in `lib/test-bridges.ts` updated to include:
- `orificeCd`, `weirCw`, `deckWidth` in bridge geometry.
- `contractionLength`, `expansionLength` moved from flow profiles to bridge geometry.
- `leftAbutmentSlope`, `rightAbutmentSlope` removed.

At least one test bridge should have a flow profile that triggers pressure flow (DS WSEL near or above low chord) to exercise the new solver.

---

## 8. Out of Scope

- Additional boundary condition types (normal depth, energy grade line) — DS WSEL only.
- Non-TUFLOW 2D model outputs (MIKE FLOOD, HEC-RAS 2D).
- Abutment slope calculations (removed entirely, not wired up).
- Training/guidance UI for junior engineers.
