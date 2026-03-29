/** Yarnell pier shape coefficients */
export const YARNELL_K: Record<string, number> = {
  'square': 1.25,
  'round-nose': 0.9,
  'cylindrical': 1.0,
  'sharp': 0.7,
};

/** Default coefficient values */
export const DEFAULTS = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
} as const;

/** Gravitational acceleration (ft/s^2) */
export const G = 32.174;
