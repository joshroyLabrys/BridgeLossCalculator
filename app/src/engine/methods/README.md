# Calculation Methods

## Overview

This directory contains the four bridge hydraulic analysis methods supported by the engine. Each method computes the upstream water surface elevation (WSEL) given a known downstream WSEL, cross-section geometry, bridge geometry, and flow conditions. All methods share the same function signature and return the same `MethodResult` type, making them interchangeable from the caller's perspective.

All four methods handle only the **free-surface** flow regime directly. When the water surface contacts the bridge soffit (pressure flow) or overtops the deck, every method delegates to the shared `pressure-flow.ts` and `overtopping-flow.ts` solvers. This means the pressure and overtopping results are identical across methods -- the methods only differ in how they compute free-surface backwater.

Engineers typically run all four methods and compare results. Agreement between methods increases confidence; divergence signals that the bridge geometry or flow conditions may be at the edge of a method's validity range.

---

## Energy Method (`energy.ts`)

### Core Equation

Standard step energy equation across four cross-sections (upstream, contraction, bridge, expansion):

```
US_WSEL = DS_WSEL + h_f + h_c + h_e
```

Where:
- `h_f` = friction loss = L * (Sf_us + Sf_ds) / 2 (average friction slope)
- `h_c` = contraction loss = Cc * |Vh_bridge - Vh_ds| (velocity head difference)
- `h_e` = expansion loss = Ce * |Vh_us - Vh_bridge| (velocity head difference)
- Sf = (Q / K)^2, where K is the Manning's conveyance
- Vh = alpha * V^2 / (2g), where alpha is the velocity distribution coefficient
- L = contractionLength + expansionLength

### How It Works

1. Computes downstream section properties (area, perimeter, conveyance, velocity).
2. Detects flow regime. Delegates to orifice/weir solvers if not free-surface.
3. Computes alpha (velocity distribution coefficient) from subsection conveyances unless overridden.
4. Uses the bisection/secant solver to iterate on upstream WSEL. The objective function computes bridge properties at the average of trial and downstream WSEL, then sums friction, contraction, and expansion losses.
5. After convergence, re-evaluates the regime. If the solution overshot the low chord, delegates to the pressure solver.

### When to Use

The energy method is the most general-purpose method and the default for most bridge analyses. It is the same approach used by HEC-RAS for bridge modeling in the energy-based mode. Use it when:

- The bridge has a well-defined contraction and expansion reach.
- You have reasonable estimates of contraction (Cc) and expansion (Ce) coefficients.
- Flow is subcritical (Froude < 1).

### Limitations

- Requires user-specified reach lengths (contraction and expansion). Results are sensitive to these values.
- Assumes gradually varied flow -- not valid near hydraulic jumps or supercritical conditions.
- Contraction/expansion coefficients (Cc = 0.3, Ce = 0.5 are defaults) are empirical and can vary by site.
- The method is iterative and may not converge for extreme conditions (very high velocity, supercritical flow).

---

## Momentum Method (`momentum.ts`)

### Core Equation

