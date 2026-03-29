# Assessment Components

This directory contains components for evaluating whether a bridge is hydraulically adequate and whether the analysis meets regulatory requirements. These appear under the **Assessment** tab.

## Components

### AdequacyPanel

**File:** `adequacy-panel.tsx`

The primary adequacy assessment view. Computes and displays a comprehensive verdict on bridge performance using the `computeAdequacy()` engine function.

**Verdict Badge:**
A color-coded card at the top with one of three severity levels:
- **pass** (green) -- bridge clears all profiles with adequate freeboard.
- **warning** (amber) -- marginal conditions detected.
- **fail** (red) -- pressure flow, overtopping, or insufficient freeboard.

**Critical Q Threshold Callouts:**
Three metric cards showing the interpolated discharge at which key transitions occur:
- **Zero Freeboard Q** -- discharge where WSEL equals the low chord minus the freeboard threshold.
- **Pressure Onset Q** -- discharge where WSEL first exceeds the low chord, initiating pressure flow.
- **Overtopping Onset Q** -- discharge where WSEL exceeds the high chord.

These values are null if the transition does not occur within the analyzed flow range.

**Rating Curve Chart:**
A D3-rendered chart plotting worst-case upstream WSEL (across all enabled methods) versus discharge. Features include:
- Regime zone shading: green (free-surface, below low chord), amber (pressure, between low and high chord), red (overtopping, above high chord).
- Horizontal reference lines for low chord and high chord elevations.
- Vertical dashed lines at each critical Q threshold.
- Data points colored by status (clear/low/pressure/overtopping).
- WSEL envelope line connecting the data points.
- Responsive: uses `ResizeObserver` to redraw on container resize.

**Freeboard and Regime Summary Table:**
A table with one row per flow profile showing: profile name, ARI, discharge, worst-case WSEL, freeboard, regime classification (Free Surface / Pressure / Overtopping), and a status badge (CLEAR / LOW / PRESSURE / OVERTOPPING).

**Additional panels:**
- `AiSummaryBanner` -- AI-generated analysis overview (shows loading state, error state, or rendered summary).
- `MethodSuitability` -- per-method suitability flags based on flow conditions.

### RegulatoryChecklist

**File:** `regulatory-checklist.tsx`

A jurisdiction-specific compliance checklist that combines automatic evaluation with manual engineer verification.

**Jurisdiction Selector:**
Dropdown with four Australian jurisdictions:
- TMR (Queensland)
- VicRoads (Victoria)
- DPIE (NSW)
- ARR General

Changing the jurisdiction loads a different set of checklist items from `@/config/regulatory-checklists.ts`.

**Checklist Items:**
Each item is either:
- **Auto-check** -- evaluated programmatically from project state. Shows a pass/fail icon and an "auto" label. The evaluator function receives a `ProjectStateForChecklist` snapshot containing freeboard results, sensitivity run status, debris percentage, scour existence, QA/QC comparison existence, regime classifications, and velocity-depth products.
- **Manual** -- requires the engineer to check a checkbox. Shows "not-assessed" until toggled.

**Progress Tracking:**
A progress bar at the top shows "X of Y requirements met" with percentage. Color transitions from red (<50%) through amber to green (100%).

The checklist items are stored in the Zustand store and persist with project snapshots.
