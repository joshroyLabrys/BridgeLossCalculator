import { describe, it, expect } from 'vitest';
import {
  clipSegmentToWsel,
  calcFlowArea,
  calcWettedPerimeter,
  calcTopWidth,
  calcHydraulicRadius,
  calcConveyance,
} from '@/engine/geometry';
import { CrossSectionPoint } from '@/engine/types';

// V-shaped channel from VBA test suite:
//   Station:   0    50   100
//   Elevation: 10    0    10
//   WSEL = 8 ft
const vChannel: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

describe('clipSegmentToWsel', () => {
  it('returns null when both points are above WSEL', () => {
    const result = clipSegmentToWsel(0, 10, 50, 12, 8);
    expect(result).toBeNull();
  });

  it('returns full segment when both points are below WSEL', () => {
    const result = clipSegmentToWsel(20, 4, 50, 0, 8);
    expect(result).toEqual({ cx1: 20, cz1: 4, cx2: 50, cz2: 0 });
  });

  it('clips right end when left is wet and right is dry', () => {
    const result = clipSegmentToWsel(50, 0, 100, 10, 8);
    expect(result).not.toBeNull();
    expect(result!.cx1).toBeCloseTo(50, 4);
    expect(result!.cz1).toBeCloseTo(0, 4);
    expect(result!.cx2).toBeCloseTo(90, 4);
    expect(result!.cz2).toBeCloseTo(8, 4);
  });

  it('clips left end when left is dry and right is wet', () => {
    const result = clipSegmentToWsel(0, 10, 50, 0, 8);
    expect(result).not.toBeNull();
    expect(result!.cx1).toBeCloseTo(10, 4);
    expect(result!.cz1).toBeCloseTo(8, 4);
    expect(result!.cx2).toBeCloseTo(50, 4);
    expect(result!.cz2).toBeCloseTo(0, 4);
  });
});

describe('calcFlowArea', () => {
  it('computes 320 sq ft for V-channel at WSEL=8', () => {
    const area = calcFlowArea(vChannel, 8);
    expect(area).toBeCloseTo(320, 1);
  });

  it('returns 0 for WSEL below all points', () => {
    const area = calcFlowArea(vChannel, -1);
    expect(area).toBeCloseTo(0, 4);
  });
});

describe('calcWettedPerimeter', () => {
  it('computes ~81.58 ft for V-channel at WSEL=8', () => {
    const perim = calcWettedPerimeter(vChannel, 8);
    expect(perim).toBeCloseTo(81.58, 1);
  });
});

describe('calcTopWidth', () => {
  it('computes 80 ft for V-channel at WSEL=8', () => {
    const tw = calcTopWidth(vChannel, 8);
    expect(tw).toBeCloseTo(80, 1);
  });
});

describe('calcHydraulicRadius', () => {
  it('computes ~3.923 ft for V-channel at WSEL=8', () => {
    const r = calcHydraulicRadius(vChannel, 8);
    expect(r).toBeCloseTo(3.923, 2);
  });

  it('returns 0 for dry section', () => {
    const r = calcHydraulicRadius(vChannel, -1);
    expect(r).toBe(0);
  });
});

describe('calcConveyance', () => {
  it('computes ~33815 cfs for V-channel at WSEL=8, n=0.035', () => {
    const k = calcConveyance(vChannel, 8);
    expect(k).toBeCloseTo(33815, -2); // within ~200
  });
});
