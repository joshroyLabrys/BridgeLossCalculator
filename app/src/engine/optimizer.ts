import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  CalculationResults,
  MethodResult,
} from './types';
import { runAllMethods } from './index';

// ─── Public types ─────────────────────────────────────────────────────────────

export type SweepParameter =
  | 'openingWidth'
  | 'lowChord'
  | 'manningsNMultiplier'
  | 'dischargeMultiplier'
  | 'debrisBlockagePct';

export type TargetMetric = 'freeboard' | 'afflux' | 'bridgeVelocity';

export type MethodKey = 'energy' | 'momentum' | 'yarnell' | 'wspro';

export interface OptimizationConfig {
  parameter: SweepParameter;
  target: TargetMetric;
  threshold: number;
  method: MethodKey;
  profileIdx: number;
}

export interface SweepPoint {
  paramValue: number;
  metricValue: number;
}

export interface OptimizationResult {
  sweepPoints: SweepPoint[];
  optimalValue: number | null;
  optimalMetric: number | null;
  thresholdMet: boolean;
  summary: string;
  parameterLabel: string;
  metricLabel: string;
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const PARAM_LABELS: Record<SweepParameter, string> = {
  openingWidth: 'Opening Width (m)',
  lowChord: 'Low Chord Elevation (m)',
  manningsNMultiplier: "Manning's n Multiplier",
  dischargeMultiplier: 'Discharge Multiplier',
  debrisBlockagePct: 'Debris Blockage (%)',
};

const METRIC_LABELS: Record<TargetMetric, string> = {
  freeboard: 'Freeboard (m)',
  afflux: 'Afflux / Head Loss (m)',
  bridgeVelocity: 'Bridge Velocity (m/s)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True when higher metric values are better (freeboard). */
function isHigherBetter(target: TargetMetric): boolean {
  return target === 'freeboard';
}

/** Extract the scalar metric value from a MethodResult. */
function extractMetric(result: MethodResult, target: TargetMetric, bridge: BridgeGeometry): number {
  if (result.error) return NaN;
  switch (target) {
    case 'freeboard':
      return Math.min(bridge.lowChordLeft, bridge.lowChordRight) - result.upstreamWsel;
    case 'afflux':
      return result.totalHeadLoss;
    case 'bridgeVelocity':
      return result.bridgeVelocity;
  }
}

/** Compute the parameter range for a given parameter. */
function computeRange(
  parameter: SweepParameter,
  xs: CrossSectionPoint[],
  bridge: BridgeGeometry
): [number, number] {
  switch (parameter) {
    case 'openingWidth': {
      const currentWidth = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
      const totalSpan = xs[xs.length - 1].station - xs[0].station;
      return [Math.max(currentWidth * 0.3, 5), Math.min(totalSpan * 0.95, currentWidth * 3)];
    }
    case 'lowChord': {
      const minElev = Math.min(...xs.map((p) => p.elevation));
      return [minElev + 1, bridge.highChord];
    }
    case 'manningsNMultiplier':
      return [0.5, 1.5];
    case 'dischargeMultiplier':
      return [0.5, 2.0];
    case 'debrisBlockagePct':
      return [0, 50];
  }
}

/** Apply a parameter value to produce modified inputs. */
function applyParameter(
  parameter: SweepParameter,
  value: number,
  xs: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  coefficients: Coefficients
): {
  xs: CrossSectionPoint[];
  bridge: BridgeGeometry;
  profiles: FlowProfile[];
  coefficients: Coefficients;
} {
  switch (parameter) {
    case 'openingWidth': {
      const currentCenter =
        (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
      const half = value / 2;
      return {
        xs,
        bridge: {
          ...bridge,
          leftAbutmentStation: currentCenter - half,
          rightAbutmentStation: currentCenter + half,
        },
        profiles,
        coefficients,
      };
    }
    case 'lowChord':
      return {
        xs,
        bridge: { ...bridge, lowChordLeft: value, lowChordRight: value },
        profiles,
        coefficients,
      };
    case 'manningsNMultiplier':
      return {
        xs: xs.map((p) => ({ ...p, manningsN: p.manningsN * value })),
        bridge,
        profiles,
        coefficients,
      };
    case 'dischargeMultiplier':
      return {
        xs,
        bridge,
        profiles: profiles.map((p) => ({ ...p, discharge: p.discharge * value })),
        coefficients,
      };
    case 'debrisBlockagePct':
      return {
        xs,
        bridge,
        profiles,
        coefficients: { ...coefficients, debrisBlockagePct: value },
      };
  }
}

/** Run the engine for a single parameter value and return the metric. */
function evaluate(
  parameter: SweepParameter,
  value: number,
  xs: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  coefficients: Coefficients,
  config: OptimizationConfig
): number {
  const applied = applyParameter(parameter, value, xs, bridge, profiles, coefficients);

  // Ensure the target method is enabled
  const coeff: Coefficients = {
    ...applied.coefficients,
    methodsToRun: {
      energy: false,
      momentum: false,
      yarnell: false,
      wspro: false,
      [config.method]: true,
    },
  };

  const results: CalculationResults = runAllMethods(
    applied.xs,
    applied.bridge,
    applied.profiles,
    coeff
  );

  const methodResults = results[config.method];
  if (!methodResults || methodResults.length === 0) return NaN;

  const idx = Math.min(config.profileIdx, methodResults.length - 1);
  const methodResult = methodResults[idx];

  return extractMetric(methodResult, config.target, applied.bridge);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function runOptimization(
  xs: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  coefficients: Coefficients,
  config: OptimizationConfig
): OptimizationResult {
  const parameterLabel = PARAM_LABELS[config.parameter];
  const metricLabel = METRIC_LABELS[config.target];
  const higherBetter = isHigherBetter(config.target);

  const [rangeMin, rangeMax] = computeRange(config.parameter, xs, bridge);
  const rangeSpan = rangeMax - rangeMin;

  // ── Phase 1: Coarse sweep (10 steps) ────────────────────────────────────────
  const SWEEP_STEPS = 10;
  const sweepPoints: SweepPoint[] = [];

  for (let i = 0; i <= SWEEP_STEPS; i++) {
    const paramValue = rangeMin + (i / SWEEP_STEPS) * rangeSpan;
    const metricValue = evaluate(
      config.parameter,
      paramValue,
      xs,
      bridge,
      profiles,
      coefficients,
      config
    );
    sweepPoints.push({ paramValue, metricValue });
  }

  // Sort sweep points by paramValue for charting
  sweepPoints.sort((a, b) => a.paramValue - b.paramValue);

  // ── Phase 2: Binary search for threshold crossing ────────────────────────────
  // Determine if threshold is met anywhere in the sweep
  const thresholdMet = sweepPoints.some((pt) =>
    !isNaN(pt.metricValue) &&
    (higherBetter ? pt.metricValue >= config.threshold : pt.metricValue <= config.threshold)
  );

  let optimalValue: number | null = null;
  let optimalMetric: number | null = null;

  if (thresholdMet) {
    // Find a crossing bracket in the sweep
    let lo = rangeMin;
    let hi = rangeMax;

    // Find the first crossing bracket from the sweep points
    for (let i = 0; i < sweepPoints.length - 1; i++) {
      const a = sweepPoints[i];
      const b = sweepPoints[i + 1];
      if (isNaN(a.metricValue) || isNaN(b.metricValue)) continue;

      const aMet = higherBetter
        ? a.metricValue >= config.threshold
        : a.metricValue <= config.threshold;
      const bMet = higherBetter
        ? b.metricValue >= config.threshold
        : b.metricValue <= config.threshold;

      if (aMet !== bMet) {
        // Crossing found: lo is the side that does NOT meet threshold
        lo = aMet ? b.paramValue : a.paramValue;
        hi = aMet ? a.paramValue : b.paramValue;
        break;
      }
    }

    // Binary search: narrow to within 0.1% of range
    const tolerance = rangeSpan * 0.001;
    const MAX_ITER = 15;

    for (let iter = 0; iter < MAX_ITER && hi - lo > tolerance; iter++) {
      const mid = (lo + hi) / 2;
      const midMetric = evaluate(
        config.parameter,
        mid,
        xs,
        bridge,
        profiles,
        coefficients,
        config
      );

      if (isNaN(midMetric)) break;

      const midMet = higherBetter
        ? midMetric >= config.threshold
        : midMetric <= config.threshold;

      // Move lo toward threshold crossing (lo is the "not met" side)
      if (midMet) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    // hi is the boundary where threshold is first met
    optimalValue = hi;
    optimalMetric = evaluate(
      config.parameter,
      optimalValue,
      xs,
      bridge,
      profiles,
      coefficients,
      config
    );
  }

  // ── Summary string ───────────────────────────────────────────────────────────
  let summary: string;
  if (!thresholdMet) {
    summary = `Threshold not met anywhere in the sweep range. No ${parameterLabel} value within [${rangeMin.toFixed(2)}, ${rangeMax.toFixed(2)}] achieves ${metricLabel} ${higherBetter ? '>=' : '<='} ${config.threshold}.`;
  } else if (optimalValue !== null && optimalMetric !== null) {
    summary = `Threshold met. Optimal ${parameterLabel} = ${optimalValue.toFixed(3)}, achieving ${metricLabel} = ${optimalMetric.toFixed(3)} (threshold: ${config.threshold}).`;
  } else {
    summary = `Threshold met somewhere in the sweep range but binary search could not narrow the crossing point.`;
  }

  return {
    sweepPoints,
    optimalValue,
    optimalMetric,
    thresholdMet,
    summary,
    parameterLabel,
    metricLabel,
  };
}
