import { CrossSectionPoint } from './types';

interface ClipResult {
  cx1: number;
  cz1: number;
  cx2: number;
  cz2: number;
}

/**
 * Clips a ground segment to the portion at or below WSEL.
 * Returns null if the entire segment is above WSEL.
 */
export function clipSegmentToWsel(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  wsel: number
): ClipResult | null {
  // Both above — no wetted portion
  if (z1 >= wsel && z2 >= wsel) return null;

  // Both at or below — entire segment is wetted
  if (z1 <= wsel && z2 <= wsel) {
    return { cx1: x1, cz1: z1, cx2: x2, cz2: z2 };
  }

  // Partial submersion — find intersection
  const t = (wsel - z1) / (z2 - z1);
  const xIntersect = x1 + t * (x2 - x1);

  if (z1 <= wsel) {
    // Left is wet, right is dry
    return { cx1: x1, cz1: z1, cx2: xIntersect, cz2: wsel };
  } else {
    // Left is dry, right is wet
    return { cx1: xIntersect, cz1: wsel, cx2: x2, cz2: z2 };
  }
}

/**
 * Computes cross-sectional flow area (sq ft) below WSEL using trapezoidal integration.
 */
export function calcFlowArea(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  let area = 0;
  for (let i = 0; i < crossSection.length - 1; i++) {
    const clip = clipSegmentToWsel(
      crossSection[i].station,
      crossSection[i].elevation,
      crossSection[i + 1].station,
      crossSection[i + 1].elevation,
      wsel
    );
    if (clip) {
      const d1 = Math.max(0, wsel - clip.cz1);
      const d2 = Math.max(0, wsel - clip.cz2);
      const segWidth = clip.cx2 - clip.cx1;
      area += ((d1 + d2) / 2) * segWidth;
    }
  }
  return area;
}

/**
 * Computes wetted perimeter (ft) — sum of ground segment slope-distances below WSEL.
 */
export function calcWettedPerimeter(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  let perim = 0;
  for (let i = 0; i < crossSection.length - 1; i++) {
    const clip = clipSegmentToWsel(
      crossSection[i].station,
      crossSection[i].elevation,
      crossSection[i + 1].station,
      crossSection[i + 1].elevation,
      wsel
    );
    if (clip) {
      const dx = clip.cx2 - clip.cx1;
      const dz = clip.cz2 - clip.cz1;
      perim += Math.sqrt(dx * dx + dz * dz);
    }
  }
  return perim;
}

/**
 * Computes water surface top width (ft).
 */
export function calcTopWidth(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  let leftStation = Infinity;
  let rightStation = -Infinity;
  let found = false;

  for (let i = 0; i < crossSection.length - 1; i++) {
    const clip = clipSegmentToWsel(
      crossSection[i].station,
      crossSection[i].elevation,
      crossSection[i + 1].station,
      crossSection[i + 1].elevation,
      wsel
    );
    if (clip) {
      found = true;
      if (clip.cx1 < leftStation) leftStation = clip.cx1;
      if (clip.cx2 > rightStation) rightStation = clip.cx2;
    }
  }

  return found ? rightStation - leftStation : 0;
}

/**
 * Computes hydraulic radius (ft) = Area / Wetted Perimeter.
 */
export function calcHydraulicRadius(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  const a = calcFlowArea(crossSection, wsel);
  const p = calcWettedPerimeter(crossSection, wsel);
  return p > 0 ? a / p : 0;
}

/**
 * Finds the indices of the left and right bank stations in the cross-section.
 * Returns [leftIdx, rightIdx]. If not found, defaults to [0, length-1].
 */
function findBankIndices(crossSection: CrossSectionPoint[]): [number, number] {
  let leftIdx = 0;
  let rightIdx = crossSection.length - 1;
  for (let i = 0; i < crossSection.length; i++) {
    if (crossSection[i].bankStation === 'left') leftIdx = i;
    if (crossSection[i].bankStation === 'right') rightIdx = i;
  }
  return [leftIdx, rightIdx];
}

/**
 * Computes subsection area, perimeter, and length-weighted average n.
 */
function calcSubsectionProperties(
  points: CrossSectionPoint[],
  wsel: number
): { area: number; perim: number; avgN: number } | null {
  if (points.length < 2) return null;

  let area = 0;
  let perim = 0;
  let totalWtN = 0;
  let totalWtLen = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const clip = clipSegmentToWsel(
      points[i].station,
      points[i].elevation,
      points[i + 1].station,
      points[i + 1].elevation,
      wsel
    );
    if (clip) {
      const d1 = Math.max(0, wsel - clip.cz1);
      const d2 = Math.max(0, wsel - clip.cz2);
      const segWidth = clip.cx2 - clip.cx1;
      area += ((d1 + d2) / 2) * segWidth;

      const dx = clip.cx2 - clip.cx1;
      const dz = clip.cz2 - clip.cz1;
      const segLen = Math.sqrt(dx * dx + dz * dz);
      perim += segLen;

      totalWtN += points[i].manningsN * segLen;
      totalWtLen += segLen;
    }
  }

  if (perim <= 0 || area <= 0 || totalWtLen <= 0) return null;

  return { area, perim, avgN: totalWtN / totalWtLen };
}

/**
 * Computes total conveyance K (cfs) using Manning's equation.
 * Splits cross-section into LOB, channel, ROB subsections by bank stations.
 * K = (1.486/n) * A * R^(2/3) per subsection, summed.
 */
export function calcConveyance(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  const [leftIdx, rightIdx] = findBankIndices(crossSection);

  const subsections = [
    crossSection.slice(0, leftIdx + 1),       // LOB
    crossSection.slice(leftIdx, rightIdx + 1), // Channel
    crossSection.slice(rightIdx),              // ROB
  ];

  let totalK = 0;

  for (const sub of subsections) {
    const props = calcSubsectionProperties(sub, wsel);
    if (!props) continue;

    const r = props.area / props.perim;
    const k = (1.486 / props.avgN) * props.area * Math.pow(r, 2 / 3);
    totalK += k;
  }

  return totalK;
}
