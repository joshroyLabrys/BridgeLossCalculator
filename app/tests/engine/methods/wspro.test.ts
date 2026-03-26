import { describe, it, expect } from 'vitest';
import { runWSPRO } from '@/engine/methods/wspro';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

// Wide flat channel with deep overbanks — ensures the bridge significantly constricts flow
// Channel: flat bottom at elev 0 from sta 0-200, bank stations at 0 and 200
// Bridge abutments at 60-140 (60% of 200 ft) → M ≈ 0.4 → Cb > 0
const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 0, manningsN: 0.04, bankStation: 'left' },
  { station: 200, elevation: 0, manningsN: 0.04, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9,
  lowChordRight: 9,
  highChord: 12,
  leftAbutmentStation: 60,
  rightAbutmentStation: 140,
  leftAbutmentSlope: 0,
  rightAbutmentSlope: 0,
  skewAngle: 0,
  piers: [{ station: 100, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

const profile: FlowProfile = {
  name: '10-yr',
  discharge: 2500,
  dsWsel: 8,
  channelSlope: 0.001,
  contractionLength: 90,
  expansionLength: 90,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runWSPRO', () => {
  it('produces US WSEL > DS WSEL', () => {
    const result = runWSPRO(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });

  it('reports free-surface flow regime', () => {
    const result = runWSPRO(crossSection, bridge, profile, coefficients);
    expect(result.flowRegime).toBe('free-surface');
  });

  it('has calculation steps', () => {
    const result = runWSPRO(crossSection, bridge, profile, coefficients);
    expect(result.calculationSteps.length).toBeGreaterThan(0);
  });

  it('computes bridge opening ratio between 0 and 1', () => {
    const result = runWSPRO(crossSection, bridge, profile, coefficients);
    // M should be between 0 and 1 for normal bridge constriction
    const mStep = result.calculationSteps.find(s => s.description.includes('opening ratio'));
    expect(mStep).toBeDefined();
    if (mStep) {
      expect(mStep.result).toBeGreaterThan(0);
      expect(mStep.result).toBeLessThanOrEqual(1);
    }
  });
});
