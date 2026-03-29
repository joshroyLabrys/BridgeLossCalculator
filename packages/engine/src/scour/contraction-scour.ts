import type { ContractionScourResult } from '../types';

/** Critical velocity: Vc = 6.19 * y1^(1/6) * D50^(1/3)
 * y1 in ft, D50 in ft, Vc in ft/s */
export function criticalVelocity(y1: number, d50ft: number): number {
  return 6.19 * Math.pow(y1, 1 / 6) * Math.pow(d50ft, 1 / 3);
}

/** Live-bed contraction scour
 * y2/y1 = (Q2/Q1)^(6/7) * (W1/W2)^k1
 * k1 = 0.59 (most cases), 0.64, or 0.69 depending on V* / omega
 * Returns scour depth = y2 - y0 */
export function liveBedScour(
  y1: number,
  Q1: number,
  Q2: number,
  W1: number,
  W2: number,
  y0: number,
  k1: number = 0.59,
): ContractionScourResult {
  const y2 = y1 * Math.pow(Q2 / Q1, 6 / 7) * Math.pow(W1 / W2, k1);
  const scourDepth = Math.max(0, y2 - y0);
  return {
    type: 'live-bed',
    criticalVelocity: 0, // not applicable for live-bed
    approachVelocity: 0, // filled by caller
    contractedDepth: y2,
    existingDepth: y0,
    scourDepth,
    criticalBedElevation: 0, // filled by caller
  };
}

/** Clear-water contraction scour
 * y2 = [0.025 * Q^2 / (Dm^(2/3) * W^2)]^(3/7)
 * Q in cfs, Dm in ft, W in ft, y2 in ft */
export function clearWaterScour(
  Q: number,
  Dm: number,
  W: number,
  y0: number,
): ContractionScourResult {
  const y2 = Math.pow((0.025 * Q * Q) / (Math.pow(Dm, 2 / 3) * W * W), 3 / 7);
  const scourDepth = Math.max(0, y2 - y0);
  return {
    type: 'clear-water',
    criticalVelocity: 0,
    approachVelocity: 0,
    contractedDepth: y2,
    existingDepth: y0,
    scourDepth,
    criticalBedElevation: 0,
  };
}

/** Main entry: determines live-bed vs clear-water and calculates */
export function calculateContractionScour(
  approachVelocity: number, // ft/s
  approachDepth: number, // ft
  d50mm: number, // mm
  approachQ: number, // cfs
  contractedQ: number, // cfs
  approachWidth: number, // ft
  contractedWidth: number, // ft
  existingDepth: number, // ft
  bedElevation: number, // ft
): ContractionScourResult {
  const d50ft = d50mm / 304.8; // mm to ft
  const Vc = criticalVelocity(approachDepth, d50ft);
  const isLiveBed = approachVelocity > Vc;

  let result: ContractionScourResult;
  if (isLiveBed) {
    result = liveBedScour(
      approachDepth,
      approachQ,
      contractedQ,
      approachWidth,
      contractedWidth,
      existingDepth,
    );
    result.type = 'live-bed';
  } else {
    const Dm = 1.25 * d50ft; // Dm ~ 1.25 * D50
    result = clearWaterScour(contractedQ, Dm, contractedWidth, existingDepth);
    result.type = 'clear-water';
  }

  result.criticalVelocity = Vc;
  result.approachVelocity = approachVelocity;
  result.criticalBedElevation = bedElevation - result.scourDepth;
  return result;
}
