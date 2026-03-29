# Scour Assessment

## Overview

This module calculates bridge scour depths using the methods from HEC-18 (Evaluating Scour at Bridges, 5th Edition). Scour is the erosion of the streambed around bridge foundations caused by flowing water, and it is the leading cause of bridge failure worldwide. The engine computes two types of scour:

1. **Pier scour** -- localized erosion around individual piers (CSU/HEC-18 equation).
2. **Contraction scour** -- general bed lowering caused by the constriction of flow through the bridge opening.

Both types are computed independently and summed for a worst-case total scour depth.

## Units

Internally, all calculations are performed in **imperial units** (ft, ft/s, cfs), consistent with the rest of the engine. The one exception is the `d50` grain size input, which is accepted in **millimeters** and converted to feet internally (1 mm = 1/304.8 ft). This matches common engineering practice where sediment grain sizes are reported in metric.

## Pier Scour (`pier-scour.ts`)

### CSU/HEC-18 Equation

```
ys = 2.0 * K1 * K2 * K3 * a^0.65 * y1^0.35 * Fr1^0.43
```

Where:
- `ys` = scour depth (ft)
- `a` = pier width (ft)
- `y1` = approach flow depth (ft)
- `Fr1` = approach Froude number
- `K1`, `K2`, `K3` = correction factors (see below)

### Correction Factors

#### K1 -- Pier Nose Shape Factor

Accounts for the streamlining effect of the pier nose geometry.

| Shape       | K1  |
|-------------|-----|
| Square      | 1.1 |
| Round-nose  | 1.0 |
| Cylindrical | 1.0 |
| Sharp       | 0.9 |

Square-nosed piers create the most turbulence and therefore the deepest scour. Sharp (pointed) noses deflect flow more efficiently and reduce scour.

#### K2 -- Flow Angle of Attack Factor

Accounts for skewed flow impacting the pier at an angle.

```
K2 = (cos(theta) + (L/a) * sin(theta))^0.65
```

Where:
- `theta` = skew angle (radians, converted from the bridge's skew angle in degrees)
- `L/a` = pier length-to-width ratio (assumed 4:1 in this implementation)

When flow is aligned with the pier (theta = 0), K2 = 1.0. As the angle of attack increases, K2 increases because the effective projected width of the pier grows.

#### K3 -- Bed Condition Factor

Accounts for bed form effects (dunes, antidunes, plane bed).

The implementation uses K3 = 1.1 for all conditions. This is the standard value for both clear-water scour and live-bed scour with plane bed conditions, which covers the most common design scenarios.

### Output

For each pier, the function returns a `PierScourResult`:

| Field                | Description |
|----------------------|-------------|
| `pierIndex`          | Index of the pier in the bridge geometry |
| `station`            | Pier station location (ft) |
| `width`              | Pier width (ft) |
| `k1`, `k2`, `k3`    | Applied correction factors |
| `scourDepth`         | Computed scour depth (ft) |
| `criticalBedElevation` | Existing bed elevation minus scour depth (ft) |

## Contraction Scour (`contraction-scour.ts`)

### Classification: Live-Bed vs Clear-Water

The first step is determining whether the approach flow is competent to move bed material:

```
Vc = 6.19 * y1^(1/6) * D50^(1/3)
```

Where:
- `Vc` = critical velocity for incipient motion (ft/s)
- `y1` = approach depth (ft)
- `D50` = median grain size (ft, converted from mm internally)

If the approach velocity exceeds Vc, the condition is **live-bed** (sediment is actively being transported). Otherwise, it is **clear-water** (bed material is stable upstream but may erode in the contracted section due to higher velocities).

### Live-Bed Contraction Scour

```
y2 / y1 = (Q2/Q1)^(6/7) * (W1/W2)^k1
```

Where:
- `y2` = contracted equilibrium depth (ft)
- `y1` = approach depth (ft)
- `Q2` = discharge in the contracted section (cfs)
- `Q1` = discharge in the approach section (cfs)
- `W1` = approach channel width (ft)
- `W2` = contracted channel width (ft)
- `k1` = exponent depending on the ratio of shear velocity to fall velocity (default 0.59 for most cases)

Scour depth = y2 - y0 (existing depth in the contracted section), clamped to zero minimum.

### Clear-Water Contraction Scour

```
y2 = [0.025 * Q^2 / (Dm^(2/3) * W^2)]^(3/7)
```

Where:
- `y2` = contracted equilibrium depth (ft)
- `Q` = contracted section discharge (cfs)
- `Dm` = effective mean grain diameter = 1.25 * D50 (ft)
- `W` = contracted section width (ft)

Scour depth = y2 - y0, clamped to zero minimum.

### Main Entry Point

The `calculateContractionScour()` function:

1. Converts D50 from mm to ft.
2. Computes critical velocity.
3. Classifies the condition as live-bed or clear-water.
4. Applies the appropriate equation.
5. Fills in the critical velocity, approach velocity, and critical bed elevation on the result.

### Output

A `ContractionScourResult`:

| Field                  | Description |
|------------------------|-------------|
| `type`                 | `'live-bed'` or `'clear-water'` |
| `criticalVelocity`    | Vc for incipient motion (ft/s) |
| `approachVelocity`    | Actual approach velocity (ft/s) |
| `contractedDepth`     | Equilibrium depth in contracted section (ft) |
| `existingDepth`       | Current depth in contracted section (ft) |
| `scourDepth`          | Depth of scour = contracted - existing (ft, min 0) |
| `criticalBedElevation` | Bed elevation after scour (ft) |

## How Engineers Use These Results

1. **Foundation design check.** Compare `criticalBedElevation` against the existing pile tip or footing elevation. If the scour hole would undermine the foundation, the bridge is at risk.

2. **Total scour.** The worst-case total scour at any pier is the sum of pier scour (at that pier) and contraction scour. This is reported as `totalWorstCase` in the `ScourResults` type.

3. **Countermeasure design.** If scour depths are unacceptable, engineers size riprap, sheet pile, or other countermeasures to protect the foundation to the predicted scour depth.

4. **Risk assessment.** Scour results feed into the adequacy decision engine to assess whether the bridge is structurally viable under design flood conditions.
