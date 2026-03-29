# Utilities (`src/lib`)

## Overview

This directory contains shared utility modules used by both the engine and the UI. These modules handle unit conversion, data parsing, input validation, project serialization, and test data.

---

## Unit Conversion (`units.ts`)

### Design Philosophy

The engine stores and computes everything in **imperial units** (ft, cfs, ft/s). The UI can display values in either imperial or metric. The unit conversion system sits at the boundary between the two: it converts user input from the display system to imperial for storage, and converts stored imperial values back to the display system for rendering.

### Supported Unit Types

| Unit Type    | Imperial | Metric  | Conversion Factor (imperial to metric) |
|-------------|----------|---------|---------------------------------------|
| `length`    | ft       | m       | 0.3048                                |
| `area`      | ft^2     | m^2     | 0.09290304                            |
| `velocity`  | ft/s     | m/s     | 0.3048                                |
| `discharge` | cfs      | m^3/s   | 0.028316846592                        |
| `slope`     | ft/ft    | m/m     | 1 (dimensionless)                     |
| `manningsN` | --       | --      | 1 (dimensionless)                     |
| `angle`     | degrees  | degrees | 1                                     |

### Key Functions

- `toImperial(value, unitType, system)` -- Converts a display value to imperial for storage. If the system is already imperial, returns the value unchanged. For metric, divides by the conversion factor.

- `toDisplay(value, unitType, system)` -- Converts an imperial stored value to the active display system. For metric, multiplies by the conversion factor.

- `unitLabel(unitType, system)` -- Returns the appropriate unit label string (e.g., "ft" or "m") for the active system.

---

## HEC-RAS Parser (`hecras-parser.ts`)

Parses HEC-RAS model files to extract geometry, flow data, and results for comparison.

### Geometry Parser (`.g01` files)

`parseHecRasGeometry(text)` reads a HEC-RAS geometry file and extracts:

- **Cross-sections**: Station/elevation pairs, Manning's n zones (triplets of station/n/0), and bank station locations. Returns an array of `ParsedCrossSection` objects.
- **Bridge blocks**: Deck/roadway definitions (high chord, deck width, low chord profile pairs), and pier definitions (station, width). Returns `ParsedBridge` objects.
- **Title**: The geometry file title from the `Geom Title=` line.

The parser handles the HEC-RAS format where `#Sta/Elev=N` precedes N station/elevation data pairs, and `#Mann=N` precedes N Manning's n triplets.

### Flow File Parser (`.f01` files)

`parseHecRasFlow(text)` extracts:

- Profile names from the `Profile Names=` line.
- Discharges from the `River Rch & RM=` data blocks.
- Downstream boundary conditions from `Known WS=` (known water surface) or `Normal Depth=` (slope) lines.

Returns an `HecRasFlowResult` with an array of profile objects matching the `FlowProfile` structure.

### Results File Parser (`.r01` files)

`parseHecRasResults(text)` scans for `Begin Profile Output` / `End Profile Output` blocks and extracts:

- Profile name
- Water surface elevation (`W.S. Elev`)
- Head loss (derived from E.G. Elev minus W.S. Elev)
- Velocity
- Froude number

Returns `HecRasResultsProfile[]` for comparison against the engine's computed results.

### Why This Exists

HEC-RAS is the industry-standard 1D hydraulic model. Engineers often have existing HEC-RAS models and want to validate this tool's results against HEC-RAS output. The parser allows direct import of HEC-RAS geometry and flow data, and comparison of computed results.

---

## Validation (`validation.ts`)

`validateInputs(crossSection, bridge, profiles)` checks the input data for errors and warnings before running calculations. Returns an array of `ValidationError` objects.

### Error Checks (prevent calculation)

- Cross-section must have at least 2 points.
- Left and right bank stations must both be defined.
- Manning's n must be positive for all points.
- Left abutment must be left of right abutment.
- Low chord must be below high chord.
- Abutment stations must be within the cross-section extents.
- Pier stations must be within the bridge opening.
- Contraction and expansion reach lengths must be positive.
- At least one flow profile is required.
- Discharge must be positive.
- Downstream WSEL must not be below the lowest cross-section elevation.

### Warning Checks (allow calculation but flag concerns)

- Manning's n outside the typical range of 0.01 to 0.3.
- Downstream WSEL more than 10 ft above the high chord (likely datum error).
- Deck width is zero when overtopping is expected (weir length would be zero).

