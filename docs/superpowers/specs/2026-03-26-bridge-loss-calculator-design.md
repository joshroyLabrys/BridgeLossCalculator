# Bridge Loss Calculator — Design Spec

**Date:** 2026-03-26
**Author:** Joshua / Claude
**Purpose:** Excel VBA tool for independent bridge hydraulic loss calculations to validate HEC-RAS output

---

## 1. Overview

A single Excel workbook (.xlsm) that computes bridge hydraulic losses using four standard methods (Energy, Momentum, Yarnell, WSPRO), then presents results alongside manually-entered HEC-RAS values for QA comparison. The tool targets practicing hydraulic/civil engineers who need to verify HEC-RAS bridge modeling results.

### Key Constraints

- **Platform:** Excel with VBA macros (.xlsm)
- **User profile:** Button-driven UI, no VBA editing required
- **Input:** Manual entry only (station/elevation pairs, bridge dimensions, flow data)
- **Output:** Step-by-step calc sheets, summary comparison tables, auto-generated charts

---

## 2. Workbook Structure

Seven sheets in a single workbook:

| Sheet | Purpose |
|-------|---------|
| **Instructions** | How-to guide, button legend, equation references, assumptions |
| **Input** | All user inputs organized in four zones |
| **Energy Method** | Standard step energy equation calculations |
| **Momentum Method** | Momentum balance calculations |
| **Yarnell** | Yarnell empirical pier loss calculations |
| **WSPRO** | FHWA WSPRO method calculations |
| **Summary & Charts** | Comparison tables, % differences, auto-generated plots |

---

## 3. Input Sheet

Four input zones arranged top-to-bottom, with action buttons at the top of the sheet.

### 3.1 Action Buttons

Located in rows 1–2, always visible:

- **Run All Methods** — executes all selected calculation methods for all profiles
- **Generate Charts** — builds/refreshes charts on the Summary sheet
- **Clear Results** — wipes all calculated values across method sheets
- **Plot Cross-Section** — generates a preview plot of the river cross-section with bridge overlay

### 3.2 Zone 1: River Cross-Section (rows 3–25)

Table with up to 50 data points:

| Column | Description |
|--------|-------------|
| Point # | Auto-numbered row index |
| Station (ft) | Horizontal distance from left reference |
| Elevation (ft) | Vertical elevation at station |
| Manning's n | Roughness coefficient (can vary per subsection) |
| Bank Station? | Marker for left/right bank station (dropdown: Left Bank, Right Bank, —) |

Bank stations define the channel vs. overbank boundaries. Manning's n values between bank stations apply to the channel; outside applies to overbanks.

### 3.3 Zone 2: Bridge Geometry (rows 28–55)

**Opening Geometry:**

| Field | Description |
|-------|-------------|
| Low Chord Elevation (Left) | Bottom of bridge deck at left abutment (ft) |
| Low Chord Elevation (Right) | Bottom of bridge deck at right abutment (ft) |
| High Chord Elevation | Top of bridge deck / roadway surface (ft) |
| Left Abutment Station | Horizontal station of left abutment face (ft) |
| Right Abutment Station | Horizontal station of right abutment face (ft) |
| Left Abutment Slope | Abutment slope in H:V ratio |
| Right Abutment Slope | Abutment slope in H:V ratio |
| Skew Angle | Bridge crossing angle relative to flow direction (degrees, 0 = perpendicular) |

**Pier Data Table** (up to 10 piers):

| Column | Description |
|--------|-------------|
| Pier # | Index |
| Station (ft) | Centerline station of pier |
| Width (ft) | Pier width perpendicular to flow |
| Shape | Dropdown: Square, Round-nose, Cylindrical, Sharp |

Pier shape selection auto-populates the Yarnell K coefficient (can be overridden in Zone 4).

**Low Chord Profile** (optional, for variable low chord):

A station/elevation table defining the low chord shape across the bridge opening. If left blank, the tool linearly interpolates between the left and right low chord elevations.

### 3.4 Zone 3: Flow Profiles (rows 58–72)

Up to 10 flow profiles:

