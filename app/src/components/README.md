# Components Overview

This directory contains all React components for the Bridge Loss Calculator application. Components are organized by **feature domain** rather than by technical layer. Each subdirectory corresponds to a distinct area of the application's workflow, from data entry through analysis to reporting.

## Organizational Principle

A hydraulic bridge analysis follows a natural sequence: gather data, run calculations, review results, assess adequacy, and generate reports. The component directories mirror that workflow. Shared UI primitives live in `ui/`, but everything else is grouped by what it does for the engineer, not by whether it is a form, a chart, or a table.

## Directory Map

| Directory | Purpose |
|-----------|---------|
| `input/` | Data entry forms for cross-section geometry, bridge dimensions, flow profiles, coefficients, and the run/clear/load-test actions. |
| `analysis/` | Post-calculation analysis: scour estimation (HEC-18), scour diagrams, QA/QC comparison against HEC-RAS, and one-page QA memo PDF generation. |
| `assessment/` | Bridge adequacy assessment with verdict badges, rating curves, freeboard tables, and jurisdiction-specific regulatory compliance checklists. |
| `hydrology/` | Australian Rainfall and Runoff (ARR) IFD lookup, catchment Tc calculators, rational method discharge estimation, and the Leaflet map for site location. |
| `simulation/` | 3D hydraulic visualization (Three.js/R3F), energy grade line diagrams (D3), What-If parameter exploration, debris guidance, and the parameter optimizer. |
| `simulation/scene-3d/` | Three.js scene components: terrain, water with custom shaders, bridge mesh with PBR materials, grass, spray particles, and procedural texture generation. |
| `results/` | Per-method result display: tabbed method views with LaTeX equations, profile accordions, step-by-step calculation breakdowns, iteration logs, and convergence charts. |
| `summary/` | Cross-method comparison: regime matrices, side-by-side tables, afflux-vs-discharge D3 charts, freeboard checks, AI-generated summaries, method suitability flags, and saved scenario comparisons. |
| `report/` | Report generation: AI narrative editor with tone selection, PDF/CSV/JSON export with section toggles, and snapshot history with save/restore/compare/diff. |
| `data/` | Data management: unified file import (CSV with column mapping, HEC-RAS, JSON project files) with drag-and-drop, and the reach manager for multi-bridge analysis. |
| `ai-chat/` | Conversational AI assistant panel for interactive hydraulic Q&A. |
| `import/` | HEC-RAS file drop zone and import dialog used on the Data tab header. |
| `what-if/` | What-If slider controls for real-time parameter sensitivity (Manning's n, debris, coefficients, discharge multipliers). |
| `ui/` | Shared UI primitives (buttons, cards, inputs, dialogs, tables, numeric inputs, math rendering). Not domain-specific. |

## Top-Level Components

| File | Purpose |
|------|---------|
| `main-tabs.tsx` | Root layout component. Manages the primary tab navigation (Data, Hydrology, Analysis, Assessment, Simulation, Report) and all sub-tab routing. Contains the simulation logic that was previously in `SimulationTab`, now inlined here. |
| `cross-section-chart.tsx` | Reusable SVG cross-section chart with optional bridge overlay, water surface lines, pier rendering, method WSEL comparison, and hazard overlay. Used by both the input preview and the bridge overlay card. |
| `hazard-overlay.tsx` | Hazard classification overlay for the cross-section chart, showing velocity-depth product zones. |
| `pdf-report.tsx` | Full PDF report generator using `@react-pdf/renderer`. Assembles all report sections into a downloadable A4 document. |
| `pdf-charts.tsx` | Static chart rendering helpers for PDF output (positioned containers instead of margin hacks). |
| `top-bar.tsx` | Application header with project name, unit system toggle, and file import/export controls. |
