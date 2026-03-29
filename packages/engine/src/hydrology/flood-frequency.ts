import type { FFAResult } from './types';
import { STANDARD_AEPS } from '../hydrology/rational-method';

/** AEP string to exceedance probability */
const AEP_PROB: Record<string, number> = {
  '50%': 0.5, '20%': 0.2, '10%': 0.1, '5%': 0.05, '2%': 0.02, '1%': 0.01,
};

/**
 * Fit Log Pearson Type III distribution to annual maximum flood series.
 * Returns quantile estimates for standard AEPs.
 */
export function fitLogPearsonIII(annualMaxima: { year: number; q: number }[]): FFAResult {
  const n = annualMaxima.length;
  if (n < 2) {
    return {
      annualMaxima,
      logPearsonIII: { mean: 0, stdDev: 0, skew: 0 },
      quantiles: STANDARD_AEPS.map(aep => ({ aep, q: 0, confidenceLow: 0, confidenceHigh: 0 })),
    };
  }

  // Log-transform
  const logQ = annualMaxima.map(d => Math.log10(Math.max(d.q, 0.001)));

  // Statistics
  const mean = logQ.reduce((a, b) => a + b, 0) / n;
  const variance = logQ.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const skew = n > 2
    ? (n / ((n - 1) * (n - 2))) * logQ.reduce((sum, x) => sum + ((x - mean) / stdDev) ** 3, 0)
    : 0;

  // Quantile estimates using frequency factor K
  const quantiles = STANDARD_AEPS.map(aep => {
    const p = AEP_PROB[aep] ?? 0.01;
    const k = frequencyFactor(p, skew);
    const logQp = mean + k * stdDev;
    const qp = Math.pow(10, logQp);

    // Approximate confidence intervals (±1 SE)
    const se = stdDev * Math.sqrt((1 + k * k / 2) / n);
    const logLow = logQp - 1.96 * se;
    const logHigh = logQp + 1.96 * se;

    return {
      aep,
      q: qp,
      confidenceLow: Math.pow(10, logLow),
      confidenceHigh: Math.pow(10, logHigh),
    };
  });

  return {
    annualMaxima,
    logPearsonIII: { mean, stdDev, skew },
    quantiles,
  };
}

/**
 * Frequency factor K for Log Pearson III.
 * Uses Wilson-Hilferty approximation for skewed distributions.
 */
function frequencyFactor(exceedanceProbability: number, skew: number): number {
  // Standard normal variate for the given probability
  const z = standardNormalQuantile(1 - exceedanceProbability);

  if (Math.abs(skew) < 0.001) return z;

  // Wilson-Hilferty approximation
  const k = skew / 6;
  const w = z;
  return (2 / skew) * (Math.pow(1 + k * w - k * k / 3, 3) - 1);
}

/**
 * Approximation of the standard normal quantile (inverse CDF).
 * Abramowitz & Stegun rational approximation.
 */
function standardNormalQuantile(p: number): number {
  if (p <= 0) return -4;
  if (p >= 1) return 4;

  const sign = p < 0.5 ? -1 : 1;
  const pp = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(pp));

  // Rational approximation coefficients
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  return sign * (t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t));
}
