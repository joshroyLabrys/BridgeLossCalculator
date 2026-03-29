import { CalculationResults, BridgeGeometry, MethodResult } from './types';

export type SuitabilityLevel = 'ok' | 'caution' | 'not-applicable' | 'error';

export interface MethodFlag {
  method: 'energy' | 'momentum' | 'yarnell' | 'wspro';
  level: SuitabilityLevel;
  reason: string | null;
  profile: string;
}

// Priority order: higher index = higher severity
const PRIORITY: SuitabilityLevel[] = ['ok', 'caution', 'not-applicable', 'error'];

function compareLevels(a: SuitabilityLevel, b: SuitabilityLevel): number {
  return PRIORITY.indexOf(a) - PRIORITY.indexOf(b);
}

function worstLevel(
  candidates: Array<{ level: SuitabilityLevel; reason: string | null; profile: string }>
): { level: SuitabilityLevel; reason: string | null; profile: string } {
  if (candidates.length === 0) return { level: 'ok', reason: null, profile: '' };
  return candidates.reduce((worst, c) => (compareLevels(c.level, worst.level) > 0 ? c : worst));
}

function fmt(value: number): string {
  return value.toFixed(2);
}

// ─── Per-method assessment helpers ────────────────────────────────────────────

function assessEnergy(
  results: MethodResult[]
): Array<{ level: SuitabilityLevel; reason: string | null; profile: string }> {
  return results.map((r) => {
    if (r.error !== null) return { level: 'error' as SuitabilityLevel, reason: r.error, profile: r.profileName };
    if (!r.converged) return { level: 'caution' as SuitabilityLevel, reason: `Did not converge for ${r.profileName}`, profile: r.profileName };
    if (r.froudeApproach > 0.8) return { level: 'caution' as SuitabilityLevel, reason: `High approach Froude (${fmt(r.froudeApproach)}) for ${r.profileName}`, profile: r.profileName };
    if (r.froudeBridge > 0.9) return { level: 'caution' as SuitabilityLevel, reason: `High bridge Froude (${fmt(r.froudeBridge)}) for ${r.profileName}`, profile: r.profileName };
    return { level: 'ok' as SuitabilityLevel, reason: null, profile: r.profileName };
  });
}

function assessMomentum(
  results: MethodResult[]
): Array<{ level: SuitabilityLevel; reason: string | null; profile: string }> {
  return results.map((r) => {
    if (r.error !== null) return { level: 'error' as SuitabilityLevel, reason: r.error, profile: r.profileName };
    if (!r.converged) return { level: 'caution' as SuitabilityLevel, reason: `Did not converge for ${r.profileName}`, profile: r.profileName };
    if (r.froudeBridge > 0.9) return { level: 'caution' as SuitabilityLevel, reason: `High bridge Froude (${fmt(r.froudeBridge)}) for ${r.profileName}`, profile: r.profileName };
    return { level: 'ok' as SuitabilityLevel, reason: null, profile: r.profileName };
  });
}

function assessYarnell(
  results: MethodResult[],
  energyResults: MethodResult[]
): Array<{ level: SuitabilityLevel; reason: string | null; profile: string }> {
  return results.map((r) => {
    // Check flow regime from energy results (reference) for the same profile
    const energyRef = energyResults.find((e) => e.profileName === r.profileName);
    const regime = energyRef ? energyRef.flowRegime : r.flowRegime;
    if (regime !== 'free-surface') {
      return {
        level: 'not-applicable' as SuitabilityLevel,
        reason: `Pressure/Overtopping flow detected for ${r.profileName}`,
        profile: r.profileName,
      };
    }

    if (r.error !== null) return { level: 'error' as SuitabilityLevel, reason: r.error, profile: r.profileName };

    const { pierBlockage, bridgeOpeningArea } = r.inputEcho;
    const totalArea = bridgeOpeningArea + pierBlockage;
    if (totalArea > 0) {
      const blockageRatio = (pierBlockage / totalArea) * 100;
      if (blockageRatio > 15) {
        return {
          level: 'caution' as SuitabilityLevel,
          reason: `Pier blockage ratio (${fmt(blockageRatio)}%) exceeds 15% for ${r.profileName}`,
          profile: r.profileName,
        };
      }
    }

    return { level: 'ok' as SuitabilityLevel, reason: null, profile: r.profileName };
  });
}

function assessWspro(
  results: MethodResult[],
  energyResults: MethodResult[]
): Array<{ level: SuitabilityLevel; reason: string | null; profile: string }> {
  return results.map((r) => {
    if (r.error !== null) return { level: 'error' as SuitabilityLevel, reason: r.error, profile: r.profileName };
    if (!r.converged) return { level: 'caution' as SuitabilityLevel, reason: `Did not converge for ${r.profileName}`, profile: r.profileName };

    // Opening ratio from corresponding energy result's inputEcho
    const energyRef = energyResults.find((e) => e.profileName === r.profileName) ?? energyResults[0];
    if (energyRef) {
      const { bridgeOpeningArea, flowArea } = energyRef.inputEcho;
      if (flowArea > 0) {
        const openingRatio = bridgeOpeningArea / flowArea;
        if (openingRatio < 0.3) {
          return {
            level: 'caution' as SuitabilityLevel,
            reason: `Severe constriction: opening ratio (${fmt(openingRatio)}) < 0.3 for ${r.profileName}`,
            profile: r.profileName,
          };
        }
      }
    }

    return { level: 'ok' as SuitabilityLevel, reason: null, profile: r.profileName };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function assessMethodSuitability(
  results: CalculationResults,
  _bridge: BridgeGeometry
): MethodFlag[] {
  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
  const flags: MethodFlag[] = [];

  for (const method of methods) {
    const methodResults = results[method];

    if (methodResults.length === 0) {
      flags.push({ method, level: 'ok', reason: null, profile: '' });
      continue;
    }

    let candidates: Array<{ level: SuitabilityLevel; reason: string | null; profile: string }>;

    switch (method) {
      case 'energy':
        candidates = assessEnergy(methodResults);
        break;
      case 'momentum':
        candidates = assessMomentum(methodResults);
        break;
      case 'yarnell':
        candidates = assessYarnell(methodResults, results.energy);
        break;
      case 'wspro':
        candidates = assessWspro(methodResults, results.energy);
        break;
    }

    const worst = worstLevel(candidates);
    flags.push({ method, ...worst });
  }

  return flags;
}
