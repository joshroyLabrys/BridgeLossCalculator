import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  MethodResult,
  CalculationStep,
} from '../types';
import {
  calcFlowArea,
  calcTopWidth,
  calcConveyance,
  calcHydraulicRadius,
  calcAlpha,
} from '../geometry';
import { interpolateLowChord, calcNetBridgeArea, calcPierBlockage } from '../bridge-geometry';
import {
  calcVelocity,
  calcVelocityHead,
  calcFroudeNumber,
} from '../hydraulics';
import { detectFlowRegime } from '../flow-regime';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from '../tuflow-flc';
import { runPressureFlow } from '../pressure-flow';
import { runOvertoppingFlow } from '../overtopping-flow';

/**
 * Look up base backwater coefficient Cb from bridge opening ratio M.
 * Based on FHWA WSPRO method Table 5-1 (simplified interpolation).
 */
function lookupCb(M: number): number {
  // Approximate relationship: Cb increases as M decreases (more constriction)
  // From WSPRO documentation:
  const table: [number, number][] = [
    [0.10, 3.10],
    [0.20, 1.40],
    [0.30, 0.73],
    [0.40, 0.39],
    [0.50, 0.20],
    [0.60, 0.10],
    [0.70, 0.04],
    [0.80, 0.01],
    [0.90, 0.00],
    [1.00, 0.00],
  ];

  if (M <= table[0][0]) return table[0][1];
  if (M >= table[table.length - 1][0]) return table[table.length - 1][1];

  for (let i = 0; i < table.length - 1; i++) {
    if (M >= table[i][0] && M <= table[i + 1][0]) {
      const t = (M - table[i][0]) / (table[i + 1][0] - table[i][0]);
      return table[i][1] + t * (table[i + 1][1] - table[i][1]);
    }
  }
  return 0;
}

/**
 * WSPRO method: FHWA bridge waterways analysis.
 * Δh = C × α₁ × (V₁²/2g)
 */
