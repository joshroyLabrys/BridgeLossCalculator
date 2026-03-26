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
  calcWettedPerimeter,
  calcTopWidth,
  calcConveyance,
  calcHydraulicRadius,
} from '../geometry';
import {
  calcNetBridgeArea,
  calcPierBlockage,
  interpolateLowChord,
} from '../bridge-geometry';
import {
  calcVelocity,
  calcVelocityHead,
  calcFroudeNumber,
  calcFrictionSlope,
  calcFrictionLoss,
} from '../hydraulics';
import { detectFlowRegime } from '../flow-regime';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from '../tuflow-flc';
import { solve } from '../iteration';

/**
 * Energy method: standard step energy equation across 4 cross-sections.
 * WS_us = WS_ds + h_f + h_c + h_e
 */
export function runEnergy(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const Q = profile.discharge;
  const dsWsel = profile.dsWsel;
  const Cc = coefficients.contractionCoeff;
  const Ce = coefficients.expansionCoeff;

  // Step 1: Downstream section properties
  const dsArea = calcFlowArea(crossSection, dsWsel);
  const dsPerim = calcWettedPerimeter(crossSection, dsWsel);
  const dsTopWidth = calcTopWidth(crossSection, dsWsel);
  const dsConveyance = calcConveyance(crossSection, dsWsel);
  const dsVelocity = calcVelocity(Q, dsArea);
  const dsVh = calcVelocityHead(dsVelocity);

  steps.push({
    stepNumber: 1,
    description: `DS hydraulic props @ WSEL ${dsWsel.toFixed(2)} ft`,
    formula: 'A, P, R, V = Q/A, V²/2g',
    intermediateValues: {
      A: dsArea,
      P: dsPerim,
      R: dsPerim > 0 ? dsArea / dsPerim : 0,
      V: dsVelocity,
    },
    result: dsVelocity,
    unit: 'ft/s',
  });

  // Detect flow regime
  const midStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, midStation);
  const regime = detectFlowRegime(dsWsel, lowChord, bridge.highChord);

  // Bridge section properties at DS WSEL
  const bridgeArea = calcNetBridgeArea(bridge, crossSection, dsWsel, coefficients.debrisBlockagePct);
  const bridgeVelocity = calcVelocity(Q, bridgeArea);
  const bridgeVh = calcVelocityHead(bridgeVelocity);

  // Iterate on upstream WSEL
  const dsSf = calcFrictionSlope(Q, dsConveyance);

  const solverResult = solve({
    lowerBound: dsWsel,
    upperBound: dsWsel + 10,
    objectiveFn: (trialWsel) => {
      const usArea = calcFlowArea(crossSection, trialWsel);
      const usConveyance = calcConveyance(crossSection, trialWsel);
      const usVelocity = calcVelocity(Q, usArea);
      const usVh = calcVelocityHead(usVelocity);

      const usSf = calcFrictionSlope(Q, usConveyance);

      // Friction loss across full reach
      const hf = calcFrictionLoss(
        profile.contractionLength + profile.expansionLength,
        dsSf,
        usSf
      );

      // Contraction loss
      const hc = Cc * Math.abs(bridgeVh - dsVh);

      // Expansion loss
      const he = Ce * Math.abs(usVh - bridgeVh);

      return dsWsel + hf + hc + he;
    },
    tolerance: coefficients.tolerance,
    maxIterations: coefficients.maxIterations,
  });

  const usWsel = solverResult.solution;
  const usArea = calcFlowArea(crossSection, usWsel);
  const usTopWidth = calcTopWidth(crossSection, usWsel);
  const usConveyance = calcConveyance(crossSection, usWsel);
  const usVelocity = calcVelocity(Q, usArea);
  const usVh = calcVelocityHead(usVelocity);
  const usSf = calcFrictionSlope(Q, usConveyance);

  const hf = calcFrictionLoss(
    profile.contractionLength + profile.expansionLength,
    dsSf,
    usSf
  );
  const hc = Cc * Math.abs(bridgeVh - dsVh);
  const he = Ce * Math.abs(usVh - bridgeVh);
  const totalLoss = usWsel - dsWsel;

  steps.push({
    stepNumber: 2,
    description: 'Friction loss',
    formula: `h_f = L × (S_f1 + S_f2) / 2`,
    intermediateValues: { L: profile.contractionLength + profile.expansionLength, Sf_ds: dsSf, Sf_us: usSf },
    result: hf,
    unit: 'ft',
  });

  steps.push({
    stepNumber: 3,
    description: 'Contraction loss',
    formula: `h_c = ${Cc} × |Δ(V²/2g)|`,
    intermediateValues: { Cc, bridgeVh, dsVh },
    result: hc,
    unit: 'ft',
  });

  steps.push({
    stepNumber: 4,
    description: 'Expansion loss',
    formula: `h_e = ${Ce} × |Δ(V²/2g)|`,
    intermediateValues: { Ce, usVh, bridgeVh },
    result: he,
    unit: 'ft',
  });

  steps.push({
    stepNumber: 5,
    description: 'Upstream WSEL',
    formula: 'US WSEL = DS WSEL + h_f + h_c + h_e',
    intermediateValues: { dsWsel, hf, hc, he },
    result: usWsel,
    unit: 'ft',
  });

  const froudeDs = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);
  const froudeUs = calcFroudeNumber(usVelocity, usArea, usTopWidth);

  const pierBlockage = calcPierBlockage(bridge.piers, crossSection, dsWsel);

  return {
    profileName: profile.name,
    upstreamWsel: usWsel,
    totalHeadLoss: totalLoss,
    approachVelocity: usVelocity,
    bridgeVelocity: bridgeVelocity,
    froudeApproach: froudeUs,
    froudeBridge: froudeDs,
    flowRegime: regime,
    iterationLog: solverResult.log,
    converged: solverResult.converged,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(totalLoss, usVelocity),
    tuflowSuperFLC: calcTuflowSuperFLC(0, usVelocity, regime),
    inputEcho: {
      flowArea: dsArea,
      hydraulicRadius: calcHydraulicRadius(crossSection, dsWsel),
      bridgeOpeningArea: bridgeArea,
      pierBlockage,
    },
    error: solverResult.converged ? null : 'Max iterations reached without convergence',
  };
}
