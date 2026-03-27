import { describe, it, expect } from 'vitest';
import { runEnergy } from '@/engine/methods/energy';
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
  orificeCd: 0.8, weirCw: 1.4, deckWidth: 10,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

const freeSurfaceProfile: FlowProfile = {
  name: 'Free', ari: '', discharge: 2500, dsWsel: 5, channelSlope: 0.001,
};

const pressureProfile: FlowProfile = {
  name: 'Pressure', ari: '', discharge: 2500, dsWsel: 10, channelSlope: 0.001,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
  maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
  debrisBlockagePct: 0, manningsNSensitivityPct: null,
  alphaOverride: null, freeboardThreshold: 0.984,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runEnergy', () => {
  it('computes free-surface result with flowCalculationType', () => {
    const result = runEnergy(crossSection, bridge, freeSurfaceProfile, coefficients);
    expect(result.error).toBeNull();
    expect(result.flowCalculationType).toBe('free-surface');
    expect(result.upstreamWsel).toBeGreaterThan(freeSurfaceProfile.dsWsel);
  });

  it('dispatches to pressure flow when WSEL > low chord', () => {
    const result = runEnergy(crossSection, bridge, pressureProfile, coefficients);
    expect(result.flowCalculationType).toBe('orifice');
    expect(result.flowRegime).toBe('pressure');
  });

  it('respects alpha override', () => {
    const withAlpha = { ...coefficients, alphaOverride: 1.5 };
    const resultOverride = runEnergy(crossSection, bridge, freeSurfaceProfile, withAlpha);
    const resultAuto = runEnergy(crossSection, bridge, freeSurfaceProfile, coefficients);
    expect(resultOverride.upstreamWsel).not.toBeCloseTo(resultAuto.upstreamWsel, 3);
  });

  it('uses reach lengths from bridge geometry', () => {
    const shortReach: BridgeGeometry = { ...bridge, contractionLength: 10, expansionLength: 10 };
    const longReach: BridgeGeometry = { ...bridge, contractionLength: 500, expansionLength: 500 };
    const resultShort = runEnergy(crossSection, shortReach, freeSurfaceProfile, coefficients);
    const resultLong = runEnergy(crossSection, longReach, freeSurfaceProfile, coefficients);
    expect(resultLong.upstreamWsel).toBeGreaterThan(resultShort.upstreamWsel);
  });
});
