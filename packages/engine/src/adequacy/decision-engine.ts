import type {
  CalculationResults,
  BridgeGeometry,
  FlowProfile,
  FlowRegime,
  Jurisdiction,
  AdequacyResult,
  AdequacyResults,
} from '../types';
import { interpolateLowChord } from '../bridge-geometry';

/** Compute bridge adequacy assessment across all profiles */
export function computeAdequacy(
  results: CalculationResults,
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  freeboardThreshold: number,
  jurisdiction: Jurisdiction
): AdequacyResults {
  const centerStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, centerStation);

  const adequacyProfiles: AdequacyResult[] = profiles.map((profile, i) => {
    // Find worst-case WSEL across all methods
    let worstCaseWsel = profile.dsWsel;
    for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
      const r = results[method][i];
      if (r && !r.error && r.upstreamWsel > worstCaseWsel) {
        worstCaseWsel = r.upstreamWsel;
      }
    }

    // Classify regime
    let regime: FlowRegime;
    if (worstCaseWsel >= bridge.highChord) regime = 'overtopping';
    else if (worstCaseWsel >= lowChord) regime = 'pressure';
    else regime = 'free-surface';

    const freeboard = lowChord - worstCaseWsel;
    let status: AdequacyResult['status'];
    if (regime === 'overtopping') status = 'overtopping';
    else if (regime === 'pressure') status = 'pressure';
    else if (freeboard <= freeboardThreshold) status = 'low';
    else status = 'clear';

    return {
      profileName: profile.name,
      ari: profile.ari,
      discharge: profile.discharge,
      worstCaseWsel,
      regime,
      freeboard,
      status,
    };
  });

  // Interpolate critical thresholds
  const pressureOnsetQ = interpolateThreshold(adequacyProfiles, lowChord);
  const overtoppingOnsetQ = interpolateThreshold(adequacyProfiles, bridge.highChord);
  const zeroFreeboardQ = interpolateZeroFreeboard(adequacyProfiles);

  // Generate verdict
  const { verdict, verdictSeverity } = generateVerdict(adequacyProfiles, jurisdiction, freeboardThreshold);

  return {
    profiles: adequacyProfiles,
    pressureOnsetQ,
    overtoppingOnsetQ,
    zeroFreeboardQ,
    verdict,
    verdictSeverity,
  };
}

export function interpolateThreshold(profiles: AdequacyResult[], threshold: number): number | null {
  for (let i = 0; i < profiles.length - 1; i++) {
    const a = profiles[i];
    const b = profiles[i + 1];
    if ((a.worstCaseWsel < threshold && b.worstCaseWsel >= threshold) ||
        (a.worstCaseWsel >= threshold && b.worstCaseWsel < threshold)) {
      const t = (threshold - a.worstCaseWsel) / (b.worstCaseWsel - a.worstCaseWsel);
      return a.discharge + t * (b.discharge - a.discharge);
    }
  }
  return null;
}

export function interpolateZeroFreeboard(profiles: AdequacyResult[]): number | null {
  for (let i = 0; i < profiles.length - 1; i++) {
    if ((profiles[i].freeboard > 0 && profiles[i+1].freeboard <= 0) ||
        (profiles[i].freeboard <= 0 && profiles[i+1].freeboard > 0)) {
      const t = profiles[i].freeboard / (profiles[i].freeboard - profiles[i+1].freeboard);
      return profiles[i].discharge + t * (profiles[i+1].discharge - profiles[i].discharge);
    }
  }
  return null;
}

export function generateVerdict(
  profiles: AdequacyResult[],
  jurisdiction: Jurisdiction,
  freeboardThreshold: number
): { verdict: string; verdictSeverity: 'pass' | 'warning' | 'fail' } {
  // Check design AEP (typically 1% for Australian standards)
  const designProfile = profiles.find(p => p.ari.includes('1%')) || profiles[profiles.length - 1];

  if (!designProfile) return { verdict: 'No profiles to assess', verdictSeverity: 'warning' };

  if (designProfile.status === 'overtopping') {
    return {
      verdict: `Bridge overtops at ${designProfile.ari} (${designProfile.discharge.toFixed(0)} m\u00B3/s)`,
      verdictSeverity: 'fail',
    };
  }
  if (designProfile.status === 'pressure') {
    // Find the highest AEP that's still free-surface
    const lastClear = [...profiles].reverse().find(p => p.status === 'clear' || p.status === 'low');
    return {
      verdict: `Pressure flow at ${designProfile.ari} \u2014 adequate to ${lastClear?.ari || 'N/A'}`,
      verdictSeverity: 'fail',
    };
  }
  if (designProfile.status === 'low') {
    return {
      verdict: `Low freeboard at ${designProfile.ari} (${designProfile.freeboard.toFixed(2)} m < ${freeboardThreshold.toFixed(2)} m threshold)`,
      verdictSeverity: 'warning',
    };
  }
  return {
    verdict: `Bridge adequate to ${designProfile.ari} \u2014 free-surface flow, ${designProfile.freeboard.toFixed(2)} m freeboard`,
    verdictSeverity: 'pass',
  };
}
