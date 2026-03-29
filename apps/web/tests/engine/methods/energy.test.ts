import { describe, it, expect } from 'vitest';
import { runEnergy } from '@flowsuite/engine/methods/energy';
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

// Low discharge that stays comfortably in free-surface (US WSEL well below low chord of 9)
const freeSurfaceProfile: FlowProfile = {
  name: 'Free', ari: '', discharge: 500, dsWsel: 5, channelSlope: 0.001,
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
    expect(result.upstreamWsel).toBeLessThan(9); // stays below low chord
  });

  it('dispatches to pressure flow when DS WSEL > low chord', () => {
    const result = runEnergy(crossSection, bridge, pressureProfile, coefficients);
    expect(result.flowCalculationType).toBe('orifice');
    expect(result.flowRegime).toBe('pressure');
  });

  it('transitions to pressure when free-surface solver overshoots low chord', () => {
    // High discharge with low DS WSEL — free-surface solver will overshoot
    const highQ: FlowProfile = { name: 'HighQ', ari: '', discharge: 2500, dsWsel: 5, channelSlope: 0.001 };
    const result = runEnergy(crossSection, bridge, highQ, coefficients);
    // Should detect the overshoot and fall back to pressure/overtopping
    expect(result.flowCalculationType).not.toBe('free-surface');
  });

  it('respects alpha override for free-surface flow', () => {
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
