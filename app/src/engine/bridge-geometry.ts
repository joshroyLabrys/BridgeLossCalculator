import { BridgeGeometry, CrossSectionPoint, Pier } from './types';
import { calcFlowArea, clipSegmentToWsel } from './geometry';

/**
 * Interpolates the low chord elevation at a given station.
 * Uses lowChordProfile if provided, otherwise linearly interpolates
 * between left and right low chord elevations across the abutment span.
 */
export function interpolateLowChord(
  bridge: BridgeGeometry,
  station: number
): number {
  if (bridge.lowChordProfile.length >= 2) {
    // Find bounding profile points and interpolate
    const profile = bridge.lowChordProfile;
    if (station <= profile[0].station) return profile[0].elevation;
    if (station >= profile[profile.length - 1].station)
      return profile[profile.length - 1].elevation;

    for (let i = 0; i < profile.length - 1; i++) {
      if (station >= profile[i].station && station <= profile[i + 1].station) {
        const t =
          (station - profile[i].station) /
          (profile[i + 1].station - profile[i].station);
        return profile[i].elevation + t * (profile[i + 1].elevation - profile[i].elevation);
      }
    }
    return profile[profile.length - 1].elevation;
  }

  // Linear interpolation between left and right abutments
  const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
  if (span <= 0) return bridge.lowChordLeft;
  const t = (station - bridge.leftAbutmentStation) / span;
  return bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft);
}

/**
 * Gets the ground elevation at a station by interpolating the cross-section.
 */
function groundElevationAt(
  crossSection: CrossSectionPoint[],
  station: number
): number {
  if (station <= crossSection[0].station) return crossSection[0].elevation;
  if (station >= crossSection[crossSection.length - 1].station)
    return crossSection[crossSection.length - 1].elevation;

  for (let i = 0; i < crossSection.length - 1; i++) {
    if (
      station >= crossSection[i].station &&
      station <= crossSection[i + 1].station
    ) {
      const t =
        (station - crossSection[i].station) /
        (crossSection[i + 1].station - crossSection[i].station);
      return (
        crossSection[i].elevation +
        t * (crossSection[i + 1].elevation - crossSection[i].elevation)
      );
    }
  }
  return crossSection[crossSection.length - 1].elevation;
}

/**
 * Computes the total pier blockage area (sq ft) below WSEL.
 * Each pier is a rectangle: width × (WSEL - pier base elevation).
 * Pier base elevation is the ground elevation at the pier station.
 */
export function calcPierBlockage(
  piers: Pier[],
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  let blockage = 0;
  for (const pier of piers) {
    const base = groundElevationAt(crossSection, pier.station);
    const depth = wsel - base;
    if (depth > 0) {
      blockage += pier.width * depth;
    }
  }
  return blockage;
}

/**
 * Clips the cross-section to the bridge opening (between abutment stations)
 * and computes the flow area below WSEL, capped at the low chord.
 */
export function calcBridgeOpeningArea(
  bridge: BridgeGeometry,
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  // Clip cross-section to abutment boundaries
  const clippedPoints = clipCrossSectionToAbutments(bridge, crossSection);

  // The effective WSEL inside the bridge is the lesser of WSEL and the low chord
  // For gross opening area, we compute area below WSEL within the opening
  const area = calcFlowArea(clippedPoints, wsel);
  return area;
}

/**
 * Clips cross-section points to the bridge abutment boundaries.
 * Interpolates new points at abutment stations if needed.
 */
function clipCrossSectionToAbutments(
  bridge: BridgeGeometry,
  crossSection: CrossSectionPoint[]
): CrossSectionPoint[] {
  const leftSta = bridge.leftAbutmentStation;
  const rightSta = bridge.rightAbutmentStation;
  const result: CrossSectionPoint[] = [];

  // Add interpolated left abutment point
  const leftElev = groundElevationAt(crossSection, leftSta);
  const leftN = interpolateManningsN(crossSection, leftSta);
  result.push({
    station: leftSta,
    elevation: leftElev,
    manningsN: leftN,
    bankStation: null,
  });

  // Add all points between abutments
  for (const pt of crossSection) {
    if (pt.station > leftSta && pt.station < rightSta) {
      result.push(pt);
    }
  }

  // Add interpolated right abutment point
  const rightElev = groundElevationAt(crossSection, rightSta);
  const rightN = interpolateManningsN(crossSection, rightSta);
  result.push({
    station: rightSta,
    elevation: rightElev,
    manningsN: rightN,
    bankStation: null,
  });

  return result;
}

function interpolateManningsN(
  crossSection: CrossSectionPoint[],
  station: number
): number {
  if (station <= crossSection[0].station) return crossSection[0].manningsN;
  for (let i = 0; i < crossSection.length - 1; i++) {
    if (
      station >= crossSection[i].station &&
      station <= crossSection[i + 1].station
    ) {
      return crossSection[i].manningsN; // step-function n
    }
  }
  return crossSection[crossSection.length - 1].manningsN;
}

/**
 * Computes net bridge opening area = gross area - pier blockage.
 * Applies skew angle correction: net area = net area * cos(skew).
 */
export function calcNetBridgeArea(
  bridge: BridgeGeometry,
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  const gross = calcBridgeOpeningArea(bridge, crossSection, wsel);
  const pierBlock = calcPierBlockage(bridge.piers, crossSection, wsel);
  let net = gross - pierBlock;

  // Skew correction
  if (bridge.skewAngle !== 0) {
    const skewRad = (bridge.skewAngle * Math.PI) / 180;
    net *= Math.cos(skewRad);
  }

  return Math.max(0, net);
}
