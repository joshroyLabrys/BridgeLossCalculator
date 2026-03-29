import type {
  Jurisdiction,
  ChecklistVerificationType,
} from '@flowsuite/engine/types';

type AutoChecklistStatus = 'pass' | 'fail' | 'not-assessed';

export interface ChecklistDefinition {
  id: string;
  requirement: string;
  verificationType: ChecklistVerificationType;
  affectsAdequacyVerdict: boolean;
  evaluate?: (state: ProjectStateForChecklist) => AutoChecklistStatus;
}

export interface ProjectStateForChecklist {
  freeboardResults: { freeboard: number; status: string }[] | null;
  sensitivityRun: boolean;
  debrisBlockagePct: number;
  scourResultsExist: boolean;
  qaqcComparisonExists: boolean;
  regimeClassifications: string[];
  freeboardThreshold: number;
}

function auto(
  id: string,
  requirement: string,
  affectsAdequacyVerdict: boolean,
  evaluate: (state: ProjectStateForChecklist) => AutoChecklistStatus,
): ChecklistDefinition {
  return {
    id,
    requirement,
    verificationType: 'auto',
    affectsAdequacyVerdict,
    evaluate,
  };
}

function manual(
  id: string,
  requirement: string,
  affectsAdequacyVerdict: boolean = false,
): ChecklistDefinition {
  return {
    id,
    requirement,
    verificationType: 'manual',
    affectsAdequacyVerdict,
  };
}

function external(
  id: string,
  requirement: string,
  affectsAdequacyVerdict: boolean = false,
): ChecklistDefinition {
  return {
    id,
    requirement,
    verificationType: 'external',
    affectsAdequacyVerdict,
  };
}

function getDesignProfile<T>(profiles: T[] | null): T | null {
  if (!profiles || profiles.length === 0) return null;
  return profiles[profiles.length - 1] ?? null;
}

export const TMR_CHECKLIST: ChecklistDefinition[] = [
  auto(
    'tmr-freeboard-300mm',
    'Freeboard >= 300 mm at design AEP',
    true,
    (s) => {
      const design = getDesignProfile(s.freeboardResults);
      if (!design) return 'not-assessed';
      return design.freeboard >= 0.984 ? 'pass' : 'fail';
    },
  ),
  auto(
    'tmr-no-pressure',
    'No pressure flow at design AEP',
    true,
    (s) => {
      const last = s.regimeClassifications[s.regimeClassifications.length - 1];
      if (!last) return 'not-assessed';
      return last === 'free-surface' ? 'pass' : 'fail';
    },
  ),
  auto(
    'tmr-mannings-sensitivity',
    "Manning's n sensitivity assessed",
    false,
    (s) => (s.sensitivityRun ? 'pass' : 'fail'),
  ),
  auto(
    'tmr-debris',
    'Debris blockage considered',
    false,
    (s) => (s.debrisBlockagePct > 0 ? 'pass' : 'fail'),
  ),
  auto(
    'tmr-scour',
    'Scour assessment completed',
    false,
    (s) => (s.scourResultsExist ? 'pass' : 'fail'),
  ),
  manual(
    'tmr-qaqc-review',
    'Independent QA/QC review completed',
  ),
  external(
    'tmr-survey',
    'Survey package verified',
  ),
  external(
    'tmr-tailwater',
    'Tailwater and boundary conditions confirmed',
  ),
];

export const VICROADS_CHECKLIST: ChecklistDefinition[] = [
  auto(
    'vic-freeboard',
    'Adequate freeboard at design AEP',
    true,
    (s) => {
      const design = getDesignProfile(s.freeboardResults);
      if (!design) return 'not-assessed';
      return design.freeboard > 0 ? 'pass' : 'fail';
    },
  ),
  auto(
    'vic-mannings',
    "Manning's n sensitivity assessed",
    false,
    (s) => (s.sensitivityRun ? 'pass' : 'fail'),
  ),
  auto(
    'vic-debris',
    'Debris blockage assessed',
    false,
    (s) => (s.debrisBlockagePct > 0 ? 'pass' : 'fail'),
  ),
  auto(
    'vic-scour',
    'Scour assessment completed',
    false,
    (s) => (s.scourResultsExist ? 'pass' : 'fail'),
  ),
  manual(
    'vic-qaqc-review',
    'Hydraulic QA/QC review completed',
  ),
  external(
    'vic-survey',
    'Survey package verified',
  ),
  external(
    'vic-model-acceptance',
    'Adopted flood model and calibration basis verified',
  ),
];

export const DPIE_CHECKLIST: ChecklistDefinition[] = [
  auto(
    'dpie-freeboard',
    'Freeboard meets adopted NSW floodplain requirement',
    true,
    (s) => {
      const design = getDesignProfile(s.freeboardResults);
      if (!design) return 'not-assessed';
      return design.freeboard >= 1.64 ? 'pass' : 'fail';
    },
  ),
  auto(
    'dpie-sensitivity',
    'Sensitivity analysis completed',
    false,
    (s) => (s.sensitivityRun ? 'pass' : 'fail'),
  ),
  auto(
    'dpie-debris',
    'Debris assessment completed',
    false,
    (s) => (s.debrisBlockagePct > 0 ? 'pass' : 'fail'),
  ),
  external(
    'dpie-floodplain-impacts',
    'Adjacent property and floodplain impacts assessed',
  ),
  external(
    'dpie-survey',
    'Current survey package verified',
  ),
  external(
    'dpie-boundaries',
    'Boundary conditions verified against adopted flood study',
  ),
];

export const ARR_CHECKLIST: ChecklistDefinition[] = [
  auto(
    'arr-freeboard',
    'Adequate freeboard provided for assessed events',
    true,
    (s) => {
      if (!s.freeboardResults) return 'not-assessed';
      return s.freeboardResults.every((f) => f.freeboard > 0) ? 'pass' : 'fail';
    },
  ),
  auto(
    'arr-sensitivity',
    'Parameter sensitivity assessed',
    false,
    (s) => (s.sensitivityRun ? 'pass' : 'fail'),
  ),
  auto(
    'arr-debris',
    'Debris blockage considered',
    false,
    (s) => (s.debrisBlockagePct > 0 ? 'pass' : 'fail'),
  ),
  external(
    'arr-data-quality',
    'Input data quality and provenance documented',
  ),
];

export function getChecklistForJurisdiction(j: Jurisdiction): ChecklistDefinition[] {
  switch (j) {
    case 'tmr':
      return TMR_CHECKLIST;
    case 'vicroads':
      return VICROADS_CHECKLIST;
    case 'dpie':
      return DPIE_CHECKLIST;
    case 'arr':
      return ARR_CHECKLIST;
  }
}
