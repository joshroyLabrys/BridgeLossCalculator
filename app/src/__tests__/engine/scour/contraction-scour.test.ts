import { describe, it, expect } from 'vitest';
import {
  criticalVelocity,
  liveBedScour,
  clearWaterScour,
  calculateContractionScour,
} from '@/engine/scour/contraction-scour';

describe('criticalVelocity', () => {
  it('computes Vc for known inputs', () => {
    // Vc = 6.19 * y1^(1/6) * D50^(1/3)
    // y1=10 ft, D50=0.001 ft (0.3048 mm)
    // 10^(1/6) ~ 1.468, 0.001^(1/3) ~ 0.1
    // Vc ~ 6.19 * 1.468 * 0.1 ~ 0.909
    const Vc = criticalVelocity(10, 0.001);
    expect(Vc).toBeCloseTo(0.909, 2);
  });

  it('increases with depth', () => {
    const Vc5 = criticalVelocity(5, 0.01);
    const Vc15 = criticalVelocity(15, 0.01);
    expect(Vc15).toBeGreaterThan(Vc5);
  });

  it('increases with D50', () => {
    const VcSmall = criticalVelocity(10, 0.001);
    const VcLarge = criticalVelocity(10, 0.01);
    expect(VcLarge).toBeGreaterThan(VcSmall);
  });
});

describe('liveBedScour', () => {
  it('returns zero scour when contracted depth < existing depth', () => {
    // y2 = y1 * (Q2/Q1)^(6/7) * (W1/W2)^0.59
    // small Q2 relative to Q1 => y2 small => scour = max(0, y2-y0)
    const result = liveBedScour(5, 1000, 100, 100, 80, 10);
    expect(result.scourDepth).toBe(0);
    expect(result.type).toBe('live-bed');
  });

  it('returns positive scour when contracted depth > existing depth', () => {
    // y1=10, Q2/Q1=1.0, W1/W2=2.0, k1=0.59
    // y2 = 10 * 1.0 * 2.0^0.59 ~ 10 * 1.506 = 15.06
    // scour = 15.06 - 8 = 7.06
    const result = liveBedScour(10, 1000, 1000, 200, 100, 8);
    expect(result.scourDepth).toBeCloseTo(7.06, 0);
    expect(result.contractedDepth).toBeCloseTo(15.06, 0);
  });
});

describe('clearWaterScour', () => {
  it('computes y2 correctly', () => {
    // y2 = [0.025 * Q^2 / (Dm^(2/3) * W^2)]^(3/7)
    // Q=500, Dm=0.01, W=50, y0=5
    const result = clearWaterScour(500, 0.01, 50, 5);
    const expected_y2 = Math.pow((0.025 * 500 * 500) / (Math.pow(0.01, 2 / 3) * 50 * 50), 3 / 7);
    expect(result.contractedDepth).toBeCloseTo(expected_y2, 4);
    expect(result.type).toBe('clear-water');
  });

  it('returns zero scour when y2 < y0', () => {
    // Very wide section, small Q => shallow y2
    const result = clearWaterScour(10, 0.1, 500, 20);
    expect(result.scourDepth).toBe(0);
  });
});

describe('calculateContractionScour (auto-classification)', () => {
  it('classifies as live-bed when V > Vc', () => {
    // d50mm=1 => d50ft=1/304.8 ~ 0.00328
    // Vc = 6.19 * 10^(1/6) * 0.00328^(1/3) ~ 6.19 * 1.468 * 0.1486 ~ 1.35
    // approachVelocity=5 > 1.35 => live-bed
    const result = calculateContractionScour(5, 10, 1, 1000, 1000, 100, 80, 8, 90);
    expect(result.type).toBe('live-bed');
    expect(result.approachVelocity).toBe(5);
    expect(result.criticalVelocity).toBeGreaterThan(0);
  });

  it('classifies as clear-water when V < Vc', () => {
    // d50mm=50 => d50ft=50/304.8 ~ 0.164
    // Vc = 6.19 * 10^(1/6) * 0.164^(1/3) ~ 6.19 * 1.468 * 0.547 ~ 4.97
    // approachVelocity=1 < 4.97 => clear-water
    const result = calculateContractionScour(1, 10, 50, 500, 500, 100, 80, 8, 90);
    expect(result.type).toBe('clear-water');
    expect(result.approachVelocity).toBe(1);
  });

  it('sets criticalBedElevation correctly', () => {
    const result = calculateContractionScour(5, 10, 1, 1000, 1000, 100, 80, 8, 90);
    expect(result.criticalBedElevation).toBeCloseTo(90 - result.scourDepth, 4);
  });
});
