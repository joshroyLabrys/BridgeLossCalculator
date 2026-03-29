import { describe, expect, it } from 'vitest';
import {
  TMR_CHECKLIST,
  VICROADS_CHECKLIST,
  DPIE_CHECKLIST,
  ARR_CHECKLIST,
} from '@/config/regulatory-checklists';

const ALL_CHECKLISTS = [
  ...TMR_CHECKLIST,
  ...VICROADS_CHECKLIST,
  ...DPIE_CHECKLIST,
  ...ARR_CHECKLIST,
];

describe('regulatory checklist definitions', () => {
  it('requires evaluators only for auto checks', () => {
    for (const item of ALL_CHECKLISTS) {
      if (item.verificationType === 'auto') {
        expect(item.evaluate).toBeTypeOf('function');
      } else {
        expect(item.evaluate).toBeUndefined();
      }
    }
  });

  it('does not allow manual or external items to affect the automatic adequacy verdict', () => {
    for (const item of ALL_CHECKLISTS) {
      if (item.verificationType !== 'auto') {
        expect(item.affectsAdequacyVerdict).toBe(false);
      }
    }
  });

  it('removes the old weak TMR velocity-depth auto-check', () => {
    expect(TMR_CHECKLIST.some((item) => item.id === 'tmr-vxd')).toBe(false);
  });

  it('classifies TMR QA/QC, survey, and tailwater items as manual or external evidence', () => {
    expect(TMR_CHECKLIST.find((item) => item.id === 'tmr-qaqc-review')?.verificationType).toBe('manual');
    expect(TMR_CHECKLIST.find((item) => item.id === 'tmr-survey')?.verificationType).toBe('external');
    expect(TMR_CHECKLIST.find((item) => item.id === 'tmr-tailwater')?.verificationType).toBe('external');
  });

  it('uses the correct imperial freeboard threshold for the NSW freeboard auto-check', () => {
    const freeboardCheck = DPIE_CHECKLIST.find((item) => item.id === 'dpie-freeboard');
    expect(freeboardCheck).toBeDefined();

    const fail = freeboardCheck?.evaluate?.({
      freeboardResults: [{ freeboard: 1.5, status: 'clear' }],
      sensitivityRun: false,
      debrisBlockagePct: 0,
      scourResultsExist: false,
      qaqcComparisonExists: false,
      regimeClassifications: ['free-surface'],
      freeboardThreshold: 0.984,
    });

    const pass = freeboardCheck?.evaluate?.({
      freeboardResults: [{ freeboard: 1.7, status: 'clear' }],
      sensitivityRun: false,
      debrisBlockagePct: 0,
      scourResultsExist: false,
      qaqcComparisonExists: false,
      regimeClassifications: ['free-surface'],
      freeboardThreshold: 0.984,
    });

    expect(fail).toBe('fail');
    expect(pass).toBe('pass');
  });
});
