# Hydrology

## Overview

This module estimates design flood discharges for ungauged catchments using the Rational Method, which is the standard approach in Australian practice for small to medium catchments (typically under 25 km^2). It provides the flow inputs that feed into the hydraulic bridge analysis engine.

The hydrology workflow is:

1. Define catchment properties (area, stream length, slope).
2. Compute time of concentration (tc) using one of two empirical equations.
3. Look up rainfall intensity from an IFD (Intensity-Frequency-Duration) table for the computed tc and each design AEP.
4. Apply the Rational Method formula to compute peak discharge for each AEP.

## Rational Method (`rational-method.ts`)

### Core Formula

```
Q = C * I * A / 360
```

Where:
- `Q` = peak discharge (m^3/s)
- `C` = runoff coefficient (dimensionless, 0 to 1)
- `I` = rainfall intensity (mm/hr) for the design duration and AEP
- `A` = catchment area (km^2)
- The divisor 360 converts the product of mm/hr and km^2 into m^3/s

Note: Unlike the rest of the engine (which operates in imperial internally), the hydrology module uses **metric units** natively because Australian hydrological practice, IFD data, and ARR (Australian Rainfall and Runoff) are all metric-based. The UI handles any necessary conversions.

### IFD Table Interpolation

The `lookupIntensity()` function interpolates rainfall intensity from a user-supplied IFD table for a given duration (in minutes) and AEP string. The IFD table structure is:

```typescript
interface IFDTable {
  durations: number[];        // e.g., [5, 10, 15, 30, 60, 120, ...]
  aeps: string[];             // e.g., ['50%', '20%', '10%', '5%', '2%', '1%']
  intensities: number[][];    // [durationIndex][aepIndex] -> mm/hr
}
```

Interpolation is linear between bounding durations. If the requested duration is outside the table range, the nearest boundary value is returned.

### ARR Data Hub Integration

In practice, the IFD table is obtained from the Bureau of Meteorology's ARR Data Hub (data.arr-software.org) by providing a geographic coordinate (latitude/longitude). The `HydrologyState` type includes a `location` field for this purpose. The actual HTTP fetch from the ARR Data Hub is handled by the UI layer -- the engine only consumes the resulting IFD table.

### Standard AEPs

The module exports a `STANDARD_AEPS` constant defining the default set of Annual Exceedance Probabilities to calculate:

```
['50%', '20%', '10%', '5%', '2%', '1%']
```

These correspond to average recurrence intervals of 2, 5, 10, 20, 50, and 100 years respectively.

### Land-Use Runoff Coefficients

The module exports `LAND_USE_COEFFICIENTS` with suggested ranges from ARR Book 5:

| Land Use         | Range     | Default |
|------------------|-----------|---------|
| Rural / Forested | 0.1 - 0.4 | 0.25   |
| Suburban / Mixed | 0.4 - 0.7 | 0.55   |
| Urban / Dense    | 0.7 - 0.9 | 0.80   |

The user selects or manually enters a runoff coefficient based on catchment characteristics.

## Time of Concentration (`time-of-concentration.ts`)

Time of concentration (tc) is the time it takes for runoff from the most hydraulically remote point in the catchment to reach the point of interest. It determines which rainfall intensity to use from the IFD table (storm duration = tc).

Two empirical equations are provided:

### Bransby-Williams

```
tc = 0.0883 * L / (A^0.1 * S^0.2)
```

Where:
- `tc` = time of concentration (hours)
- `L` = stream length (km)
- `A` = catchment area (km^2)
- `S` = equal-area slope (m/km)

This is the more commonly used equation in Australian practice. It requires knowledge of the main stream length and catchment slope.

### Friends Equation

```
tc = 0.76 * A^0.38
```

Where:
- `tc` = time of concentration (hours)
- `A` = catchment area (km^2)

A simpler equation that depends only on catchment area. Useful when stream length and slope data are not available, or as a cross-check against Bransby-Williams. Generally less accurate for elongated catchments or steep terrain.

### Manual Override

The `HydrologyState` type also supports `tcMethod: 'manual'` with a `tcManual` field, allowing the user to directly specify tc when they have site-specific data or want to use a different estimation method.

## How It Fits Together

The hydrology module produces an array of `{ aep: string; q: number }` pairs (stored in `HydrologyState.calculatedDischarges`). These can be used to populate `FlowProfile` entries for the main hydraulic analysis. The downstream WSEL for each profile must still be supplied separately (from a hydraulic model, rating curve, or normal depth calculation).
