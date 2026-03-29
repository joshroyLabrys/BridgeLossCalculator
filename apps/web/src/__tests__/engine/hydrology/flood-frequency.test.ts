import { describe, it, expect } from 'vitest';
import { fitLogPearsonIII } from '@flowsuite/engine/hydrology/flood-frequency';

describe('fitLogPearsonIII', () => {
  it('fits a distribution to annual maxima', () => {
    const data = [
      { year: 2010, q: 45 },
      { year: 2011, q: 120 },
      { year: 2012, q: 65 },
      { year: 2013, q: 88 },
      { year: 2014, q: 200 },
      { year: 2015, q: 52 },
      { year: 2016, q: 78 },
      { year: 2017, q: 155 },
      { year: 2018, q: 42 },
      { year: 2019, q: 95 },
    ];
    const result = fitLogPearsonIII(data);
    expect(result.logPearsonIII.mean).toBeGreaterThan(0);
    expect(result.logPearsonIII.stdDev).toBeGreaterThan(0);
    expect(result.quantiles.length).toBeGreaterThan(0);
    // 1% AEP Q should be larger than 50% AEP Q
    const q1 = result.quantiles.find(q => q.aep === '1%');
    const q50 = result.quantiles.find(q => q.aep === '50%');
    expect(q1).toBeDefined();
    expect(q50).toBeDefined();
    if (q1 && q50) expect(q1.q).toBeGreaterThan(q50.q);
  });

  it('handles small sample sizes', () => {
    const data = [{ year: 2020, q: 50 }, { year: 2021, q: 80 }];
    const result = fitLogPearsonIII(data);
    expect(result.quantiles.length).toBeGreaterThan(0);
  });
});
