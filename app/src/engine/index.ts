import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  CalculationResults,
  SensitivityResults,
} from './types';
import { runEnergy } from './methods/energy';
import { runMomentum } from './methods/momentum';
import { runYarnell } from './methods/yarnell';
import { runWSPRO } from './methods/wspro';

export { runEnergy } from './methods/energy';
export { runMomentum } from './methods/momentum';
export { runYarnell } from './methods/yarnell';
export { runWSPRO } from './methods/wspro';

/**
 * Runs all selected calculation methods for all flow profiles.
 */
export function runAllMethods(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  coefficients: Coefficients
): CalculationResults {
  const results: CalculationResults = {
    energy: [],
    momentum: [],
    yarnell: [],
    wspro: [],
  };

  for (const profile of profiles) {
    if (coefficients.methodsToRun.energy) {
      results.energy.push(runEnergy(crossSection, bridge, profile, coefficients));
    }
    if (coefficients.methodsToRun.momentum) {
      results.momentum.push(runMomentum(crossSection, bridge, profile, coefficients));
    }
    if (coefficients.methodsToRun.yarnell) {
      results.yarnell.push(runYarnell(crossSection, bridge, profile, coefficients));
    }
    if (coefficients.methodsToRun.wspro) {
      results.wspro.push(runWSPRO(crossSection, bridge, profile, coefficients));
    }
  }

  return results;
}

export function runWithSensitivity(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  coefficients: Coefficients
): SensitivityResults {
  const pct = coefficients.manningsNSensitivityPct / 100;

  const scaledLow = crossSection.map(p => ({
    ...p,
    manningsN: p.manningsN * (1 - pct),
  }));

  const scaledHigh = crossSection.map(p => ({
    ...p,
    manningsN: p.manningsN * (1 + pct),
  }));

  return {
    low: runAllMethods(scaledLow, bridge, profiles, coefficients),
    high: runAllMethods(scaledHigh, bridge, profiles, coefficients),
  };
}