| Column | Description |
|--------|-------------|
| Profile Name | User label (e.g., "10-yr", "100-yr") |
| Q (cfs) | Discharge |
| DS WSEL (ft) | Known downstream water surface elevation |
| Channel Slope (ft/ft) | Energy grade line slope for friction loss estimates |
| Contraction Reach Length (ft) | Distance from downstream face to downstream section (default: bridge opening width) |
| Expansion Reach Length (ft) | Distance from upstream face to upstream section (default: bridge opening width) |

### 3.5 Zone 4: Coefficients & Settings (rows 75–90)

**Energy Method:**
- Contraction Coefficient (Cc) — default 0.3
- Expansion Coefficient (Ce) — default 0.5

**Yarnell Method:**
- Pier Shape Coefficient (K) — auto-populated from pier shape, with manual override option

**Iteration Settings:**
- Max Iterations — default 100
- Convergence Tolerance — default 0.01 ft
- Initial US WSEL Guess — default DS WSEL + 0.5 ft

**Methods to Run:**
- Checkboxes for each method: Energy, Momentum, Yarnell, WSPRO

---

## 4. Calculation Method Sheets

All four method sheets share a common layout template.

### 4.1 Common Layout

| Row Block | Content |
|-----------|---------|
| **Header** (rows 1–5) | Method name, governing equation (text form), reference citation |
| **Input Echo** (rows 7–20) | Key values cell-referenced from Input sheet: cross-section area, wetted perimeter, hydraulic radius, bridge opening area, pier blockage area, Q |
| **Calculations** (rows 22–60+) | One column block per flow profile, labeled step-by-step |
| **Iteration Log** (rows 62–75) | Iteration #, trial WSEL, computed WSEL, error, convergence status |
| **Results** (rows 77–85) | Upstream WSEL, total head loss, approach velocity, bridge velocity, Froude numbers, flow regime |
| **TUFLOW FLC** (rows 87–90) | Back-calculated equivalent form loss coefficients: Pier FLC and Superstructure FLC per profile |

### 4.2 Hydraulic Property Computations (shared across methods)

All methods require these geometric/hydraulic properties computed from the cross-section and water surface elevation:

- **Flow area (A)** — trapezoidal integration of cross-section below WSEL
- **Wetted perimeter (P)** — sum of segment lengths below WSEL
- **Hydraulic radius (R)** — A / P
- **Top width (T)** — water surface width
- **Velocity (V)** — Q / A
- **Velocity head** — α × V² / 2g (α = velocity distribution coefficient, default 1.0, adjustable)
- **Bridge opening area** — net area below low chord minus pier blockage, accounting for abutment slopes and skew
- **Conveyance (K)** — (1.486/n) × A × R^(2/3) per subsection, summed

These are computed by shared VBA functions called by all method sheets.

### 4.3 Flow Regime Detection

For each profile, the tool determines the flow condition:

| Regime | Condition | Calculation Path |
|--------|-----------|-----------------|
| **Free Surface (F)** | WSEL < Low Chord | Standard open-channel bridge loss equations |
| **Pressure Flow (P)** | Low Chord < WSEL < High Chord | Orifice-type flow equations (sluice gate analogy) |
| **Overtopping (O)** | WSEL > High Chord | Weir flow over deck + pressure/orifice flow through opening |

Each method sheet switches calculation logic based on detected regime.

### 4.4 Energy Method

**Reference:** HEC-RAS Hydraulic Reference Manual, Chapter 5

**Approach:** Standard step method computing energy balance between four cross-sections:
1. Section 1 (downstream) — same cross-section geometry, offset by expansion reach length
2. Section BD (bridge downstream face) — cross-section clipped to bridge opening
3. Section BU (bridge upstream face) — cross-section clipped to bridge opening
4. Section 3 (upstream / approach) — same cross-section geometry, offset by contraction reach length

Note: The tool uses the single input cross-section at all four locations (simplified approach consistent with hand-calculation practice). Reach lengths from Zone 3 define the spacing for friction loss computation.

