import { describe, it, expect } from 'vitest';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from '@/engine/tuflow-flc';

describe('calcTuflowPierFLC', () => {
  it('computes h_pier / (V^2/2g)', () => {
    // headLoss=0.5, velocity=7.0 → Vh = 7^2/(2*32.174) = 0.7613
    // FLC = 0.5 / 0.7613 = 0.6568
    expect(calcTuflowPierFLC(0.5, 7.0)).toBeCloseTo(0.657, 2);
  });

  it('returns 0 for zero velocity', () => {
    expect(calcTuflowPierFLC(0.5, 0)).toBe(0);
  });
});

describe('calcTuflowSuperFLC', () => {
  it('returns null for free-surface flow', () => {
    expect(calcTuflowSuperFLC(0.5, 7.0, 'free-surface')).toBeNull();
  });

  it('computes FLC for pressure flow', () => {
    expect(calcTuflowSuperFLC(0.5, 7.0, 'pressure')).toBeCloseTo(0.657, 2);
  });

  it('computes non-zero superstructure FLC for pressure flow', () => {
    const result = calcTuflowSuperFLC(2.5, 6.0, 'pressure');
    // FLC = 2.5 / (6²/(2×32.174)) = 2.5 / 0.559 ≈ 4.47
    expect(result).toBeCloseTo(4.47, 1);
  });

  it('computes non-zero superstructure FLC for overtopping', () => {
    const result = calcTuflowSuperFLC(1.0, 4.0, 'overtopping');
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });
});
