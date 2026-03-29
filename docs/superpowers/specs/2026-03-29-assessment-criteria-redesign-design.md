# Assessment Criteria Redesign - Design Spec

**Date:** 2026-03-29
**Goal:** Separate automatic hydraulic verdict logic from manual and external-evidence compliance checks so the app is explicit about what it can and cannot verify.
**Audience:** Product owner, hydraulic engineers, and future contributors touching adequacy or compliance workflows.

---

## Problem

1. The checklist previously mixed app-verifiable criteria with engineer-confirmed and externally sourced criteria in one flat pass/fail list.
2. That made the app look more authoritative than it should for criteria such as survey verification, tailwater confirmation, calibration acceptance, and broader floodplain impact review.
3. Some weak heuristic checks were being treated like auto-verifiable criteria even though the current implementation was not strong enough to defend them.

## Design Principles

- The app should only auto-verify criteria it can defend from current state.
- The automatic adequacy verdict should stay separate from broader compliance workflow.
- Manual and external-evidence items should remain visible, but never be presented as if the app verified them itself.

## Proposed Design

### User experience

- The adequacy panel remains the home of the automatic hydraulic verdict.
- The regulatory checklist is split into four groups:
  - automatic verdict inputs
  - supporting app checks
  - engineer confirmation
  - external evidence
- User-facing copy makes it clear that manual and external checks do not change the automatic adequacy verdict.

### Technical approach

- Extend `ChecklistItem` with:
  - `verificationType`
  - `affectsAdequacyVerdict`
- Replace the old `autoCheck` boolean with an explicit verification model.
- Rework jurisdiction checklist definitions so:
  - only defensible auto checks retain evaluators
  - manual and external items no longer masquerade as app-verifiable
  - weak automatic criteria are removed
- Synchronize evaluated checklist state back into the store so exports and reports stay aligned with the UI.

## File Map

### New files
| File | Responsibility |
|------|----------------|
| [docs/superpowers/specs/2026-03-29-assessment-criteria-redesign-design.md](c:\Users\Joshr\Desktop\Projects\Personal\Kyle'sWeirdRequests\TheTools\docs\superpowers\specs\2026-03-29-assessment-criteria-redesign-design.md) | Documents the criteria split and rationale |
| [apps/web/src/__tests__/config/regulatory-checklists.test.ts](c:\Users\Joshr\Desktop\Projects\Personal\Kyle'sWeirdRequests\TheTools\apps\web\src\__tests__\config\regulatory-checklists.test.ts) | Focused tests for the new checklist model |

### Modified files
| File | Change |
|------|--------|
| [packages/engine/src/types.ts](c:\Users\Joshr\Desktop\Projects\Personal\Kyle'sWeirdRequests\TheTools\packages\engine\src\types.ts) | Adds explicit checklist verification metadata |
| [apps/web/src/store/project-store.ts](c:\Users\Joshr\Desktop\Projects\Personal\Kyle'sWeirdRequests\TheTools\apps\web\src\store\project-store.ts) | Adds checklist replacement action for UI/report synchronization |
| [apps/web/src/config/regulatory-checklists.ts](c:\Users\Joshr\Desktop\Projects\Personal\Kyle'sWeirdRequests\TheTools\apps\web\src\config\regulatory-checklists.ts) | Rebuilds checklist definitions around auto/manual/external evidence |
| [apps/web/src/components/assessment/regulatory-checklist.tsx](c:\Users\Joshr\Desktop\Projects\Personal\Kyle'sWeirdRequests\TheTools\apps\web\src\components\assessment\regulatory-checklist.tsx) | Groups and presents criteria honestly in the UI |
| [apps/web/src/components/pdf-report.tsx](c:\Users\Joshr\Desktop\Projects\Personal\Kyle'sWeirdRequests\TheTools\apps\web\src\components\pdf-report.tsx) | Updates compliance export to reflect the new checklist model |
| [apps/web/src/config/README.md](c:\Users\Joshr\Desktop\Projects\Personal\Kyle'sWeirdRequests\TheTools\apps\web\src\config\README.md) | Documents the new checklist configuration rules |
| [apps/web/src/store/README.md](c:\Users\Joshr\Desktop\Projects\Personal\Kyle'sWeirdRequests\TheTools\apps\web\src\store\README.md) | Documents the new checklist state behavior |
| [apps/web/src/components/assessment/README.md](c:\Users\Joshr\Desktop\Projects\Personal\Kyle'sWeirdRequests\TheTools\apps\web\src\components\assessment\README.md) | Documents the assessment workflow split |

## Scope Boundaries

- In scope:
  - honesty and structure of criteria classification
  - UI/report clarity
  - removal of weak automatic criteria
- Out of scope:
  - rewriting the adequacy engine
  - updating all jurisdiction logic to authority-grade standards
  - renaming the internal `dpie` key for backwards compatibility

## Validation

- Check that manual and external items never require auto evaluators.
- Check that non-auto items never affect the automatic adequacy verdict.
- Check that report export sees the same evaluated checklist state as the UI.