**Steps per profile:**
1. Compute hydraulic properties at downstream section using DS WSEL
2. Estimate friction losses (Manning's equation) between sections
3. Compute contraction loss: h_c = Cc × |Δ(αV²/2g)|
4. Compute expansion loss: h_e = Ce × |Δ(αV²/2g)|
5. Iterate on upstream WSEL until energy balance converges:
   - WS_us = WS_ds + h_f + h_c + h_e
   - Where h_f = friction loss = L × (S_f1 + S_f2) / 2

### 4.5 Momentum Method

**Reference:** HEC-RAS Hydraulic Reference Manual, Chapter 5

**Approach:** Momentum balance across the bridge opening, accounting for pressure forces, weight component, friction, and drag.

**Steps per profile:**
1. Compute hydrostatic pressure forces upstream and downstream of bridge
2. Compute momentum flux (ρQV) at upstream and downstream faces
3. Account for weight component along channel slope
4. Account for friction force on bed and walls
5. Account for pier/abutment drag forces
6. Iterate on upstream WSEL until momentum equation balances:
   - ΣF = ΔM (net force = change in momentum flux)

### 4.6 Yarnell Method

**Reference:** Yarnell, D.L. (1934), "Bridge Piers as Channel Obstructions"

**Governing Equation:**
```
Δy = K × (K + 5 - 0.6) × (α + 15α⁴) × (V²/2g)
```
Where:
- Δy = backwater rise due to bridge piers
- K = pier shape coefficient (Square: 1.25, Round-nose: 0.9, Cylindrical: 1.0, Sharp: 0.7)
- α = ratio of pier obstruction area to total flow area
- V = downstream velocity

**Steps per profile:**
1. Compute downstream hydraulic properties
2. Calculate pier obstruction ratio (α)
3. Look up or use K from pier shape
4. Apply Yarnell equation for Δy
5. US WSEL = DS WSEL + Δy

Note: Yarnell is a direct (non-iterative) calculation for free-surface flow. For pressure/overtopping conditions, the method flags as "Not Applicable."

### 4.7 WSPRO Method

**Reference:** FHWA Report FHWA-IP-87-7, "Bridge Waterways Analysis Model"

**Approach:** Uses bridge opening ratio, eccentricity, and Froude number corrections.

**Steps per profile:**
1. Compute bridge opening ratio M = K_q / K_total (conveyance ratio)
2. Compute eccentricity factor based on flow distribution
3. Look up base coefficient C_b from M
4. Apply Froude number correction factor
5. Apply eccentricity correction factor
6. Compute backwater: Δh = C × α₁ × (V₁²/2g)
7. US WSEL = DS WSEL + Δh

---

## 5. Summary & Charts Sheet

### 5.1 Comparison Tables

**Upstream WSEL Table** — method (rows) × profile (columns):
- One row per calculation method (Energy, Momentum, Yarnell, WSPRO)
- Gold-highlighted HEC-RAS row for manual entry of HEC-RAS results
- Auto-calculated % difference row below HEC-RAS, computed on head loss (Δh), not WSEL (since small absolute WSEL differences are meaningful)
- Conditional formatting on % difference: green (<5%), yellow (5–10%), red (>10%)
- Absolute difference row also shown (ft) for direct comparison

**Head Loss Table** — same matrix format for Δh values

**TUFLOW Form Loss Coefficients Table** — method (rows) × profile (columns):
- Back-calculated equivalent form loss coefficients for TUFLOW input
- **Pier FLC:** FLC_pier = h_pier / (V²/2g), where h_pier is the pier-attributable head loss and V is the approach velocity
- **Superstructure FLC:** FLC_super = h_super / (V²/2g), computed when pressure flow or overtopping is detected (superstructure engaged)
- For free-surface flow with no superstructure contact, Superstructure FLC shows "N/A"
- Each method produces its own FLC values; the table shows all methods side-by-side
- Gold HEC-RAS row for manual entry of HEC-RAS equivalent FLC for comparison

**Additional Tables:**
- Velocity comparison (approach velocity per method × profile)
- Froude number comparison
- Bridge opening ratio

### 5.2 Flow Regime Matrix

Method × profile matrix showing regime codes:
- F = Free surface
- P = Pressure flow
- O = Overtopping
- Mismatches between methods or vs. HEC-RAS highlighted in red

### 5.3 Auto-Generated Charts

**Chart 1: Cross-Section Profile with Water Surfaces**
- River cross-section (ground line from station/elevation data)
- Bridge deck (low chord and high chord)
- Piers (rectangles at pier stations)
- Color-coded horizontal water surface lines per method for selected profile
- Profile selector dropdown to switch between flow events

**Chart 2: Head Loss Comparison Bar Chart**
- Grouped bars: one group per flow profile
- One bar color per method
- HEC-RAS value shown as a horizontal marker line per group

**Chart 3: Upstream WSEL Comparison**
- Line chart: x-axis = discharge, y-axis = US WSEL
- One line per method + HEC-RAS

All charts generated via VBA using Excel's native chart objects. "Generate Charts" button refreshes all charts.

---

## 6. VBA Architecture

### 6.1 Module Structure

| Module | Responsibility |
|--------|---------------|
| **mod_Main** | Button handlers, orchestration (Run All, Clear, etc.) |
| **mod_Geometry** | Cross-section area, wetted perimeter, hydraulic radius, top width, conveyance calculations |
| **mod_BridgeGeometry** | Bridge opening area, pier blockage, net area, skew correction |
| **mod_Hydraulics** | Friction slope, Manning's equation, velocity head, Froude number |
| **mod_Iteration** | Bisection/secant iteration engine with convergence tracking |
| **mod_Energy** | Energy method calculation logic |
| **mod_Momentum** | Momentum method calculation logic |
| **mod_Yarnell** | Yarnell method calculation logic |
| **mod_WSPRO** | WSPRO method calculation logic |
| **mod_Charts** | Chart creation and refresh logic |
| **mod_Utilities** | Input validation, error handling, sheet formatting helpers |

### 6.2 Shared Functions

Core hydraulic property functions used by all methods:

```
CalcFlowArea(crossSection, wsel) → Double
CalcWettedPerimeter(crossSection, wsel) → Double
CalcHydraulicRadius(crossSection, wsel) → Double
CalcTopWidth(crossSection, wsel) → Double
CalcConveyance(crossSection, wsel, manningsN) → Double
CalcBridgeOpeningArea(bridgeGeom, wsel) → Double
CalcPierBlockage(piers, wsel) → Double
DetectFlowRegime(wsel, lowChord, highChord) → String
CalcTuflowPierFLC(pierHeadLoss, approachVelocity) → Double
CalcTuflowSuperFLC(superHeadLoss, approachVelocity) → Double
```

### 6.3 Iteration Engine

Uses bisection method with secant method acceleration:
1. Establish bounds: lower = DS WSEL, upper = DS WSEL + 10 ft
2. Bisect to narrow range
3. Switch to secant method once within 0.5 ft
4. Converge to tolerance (default 0.01 ft)
5. Log each iteration step to the method sheet's iteration log block
6. Flag if max iterations reached without convergence

### 6.4 Error Handling

- Input validation before running (missing data, negative values, inconsistent geometry)
- Each method catches division-by-zero, negative area, supercritical flow conditions
- Errors written to the method sheet's results block with descriptive messages
- Summary sheet marks errored cells with "ERR" and red fill

---

## 7. User Workflow

1. Open workbook, read Instructions sheet
2. Enter river cross-section data in Zone 1
3. Enter bridge geometry in Zone 2
4. Enter flow profiles in Zone 3
5. Review/adjust coefficients in Zone 4
6. Click **Plot Cross-Section** to visually verify geometry
7. Click **Run All Methods**
8. Review each method sheet for step-by-step calculations
9. Enter HEC-RAS results in the gold row on the Summary sheet
10. Click **Generate Charts**
11. Review comparison tables and charts for discrepancies
12. Print/PDF the Summary sheet and any method sheets needed for documentation

---

## 8. Assumptions and Limitations

- **Steady-state flow only** — no unsteady/hydrograph routing
- **1D calculations** — no 2D flow distribution effects
- **Subcritical flow assumed** — supercritical conditions flagged but not fully solved
- **No roadway overtopping weir geometry** — uses simplified rectangular weir for overtopping
- **Single bridge opening** — no multiple-opening or relief bridge support
- **No ice or debris loading** — clean opening assumed
- **English units only** — ft, cfs, ft/ft (metric conversion not in scope)
- **Up to 50 cross-section points, 10 piers, 10 flow profiles** — practical limits for Excel performance
