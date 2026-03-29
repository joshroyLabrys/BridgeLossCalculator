import { describe, it, expect } from 'vitest';
import { toImperial, toDisplay, unitLabel } from '@flowsuite/data';

describe('toImperial', () => {
  it('returns identity for imperial system', () => {
    expect(toImperial(100, 'length', 'imperial')).toBe(100);
  });

  it('converts meters to feet', () => {
    expect(toImperial(1, 'length', 'metric')).toBeCloseTo(3.28084, 3);
  });

  it('converts m\u00B2 to ft\u00B2', () => {
    expect(toImperial(1, 'area', 'metric')).toBeCloseTo(10.7639, 2);
  });

  it('converts m/s to ft/s', () => {
    expect(toImperial(1, 'velocity', 'metric')).toBeCloseTo(3.28084, 3);
  });

  it('converts m\u00B3/s to cfs', () => {
    expect(toImperial(1, 'discharge', 'metric')).toBeCloseTo(35.3147, 2);
  });

  it('returns identity for dimensionless types', () => {
    expect(toImperial(0.035, 'manningsN', 'metric')).toBe(0.035);
    expect(toImperial(0.001, 'slope', 'metric')).toBe(0.001);
    expect(toImperial(30, 'angle', 'metric')).toBe(30);
  });
});

describe('toDisplay', () => {
  it('returns identity for imperial system', () => {
    expect(toDisplay(100, 'length', 'imperial')).toBe(100);
  });

  it('converts feet to meters', () => {
    expect(toDisplay(1, 'length', 'metric')).toBeCloseTo(0.3048, 4);
  });

  it('converts ft\u00B2 to m\u00B2', () => {
    expect(toDisplay(1, 'area', 'metric')).toBeCloseTo(0.0929, 3);
  });

  it('converts cfs to m\u00B3/s', () => {
    expect(toDisplay(1, 'discharge', 'metric')).toBeCloseTo(0.02832, 4);
  });

  it('roundtrips correctly', () => {
    const original = 100;
    const displayed = toDisplay(original, 'length', 'metric');
    const back = toImperial(displayed, 'length', 'metric');
    expect(back).toBeCloseTo(original, 6);
  });
});

describe('unitLabel', () => {
  it('returns imperial labels', () => {
    expect(unitLabel('length', 'imperial')).toBe('ft');
    expect(unitLabel('discharge', 'imperial')).toBe('cfs');
    expect(unitLabel('velocity', 'imperial')).toBe('ft/s');
    expect(unitLabel('area', 'imperial')).toBe('ft\u00B2');
  });

  it('returns metric labels', () => {
    expect(unitLabel('length', 'metric')).toBe('m');
    expect(unitLabel('discharge', 'metric')).toBe('m\u00B3/s');
    expect(unitLabel('velocity', 'metric')).toBe('m/s');
    expect(unitLabel('area', 'metric')).toBe('m\u00B2');
  });
});
