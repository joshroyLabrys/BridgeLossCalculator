/**
 * Computes effective weir length for overtopping calculations.
 * Adjusts deck width for bridge skew angle.
 */
export function calcEffectiveWeirLength(
  deckWidth: number,
  skewAngle: number
): number {
  if (deckWidth <= 0) return 0;
  if (skewAngle === 0) return deckWidth;
  const skewRad = (skewAngle * Math.PI) / 180;
  return deckWidth * Math.cos(skewRad);
}
