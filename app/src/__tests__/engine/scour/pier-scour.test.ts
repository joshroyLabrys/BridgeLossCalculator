import { describe, it, expect } from 'vitest';
import {
  pierShapeFactor,
  flowAngleFactor,
  bedConditionFactor,
  calculatePierScour,
} from '@/engine/scour/pier-scour';
import type { Pier } from '@/engine/types';

describe('pierShapeFactor (K1)', () => {
  it('returns 1.1 for square noses', () => {
    expect(pierShapeFactor('square')).toBe(1.1);
  });
  it('returns 1.0 for round-nose', () => {
    expect(pierShapeFactor('round-nose')).toBe(1.0);
  });
  it('returns 1.0 for cylindrical', () => {
    expect(pierShapeFactor('cylindrical')).toBe(1.0);
  });
  it('returns 0.9 for sharp', () => {
    expect(pierShapeFactor('sharp')).toBe(0.9);
  });
});

describe('flowAngleFactor (K2)', () => {
  it('returns 1.0 when skew angle is 0', () => {
    expect(flowAngleFactor(0, 10, 2)).toBe(1.0);
  });
  it('increases with skew angle', () => {
    const k2_15 = flowAngleFactor(15, 10, 2);
    const k2_30 = flowAngleFactor(30, 10, 2);
    expect(k2_15).toBeGreaterThan(1.0);
    expect(k2_30).toBeGreaterThan(k2_15);
  });
  it('computes known value at 30 degrees L/a=4', () => {
    // cos(30) + 4*sin(30) = 0.866 + 2.0 = 2.866
    // 2.866^0.65 ~ 1.983
    const k2 = flowAngleFactor(30, 8, 2); // L=8, a=2 => L/a=4
    expect(k2).toBeCloseTo(1.983, 1);
  });
});

describe('bedConditionFactor (K3)', () => {
  it('returns 1.1 regardless of bed type', () => {
    expect(bedConditionFactor(true)).toBe(1.1);
    expect(bedConditionFactor(false)).toBe(1.1);
  });
});

describe('calculatePierScour', () => {
  const pier: Pier = { station: 50, width: 3, shape: 'round-nose' };

  it('computes scour depth with known inputs', () => {
    // K1=1.0, K2=1.0 (skew=0), K3=1.1
    // ys = 2.0 * 1.0 * 1.0 * 1.1 * 3^0.65 * 10^0.35 * 0.3^0.43
    // 3^0.65 ~ 2.126, 10^0.35 ~ 2.239, 0.3^0.43 ~ 0.580
    // ys = 2.0 * 1.1 * 2.126 * 2.239 * 0.580 ~ 6.08
    const result = calculatePierScour(pier, 0, 10, 0.3, 0, 95, false);
    expect(result.scourDepth).toBeCloseTo(6.08, 0);
    expect(result.criticalBedElevation).toBeCloseTo(95 - result.scourDepth, 4);
    expect(result.k1).toBe(1.0);
    expect(result.k2).toBe(1.0);
    expect(result.k3).toBe(1.1);
    expect(result.pierIndex).toBe(0);
    expect(result.station).toBe(50);
  });

  it('increases scour for square piers', () => {
    const squarePier: Pier = { station: 50, width: 3, shape: 'square' };
    const round = calculatePierScour(pier, 0, 10, 0.3, 0, 95, false);
    const square = calculatePierScour(squarePier, 0, 10, 0.3, 0, 95, false);
    expect(square.scourDepth).toBeGreaterThan(round.scourDepth);
  });

  it('increases scour with skew angle', () => {
    const noSkew = calculatePierScour(pier, 0, 10, 0.3, 0, 95, false);
    const skewed = calculatePierScour(pier, 0, 10, 0.3, 30, 95, false);
    expect(skewed.scourDepth).toBeGreaterThan(noSkew.scourDepth);
  });
});
