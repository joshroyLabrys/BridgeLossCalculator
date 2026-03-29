import { describe, it, expect } from 'vitest';
import { runMomentum } from '@flowsuite/engine/methods/momentum';
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
  name: '10-yr', ari: '', discharge: 2500, dsWsel: 5, channelSlope: 0.001,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
  maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
  debrisBlockagePct: 0, manningsNSensitivityPct: null,
  alphaOverride: null, freeboardThreshold: 0.984,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runMomentum', () => {
  it('computes free-surface result with flowCalculationType', () => {
    const result = runMomentum(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.flowCalculationType).toBe('free-surface');
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
  });

  it('dispatches to orifice solver for pressure flow', () => {
    const pressureProfile: FlowProfile = { ...profile, dsWsel: 10 };
    const result = runMomentum(crossSection, bridge, pressureProfile, coefficients);
    expect(result.flowCalculationType).toBe('orifice');
  });

  it('converges within max iterations', () => {
    const result = runMomentum(crossSection, bridge, profile, coefficients);
    expect(result.converged).toBe(true);
  });
});
