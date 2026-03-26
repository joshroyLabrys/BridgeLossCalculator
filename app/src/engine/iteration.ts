import { IterationStep } from './types';

export interface SolverOptions {
  lowerBound: number;
  upperBound: number;
  objectiveFn: (trial: number) => number;
  tolerance: number;
  maxIterations: number;
}

export interface SolverResult {
  solution: number;
  converged: boolean;
  log: IterationStep[];
}

/**
 * Bisection/secant hybrid solver.
 *
 * objectiveFn(trial) returns the "computed" value for a given trial.
 * The solver seeks trial such that |trial - objectiveFn(trial)| < tolerance.
 *
 * Phase 1: Bisection to narrow range to within 0.5 ft.
 * Phase 2: Secant method for faster convergence.
 */
export function solve(options: SolverOptions): SolverResult {
  const { lowerBound, upperBound, objectiveFn, tolerance, maxIterations } =
    options;
  const log: IterationStep[] = [];

  let lo = lowerBound;
  let hi = upperBound;
  let trial = (lo + hi) / 2;
  let computed = objectiveFn(trial);
  let prevTrial = lo;
  let prevComputed = objectiveFn(lo);

  for (let i = 1; i <= maxIterations; i++) {
    computed = objectiveFn(trial);
    const error = computed - trial;

    log.push({
      iteration: i,
      trialWsel: trial,
      computedWsel: computed,
      error: Math.abs(error),
    });

    if (Math.abs(error) <= tolerance) {
      return { solution: computed, converged: true, log };
    }

    if (hi - lo > 0.5) {
      // Bisection phase
      if (error > 0) {
        lo = trial;
      } else {
        hi = trial;
      }
      prevTrial = trial;
      prevComputed = computed;
      trial = (lo + hi) / 2;
    } else {
      // Secant phase: use previous and current (trial, error) pair
      const prevError = prevComputed - prevTrial;
      const currError = error; // = computed - trial
      const denom = currError - prevError;

      const oldTrial = prevTrial;
      prevTrial = trial;
      prevComputed = computed;

      if (Math.abs(denom) < 1e-12) {
        // Fall back to bisection if secant denominator is near zero
        trial = (lo + hi) / 2;
      } else {
        // Secant step: next = trial - error * (trial - prevTrial) / (error - prevError)
        const nextTrial = trial - currError * (trial - oldTrial) / denom;
        // Clamp to bounds
        trial = Math.max(lo, Math.min(hi, nextTrial));
      }
    }
  }

  return { solution: computed, converged: false, log };
}
