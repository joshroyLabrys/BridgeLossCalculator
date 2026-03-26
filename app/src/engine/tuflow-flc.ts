import { FlowRegime } from './types';

const G = 32.174;

/**
 * Back-calculates TUFLOW pier form loss coefficient.
 * FLC = h_pier / (V^2 / 2g)
 */
export function calcTuflowPierFLC(
  pierHeadLoss: number,
  approachVelocity: number
): number {
  if (approachVelocity <= 0) return 0;
  const vh = (approachVelocity * approachVelocity) / (2 * G);
  return pierHeadLoss / vh;
}

/**
 * Back-calculates TUFLOW superstructure form loss coefficient.
 * Returns null for free-surface flow (no superstructure engagement).
 */
export function calcTuflowSuperFLC(
  superHeadLoss: number,
  approachVelocity: number,
  regime: FlowRegime
): number | null {
  if (regime === 'free-surface') return null;
  if (approachVelocity <= 0) return 0;
  const vh = (approachVelocity * approachVelocity) / (2 * G);
  return superHeadLoss / vh;
}
