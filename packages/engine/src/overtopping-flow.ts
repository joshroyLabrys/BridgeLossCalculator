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
import { calcEffectiveWeirLength } from './deck-profile';
import { solve } from './iteration';
import { G } from './constants';

/**
 * Combined orifice + weir solver for overtopping flow regime.
 * Q_total = Q_orifice + Q_weir
 * Orifice: Q = Cd × A_net × √(2g × ΔH)
 * Weir: Q = Cw × L_weir × H^1.5
 */
export function runOvertoppingFlow(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const Q = profile.discharge;
  const dsWsel = profile.dsWsel;
  const Cd = bridge.orificeCd;
  const Cw = bridge.weirCw;

  const midStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, midStation);
  const highChord = bridge.highChord;
  const weirLength = calcEffectiveWeirLength(bridge.deckWidth, bridge.skewAngle);

  const netArea = calcNetBridgeArea(bridge, crossSection, lowChord, coefficients.debrisBlockagePct);

  steps.push({
    stepNumber: 1,
    description: 'Bridge opening and weir parameters',
    formula: 'A_net at low chord, L_weir adjusted for skew',
    intermediateValues: { A_net: netArea, Cd, Cw, L_weir: weirLength, highChord },
    result: netArea,
    unit: 'ft²',
  });

  const solverResult = solve({
    lowerBound: dsWsel,
    upperBound: dsWsel + 20,
    objectiveFn: (trialWsel) => {
      const deltaH_orifice = trialWsel - lowChord;
      const qOrifice = deltaH_orifice > 0
        ? Cd * netArea * Math.sqrt(2 * G * deltaH_orifice)
        : 0;

      const H_weir = trialWsel - highChord;
      const qWeir = H_weir > 0 && weirLength > 0
        ? Cw * weirLength * Math.pow(H_weir, 1.5)
        : 0;

      const qTotal = qOrifice + qWeir;
      if (qTotal <= 0) return trialWsel + 1;

      const ratio = Q / qTotal;
      const adjustment = Math.pow(ratio, 0.67);
      const deltaFromDs = trialWsel - dsWsel;
      return dsWsel + deltaFromDs * adjustment;
    },
    tolerance: coefficients.tolerance,
    maxIterations: coefficients.maxIterations,
  });

  const usWsel = solverResult.solution;
  const deltaH_orifice = usWsel - lowChord;
  const qOrifice = deltaH_orifice > 0 ? Cd * netArea * Math.sqrt(2 * G * deltaH_orifice) : 0;
  const H_weir = usWsel - highChord;
  const qWeir = H_weir > 0 && weirLength > 0 ? Cw * weirLength * Math.pow(H_weir, 1.5) : 0;

  steps.push({
    stepNumber: 2,
    description: 'Orifice flow component',
    formula: 'Q_orf = Cd × A_net × √(2g × ΔH)',
    intermediateValues: { deltaH: deltaH_orifice, Cd, A_net: netArea },
    result: qOrifice,
    unit: 'cfs',
  });

  steps.push({
    stepNumber: 3,
    description: 'Weir flow component',
    formula: 'Q_weir = Cw × L × H^1.5',
    intermediateValues: { H_weir: Math.max(0, H_weir), Cw, L: weirLength },
    result: qWeir,
    unit: 'cfs',
  });

  steps.push({
    stepNumber: 4,
    description: 'Upstream WSEL from combined orifice + weir',
    formula: 'Q_total = Q_orf + Q_weir, solve for US WSEL',
    intermediateValues: { Q_orifice: qOrifice, Q_weir: qWeir, Q_total: Q },
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
    flowRegime: 'overtopping',
    flowCalculationType: 'orifice+weir',
    iterationLog: solverResult.log,
    converged: solverResult.converged,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(totalLoss, usVelocity),
    // Note: Passes total afflux as superstructure head loss. For a true layered FLC,
    // subtract the free-surface pier-only afflux. This is a conservative estimate.
    tuflowSuperFLC: calcTuflowSuperFLC(totalLoss, usVelocity, 'overtopping'),
    inputEcho: {
      flowArea: dsArea,
      hydraulicRadius: calcHydraulicRadius(crossSection, dsWsel),
      bridgeOpeningArea: netArea,
      pierBlockage,
    },
    error: solverResult.converged ? null : 'Max iterations reached without convergence',
  };
}
