import type { Jurisdiction } from '@/engine/types';

export interface ChecklistDefinition {
  id: string;
  requirement: string;
  autoCheck: boolean;
  /** Evaluator receives project state, returns 'pass' | 'fail' | 'not-assessed' */
  evaluate?: (state: ProjectStateForChecklist) => 'pass' | 'fail' | 'not-assessed';
}

export interface ProjectStateForChecklist {
  freeboardResults: { freeboard: number; status: string }[] | null;
  sensitivityRun: boolean;
  debrisBlockagePct: number;
  scourResultsExist: boolean;
  qaqcComparisonExists: boolean;
  regimeClassifications: string[];
  velocityDepthProducts: number[]; // V × d for each profile
  freeboardThreshold: number;
}

export const TMR_CHECKLIST: ChecklistDefinition[] = [
  {
    id: 'tmr-freeboard-300mm',
    requirement: 'Freeboard ≥ 300mm at 1% AEP',
    autoCheck: true,
    evaluate: (s) => {
      if (!s.freeboardResults) return 'not-assessed';
      // assume last profile is the largest (design event)
      const design = s.freeboardResults[s.freeboardResults.length - 1];
      if (!design) return 'not-assessed';
      return design.freeboard >= 0.3 ? 'pass' : 'fail'; // 0.3 m = 300 mm
    },
  },
  {
    id: 'tmr-no-pressure',
    requirement: 'No pressure flow at design AEP',
    autoCheck: true,
    evaluate: (s) => {
      if (!s.regimeClassifications.length) return 'not-assessed';
      const last = s.regimeClassifications[s.regimeClassifications.length - 1];
      return last === 'free-surface' ? 'pass' : 'fail';
    },
  },
  {
    id: 'tmr-vxd',
    requirement: 'Velocity × depth product within limits',
    autoCheck: true,
    evaluate: (s) => {
      if (!s.velocityDepthProducts.length) return 'not-assessed';
      // TMR limit: V×d ≤ 1.2 m²/s (general road classification)
      return s.velocityDepthProducts.every((vd) => vd <= 1.2) ? 'pass' : 'fail';
    },
  },
  {
    id: 'tmr-mannings-sensitivity',
    requirement: "Manning's n sensitivity ±20% assessed",
    autoCheck: true,
    evaluate: (s) => (s.sensitivityRun ? 'pass' : 'fail'),
  },
  {
    id: 'tmr-debris',
    requirement: 'Debris blockage considered (ARR guidelines)',
    autoCheck: true,
    evaluate: (s) => (s.debrisBlockagePct > 0 ? 'pass' : 'fail'),
  },
  {
    id: 'tmr-scour',
    requirement: 'Scour assessment completed',
    autoCheck: true,
    evaluate: (s) => (s.scourResultsExist ? 'pass' : 'fail'),
  },
  {
    id: 'tmr-survey',
    requirement: 'Survey data verified',
    autoCheck: false,
  },
  {
    id: 'tmr-tailwater',
    requirement: 'Tailwater conditions confirmed',
    autoCheck: false,
  },
  {
    id: 'tmr-qaqc',
    requirement: 'Independent QA/QC check completed',
    autoCheck: true,
    evaluate: (s) => (s.qaqcComparisonExists ? 'pass' : 'fail'),
  },
];

export const VICROADS_CHECKLIST: ChecklistDefinition[] = [
  {
    id: 'vic-freeboard',
    requirement: 'Adequate freeboard at design AEP',
    autoCheck: true,
    evaluate: (s) => {
      if (!s.freeboardResults) return 'not-assessed';
      const design = s.freeboardResults[s.freeboardResults.length - 1];
      return design && design.freeboard > 0 ? 'pass' : 'fail';
    },
  },
  {
    id: 'vic-mannings',
    requirement: "Manning's n sensitivity assessed",
    autoCheck: true,
    evaluate: (s) => (s.sensitivityRun ? 'pass' : 'fail'),
  },
  {
    id: 'vic-debris',
    requirement: 'Debris blockage assessed',
    autoCheck: true,
    evaluate: (s) => (s.debrisBlockagePct > 0 ? 'pass' : 'fail'),
  },
  {
    id: 'vic-scour',
    requirement: 'Scour assessment completed',
    autoCheck: true,
    evaluate: (s) => (s.scourResultsExist ? 'pass' : 'fail'),
  },
  {
    id: 'vic-survey',
    requirement: 'Survey data verified',
    autoCheck: false,
  },
  {
    id: 'vic-calibration',
    requirement: 'Model calibration verified',
    autoCheck: false,
  },
];

export const DPIE_CHECKLIST: ChecklistDefinition[] = [
  {
    id: 'dpie-freeboard',
    requirement: 'Freeboard meets floodplain management requirements',
    autoCheck: true,
    evaluate: (s) => {
      if (!s.freeboardResults) return 'not-assessed';
      const design = s.freeboardResults[s.freeboardResults.length - 1];
      return design && design.freeboard >= 0.5 ? 'pass' : 'fail'; // 500 mm for DPIE
    },
  },
  {
    id: 'dpie-sensitivity',
    requirement: 'Sensitivity analysis completed',
    autoCheck: true,
    evaluate: (s) => (s.sensitivityRun ? 'pass' : 'fail'),
  },
  {
    id: 'dpie-debris',
    requirement: 'Debris assessment per ARR',
    autoCheck: true,
    evaluate: (s) => (s.debrisBlockagePct > 0 ? 'pass' : 'fail'),
  },
  {
    id: 'dpie-afflux',
    requirement: 'Afflux impact on adjacent properties assessed',
    autoCheck: false,
  },
  {
    id: 'dpie-survey',
    requirement: 'Current survey data used',
    autoCheck: false,
  },
];

export const ARR_CHECKLIST: ChecklistDefinition[] = [
  {
    id: 'arr-sensitivity',
    requirement: 'Parameter sensitivity assessed (ARR Book 7)',
    autoCheck: true,
    evaluate: (s) => (s.sensitivityRun ? 'pass' : 'fail'),
  },
  {
    id: 'arr-debris',
    requirement: 'Debris blockage per ARR guidelines',
    autoCheck: true,
    evaluate: (s) => (s.debrisBlockagePct > 0 ? 'pass' : 'fail'),
  },
  {
    id: 'arr-freeboard',
    requirement: 'Adequate freeboard provided',
    autoCheck: true,
    evaluate: (s) => {
      if (!s.freeboardResults) return 'not-assessed';
      return s.freeboardResults.every((f) => f.freeboard > 0) ? 'pass' : 'fail';
    },
  },
  {
    id: 'arr-data-quality',
    requirement: 'Input data quality documented',
    autoCheck: false,
  },
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
