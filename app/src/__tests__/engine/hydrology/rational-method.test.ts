import { describe, it, expect } from 'vitest';
import { rationalMethod, lookupIntensity, STANDARD_AEPS } from '@/engine/hydrology/rational-method';
import type { IFDTable } from '@/engine/types';

// ── Test IFD table ──
const testIFD: IFDTable = {
  durations: [10, 30, 60, 120],
  aeps: ['50%', '20%', '10%', '5%', '2%', '1%'],
  intensities: [
    [60, 80, 95, 110, 130, 150],   // 10 min
    [35, 47, 56, 65, 77, 89],      // 30 min
    [22, 30, 36, 42, 50, 58],      // 60 min
    [14, 19, 23, 27, 32, 37],      // 120 min
  ],
};

describe('rationalMethod', () => {
  it('computes Q = C * I * A / 360', () => {
    // C=0.5, I=100mm/hr, A=10km²
    // Q = 0.5 * 100 * 10 / 360 = 500/360 ≈ 1.389
    const q = rationalMethod(0.5, 100, 10);
    expect(q).toBeCloseTo(1.389, 2);
  });

  it('returns 0 when any input is 0', () => {
    expect(rationalMethod(0, 100, 10)).toBe(0);
    expect(rationalMethod(0.5, 0, 10)).toBe(0);
    expect(rationalMethod(0.5, 100, 0)).toBe(0);
  });

  it('scales linearly with C', () => {
    const q1 = rationalMethod(0.5, 100, 10);
    const q2 = rationalMethod(1.0, 100, 10);
    expect(q2).toBeCloseTo(q1 * 2, 6);
  });
});

describe('lookupIntensity', () => {
  it('returns exact value for matching duration', () => {
    const i = lookupIntensity(testIFD, 30, '10%');
    expect(i).toBe(56);
  });

  it('returns null for unknown AEP', () => {
    const i = lookupIntensity(testIFD, 30, '99%');
    expect(i).toBeNull();
  });

  it('clamps to first duration when below range', () => {
    const i = lookupIntensity(testIFD, 5, '50%');
    expect(i).toBe(60);
  });

  it('clamps to last duration when above range', () => {
    const i = lookupIntensity(testIFD, 200, '50%');
    expect(i).toBe(14);
  });

  it('interpolates between durations', () => {
    // 20 min is halfway between 10 and 30
    // For '50%': 60 + 0.5 * (35 - 60) = 60 - 12.5 = 47.5
    const i = lookupIntensity(testIFD, 20, '50%');
    expect(i).toBeCloseTo(47.5, 4);
  });

  it('interpolates at 25% of interval', () => {
    // 15 min is 25% between 10 and 30 (t = 5/20 = 0.25)
    // For '1%': 150 + 0.25 * (89 - 150) = 150 - 15.25 = 134.75
    const i = lookupIntensity(testIFD, 15, '1%');
    expect(i).toBeCloseTo(134.75, 4);
  });

  it('returns correct value for last AEP column', () => {
    const i = lookupIntensity(testIFD, 60, '1%');
    expect(i).toBe(58);
  });
});

describe('STANDARD_AEPS', () => {
  it('contains 6 standard AEPs', () => {
    expect(STANDARD_AEPS).toHaveLength(6);
    expect(STANDARD_AEPS).toContain('1%');
    expect(STANDARD_AEPS).toContain('50%');
  });
});
