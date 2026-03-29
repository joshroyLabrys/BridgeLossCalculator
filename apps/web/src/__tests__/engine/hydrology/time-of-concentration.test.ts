import { describe, it, expect } from 'vitest';
import { bransbyWilliams, friends } from '@flowsuite/engine/hydrology/time-of-concentration';

describe('bransbyWilliams', () => {
  it('returns 0 for zero or negative inputs', () => {
    expect(bransbyWilliams(0, 10, 5)).toBe(0);
    expect(bransbyWilliams(5, 0, 5)).toBe(0);
    expect(bransbyWilliams(5, 10, 0)).toBe(0);
    expect(bransbyWilliams(-1, 10, 5)).toBe(0);
  });

  it('computes correct Tc for known inputs', () => {
    // L=10km, A=50km², S=5m/km
    // tc = 0.0883 * 10 / (50^0.1 * 5^0.2)
    // 50^0.1 ≈ 1.4725, 5^0.2 ≈ 1.3797
    // tc = 0.883 / (1.4725 * 1.3797) ≈ 0.883 / 2.0316 ≈ 0.4346
    const tc = bransbyWilliams(10, 50, 5);
    expect(tc).toBeCloseTo(0.4346, 2);
  });

  it('increases with stream length', () => {
    const tc1 = bransbyWilliams(5, 50, 5);
    const tc2 = bransbyWilliams(10, 50, 5);
    expect(tc2).toBeGreaterThan(tc1);
  });

  it('decreases with steeper slope', () => {
    const tc1 = bransbyWilliams(10, 50, 2);
    const tc2 = bransbyWilliams(10, 50, 10);
    expect(tc2).toBeLessThan(tc1);
  });
});

describe('friends', () => {
  it('returns 0 for zero or negative area', () => {
    expect(friends(0)).toBe(0);
    expect(friends(-5)).toBe(0);
  });

  it('computes correct Tc for known inputs', () => {
    // A=100km²: tc = 0.76 * 100^0.38 = 0.76 * 5.7544 ≈ 4.373
    const tc = friends(100);
    expect(tc).toBeCloseTo(4.373, 1);
  });

  it('increases with catchment area', () => {
    const tc1 = friends(10);
    const tc2 = friends(100);
    expect(tc2).toBeGreaterThan(tc1);
  });

  it('returns reasonable value for small catchment', () => {
    // A=1km²: tc = 0.76 * 1^0.38 = 0.76
    const tc = friends(1);
    expect(tc).toBeCloseTo(0.76, 2);
  });
});
