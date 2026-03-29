# Configuration

This directory contains application configuration that is data-driven rather than code-driven. The main configuration here is the jurisdiction checklist model used by the Assessment tab.

## Files

### `regulatory-checklists.ts`

Defines compliance checklist requirements for four Australian jurisdiction packs:

- `tmr`
- `vicroads`
- `dpie`
- `arr`

Each checklist item now carries two important dimensions:

- `verificationType`
  - `auto`: the app can evaluate it from current state
  - `manual`: the engineer confirms it inside the app
  - `external`: it must be confirmed from external project evidence
- `affectsAdequacyVerdict`
  - `true`: this aligns with the automatic hydraulic verdict
  - `false`: this is supporting compliance workflow only

That split is intentional. The app should be explicit about which criteria it can truly verify and which ones still depend on engineering judgement or external records.

## Project State for Evaluators

Auto checks receive a small snapshot of project state:

```typescript
interface ProjectStateForChecklist {
  freeboardResults: { freeboard: number; status: string }[] | null;
  sensitivityRun: boolean;
  debrisBlockagePct: number;
  scourResultsExist: boolean;
  qaqcComparisonExists: boolean;
  regimeClassifications: string[];
  freeboardThreshold: number;
}
```

Evaluator functions should return only:

- `'pass'`
- `'fail'`
- `'not-assessed'`

Manual and external items do not use evaluators.

## Current Design Rules

- Only criteria the app can defend computationally should be `auto`.
- Only criteria that directly align with the hydraulic adequacy verdict should set `affectsAdequacyVerdict: true`.
- Criteria that depend on survey packages, adopted flood studies, model acceptance, calibration, or approval records should be `external`.
- Criteria that depend on an engineer completing a review step inside the app should be `manual`.
- Weak or misleading "pretend-auto" checks should be removed rather than automated badly.

## How to Add a New Jurisdiction

1. Add the new `Jurisdiction` member in `@flowsuite/engine/types.ts`.
2. Create a new checklist array in `regulatory-checklists.ts`.
3. Classify every item with `verificationType` and `affectsAdequacyVerdict`.
4. Add evaluator functions only for genuinely app-verifiable checks.
5. Add the jurisdiction label in `components/assessment/regulatory-checklist.tsx`.

The UI will automatically group the items into:

- automatic verdict inputs
- supporting app checks
- engineer confirmation
- external evidence
