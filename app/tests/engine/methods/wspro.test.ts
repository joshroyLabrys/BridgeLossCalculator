import { describe, it, expect } from 'vitest';
import { runWSPRO } from '@/engine/methods/wspro';
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

describe('runWSPRO', () => {
  it('computes free-surface result with flowCalculationType', () => {
    const result = runWSPRO(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.flowCalculationType).toBe('free-surface');
    expect(result.upstreamWsel).toBeGreaterThanOrEqual(profile.dsWsel);
  });

  it('dispatches to orifice solver for pressure flow', () => {
    const pressureProfile: FlowProfile = { ...profile, dsWsel: 10 };
    const result = runWSPRO(crossSection, bridge, pressureProfile, coefficients);
    expect(result.flowCalculationType).toBe('orifice');
  });

  it('uses alpha in backwater computation', () => {
    // Use a cross-section with overbank areas so that calcAlpha != 1.0
    // and a narrower bridge opening so M < 1 and Cb > 0
    const wideSection: CrossSectionPoint[] = [
      { station: 0, elevation: 5, manningsN: 0.08, bankStation: 'left' },
      { station: 20, elevation: 5, manningsN: 0.08, bankStation: null },
      { station: 25, elevation: 0, manningsN: 0.035, bankStation: null },
      { station: 75, elevation: 0, manningsN: 0.035, bankStation: null },
      { station: 80, elevation: 5, manningsN: 0.08, bankStation: null },
      { station: 100, elevation: 5, manningsN: 0.08, bankStation: 'right' },
    ];
    const constrictionBridge: BridgeGeometry = {
      ...bridge,
      leftAbutmentStation: 25, rightAbutmentStation: 75,
      lowChordLeft: 8, lowChordRight: 8,
    };
    const wideProfile: FlowProfile = { ...profile, dsWsel: 6 };
    const withAlpha = { ...coefficients, alphaOverride: 2.0 };
    const resultAlpha = runWSPRO(wideSection, constrictionBridge, wideProfile, withAlpha);
    const resultDefault = runWSPRO(wideSection, constrictionBridge, wideProfile, coefficients);
    // Higher alpha = higher velocity head = higher backwater
    expect(resultAlpha.upstreamWsel).toBeGreaterThan(resultDefault.upstreamWsel);
  });
});