export function runWSPRO(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const Q = profile.discharge;
  const dsWsel = profile.dsWsel;

  // Flow regime
  const midStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, midStation);
  const regime = detectFlowRegime(dsWsel, lowChord, bridge.highChord);

  if (regime === 'pressure') {
    return runPressureFlow(crossSection, bridge, profile, coefficients);
  }
  if (regime === 'overtopping') {
    return runOvertoppingFlow(crossSection, bridge, profile, coefficients);
  }

  // Compute alpha
  const alpha = coefficients.alphaOverride ?? calcAlpha(crossSection, dsWsel);

  // Step 1: Total section conveyance
  const K_total = calcConveyance(crossSection, dsWsel);

  // Step 2: Bridge opening conveyance (conveyance of subsection within abutments)
  // Clip cross-section to abutment bounds and compute conveyance
  const bridgePoints = crossSection.filter(
    p => p.station >= bridge.leftAbutmentStation && p.station <= bridge.rightAbutmentStation
  );

  // Add interpolated boundary points if needed
  const clippedPoints: CrossSectionPoint[] = [];

  // Left boundary
  const leftElev = interpolateElevation(crossSection, bridge.leftAbutmentStation);
  clippedPoints.push({
    station: bridge.leftAbutmentStation,
    elevation: leftElev,
    manningsN: crossSection[0].manningsN,
    bankStation: 'left',
  });

  for (const p of bridgePoints) {
    if (p.station > bridge.leftAbutmentStation && p.station < bridge.rightAbutmentStation) {
      clippedPoints.push({ ...p, bankStation: null });
    }
  }

  // Right boundary
  const rightElev = interpolateElevation(crossSection, bridge.rightAbutmentStation);
  clippedPoints.push({
    station: bridge.rightAbutmentStation,
    elevation: rightElev,
    manningsN: crossSection[crossSection.length - 1].manningsN,
    bankStation: 'right',
  });

  const K_bridge = calcConveyance(clippedPoints, dsWsel);

  // Step 3: Bridge opening ratio M (clamped to [0,1])
  // M can exceed 1 when bridge subsection is hydraulically more efficient than
  // the full cross-section (e.g., avoids shallow overbank areas). Clamp to 1.
  const M = K_total > 0 ? Math.min(1, K_bridge / K_total) : 0;

  steps.push({
    stepNumber: 1,
    description: 'Bridge opening ratio M (conveyance ratio)',
    formula: 'M = min(1, K_bridge / K_total)',
    intermediateValues: { K_total, K_bridge },
    result: M,
    unit: '',
  });

  // Step 4: Base coefficient Cb
  const Cb = lookupCb(M);

  steps.push({
    stepNumber: 2,
    description: 'Base backwater coefficient Cb from M',
    formula: 'Cb = f(M) from WSPRO Table 5-1',
    intermediateValues: { M },
    result: Cb,
    unit: '',
  });

  // Step 5: Froude number correction
  const dsArea = calcFlowArea(crossSection, dsWsel);
  const dsTopWidth = calcTopWidth(crossSection, dsWsel);
  const dsVelocity = calcVelocity(Q, dsArea);
  const Fr = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);

  // Froude correction factor (approximate): increases for higher Froude
  const froudeCorrection = 1.0 + 0.5 * Fr * Fr;

  steps.push({
    stepNumber: 3,
    description: 'Froude number correction',
    formula: 'K_Fr = 1 + 0.5·Fr²',
    intermediateValues: { Fr },
    result: froudeCorrection,
    unit: '',
  });

  // Step 6: Eccentricity correction
  // e = (Q_left - Q_right) / Q_total, measured relative to bridge centerline
  // Compute conveyance split to estimate flow distribution
  const leftConveyance = calcConveyance(
    crossSection.filter(p => p.station <= midStation),
    dsWsel
  );
  const rightConveyance = calcConveyance(
    crossSection.filter(p => p.station >= midStation),
    dsWsel
  );
  const totalConveyance = leftConveyance + rightConveyance;
  const eccentricity = totalConveyance > 0
    ? Math.abs(leftConveyance - rightConveyance) / totalConveyance
    : 0;
  // Eccentricity correction: K_e = 1 + e (linear approximation from WSPRO manual)
  const eccentricityCorrection = 1.0 + eccentricity;

  steps.push({
    stepNumber: 4,
    description: 'Eccentricity correction',
    formula: 'e = |K_left - K_right| / K_total, K_e = 1 + e',
    intermediateValues: { K_left: leftConveyance, K_right: rightConveyance, e: eccentricity },
    result: eccentricityCorrection,
    unit: '',
  });

  // Step 7: Compute backwater
  const dsVh = calcVelocityHead(dsVelocity, alpha);
  const C = Cb * froudeCorrection * eccentricityCorrection;
  const dh = C * alpha * dsVh;

  steps.push({
    stepNumber: 5,
    description: 'Backwater computation',
    formula: 'Δh = C × α₁ × (V₁²/2g)',
    intermediateValues: { C, alpha, 'V²/2g': dsVh },
    result: dh,
    unit: 'ft',
  });

  // Upstream WSEL
  const usWsel = dsWsel + dh;

  steps.push({
    stepNumber: 6,
    description: 'Upstream water surface elevation',
    formula: 'US WSEL = DS WSEL + Δh',
    intermediateValues: { dsWsel, dh },
    result: usWsel,
    unit: 'ft',
  });

  // Regime re-evaluation: if backwater pushes WSEL above low chord,
  // fall back to pressure/overtopping solver.
  if (usWsel > lowChord) {
    const postRegime = detectFlowRegime(usWsel, lowChord, bridge.highChord);
    if (postRegime === 'pressure') {
      return runPressureFlow(crossSection, bridge, profile, coefficients);
    }
    if (postRegime === 'overtopping') {
      return runOvertoppingFlow(crossSection, bridge, profile, coefficients);
    }
  }

  // Upstream properties
  const usArea = calcFlowArea(crossSection, usWsel);
  const usTopWidth = calcTopWidth(crossSection, usWsel);
  const usVelocity = calcVelocity(Q, usArea);
  const froudeUs = calcFroudeNumber(usVelocity, usArea, usTopWidth);

  const bridgeArea = calcFlowArea(clippedPoints, dsWsel);
  const bridgeVelocity = calcVelocity(Q, bridgeArea);

  const pierBlockage = calcPierBlockage(bridge.piers, crossSection, dsWsel);

  return {
    profileName: profile.name,
    upstreamWsel: usWsel,
    totalHeadLoss: dh,
    approachVelocity: usVelocity,
    bridgeVelocity,
    froudeApproach: froudeUs,
    froudeBridge: Fr,
    flowRegime: regime,
    flowCalculationType: 'free-surface',
    iterationLog: [],
    converged: true,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(dh, usVelocity),
    tuflowSuperFLC: calcTuflowSuperFLC(0, usVelocity, regime),
    inputEcho: {
      flowArea: dsArea,
      hydraulicRadius: calcHydraulicRadius(crossSection, dsWsel),
      bridgeOpeningArea: calcNetBridgeArea(bridge, crossSection, dsWsel, coefficients.debrisBlockagePct),
      pierBlockage,
    },
    error: null,
  };
}

function interpolateElevation(crossSection: CrossSectionPoint[], station: number): number {
  if (station <= crossSection[0].station) return crossSection[0].elevation;
  if (station >= crossSection[crossSection.length - 1].station)
    return crossSection[crossSection.length - 1].elevation;

  for (let i = 0; i < crossSection.length - 1; i++) {
    if (station >= crossSection[i].station && station <= crossSection[i + 1].station) {
      const t = (station - crossSection[i].station) /
        (crossSection[i + 1].station - crossSection[i].station);
      return crossSection[i].elevation + t * (crossSection[i + 1].elevation - crossSection[i].elevation);
    }
  }
  return crossSection[crossSection.length - 1].elevation;
}
