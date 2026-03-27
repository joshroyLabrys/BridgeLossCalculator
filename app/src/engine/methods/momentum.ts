import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  MethodResult,
  CalculationStep,
} from '../types';
import { calcFlowArea, calcWettedPerimeter, calcTopWidth, calcHydraulicRadius, calcAlpha } from '../geometry';
import { calcNetBridgeArea, calcPierBlockage, interpolateLowChord } from '../bridge-geometry';
import { calcVelocity, calcVelocityHead, calcFroudeNumber } from '../hydraulics';
import { detectFlowRegime } from '../flow-regime';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from '../tuflow-flc';
import { solve } from '../iteration';
import { G } from '@/lib/constants';
import { runPressureFlow } from '../pressure-flow';
import { runOvertoppingFlow } from '../overtopping-flow';

const WATER_DENSITY = 1.94; // slugs/ft^3 (freshwater)

/**
 * Computes the hydrostatic force on a cross-section at a given WSEL.
 * F = γ * A * y_bar where y_bar = centroid depth below surface.
 * For trapezoidal integration, F = γ * Σ(segment moment about WSEL).
 * Simplified: F ≈ γ * A * (WSEL - z_centroid) where z_centroid ≈ WSEL - A/(2*T)
 * More accurately: F = 0.5 * γ * A * D where D = A/T (mean depth)
 */
function hydrostaticForce(area: number, topWidth: number): number {
  if (topWidth <= 0 || area <= 0) return 0;
  const meanDepth = area / topWidth;
  // F = γ * A * (meanDepth / 2) = 0.5 * γ * A * D
  // Using specific weight γ = ρg = 62.4 lb/ft^3
  const gamma = WATER_DENSITY * G; // 62.4 lb/ft^3
  return 0.5 * gamma * area * meanDepth;
}

/**
 * Momentum method: balance across the bridge opening.
 * ΣF = ΔM (net force = change in momentum flux)
 */
export function runMomentum(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const Q = profile.discharge;
  const dsWsel = profile.dsWsel;

  // Downstream properties
  const dsArea = calcFlowArea(crossSection, dsWsel);
  const dsTopWidth = calcTopWidth(crossSection, dsWsel);
  const dsPerim = calcWettedPerimeter(crossSection, dsWsel);
  const dsVelocity = calcVelocity(Q, dsArea);

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

  steps.push({
    stepNumber: 1,
    description: `DS hydraulic props @ WSEL ${dsWsel.toFixed(2)} ft`,
    formula: 'A, P, V = Q/A',
    intermediateValues: { A: dsArea, P: dsPerim, V: dsVelocity },
    result: dsVelocity,
    unit: 'ft/s',
  });

  // DS hydrostatic force
  const F_ds = hydrostaticForce(dsArea, dsTopWidth);

  // DS momentum flux
  const M_ds = WATER_DENSITY * Q * dsVelocity;

  steps.push({
    stepNumber: 2,
    description: 'DS hydrostatic force and momentum flux',
    formula: 'F = 0.5·γ·A·D, M = ρ·Q·V',
    intermediateValues: { F_ds, M_ds },
    result: F_ds,
    unit: 'lb',
  });

  // Pier drag force (estimated)
  const pierBlockArea = calcPierBlockage(bridge.piers, crossSection, dsWsel);
  const Cd = 1.2; // drag coefficient for bridge piers
  const F_drag = 0.5 * WATER_DENSITY * Cd * pierBlockArea * dsVelocity * dsVelocity;

  steps.push({
    stepNumber: 3,
    description: 'Pier drag force',
    formula: 'F_drag = 0.5·ρ·Cd·A_pier·V²',
    intermediateValues: { Cd, pierBlockArea, V: dsVelocity },
    result: F_drag,
    unit: 'lb',
  });

  // Weight component along slope
  const reachLength = bridge.contractionLength + bridge.expansionLength;
  const W_x = WATER_DENSITY * G * dsArea * reachLength * profile.channelSlope;

  // Friction force
  const tau = WATER_DENSITY * G * (dsArea / dsPerim) * profile.channelSlope;
  const F_friction = tau * dsPerim * reachLength;

  steps.push({
    stepNumber: 4,
    description: 'Weight and friction forces',
    formula: 'W_x = γ·A·L·S, F_f = τ·P·L',
    intermediateValues: { W_x, F_friction },
    result: W_x - F_friction,
    unit: 'lb',
  });

  // Solve for upstream WSEL using momentum balance
  const solverResult = solve({
    lowerBound: dsWsel,
    upperBound: dsWsel + 10,
    objectiveFn: (trialWsel) => {
      const usArea = calcFlowArea(crossSection, trialWsel);
      const usTopWidth = calcTopWidth(crossSection, trialWsel);
      const usVelocity = calcVelocity(Q, usArea);

      const F_us = hydrostaticForce(usArea, usTopWidth);
      const M_us = WATER_DENSITY * Q * usVelocity;

      // Momentum balance: F_us - F_ds + M_ds - M_us + W_x - F_friction - F_drag = 0
      // Rearranged to find the WSEL where balance holds
      // Target: F_us = F_ds - M_ds + M_us - W_x + F_friction + F_drag
      const targetForce = F_ds - M_ds + M_us - W_x + F_friction + F_drag;

      // Invert F_us to find corresponding WSEL
      // F_us = 0.5 * γ * A * D, find WSEL where F_us matches targetForce
      // Simpler: use the error to adjust WSEL
      const error = F_us - targetForce;
      // Scale error to WSEL adjustment
      const gamma = WATER_DENSITY * G;
      const dFdWsel = gamma * usTopWidth * (usArea / usTopWidth); // ≈ γ*A
      if (Math.abs(dFdWsel) < 1e-6) return trialWsel;

      return trialWsel - error / dFdWsel;
    },
    tolerance: coefficients.tolerance,
    maxIterations: coefficients.maxIterations,
  });

  const usWsel = solverResult.solution;

  // Regime re-evaluation: if free-surface solver overshoots low chord,
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

  const usArea = calcFlowArea(crossSection, usWsel);
  const usTopWidth = calcTopWidth(crossSection, usWsel);
  const usVelocity = calcVelocity(Q, usArea);
  const totalLoss = usWsel - dsWsel;

  steps.push({
    stepNumber: 5,
    description: 'Upstream WSEL from momentum balance',
    formula: 'ΣF = ΔM',
    intermediateValues: { dsWsel, totalLoss },
    result: usWsel,
    unit: 'ft',
  });

  const froudeDs = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);
  const froudeUs = calcFroudeNumber(usVelocity, usArea, usTopWidth);
  const bridgeArea = calcNetBridgeArea(bridge, crossSection, dsWsel, coefficients.debrisBlockagePct);
  const bridgeVelocity = calcVelocity(Q, bridgeArea);

  return {
    profileName: profile.name,
    upstreamWsel: usWsel,
    totalHeadLoss: totalLoss,
    approachVelocity: usVelocity,
    bridgeVelocity,
    froudeApproach: froudeUs,
    froudeBridge: froudeDs,
    flowRegime: regime,
    flowCalculationType: 'free-surface',
    iterationLog: solverResult.log,
    converged: solverResult.converged,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(totalLoss, usVelocity),
    tuflowSuperFLC: calcTuflowSuperFLC(0, usVelocity, regime),
    inputEcho: {
      flowArea: dsArea,
      hydraulicRadius: calcHydraulicRadius(crossSection, dsWsel),
      bridgeOpeningArea: bridgeArea,
      pierBlockage: pierBlockArea,
    },
    error: solverResult.converged ? null : 'Max iterations reached without convergence',
  };
}
