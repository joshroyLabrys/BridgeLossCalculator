import { describe, it, expect } from 'vitest';
import { applyLosses } from '@flowsuite/engine/hydrology/loss-model';

describe('applyLosses', () => {
  it('applies initial loss correctly', () => {
    // 5mm IL, rainfall = [3, 4, 6, 2] mm per timestep
    // IL absorbs first 3mm, then 2mm of the 4mm timestep = 5mm total
    // Excess: [0, 2, 6, 2]
    const rainfall = [3, 4, 6, 2];
    const result = applyLosses(rainfall, 5, 0, 0, 0, 15);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(2);
    expect(result[2]).toBeCloseTo(6);
    expect(result[3]).toBeCloseTo(2);
  });

  it('applies continuing loss after IL exhausted', () => {
    // IL=2, CL=12mm/hr (=3mm per 15min timestep), rainfall=[5, 5, 5, 5]
    // Step 0: 5mm, IL absorbs 2mm, remaining 3mm, CL absorbs 3mm → excess 0
    // Step 1: 5mm, CL absorbs 3mm → excess 2
    const rainfall = [5, 5, 5, 5];
    const result = applyLosses(rainfall, 2, 12, 0, 0, 15);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(2);
    expect(result[2]).toBeCloseTo(2);
  });

  it('subtracts pre-burst from total before IL', () => {
    // preBurst=3mm subtracted from budget, effectively reduces IL capacity
    // With IL=5 and preBurst=3, effective IL remaining = 5-3 = 2
    const rainfall = [3, 4, 6, 2];
    const result = applyLosses(rainfall, 5, 0, 3, 0, 15);
    expect(result[0]).toBeCloseTo(1); // 3mm rain, 2mm effective IL remaining → 1mm excess
    expect(result[1]).toBeCloseTo(4); // IL exhausted
  });

  it('handles impervious fraction', () => {
    // 50% impervious, IL=100 (never exhausted for pervious part)
    // Pervious excess = 0, impervious contributes 50% of rainfall
    const rainfall = [10, 10];
    const result = applyLosses(rainfall, 100, 0, 0, 0.5, 15);
    expect(result[0]).toBeCloseTo(5); // 50% of 10
    expect(result[1]).toBeCloseTo(5);
  });

  it('returns zeros when all rain absorbed by losses', () => {
    const rainfall = [2, 2, 2];
    const result = applyLosses(rainfall, 100, 0, 0, 0, 15);
    expect(result.every(v => v === 0)).toBe(true);
  });
});
