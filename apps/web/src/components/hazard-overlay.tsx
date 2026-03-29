// src/components/hazard-overlay.tsx
import type { CrossSectionPoint } from '@flowsuite/engine/types';
import { clipSegmentToWsel } from '@flowsuite/engine/geometry';

export type HazardLevel = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

export interface HazardZone {
  stationStart: number;
  stationEnd: number;
  depth: number;
  velocity: number;
  dv: number;
  level: HazardLevel;
}

export const HAZARD_COLORS: Record<HazardLevel, string> = {
  H1: '#22c55e',
  H2: '#eab308',
  H3: '#f97316',
  H4: '#ef4444',
  H5: '#991b1b',
};

export const HAZARD_LABELS: Record<HazardLevel, string> = {
  H1: 'Generally Safe',
  H2: 'Unsafe — Small Vehicles',
  H3: 'Unsafe — Vehicles & Vulnerable',
  H4: 'Unsafe — All People & Vehicles',
  H5: 'Extreme Danger',
};

function classifyHazard(depth: number, velocity: number): HazardLevel {
  const dv = depth * velocity;
  if (dv < 2.0) return 'H1';
  if (dv < 4.0) return 'H2';
  if (dv < 8.0) return 'H3';
  if (dv < 20.0) return 'H4';
  return 'H5';
}

export function computeHazardZones(
  crossSection: CrossSectionPoint[],
  wsel: number,
  avgVelocity: number,
): HazardZone[] {
  const zones: HazardZone[] = [];

  for (let i = 0; i < crossSection.length - 1; i++) {
    const clip = clipSegmentToWsel(
      crossSection[i].station,
      crossSection[i].elevation,
      crossSection[i + 1].station,
      crossSection[i + 1].elevation,
      wsel,
    );
    if (!clip) continue;

    const midElev = (clip.cz1 + clip.cz2) / 2;
    const depth = Math.max(0, wsel - midElev);
    if (depth <= 0) continue;

    const dv = depth * avgVelocity;
    const level = classifyHazard(depth, avgVelocity);

    zones.push({
      stationStart: clip.cx1,
      stationEnd: clip.cx2,
      depth,
      velocity: avgVelocity,
      dv,
      level,
    });
  }

  return zones;
}
