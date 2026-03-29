# State Management

This directory contains the application's centralized state store, built with [Zustand](https://github.com/pmndrs/zustand).

## File

### project-store.ts

A single Zustand store (`useProjectStore`) that holds all application state. There is no Redux, no context providers, and no prop drilling for shared state -- components read slices directly via selector hooks.

## Store Structure

### State Slices

| Slice | Type | Purpose |
|-------|------|---------|
| `crossSection` | `CrossSectionPoint[]` | Station/elevation/Manning's n data points defining the channel. |
| `bridgeGeometry` | `BridgeGeometry` | Bridge opening dimensions, abutment locations, piers, skew, pressure/overtopping parameters, and optional low chord profile. |
| `flowProfiles` | `FlowProfile[]` | Up to 10 discharge scenarios with name, ARI, Q, DS WSEL, and channel slope. |
| `coefficients` | `Coefficients` | Contraction/expansion coefficients, Yarnell K, solver settings, debris blockage, sensitivity config, method toggles, and freeboard threshold. |
| `results` | `CalculationResults \| null` | Output from `runAllMethods()`. Contains arrays of `MethodResult` for energy, momentum, yarnell, and wspro. |
| `sensitivityResults` | `SensitivityResults \| null` | Output from `runWithSensitivity()` when Manning's n sensitivity is enabled. |
| `hecRasComparison` | `HecRasComparison[]` | User-entered HEC-RAS reference values for QA/QC comparison. |
| `unitSystem` | `'imperial' \| 'metric'` | Display unit system. Engine always works in imperial internally. |
| `projectName` | `string` | User-defined project name for reports and exports. |
| `activeMainTab` | `string` | Currently active top-level tab (data, hydrology, analysis, assessment, simulation, report). |
| `activeSubTab` | `Record<string, string>` | Currently active sub-tab for each main tab. |
| `aiSummary` | `AiSummaryResponse \| null` | AI-generated analysis summary. |
| `aiSummaryLoading` | `boolean` | Loading state for AI summary fetch. |
| `aiSummaryError` | `string \| null` | Error message from AI summary fetch. |
| `scenarios` | `Scenario[]` | Saved analysis scenarios for comparison. |
| `hydrology` | `HydrologyState` | Hydrology data: location, catchment area, stream length, slope, IFD data, Tc method/value, runoff coefficient, and calculated discharges. |
| `scourInputs` | `ScourInputs` | Scour calculation parameters: bed material, D50, D95, upstream bed elevation, countermeasure type. |
| `scourResults` | `ScourResults[] \| null` | Per-profile pier and contraction scour results. |
| `adequacyResults` | `AdequacyResults \| null` | Bridge adequacy verdict, per-profile status, critical Q thresholds. |
| `regulatoryJurisdiction` | `Jurisdiction` | Selected regulatory jurisdiction (tmr, vicroads, dpie, arr). |
| `regulatoryChecklist` | `ChecklistItem[]` | Current state of all checklist items, including verification type (`auto`, `manual`, `external`) and whether the item aligns with the automatic hydraulic verdict. |
| `narrativeSections` | `NarrativeSection[]` | AI-generated narrative report sections with content and edit status. |
| `narrativeTone` | `'technical' \| 'summary'` | Selected narrative tone for AI generation. |
| `snapshots` | `ProjectSnapshot[]` | Saved project snapshots for history comparison. |
| `bridges` | `BridgeProject[]` | Multi-bridge data for reach analysis mode. |
| `activeBridgeIndex` | `number` | Index of the currently selected bridge in reach mode. |
| `reachMode` | `boolean` | Whether multi-bridge reach analysis is active. |
| `reachResults` | `ReachResults \| null` | Results from reach analysis. |

### Key Actions

**Input updates:**
- `updateCrossSection(points)` -- replaces cross-section data.
- `updateBridgeGeometry(geom)` -- replaces bridge geometry.
- `updateFlowProfiles(profiles)` -- replaces flow profiles.
- `updateCoefficients(coeffs)` -- replaces coefficients.

**Results:**
- `setResults(results)` -- stores calculation results.
- `clearResults()` -- clears results, AI summary, and loading state.
- `setSensitivityResults(results)` -- stores or clears sensitivity results.

**HEC-RAS comparison:**
- `updateHecRasComparison(data)` -- updates comparison values. Includes a debounced auto-fetch of the AI summary when all profiles have both WSEL and head loss values filled.

**AI:**
- `fetchAiSummary()` -- async action that posts project data to `/api/ai-summary` and stores the response. Handles loading and error states.
- `clearAiSummary()` -- clears summary state.

**Scenarios:**
- `saveScenario(name)` -- snapshots current inputs + results.
- `deleteScenario(index)` -- removes a saved scenario.

**Persistence:**
- `exportProject()` -- serializes full state to JSON string via `serializeProject()`.
- `importProject(json)` -- parses JSON and replaces all state via `parseProjectJson()`.

**Hydrology:**
- `updateHydrology(partial)` -- merges partial updates into hydrology state.

**Scour:**
- `updateScourInputs(partial)` -- merges partial updates.
- `setScourResults(results)` -- stores scour results.

**Assessment:**
- `setAdequacyResults(results)` -- stores adequacy results (usually set automatically by `AdequacyPanel` via `useEffect`).
- `setJurisdiction(j)` -- changes the regulatory jurisdiction.
- `setRegulatoryChecklist(items)` -- replaces the evaluated checklist state so report export and snapshots stay aligned with the UI.
- `updateChecklistItem(id, status)` -- updates a single manual or external checklist item's status.

**Narrative:**
- `updateNarrativeSection(id, updates)` -- updates a narrative section's content and status.
- `setNarrativeTone(tone)` -- switches between technical and summary.

**Snapshots:**
- `saveSnapshot(name, note?)` -- captures full serialized state with timestamp and summary.
- `restoreSnapshot(id)` -- replaces all state from a snapshot.
- `deleteSnapshot(id)` -- removes a snapshot.

**Reach mode:**
- `addBridge(name, chainage)` -- creates a new bridge with empty data.
- `removeBridge(id)` -- deletes a bridge.
- `updateBridge(id, updates)` -- patches a bridge's data.
- `setActiveBridgeIndex(index)` -- switches the active bridge.
- `setReachMode(enabled)` -- toggles reach mode.
- `setReachResults(results)` -- stores reach analysis results.

## How State Flows Between Components

1. **Input forms** write to the store via update actions.
2. **ActionButtons** reads from the store, runs the engine, and writes results back.
3. **Results/Summary/Assessment** components read from the store reactively (Zustand re-renders only when the selected slice changes).
4. **AI components** trigger async fetches that update AI-specific slices.
5. **Export/Import** serializes/deserializes the entire store.

## Snapshot and Persistence Strategy

- **Project export/import:** Full state serialization to/from JSON. Handled by `@/lib/json-io`.
- **Snapshots:** Stored in the Zustand state as `ProjectSnapshot[]`. The `HistoryPanel` additionally persists snapshots to `localStorage` under `'project-snapshots'`. Maximum 20 snapshots enforced.
- **No automatic persistence:** The store does not auto-save to localStorage on every change. Persistence is explicit (snapshot save or project export).

## Multi-Bridge State Model

When reach mode is enabled:
- The `bridges` array holds independent `BridgeProject` objects, each with its own cross-section, geometry, and coefficients.
- `activeBridgeIndex` determines which bridge's data is shown in the editing forms.
- The main `crossSection` and `bridgeGeometry` slices serve as the "working copy" for the active bridge.
- Switching bridges syncs data between the working copy and the bridge array.
- Reach analysis processes all bridges in sequence by chainage order.
