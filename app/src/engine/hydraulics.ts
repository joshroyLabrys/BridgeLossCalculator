const G = 32.174; // gravitational acceleration, ft/s^2

/**
 * Computes velocity (ft/s) = Q / A.
 */
export function calcVelocity(discharge: number, area: number): number {
  if (area <= 0) return 0;
  return discharge / area;
}

/**
 * Computes velocity head (ft) = alpha * V^2 / (2g).
 * alpha = velocity distribution coefficient (default 1.0).
 */
export function calcVelocityHead(
  velocity: number,
  alpha: number = 1.0
): number {
  return (alpha * velocity * velocity) / (2 * G);
}

/**
 * Computes Froude number = V / sqrt(g * D).
 * D = A / T (hydraulic depth).
 */
export function calcFroudeNumber(
  velocity: number,
  area: number,
  topWidth: number
): number {
  if (topWidth <= 0 || area <= 0) return 0;
  const d = area / topWidth;
  return velocity / Math.sqrt(G * d);
}

/**
 * Computes friction slope Sf = (Q / K)^2.
 * K = conveyance.
 */
export function calcFrictionSlope(
  discharge: number,
  conveyance: number
): number {
  if (conveyance <= 0) return 0;
  const ratio = discharge / conveyance;
  return ratio * ratio;
}

/**
 * Computes friction loss (ft) using average friction slope.
 * hf = L * (Sf1 + Sf2) / 2.
 */
export function calcFrictionLoss(
  reachLength: number,
  sf1: number,
  sf2: number
): number {
  return reachLength * (sf1 + sf2) / 2;
}
