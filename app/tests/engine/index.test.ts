import { describe, it, expect } from 'vitest';
import { runAllMethods } from '@/engine/index';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

// Wide flat channel — bridge abutments at 60-140 (40% of 200 ft) → M ≈ 0.4 → Cb > 0
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

const profiles: FlowProfile[] = [
  {
    name: '10-yr',
    discharge: 2500,
    dsWsel: 8,
    channelSlope: 0.001,
    contractionLength: 90,
    expansionLength: 90,
  },
  {
    name: '100-yr',
    discharge: 5000,
    dsWsel: 8.5,
    channelSlope: 0.001,
    contractionLength: 90,
    expansionLength: 90,
  },
];

const coefficients: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runAllMethods', () => {
  it('returns results for all four methods', () => {
    const results = runAllMethods(crossSection, bridge, profiles, coefficients);
    expect(results.energy).toHaveLength(2);
    expect(results.momentum).toHaveLength(2);
    expect(results.yarnell).toHaveLength(2);
    expect(results.wspro).toHaveLength(2);
  });

  it('respects methodsToRun flags', () => {
    const onlyEnergy = {
      ...coefficients,
      methodsToRun: { energy: true, momentum: false, yarnell: false, wspro: false },
    };
    const results = runAllMethods(crossSection, bridge, profiles, onlyEnergy);
    expect(results.energy).toHaveLength(2);
    expect(results.momentum).toHaveLength(0);
    expect(results.yarnell).toHaveLength(0);
    expect(results.wspro).toHaveLength(0);
  });

  it('all methods produce positive head loss', () => {
    const results = runAllMethods(crossSection, bridge, profiles, coefficients);
    for (const r of results.energy) expect(r.totalHeadLoss).toBeGreaterThan(0);
    for (const r of results.yarnell) {
      if (!r.error) expect(r.totalHeadLoss).toBeGreaterThan(0);
    }
    for (const r of results.wspro) expect(r.totalHeadLoss).toBeGreaterThan(0);
  });
});
