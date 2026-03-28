import type { IFDTable } from '@/engine/types';

/** Q = C * I * A / 360 (Q in m³/s, I in mm/hr, A in km²) */
export function rationalMethod(C: number, I: number, A: number): number {
  return (C * I * A) / 360;
}

/** Interpolate intensity from IFD table for given duration (minutes) and AEP string */
export function lookupIntensity(ifdData: IFDTable, durationMin: number, aep: string): number | null {
  const aepIdx = ifdData.aeps.indexOf(aep);
  if (aepIdx === -1) return null;

  // Find bounding durations and interpolate
  const durations = ifdData.durations;
  if (durationMin <= durations[0]) return ifdData.intensities[0][aepIdx];
  if (durationMin >= durations[durations.length - 1]) return ifdData.intensities[durations.length - 1][aepIdx];

  for (let i = 0; i < durations.length - 1; i++) {
    if (durationMin >= durations[i] && durationMin <= durations[i + 1]) {
      const t = (durationMin - durations[i]) / (durations[i + 1] - durations[i]);
      return ifdData.intensities[i][aepIdx] + t * (ifdData.intensities[i + 1][aepIdx] - ifdData.intensities[i][aepIdx]);
    }
  }
  return null;
}

/** Standard AEPs to calculate */
export const STANDARD_AEPS = ['50%', '20%', '10%', '5%', '2%', '1%'];

/** ARR Book 5 runoff coefficient suggestions */
export const LAND_USE_COEFFICIENTS = [
  { label: 'Rural / Forested', range: '0.1-0.4', default: 0.25 },
  { label: 'Suburban / Mixed', range: '0.4-0.7', default: 0.55 },
  { label: 'Urban / Dense', range: '0.7-0.9', default: 0.8 },
] as const;
