/** Bransby-Williams: tc in hours
 * L = stream length (km), A = catchment area (km²), S = equal-area slope (m/km) */
export function bransbyWilliams(streamLength: number, catchmentArea: number, slope: number): number {
  if (catchmentArea <= 0 || slope <= 0 || streamLength <= 0) return 0;
  return 0.0883 * streamLength / (Math.pow(catchmentArea, 0.1) * Math.pow(slope, 0.2));
}

/** Friends equation: tc in hours, A in km² */
export function friends(catchmentArea: number): number {
  if (catchmentArea <= 0) return 0;
  return 0.76 * Math.pow(catchmentArea, 0.38);
}
