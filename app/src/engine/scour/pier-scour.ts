import type { Pier, PierScourResult } from '@/engine/types';

/** K1: Pier nose shape factor */
export function pierShapeFactor(shape: Pier['shape']): number {
  switch (shape) {
    case 'square': return 1.1;
    case 'round-nose': return 1.0;
    case 'cylindrical': return 1.0;
    case 'sharp': return 0.9;
    default: return 1.0;
  }
}

/** K2: Flow angle correction factor
 * theta in degrees, L = pier length along flow, a = pier width */
export function flowAngleFactor(skewAngleDeg: number, pierLength: number, pierWidth: number): number {
  if (skewAngleDeg === 0) return 1.0;
  const theta = (skewAngleDeg * Math.PI) / 180;
  const La = pierLength > 0 ? pierLength / pierWidth : 1;
  return Math.pow(Math.cos(theta) + La * Math.sin(theta), 0.65);
}

/** K3: Bed condition factor */
export function bedConditionFactor(isLiveBed: boolean): number {
  // For clear-water scour: 1.1
  // For live-bed (plane bed): 1.1
  // Other bed forms would vary, but we use 1.1 as default
  return 1.1;
}

/** CSU/HEC-18: ys = 2.0 * K1 * K2 * K3 * a^0.65 * y1^0.35 * Fr1^0.43
 * All inputs in imperial (ft)
 * y1 = approach flow depth (ft)
 * Fr1 = approach Froude number
 * a = pier width (ft)
 */
export function calculatePierScour(
  pier: Pier,
  pierIndex: number,
  y1: number,
  Fr1: number,
  skewAngleDeg: number,
  bedElevation: number,
  isLiveBed: boolean,
): PierScourResult {
  const k1 = pierShapeFactor(pier.shape);
  const k2 = flowAngleFactor(skewAngleDeg, pier.width * 4, pier.width); // assume L/a ~ 4
  const k3 = bedConditionFactor(isLiveBed);
  const a = pier.width;

  const ys = 2.0 * k1 * k2 * k3 * Math.pow(a, 0.65) * Math.pow(y1, 0.35) * Math.pow(Fr1, 0.43);

  return {
    pierIndex,
    station: pier.station,
    width: pier.width,
    k1,
    k2,
    k3,
    scourDepth: ys,
    criticalBedElevation: bedElevation - ys,
  };
}
