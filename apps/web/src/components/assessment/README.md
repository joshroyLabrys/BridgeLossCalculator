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

A jurisdiction-specific compliance checklist that is explicit about what the app can verify and what it cannot.

**Jurisdiction Selector:**
Dropdown with four Australian jurisdiction packs:
- TMR (Queensland)
- VicRoads (Victoria)
- DPIE (NSW)
- ARR General

Changing the jurisdiction loads a different checklist definition set from `@/config/regulatory-checklists.ts`.

**Checklist Groups:**
The UI separates items into four groups:

- **Automatic Verdict Inputs** -- app-verifiable hydraulic checks that align with the automatic adequacy verdict.
- **Supporting App Checks** -- app-verifiable workflow checks that support compliance but do not change the hydraulic verdict.
- **Engineer Confirmation** -- checks confirmed inside the app after review.
- **External Evidence** -- checks confirmed from survey, adopted flood models, approvals, or other project records.

**Why this split exists:**
The adequacy verdict should only rely on criteria the app can actually defend computationally. Manual and external-evidence items stay visible in the compliance workflow, but they are not presented as if the app had verified them automatically.

**Persistence:**
The evaluated checklist state is synchronized back into the Zustand store so exports, snapshots, and report generation use the same checklist state the user sees in the UI.
