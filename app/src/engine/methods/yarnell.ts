import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  MethodResult,
  CalculationStep,
} from '../types';
import { calcFlowArea, calcTopWidth, calcHydraulicRadius } from '../geometry';
import { calcPierBlockage, calcNetBridgeArea } from '../bridge-geometry';
import { calcVelocity, calcVelocityHead, calcFroudeNumber } from '../hydraulics';
import { detectFlowRegime } from '../flow-regime';
import { interpolateLowChord } from '../bridge-geometry';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from '../tuflow-flc';
import { YARNELL_K } from '@/lib/constants';

function getYarnellK(bridge: BridgeGeometry, coefficients: Coefficients): number {
  if (coefficients.yarnellK !== null) return coefficients.yarnellK;
  // Use the first pier's shape (all piers assumed same shape for Yarnell)
  if (bridge.piers.length === 0) return 0;
  return YARNELL_K[bridge.piers[0].shape] ?? 1.0;
}

export function runYarnell(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const dsWsel = profile.dsWsel;

  // Detect flow regime at downstream
  const midStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, midStation);
  const regime = detectFlowRegime(dsWsel, lowChord, bridge.highChord);

  // Yarnell only applies to free-surface flow
  if (regime !== 'free-surface') {
    return {
      profileName: profile.name,
      upstreamWsel: dsWsel,
      totalHeadLoss: 0,
      approachVelocity: 0,
      bridgeVelocity: 0,
      froudeApproach: 0,
      froudeBridge: 0,
      flowRegime: regime,
      iterationLog: [],
      converged: true,
      calculationSteps: [],
      tuflowPierFLC: 0,
      tuflowSuperFLC: null,
      inputEcho: {
        flowArea: 0,
        hydraulicRadius: 0,
        bridgeOpeningArea: 0,
        pierBlockage: 0,
      },
      error: `Not Applicable: Yarnell method only applies to free-surface flow (detected: ${regime})`,
    };
  }

  // Step 1: Downstream hydraulic properties
  const dsArea = calcFlowArea(crossSection, dsWsel);
  const dsTopWidth = calcTopWidth(crossSection, dsWsel);
  const dsVelocity = calcVelocity(profile.discharge, dsArea);
  const dsVh = calcVelocityHead(dsVelocity);

  steps.push({
    stepNumber: 1,
    description: 'Downstream hydraulic properties',
    formula: 'A = flow area, V = Q/A',
    intermediateValues: { A: dsArea, V: dsVelocity, 'V²/2g': dsVh },
    result: dsVelocity,
    unit: 'ft/s',
  });

  // Step 2: Pier obstruction ratio
  const pierBlockage = calcPierBlockage(bridge.piers, crossSection, dsWsel);
  const alpha = pierBlockage / dsArea;

  steps.push({
    stepNumber: 2,
    description: 'Pier obstruction ratio',
    formula: 'α = pier blockage area / total flow area',
    intermediateValues: { pierBlockage, totalArea: dsArea },
    result: alpha,
    unit: '',
  });

  // Step 3: Get K coefficient
  const K = getYarnellK(bridge, coefficients);

  steps.push({
    stepNumber: 3,
    description: 'Yarnell pier shape coefficient',
    formula: 'K from pier shape lookup or manual override',
    intermediateValues: {},
    result: K,
    unit: '',
  });

  // Step 4: Apply Yarnell equation
  // Δy = K * (K + 5 - 0.6) * (α + 15α⁴) * (V²/2g)
  const dy = K * (K + 5 - 0.6) * (alpha + 15 * Math.pow(alpha, 4)) * dsVh;

  steps.push({
    stepNumber: 4,
    description: 'Yarnell backwater equation',
    formula: 'Δy = K × (K + 5 - 0.6) × (α + 15α⁴) × (V²/2g)',
    intermediateValues: {
      K,
      'K+5-0.6': K + 5 - 0.6,
      'α+15α⁴': alpha + 15 * Math.pow(alpha, 4),
      'V²/2g': dsVh,
    },
    result: dy,
    unit: 'ft',
  });

  // Step 5: Upstream WSEL
  const usWsel = dsWsel + dy;

  steps.push({
    stepNumber: 5,
    description: 'Upstream water surface elevation',
    formula: 'US WSEL = DS WSEL + Δy',
    intermediateValues: { dsWsel, dy },
    result: usWsel,
    unit: 'ft',
  });

  // Compute upstream properties for reporting
  const usArea = calcFlowArea(crossSection, usWsel);
  const usTopWidth = calcTopWidth(crossSection, usWsel);
  const usVelocity = calcVelocity(profile.discharge, usArea);
  const froudeDs = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);
  const froudeUs = calcFroudeNumber(usVelocity, usArea, usTopWidth);

  return {
    profileName: profile.name,
    upstreamWsel: usWsel,
    totalHeadLoss: dy,
    approachVelocity: usVelocity,
    bridgeVelocity: dsVelocity,
    froudeApproach: froudeUs,
    froudeBridge: froudeDs,
    flowRegime: regime,
    iterationLog: [],
    converged: true,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(dy, usVelocity),
    tuflowSuperFLC: null,
    inputEcho: {
      flowArea: dsArea,
      hydraulicRadius: calcHydraulicRadius(crossSection, dsWsel),
      bridgeOpeningArea: calcNetBridgeArea(bridge, crossSection, dsWsel),
      pierBlockage,
    },
    error: null,
  };
}
