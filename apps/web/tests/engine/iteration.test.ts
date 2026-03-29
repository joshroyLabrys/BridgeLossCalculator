import { describe, it, expect } from 'vitest';
import { solve } from '@flowsuite/engine/iteration';

describe('solve', () => {
  it('converges on a simple linear equation', () => {
    // Solve: f(x) = x - 5 = 0, so target x = 5
    // objectiveFn returns the "computed" value given a trial
    const result = solve({
      lowerBound: 0,
      upperBound: 10,
      objectiveFn: (trial) => 5, // always returns 5 as the "target"
      tolerance: 0.01,
      maxIterations: 100,
    });
    expect(result.converged).toBe(true);
    expect(result.solution).toBeCloseTo(5, 1);
    expect(result.log.length).toBeGreaterThan(0);
  });

  it('converges on a nonlinear function', () => {
    // Solve: trial = 100 + 0.5 / (trial - 99)
    // Rearranged: (trial-99)(trial-100) = 0.5
    // trial^2 - 199*trial + 9900 - 0.5 = 0 → trial = (199 + sqrt(3)) / 2 ≈ 100.866
    const result = solve({
      lowerBound: 99.1,
      upperBound: 110,
      objectiveFn: (trial) => 100 + 0.5 / (trial - 99),
      tolerance: 0.01,
      maxIterations: 100,
    });
    expect(result.converged).toBe(true);
    // Fixed points: (199 ± sqrt(3)) / 2 ≈ 100.366 or 98.634
    // Solver converges to upper root ≈ 100.366
    expect(result.solution).toBeCloseTo(100.366, 1);
  });

  it('reports non-convergence when max iterations exceeded', () => {
    const result = solve({
      lowerBound: 0,
      upperBound: 100,
      objectiveFn: (trial) => trial + 1, // never converges
      tolerance: 0.001,
      maxIterations: 5,
    });
    expect(result.converged).toBe(false);
    expect(result.log.length).toBe(5);
  });
});
