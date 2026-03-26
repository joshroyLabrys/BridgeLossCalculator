import { describe, it, expect } from 'vitest';
import { runEnergy } from '@/engine/methods/energy';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

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
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runEnergy', () => {
  it('converges and produces US WSEL > DS WSEL', () => {
    const result = runEnergy(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.converged).toBe(true);
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });

  it('has calculation steps', () => {
    const result = runEnergy(crossSection, bridge, profile, coefficients);
    expect(result.calculationSteps.length).toBeGreaterThan(0);
  });

  it('has iteration log', () => {
    const result = runEnergy(crossSection, bridge, profile, coefficients);
    expect(result.iterationLog.length).toBeGreaterThan(0);
  });

  it('reports flow regime', () => {
    const result = runEnergy(crossSection, bridge, profile, coefficients);
    expect(result.flowRegime).toBe('free-surface');
  });

  it('computes TUFLOW FLCs', () => {
    const result = runEnergy(crossSection, bridge, profile, coefficients);
    expect(result.tuflowPierFLC).toBeGreaterThan(0);
  });
});
