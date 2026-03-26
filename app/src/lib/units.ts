export type UnitSystem = 'imperial' | 'metric';
export type UnitType = 'length' | 'area' | 'velocity' | 'discharge' | 'slope' | 'manningsN' | 'angle';

// Conversion factors: multiply Imperial value by factor to get Metric
const TO_METRIC: Record<UnitType, number> = {
  length: 0.3048,
  area: 0.09290304,
  velocity: 0.3048,
  discharge: 0.028316846592,
  slope: 1,
  manningsN: 1,
  angle: 1,
};

const LABELS: Record<UnitType, { imperial: string; metric: string }> = {
  length: { imperial: 'ft', metric: 'm' },
  area: { imperial: 'ft\u00B2', metric: 'm\u00B2' },
  velocity: { imperial: 'ft/s', metric: 'm/s' },
  discharge: { imperial: 'cfs', metric: 'm\u00B3/s' },
  slope: { imperial: 'ft/ft', metric: 'm/m' },
  manningsN: { imperial: '', metric: '' },
  angle: { imperial: 'degrees', metric: 'degrees' },
};

/**
 * Convert a display value (in the active unit system) to Imperial for storage.
 * metric -> imperial: divide by TO_METRIC factor
 */
export function toImperial(value: number, unitType: UnitType, system: UnitSystem): number {
  if (system === 'imperial') return value;
  const factor = TO_METRIC[unitType];
  return factor === 1 ? value : value / factor;
}

/**
 * Convert an Imperial value (from store/engine) to the active display system.
 * imperial -> metric: multiply by TO_METRIC factor
 */
export function toDisplay(value: number, unitType: UnitType, system: UnitSystem): number {
  if (system === 'imperial') return value;
  const factor = TO_METRIC[unitType];
  return factor === 1 ? value : value * factor;
}

/**
 * Get the label string for a unit type in the active system.
 */
export function unitLabel(unitType: UnitType, system: UnitSystem): string {
  return LABELS[unitType][system];
}
