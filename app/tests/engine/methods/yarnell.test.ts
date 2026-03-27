import { describe, it, expect } from 'vitest';
import { runYarnell } from '@/engine/methods/yarnell';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9, lowChordRight: 9, highChord: 12,
  leftAbutmentStation: 5, rightAbutmentStation: 95,
  skewAngle: 0, contractionLength: 90, expansionLength: 90,
  orificeCd: 0.8, weirCw: 1.4, deckWidth: 0,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

const profile: FlowProfile = {
  name: '10-yr', ari: '', discharge: 2500, dsWsel: 8, channelSlope: 0.001,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
  maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
  debrisBlockagePct: 0, manningsNSensitivityPct: null,
  alphaOverride: null, freeboardThreshold: 0.984,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runYarnell', () => {
  it('computes backwater using corrected Froude-based equation', () => {
    const result = runYarnell(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.flowRegime).toBe('free-surface');
    expect(result.flowCalculationType).toBe('free-surface');
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0.01);
    expect(result.totalHeadLoss).toBeLessThan(5.0);
  });

  it('flags not-applicable for pressure flow', () => {
    const pressureProfile: FlowProfile = { ...profile, dsWsel: 10 };
    const result = runYarnell(crossSection, bridge, pressureProfile, coefficients);
    expect(result.error).toContain('Not Applicable');
    expect(result.flowCalculationType).toBe('free-surface');
  });

  it('allows manual K override', () => {
    const manualK = { ...coefficients, yarnellK: 1.25 };
    const result = runYarnell(crossSection, bridge, profile, manualK);
    const autoResult = runYarnell(crossSection, bridge, profile, coefficients);
    expect(result.totalHeadLoss).toBeGreaterThan(autoResult.totalHeadLoss);
  });

  it('produces zero afflux with zero pier blockage', () => {
    const noPiers: BridgeGeometry = { ...bridge, piers: [] };
    const result = runYarnell(crossSection, noPiers, profile, coefficients);
    expect(result.totalHeadLoss).toBeCloseTo(0, 4);
  });
});
