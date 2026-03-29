import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  MethodResult,
  CalculationStep,
} from './types';
import { calcFlowArea, calcTopWidth, calcHydraulicRadius } from './geometry';
import { calcNetBridgeArea, calcPierBlockage, interpolateLowChord } from './bridge-geometry';
import { calcVelocity, calcFroudeNumber } from './hydraulics';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from './tuflow-flc';
import { solve } from './iteration';
import { G } from './constants';

/**
 * Orifice flow solver for pressure flow regime.
 * Q = Cd × A_net × √(2g × ΔH)
 * Iterates on upstream WSEL to find where orifice Q matches input Q.
 */
export function runPressureFlow(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const Q = profile.discharge;
  const dsWsel = profile.dsWsel;
  const Cd = bridge.orificeCd;

  const midStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, midStation);

  // Step 1: Net bridge opening area at low chord (fully submerged)
  const netArea = calcNetBridgeArea(bridge, crossSection, lowChord, coefficients.debrisBlockagePct);

  steps.push({
    stepNumber: 1,
    description: 'Net bridge opening area (at low chord, fully submerged)',
    formula: 'A_net = gross area − pier blockage − debris',
    intermediateValues: { lowChord, A_net: netArea, Cd },
    result: netArea,
    unit: 'ft²',
  });

  // Step 2: Solve for upstream WSEL using orifice equation
  const solverResult = solve({
    lowerBound: dsWsel,
    upperBound: dsWsel + 20,
    objectiveFn: (trialWsel) => {
      const deltaH = trialWsel - lowChord;
      if (deltaH <= 0) return trialWsel + 1;
      const qOrifice = Cd * netArea * Math.sqrt(2 * G * deltaH);
      const ratio = Q / qOrifice;
      const deltaH_needed = deltaH * ratio * ratio;
      return lowChord + deltaH_needed;
    },
    tolerance: coefficients.tolerance,
    maxIterations: coefficients.maxIterations,
  });

  const usWsel = solverResult.solution;
  const deltaH = usWsel - lowChord;

  steps.push({
    stepNumber: 2,
    description: 'Orifice equation — upstream WSEL',
    formula: 'Q = Cd × A_net × √(2g × ΔH), solve for ΔH',
    intermediateValues: { Q, Cd, A_net: netArea, deltaH },
    result: usWsel,
    unit: 'ft',
  });

  const totalLoss = usWsel - dsWsel;
  const usArea = calcFlowArea(crossSection, usWsel);
  const usTopWidth = calcTopWidth(crossSection, usWsel);
  const usVelocity = calcVelocity(Q, usArea);
  const froudeUs = calcFroudeNumber(usVelocity, usArea, usTopWidth);

  const dsArea = calcFlowArea(crossSection, dsWsel);
  const dsTopWidth = calcTopWidth(crossSection, dsWsel);
  const dsVelocity = calcVelocity(Q, dsArea);
  const froudeDs = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);

  const bridgeVelocity = calcVelocity(Q, netArea);
  const pierBlockage = calcPierBlockage(bridge.piers, crossSection, dsWsel);

  return {
    profileName: profile.name,
    upstreamWsel: usWsel,
    totalHeadLoss: totalLoss,
    approachVelocity: usVelocity,
    bridgeVelocity,
    froudeApproach: froudeUs,
    froudeBridge: froudeDs,
    flowRegime: 'pressure',
    flowCalculationType: 'orifice',
    iterationLog: solverResult.log,
    converged: solverResult.converged,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(totalLoss, usVelocity),
    // Note: Passes total afflux as superstructure head loss. For a true layered FLC,
    // subtract the free-surface pier-only afflux. This is a conservative estimate.
    tuflowSuperFLC: calcTuflowSuperFLC(totalLoss, usVelocity, 'pressure'),
    inputEcho: {
      flowArea: dsArea,
      hydraulicRadius: calcHydraulicRadius(crossSection, dsWsel),
      bridgeOpeningArea: netArea,
      pierBlockage,
    },
    error: solverResult.converged ? null : 'Max iterations reached without convergence',
  };
}
