import { describe, it, expect } from 'vitest';
import { runOvertoppingFlow } from '@/engine/overtopping-flow';
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
  name: 'Overtopping', ari: '', discharge: 5000, dsWsel: 13, channelSlope: 0.001,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
  maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
  debrisBlockagePct: 0, manningsNSensitivityPct: null,
  alphaOverride: null, freeboardThreshold: 0.984,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runOvertoppingFlow', () => {
  it('computes upstream WSEL > ds WSEL for overtopping flow', () => {
    const result = runOvertoppingFlow(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.converged).toBe(true);
    expect(result.flowCalculationType).toBe('orifice+weir');
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
  });

  it('splits flow between orifice and weir', () => {
    const result = runOvertoppingFlow(crossSection, bridge, profile, coefficients);
    const stepDescs = result.calculationSteps.map(s => s.description.toLowerCase());
    expect(stepDescs.some(d => d.includes('orifice'))).toBe(true);
    expect(stepDescs.some(d => d.includes('weir'))).toBe(true);
  });

  it('produces higher WSEL with smaller deckWidth (less weir capacity)', () => {
    const narrowDeck: BridgeGeometry = { ...bridge, deckWidth: 3 };
    const resultNarrow = runOvertoppingFlow(crossSection, narrowDeck, profile, coefficients);
    const resultWide = runOvertoppingFlow(crossSection, bridge, profile, coefficients);
    expect(resultNarrow.upstreamWsel).toBeGreaterThan(resultWide.upstreamWsel);
  });
});
