# Configuration

This directory contains application configuration that is data-driven rather than code-driven. Currently it houses the regulatory checklist definitions.

## Files

### regulatory-checklists.ts

Defines compliance checklist requirements for four Australian jurisdictions. Each jurisdiction has a list of `ChecklistDefinition` objects that the `RegulatoryChecklist` component evaluates against the current project state.

## Jurisdictions

### TMR (Queensland) -- `TMR_CHECKLIST`

9 items, 7 auto-checked:
- Freeboard >= 300mm at 1% AEP.
- No pressure flow at design AEP.
- Velocity x depth product <= 1.2 m2/s.
- Manning's n sensitivity +/-20% assessed.
- Debris blockage considered (ARR guidelines).
- Scour assessment completed.
- Independent QA/QC check completed.
- Survey data verified (manual).
- Tailwater conditions confirmed (manual).

### VicRoads (Victoria) -- `VICROADS_CHECKLIST`

6 items, 4 auto-checked:
- Adequate freeboard at design AEP (freeboard > 0).
- Manning's n sensitivity assessed.
- Debris blockage assessed.
- Scour assessment completed.
- Survey data verified (manual).
- Model calibration verified (manual).

### DPIE (NSW) -- `DPIE_CHECKLIST`

5 items, 3 auto-checked:
- Freeboard meets floodplain management requirements (>= 500mm).
- Sensitivity analysis completed.
- Debris assessment per ARR.
- Afflux impact on adjacent properties assessed (manual).
- Current survey data used (manual).

### ARR General -- `ARR_CHECKLIST`

4 items, 3 auto-checked:
- Parameter sensitivity assessed (ARR Book 7).
- Debris blockage per ARR guidelines.
- Adequate freeboard provided (all profiles > 0).
- Input data quality documented (manual).

## How Evaluator Functions Work

Each auto-checked item has an `evaluate` function that receives a `ProjectStateForChecklist` object:

```typescript
interface ProjectStateForChecklist {
  freeboardResults: { freeboard: number; status: string }[] | null;
  sensitivityRun: boolean;
  debrisBlockagePct: number;
  scourResultsExist: boolean;
  qaqcComparisonExists: boolean;
  regimeClassifications: string[];
  velocityDepthProducts: number[];
  freeboardThreshold: number;
}
```

The evaluator returns `'pass'`, `'fail'`, or `'not-assessed'`. The `RegulatoryChecklist` component builds this object from the current store state (results, coefficients, scour, HEC-RAS comparison) and passes it to each evaluator.

Manual items have no evaluator. They show a checkbox that the engineer toggles, and the status persists in the store as `'manual-pass'` or `'not-assessed'`.

## How to Add a New Jurisdiction

1. Define a new `Jurisdiction` union member in `@/engine/types.ts`.
2. Create a new checklist array in this file (e.g., `export const MY_JURISDICTION_CHECKLIST: ChecklistDefinition[] = [...]`).
3. Add a case to the `getChecklistForJurisdiction()` switch statement.
4. Add a label entry in the `JURISDICTION_LABELS` record in `regulatory-checklist.tsx`.
5. For auto-checked items, write an `evaluate` function that inspects `ProjectStateForChecklist` and returns the appropriate status.
6. For manual items, set `autoCheck: false` and omit the `evaluate` function.

The UI will automatically pick up the new jurisdiction in the dropdown and render its items with the appropriate auto/manual behavior.
