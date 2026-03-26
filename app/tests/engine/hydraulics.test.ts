import { describe, it, expect } from 'vitest';
import {
  calcVelocity,
  calcVelocityHead,
  calcFroudeNumber,
  calcFrictionSlope,
  calcFrictionLoss,
} from '@/engine/hydraulics';

describe('calcVelocity', () => {
  it('computes Q/A', () => {
    expect(calcVelocity(1000, 200)).toBeCloseTo(5, 4);
  });

  it('returns 0 for zero area', () => {
    expect(calcVelocity(1000, 0)).toBe(0);
  });
});

describe('calcVelocityHead', () => {
  it('computes alpha * V^2 / (2 * 32.174)', () => {
    // V=5, alpha=1.0 → 5^2 / 64.348 = 0.3883
    expect(calcVelocityHead(5, 1.0)).toBeCloseTo(0.3883, 3);
  });
});

describe('calcFroudeNumber', () => {
  it('computes V / sqrt(g * D)', () => {
    // V=5, A=200, T=40 → D=5 → Fr = 5/sqrt(32.174*5) = 5/12.684 = 0.394
    expect(calcFroudeNumber(5, 200, 40)).toBeCloseTo(0.394, 2);
  });
});

describe('calcFrictionSlope', () => {
  it('computes (Q/K)^2', () => {
    // Q=1000, K=33815 → Sf = (1000/33815)^2 = 0.000875
    expect(calcFrictionSlope(1000, 33815)).toBeCloseTo(0.000875, 5);
  });
});

describe('calcFrictionLoss', () => {
  it('computes average friction slope times reach length', () => {
    // L=100, Sf1=0.001, Sf2=0.002 → hf = 100 * (0.001+0.002)/2 = 0.15
    expect(calcFrictionLoss(100, 0.001, 0.002)).toBeCloseTo(0.15, 4);
  });
});
