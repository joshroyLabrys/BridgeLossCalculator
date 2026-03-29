import { describe, it, expect } from 'vitest';
import {
  calcBridgeOpeningArea,
  calcPierBlockage,
  calcNetBridgeArea,
  interpolateLowChord,
} from '@flowsuite/engine/bridge-geometry';
import { CrossSectionPoint, BridgeGeometry, Pier } from '@flowsuite/engine/types';

// Trapezoidal channel: flat bottom at elev 90 from sta 30-70, banks rising to 100
const channel: CrossSectionPoint[] = [
  { station: 0, elevation: 100, manningsN: 0.045, bankStation: 'left' },
  { station: 30, elevation: 90, manningsN: 0.035, bankStation: null },
  { station: 70, elevation: 90, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 100, manningsN: 0.045, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 98,
  lowChordRight: 98,
  highChord: 102,
  leftAbutmentStation: 20,
  rightAbutmentStation: 80,
  skewAngle: 0,
  contractionLength: 90,
  expansionLength: 90,
  orificeCd: 0.8,
  weirCw: 1.4,
  deckWidth: 0,
  piers: [
    { station: 50, width: 3, shape: 'round-nose' },
  ],
  lowChordProfile: [],
};

describe('interpolateLowChord', () => {
  it('returns constant low chord when no profile given', () => {
    expect(interpolateLowChord(bridge, 50)).toBeCloseTo(98, 4);
  });

  it('interpolates between left and right when different', () => {
    const asymBridge = { ...bridge, lowChordLeft: 96, lowChordRight: 100 };
    // At midpoint of abutments (sta 50), expect 98
    expect(interpolateLowChord(asymBridge, 50)).toBeCloseTo(98, 4);
    // At left abutment, expect 96
    expect(interpolateLowChord(asymBridge, 20)).toBeCloseTo(96, 4);
  });
});

describe('calcPierBlockage', () => {
  it('computes pier blockage area below WSEL', () => {
    // Single pier: width=3, bottom at channel elev 90 at sta 50, WSEL=95
    // Blockage = 3 * (95 - 90) = 15 sq ft
    const piers: Pier[] = [{ station: 50, width: 3, shape: 'round-nose' }];
    const blockage = calcPierBlockage(piers, channel, 95);
    expect(blockage).toBeCloseTo(15, 1);
  });

  it('returns 0 when WSEL is below pier base', () => {
    const piers: Pier[] = [{ station: 50, width: 3, shape: 'round-nose' }];
    const blockage = calcPierBlockage(piers, channel, 85);
    expect(blockage).toBeCloseTo(0, 4);
  });
});

describe('calcBridgeOpeningArea', () => {
  it('computes gross opening area below low chord', () => {
    // At WSEL=95: area below WSEL clipped to abutment stations, minus pier
    const area = calcBridgeOpeningArea(bridge, channel, 95);
    expect(area).toBeGreaterThan(0);
  });
});

describe('calcNetBridgeArea', () => {
  it('subtracts pier blockage from gross opening', () => {
    const net = calcNetBridgeArea(bridge, channel, 95);
    const gross = calcBridgeOpeningArea(bridge, channel, 95);
    const pierBlock = calcPierBlockage(bridge.piers, channel, 95);
    expect(net).toBeCloseTo(gross - pierBlock, 1);
  });
});