Each error includes a `field` path (e.g., `'bridge.piers[2]'`), a human-readable `message`, and a `severity` of `'error'` or `'warning'`.

---

## Project Serialization (`json-io.ts`)

Handles saving and loading project state as JSON files.

### `serializeProject(state)`

Converts the current project state to a JSON string (version 2 format). Includes:

- Cross-section points
- Bridge geometry
- Flow profiles
- Coefficients
- HEC-RAS comparison data
- Active unit system

Does **not** include calculated results -- these are recomputed on load.

### `parseProjectJson(json)`

Parses a JSON string back into project state. Handles:

- **Version migration**: Supports both version 1 and version 2 formats. Version 1 stored reach lengths in flow profiles rather than bridge geometry; the parser migrates them automatically.
- **Default values**: Missing fields are filled with sensible defaults (e.g., `orificeCd = 0.8`, `weirCw = 1.4`, `tolerance = 0.01`, `maxIterations = 100`).
- **Unit system**: Reads the stored unit system or defaults to imperial if not present.

### Defaults

| Field               | Default Value |
|--------------------|---------------|
| `orificeCd`        | 0.8           |
| `weirCw`           | 1.4           |
| `deckWidth`        | 0             |
| `contractionCoeff` | 0.3           |
| `expansionCoeff`   | 0.5           |
| `maxIterations`    | 100           |
| `tolerance`        | 0.01          |
| `freeboardThreshold` | 0.984 (ft, = 0.3 m) |
| `alphaOverride`    | null (computed) |

---

## Test Bridge Data (`test-bridges.ts`)

Provides a curated set of five bridge configurations for testing, validation, and demonstration.

### Included Bridges

1. **V-Channel Benchmark** (`v-channel-benchmark`)
   - **Purpose**: Hand-computable reference case. Symmetric trapezoidal channel with a single round-nose pier. Simple enough to verify every intermediate value by hand.
   - **Location**: Validation Reference
   - **Geometry**: 11 survey points, single 1.22 m pier
   - **Flows**: 2 benchmark flows

2. **Beaver Creek Bridge** (`beaver-creek`)
   - **Purpose**: USACE HEC-RAS Applications Guide benchmark (Example 2). Calibrated against observed flood levels with a 0.07 m mean absolute error.
   - **Location**: Kentwood, Louisiana
   - **Geometry**: 18 survey points, 9 square piers
   - **Flows**: 3 events (25-yr, 100-yr, May 1974 flood)
   - **Reference**: HEC-RAS Applications Guide, Chapter 3

3. **Bogue Chitto Bridge** (`bogue-chitto`)
   - **Purpose**: WSPRO validation case (HEC-RAS Example 13). Wide floodplain with significant overbank flow.
   - **Location**: Pike County, Mississippi
   - **Geometry**: 18 survey points, 17 narrow square piers
   - **Flows**: 2 events (50-yr, 100-yr)
   - **Reference**: HEC-RAS Applications Guide, Example 13

4. **Windsor Bridge** (`windsor`)
   - **Purpose**: Major Australian flood-prone crossing. Deep tidal channel with broad floodplain. Tests the engine with metric-native data and round-nose pier shapes.
   - **Location**: Hawkesbury River, NSW, Australia
   - **Geometry**: 16 survey points, 4 round-nose piers, 10-degree skew
   - **Flows**: 3 events (5-yr to 100-yr)
   - **Reference**: Hawkesbury-Nepean Flood Study 2024

5. **Breakfast Creek Bridge** (`breakfast-creek`)
   - **Purpose**: Small urban tidal creek crossing. Tests compact geometry and low-flow behavior.
   - **Location**: Brisbane, QLD, Australia
   - **Geometry**: 14 survey points, 2 square heritage piers
   - **Flows**: 3 events (10-yr to 100-yr)
   - **Reference**: BCC Breakfast Creek Flood Study

### Data Format

All test bridge values are stored in **metric** (m, m^3/s). The UI converts to imperial on load using the unit conversion system. Each `TestBridge` object includes the full `crossSection`, `bridgeGeometry`, `flowProfiles`, and `coefficients` needed to run a complete analysis.

The `expectedResults` field (optional) allows known-correct results to be attached for automated regression testing. When present, the UI can compare computed values against expected values and flag discrepancies.
