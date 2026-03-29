# Analysis Components

This directory contains post-calculation analysis tools that go beyond the basic method results: scour estimation and QA/QC comparison against HEC-RAS. These appear under the **Analysis** tab.

## Components

### ScourPanel

**File:** `scour-panel.tsx`

Performs HEC-18 scour estimation for both pier scour and contraction scour.

**Inputs (editable):**
- Bed material type (sand, gravel, cobble, clay, rock) with D50 range hints.
- D50 (mm) -- median grain size.
- D95 (mm) -- optional, for armoring checks.
- Upstream bed elevation -- defaults to the lowest cross-section point within the bridge opening.
- Countermeasure type (none, riprap, sheet pile, gabions, other).

**Calculation flow:**
1. Requires hydraulic results to be computed first (approach velocity and Froude number come from the energy method result, falling back to momentum, Yarnell, or WSPRO in that order).
2. For each flow profile, calculates critical velocity using the Shields-based `criticalVelocity()` function to determine live-bed vs. clear-water conditions.
3. Calls `calculatePierScour()` for each pier, which applies the CSU/HEC-18 equation with K1 (shape), K2 (skew), and K3 (bed condition) correction factors.
4. Calls `calculateContractionScour()` using approach conditions and the contracted/uncontracted width ratio.
5. Worst-case total scour = max pier scour + contraction scour.

**Results display:**
- Summary banner showing worst-case total scour across all profiles (amber warning card).
- Profile selector dropdown.
- Contraction scour card with type (live-bed/clear-water), critical velocity, approach velocity, scour depth, and critical bed elevation.
- Pier scour table with per-pier K factors and scour depths.
- Scour cross-section diagram (see ScourDiagram below).

### ScourDiagram

**File:** `scour-diagram.tsx`

An SVG cross-section sketch showing the original ground, bridge deck, piers, water surface, and a dashed red line at the worst-case scoured bed elevation across the bridge opening.

Uses D3 `scaleLinear` for coordinate mapping. The elevation range automatically includes scour elevations and the high chord to ensure everything fits. Includes a three-item legend (Ground, Scoured Bed, Water Surface).

### QaqcPanel

**File:** `qaqc-panel.tsx`

Compares the application's worst-case results (highest WSEL across all enabled methods) against user-entered HEC-RAS reference values.

**How it works:**
1. Users enter HEC-RAS upstream WSEL and head loss for each flow profile via `HecRasInputRow` components.
2. For each profile, the panel finds the worst-case result across enabled methods.
3. Builds a comparison table with columns: Parameter, This App, HEC-RAS, Delta, % Diff.
4. Color-coded divergence badges: green (<5%), amber (5-10%), red (>10%).

**Root cause suggestions:**
When divergence exceeds 10%, the panel applies pattern-matching rules:
- If all methods diverge: "Check Manning's n values and cross-section geometry."
- If WSEL diverges but head loss does not: "Downstream boundary condition may differ."
- If head loss diverges: "Check contraction/expansion coefficients."
- If only Yarnell diverges: "Yarnell method not valid for pressure flow."
- If velocity diverges: "Check flow area computation -- pier blockage may differ."

**Verdict logic:**
- **PASS** -- all parameters within 5%.
- **ACCEPTABLE** -- all within 10%.
- **REVIEW REQUIRED** -- one or more parameters exceed 10%.
- If no HEC-RAS data entered: prompts the user to enter values.

**Export Memo** button generates a one-page PDF via QaqcMemoPdf.

### QaqcMemoPdf

**File:** `qaqc-memo-pdf.tsx`

A `@react-pdf/renderer` Document component that produces a one-page A4 memo containing:
- Title: "QA/QC Comparison Memo" with project name and date.
- Color-coded verdict badge (green/amber/red background).
- Per-profile comparison tables matching the on-screen layout.
- Root cause annotations (red warning text) for parameters exceeding 10%.
- Footer with generation attribution and date.

The memo is generated client-side via `pdf(...).toBlob()` and downloaded as `qaqc-memo.pdf`.
