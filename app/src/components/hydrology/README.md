# Hydrology Components

This directory contains components for hydrological analysis following the Australian Rainfall and Runoff (ARR) framework. These appear under the **Hydrology** tab and provide a path from site location to design discharges that feed into the hydraulic analysis.

## Components

### ArrLookup

**File:** `arr-lookup.tsx`

Map-based location picker with IFD (Intensity-Frequency-Duration) data retrieval from the ARR Data Hub API.

**Left column -- Site Location:**
- Interactive Leaflet map (loaded via `dynamic()` with `ssr: false` to avoid SSR issues).
- Click the map to set coordinates, or enter latitude/longitude manually.
- Catchment area input (km2).
- **Fetch IFD Data** button calls `https://data.arr-software.org/v3/ifd?lat=...&lng=...` with a 15-second timeout.
- On API failure or unexpected response format, falls back to mock IFD data (approximate SE Queensland values) and displays a warning banner.

**Right column -- IFD Results:**
- Displays the IFD table as durations (rows) x AEPs (columns) with intensities in mm/hr.
- Highlights the critical duration row (highest intensity for the first AEP).
- Shows a badge with the table dimensions (e.g., "13 durations x 6 AEPs").

### CatchmentCalculator

**File:** `catchment-calculator.tsx`

Calculates design discharges using the Rational Method (Q = C x I x A / 360) for each standard AEP.

**Left column -- Time of Concentration:**
- Three Tc methods:
  - **Bransby-Williams** -- requires stream length (km) and equal-area slope (m/km), plus catchment area from the hydrology state.
  - **Friends** -- requires only catchment area.
  - **Manual** -- direct entry in hours.
- Comparison table showing all computed Tc values side by side, with the selected method highlighted.

**Left column -- Runoff Coefficient:**
- Land use buttons with ARR Book 5 suggested C ranges (e.g., "Rural: 0.3-0.5, default 0.4").
- Clicking a land use sets the runoff coefficient.
- Manual override input clamped to 0-1.

**Right column -- Discharge Results:**
- Summary badges showing current Tc, C, and A values.
- Table of discharges per AEP with intensity (mm/hr) and Q (m3/s).
- **Send to Flow Profiles** button merges calculated discharges into the flow profiles form, matching by ARI and adding new profiles for unmatched AEPs. Note: downstream WSEL defaults to 0 and channel slope to 0.001 -- the engineer must fill these in.

### LeafletMap

**File:** `leaflet-map.tsx`

A client-only Leaflet embed that cannot be server-side rendered.

**Key implementation details:**
- Default-exported (required by Next.js `dynamic()` with `ssr: false`).
- Uses OpenStreetMap tile layer with standard attribution.
- Fixes the default Leaflet marker icon issue with bundlers by manually specifying icon URLs from unpkg.
- Initializes the map once on mount, then updates the marker and view center when lat/lng props change.
- Re-binds the click handler when the `onMapClick` callback changes.
- Calls `map.invalidateSize()` 100ms after mount to fix grey tiles when the map is initially hidden inside a tab.
