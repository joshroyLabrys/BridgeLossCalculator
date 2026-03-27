// src/engine/simulation-profile.ts
import type {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  MethodResult,
  FlowRegime,
} from './types';
import { calcFlowArea, calcTopWidth } from './geometry';
import { calcVelocity } from './hydraulics';

export interface ProfileZone {
  stationStart: number;
  stationEnd: number;
  bedElevation: number;
  wsel: number;
  velocity: number;
  depth: number;
}

export interface HydraulicProfile {
  approach: ProfileZone;
  bridge: {
    stationStart: number;
    stationEnd: number;
    bedElevation: number;
    lowChordLeft: number;
    lowChordRight: number;
    highChord: number;
    deckWidth: number;
    wsel: number;
    velocity: number;
    depth: number;
    piers: { station: number; width: number }[];
  };
  exit: ProfileZone;
  flowRegime: FlowRegime;
  dsWsel: number;
  usWsel: number;
  totalHeadLoss: number;
}

function minBedElevation(
  crossSection: CrossSectionPoint[],
  staStart: number,
  staEnd: number,
): number {
  let minElev = Infinity;
  for (const pt of crossSection) {
    if (pt.station >= staStart && pt.station <= staEnd) {
      if (pt.elevation < minElev) minElev = pt.elevation;
    }
  }
  return minElev === Infinity ? crossSection[0]?.elevation ?? 0 : minElev;
}

export function buildHydraulicProfile(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  result: MethodResult,
): HydraulicProfile {
  const firstSta = crossSection[0].station;
  const lastSta = crossSection[crossSection.length - 1].station;

  const approachBed = minBedElevation(crossSection, firstSta, bridge.leftAbutmentStation);
  const approachArea = calcFlowArea(crossSection, result.upstreamWsel);
  const approachTw = calcTopWidth(crossSection, result.upstreamWsel);
  const approachDepth = approachTw > 0 ? approachArea / approachTw : 0;

  const bridgeBed = minBedElevation(crossSection, bridge.leftAbutmentStation, bridge.rightAbutmentStation);

  const exitBed = minBedElevation(crossSection, bridge.rightAbutmentStation, lastSta);
  const exitArea = calcFlowArea(crossSection, profile.dsWsel);
  const exitTw = calcTopWidth(crossSection, profile.dsWsel);
  const exitDepth = exitTw > 0 ? exitArea / exitTw : 0;

  return {
    approach: {
      stationStart: firstSta,
      stationEnd: bridge.leftAbutmentStation,
      bedElevation: approachBed,
      wsel: result.upstreamWsel,
      velocity: result.approachVelocity,
      depth: approachDepth,
    },
    bridge: {
      stationStart: bridge.leftAbutmentStation,
      stationEnd: bridge.rightAbutmentStation,
      bedElevation: bridgeBed,
      lowChordLeft: bridge.lowChordLeft,
      lowChordRight: bridge.lowChordRight,
      highChord: bridge.highChord,
      deckWidth: bridge.deckWidth,
      wsel: result.upstreamWsel,
      velocity: result.bridgeVelocity,
      depth: result.upstreamWsel - bridgeBed,
      piers: bridge.piers.map(p => ({ station: p.station, width: p.width })),
    },
    exit: {
      stationStart: bridge.rightAbutmentStation,
      stationEnd: lastSta,
      bedElevation: exitBed,
      wsel: profile.dsWsel,
      velocity: calcVelocity(profile.discharge, exitArea),
      depth: exitDepth,
    },
    flowRegime: result.flowRegime,
    dsWsel: profile.dsWsel,
    usWsel: result.upstreamWsel,
    totalHeadLoss: result.totalHeadLoss,
  };
}
