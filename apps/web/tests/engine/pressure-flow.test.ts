import { describe, it, expect } from 'vitest';
import { runPressureFlow } from '@flowsuite/engine/pressure-flow';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@flowsuite/engine/types';

const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9, lowChordRight: 9, highChord: 12,
  leftAbutmentStation: 5, rightAbutmentStation: 95,
  skewAngle: 0, contractionLength: 90, expansionLength: 90,
  orificeCd: 0.8, weirCw: 1.4, deckWidth: 10,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

const profile: FlowProfile = {
  name: 'Pressure', ari: '', discharge: 2500, dsWsel: 10, channelSlope: 0.001,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
  maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
  debrisBlockagePct: 0, manningsNSensitivityPct: null,
  alphaOverride: null, freeboardThreshold: 0.984,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runPressureFlow', () => {
  it('computes upstream WSEL > ds WSEL for pressure flow', () => {
    const result = runPressureFlow(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.converged).toBe(true);
    expect(result.flowCalculationType).toBe('orifice');
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });

  it('produces higher upstream WSEL with lower Cd', () => {
    const lowCd: BridgeGeometry = { ...bridge, orificeCd: 0.5 };
    const resultLow = runPressureFlow(crossSection, lowCd, profile, coefficients);
    const resultHigh = runPressureFlow(crossSection, bridge, profile, coefficients);
    expect(resultLow.upstreamWsel).toBeGreaterThan(resultHigh.upstreamWsel);
  });

  it('returns calculation steps documenting the orifice equation', () => {
    const result = runPressureFlow(crossSection, bridge, profile, coefficients);
    expect(result.calculationSteps.length).toBeGreaterThan(0);
    expect(result.calculationSteps.some(s => s.description.toLowerCase().includes('orifice'))).toBe(true);
  });
});