Force balance (Newton's second law) applied to the control volume between upstream and downstream sections:

```
F_us - F_ds + M_ds - M_us + W_x - F_friction - F_drag = 0
```

Where:
- `F` = hydrostatic force = 0.5 * gamma * A * D (gamma = 62.4 lb/ft^3, D = mean depth = A/T)
- `M` = momentum flux = rho * Q * V (rho = 1.94 slugs/ft^3)
- `W_x` = weight component along the slope = gamma * A * L * S
- `F_friction` = bed friction force = tau * P * L, where tau = gamma * R * S
- `F_drag` = pier drag = 0.5 * rho * Cd_drag * A_pier * V^2 (Cd_drag = 1.2)

### How It Works

1. Computes downstream hydrostatic force and momentum flux.
2. Estimates pier drag force using a drag coefficient of 1.2 applied to the pier blockage area.
3. Computes weight and friction forces along the reach.
4. Uses the solver to find the upstream WSEL where the momentum balance closes. The objective function uses a Newton-like correction: it computes the force imbalance and scales it by dF/dWSEL to estimate the next trial.
5. Re-evaluates regime after convergence, same as energy method.

### When to Use

The momentum method is preferred when:

- There are significant pier drag forces (many piers, wide piers, or high velocities).
- The energy method does not converge or produces suspect results.
- You want an independent check based on different physical principles (force balance vs energy conservation).
- Flow is near critical (Froude approaching 1.0), where the momentum approach can be more stable.

### Limitations

- Uses simplified hydrostatic force computation (assumes mean depth approximation for the pressure distribution).
- Pier drag coefficient is fixed at 1.2 -- not adjustable by the user.
- The bed shear stress approximation (uniform flow friction) may not be accurate for rapidly varied flow.
- Like the energy method, it requires contraction and expansion reach lengths.

---

## Yarnell Method (`yarnell.ts`)

### Core Equation

Empirical pier-based formula developed by David Yarnell (1934):

```
dy = K * Fr3^2 * (K + 5*Fr3^2 - 0.6) * (alpha + 15*alpha^4) * y3
```

Where:
- `dy` = backwater rise above the downstream WSEL (ft)
- `K` = pier shape coefficient (see table below)
- `Fr3` = Froude number at the downstream section
- `alpha` = pier obstruction ratio = pier blockage area / total flow area
- `y3` = hydraulic depth at the downstream section (A/T)

The upstream WSEL is simply `DS_WSEL + dy`. No iteration is required.

### K Coefficients (Pier Shape)

| Pier Shape   | K Value |
|-------------|---------|
| Square      | 1.25    |
| Round-nose  | 0.90    |
| Cylindrical | 0.90    |
| Sharp       | 0.70    |

The user can override K manually via `coefficients.yarnellK`. If null, the engine looks up K from the first pier's shape.

### When to Use

The Yarnell method is appropriate when:

- The bridge has prominent piers that are the primary cause of backwater.
- Flow is free-surface and subcritical.
- You want a quick, non-iterative estimate of pier-induced backwater.
- The method is commonly used in Australian practice (Austroads, TMR guidelines) as a check method.

### Limitations

- **Free-surface flow only.** If the regime is pressure or overtopping, Yarnell returns an error result with the message "Not Applicable: Yarnell method only applies to free-surface flow." It does not delegate to the pressure/orifice solvers.
- Only accounts for pier obstruction effects. Does not model abutment contraction, friction losses, or expansion losses.
- Empirically derived from laboratory experiments on uniform channels with simple pier shapes. May not be accurate for complex geometries, skewed bridges, or debris-laden conditions.
- Requires at least one pier to produce a meaningful result (alpha = 0 yields dy = 0).

---

## WSPRO Method (`wspro.ts`)

### Core Equation

FHWA backwater coefficient approach (Water Surface Profile, WSPRO):

```
dh = C * alpha1 * (V1^2 / 2g)
```

Where:
- `dh` = backwater above downstream WSEL (ft)
- `C` = composite coefficient = Cb * K_Fr * K_e
- `Cb` = base backwater coefficient from the bridge opening ratio M (lookup table)
- `K_Fr` = Froude number correction = 1 + 0.5 * Fr^2
- `K_e` = eccentricity correction = 1 + e, where e = |K_left - K_right| / K_total
- `alpha1` = velocity distribution coefficient
- `V1` = approach velocity

### Bridge Opening Ratio M

M = K_bridge / K_total (clamped to [0, 1])

Where K_bridge is the Manning's conveyance of the portion of the cross-section within the bridge abutments, and K_total is the conveyance of the full cross-section. Lower M means more constriction and higher backwater.

The base coefficient Cb is looked up from a table derived from FHWA WSPRO documentation (Table 5-1):

| M    | Cb   |
|------|------|
| 0.10 | 3.10 |
| 0.20 | 1.40 |
| 0.30 | 0.73 |
| 0.40 | 0.39 |
| 0.50 | 0.20 |
| 0.60 | 0.10 |
| 0.70 | 0.04 |
| 0.80 | 0.01 |
| 0.90 | 0.00 |
| 1.00 | 0.00 |

Values between table entries are linearly interpolated.

### How It Works

1. Computes total cross-section conveyance and bridge opening conveyance.
2. Calculates M = K_bridge / K_total (clamped to 1.0).
3. Looks up Cb from the table.
4. Computes Froude correction and eccentricity correction factors.
5. Multiplies all factors to get the composite coefficient C.
6. Backwater = C * alpha * downstream velocity head.
7. Re-evaluates regime if the result exceeds the low chord.

No iteration is required -- the method is direct (non-iterative) like Yarnell.

### When to Use

WSPRO is the method of choice when:

- The bridge constriction is primarily caused by abutments rather than piers.
- You have a wide floodplain with significant overbank flow being forced through a narrower bridge opening.
- The FHWA WSPRO approach is standard practice in your jurisdiction.
- You want a method that accounts for flow eccentricity (asymmetric floodplain).

### Limitations

- The Cb lookup table is an approximation of the original FHWA curves. Accuracy decreases for extreme M values (very small or very large openings).
- The Froude correction is a simplified quadratic approximation.
- Does not directly model pier effects (pier losses are implicitly included in the M ratio through reduced bridge conveyance).
- Like Yarnell, delegates to pressure/overtopping solvers when the computed WSEL exceeds the low chord.

---

## Comparison of Methods

| Aspect             | Energy         | Momentum       | Yarnell        | WSPRO          |
|--------------------|----------------|----------------|----------------|----------------|
| Iterative?         | Yes            | Yes            | No             | No             |
| Models piers?      | Via area reduction | Via drag force | Directly (K)  | Via conveyance |
| Models abutments?  | Via contraction | Via contraction | No            | Directly (M)  |
| Friction losses?   | Yes            | Yes            | No             | No             |
| Pressure/overtop?  | Delegates      | Delegates      | N/A (error)    | Delegates      |
| Key parameters     | Cc, Ce, L      | L, slope       | K, pier ratio  | M ratio        |
| Best for           | General use    | High pier drag | Quick pier check | Wide floodplains |
