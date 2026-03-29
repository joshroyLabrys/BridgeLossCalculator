# Method Results Components

This directory contains components for displaying detailed per-method calculation results. These appear under the **Analysis > Methods** sub-tab.

## How Results Are Displayed

Results follow a hierarchy: **Method > Profile > Details**. The user first selects a method (Energy, Momentum, Yarnell, WSPRO), then expands individual flow profiles to see full breakdowns.

## Components

### MethodTabs

**File:** `method-tabs.tsx`

The top-level tab strip with four color-coded method tabs:
- **Energy** (blue) -- HEC-RAS standard step method. Reference: HEC-RAS Hydraulic Reference Manual, Chapter 5.
- **Momentum** (emerald) -- momentum balance method. Same reference.
- **Yarnell** (amber) -- Yarnell pier loss equation (1934).
- **WSPRO** (purple) -- FHWA bridge waterways analysis model.

Each tab renders a `MethodView` with the method's name, literature reference, governing equation (LaTeX), and results array.

### MethodView

**File:** `method-view.tsx`

Displays a single method's results:
1. **Header card** with method name, reference citation, and the governing equation rendered via KaTeX (`<Math>` component) in a styled container.
2. **ProfileAccordion** with all flow profile results.

Shows a placeholder state ("No results yet") when the results array is empty.

### ProfileAccordion

**File:** `profile-accordion.tsx`

An accordion (multiple items can be open simultaneously) with one item per flow profile.

**Accordion trigger** shows:
- Profile name.
- Convergence badge: "CONVERGED" (primary) or "NOT CONVERGED" (destructive).
- Flow regime badge: "FREE SURFACE" (blue), "PRESSURE" (orange), "OVERTOPPING" (purple).
- Error message if present.
- US WSEL and total head loss (Deltah) values.

**Accordion content** contains:
1. **Input Echo** -- 4 metric cards showing the engine's computed flow area, hydraulic radius, bridge opening area, and pier blockage area. This lets the engineer verify the engine interpreted the geometry correctly.
2. **Key Results** -- metric cards for upstream WSEL, total head loss, approach velocity, bridge velocity, and Froude number.
3. **Calculation Steps** -- step-by-step breakdown (see below).
4. **Iteration Log** -- convergence details (see below).

### CalculationSteps

**File:** `calculation-steps.tsx`

Renders the step-by-step calculation breakdown that the engine records during execution.

Each step shows:
- Step number and description in plain English.
- Intermediate values (e.g., `n_avg = 0.0350`, `P = 45.6`).
- The formula in LaTeX notation via KaTeX.
- The computed result with appropriate unit conversion to the active unit system.

Unit conversion maps internal imperial units (`ft`, `ft/s`, `ft2`, `cfs`) to display units based on the user's selected system.

### IterationLog

**File:** `iteration-log.tsx`

A collapsible section showing the solver's iteration history.

**Header:** "Iteration Log (N iterations)" -- click to expand.

**Content:**
1. **Convergence chart** (see below) -- shown by default with a toggle to hide.
2. **Iteration table** in a scrollable container (max height 200px):
   - Columns: iteration number, trial WSEL, computed WSEL, error.
   - All values displayed in the active unit system.

### ConvergenceChart

**File:** `convergence-chart.tsx`

A D3-rendered chart visualizing how the iterative solver converges to a solution.

**Visual elements:**
- X axis: iteration number.
- Y axis: absolute error (difference between trial and computed WSEL).
- Error line connecting iteration points.
- Points colored green (converged, error below tolerance) or red (still diverged).
- Horizontal tolerance band showing the target convergence threshold.
- Vertical connector lines from each point to the X axis.
- Animated entry (replay button available to re-trigger animation).

The chart uses a muted dark theme consistent with the application's design system.
