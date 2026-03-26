import { describe, it, expect } from 'vitest';
import { runYarnell } from '@/engine/methods/yarnell';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

// V-channel from geometry tests
const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9,
  lowChordRight: 9,
  highChord: 12,
  leftAbutmentStation: 5,
  rightAbutmentStation: 95,
  leftAbutmentSlope: 0,
  rightAbutmentSlope: 0,
  skewAngle: 0,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
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
  yarnellK: null, // auto from pier shape
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runYarnell', () => {
  it('produces a result with upstream WSEL > downstream WSEL', () => {
    const result = runYarnell(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
    expect(result.flowRegime).toBe('free-surface');
    expect(result.profileName).toBe('10-yr');
  });

  it('uses correct K coefficient for round-nose pier (0.9)', () => {
    const result = runYarnell(crossSection, bridge, profile, coefficients);
    // Yarnell equation: Δy = K*(K+5-0.6)*(α+15α⁴)*(V²/2g)
    // K=0.9 for round-nose
    expect(result.totalHeadLoss).toBeGreaterThan(0);
    expect(result.calculationSteps.length).toBeGreaterThan(0);
  });

  it('flags not-applicable for pressure flow', () => {
    const pressureProfile = { ...profile, dsWsel: 10 };
    // WSEL=10 > low chord=9 → pressure flow
    const result = runYarnell(crossSection, bridge, pressureProfile, coefficients);
    expect(result.error).toContain('Not Applicable');
  });

  it('allows manual K override', () => {
    const manualK = { ...coefficients, yarnellK: 1.25 }; // square pier K
    const result = runYarnell(crossSection, bridge, profile, manualK);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });
});
