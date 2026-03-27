import { BridgeGeometry, FlowProfile, CalculationResults, FreeboardResult, FreeboardSummary } from './types';
import { interpolateLowChord } from './bridge-geometry';

export function computeFreeboard(
  results: CalculationResults,
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  freeboardThreshold: number
): FreeboardSummary {
  const centerStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, centerStation);

  const freeboardResults: FreeboardResult[] = profiles.map((profile, i) => {
    let worstUsWsel = profile.dsWsel;

    for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
      const r = results[method][i];
      if (r && !r.error && r.upstreamWsel > worstUsWsel) {
        worstUsWsel = r.upstreamWsel;
      }
    }

    const freeboard = lowChord - worstUsWsel;

    let status: FreeboardResult['status'];
    if (worstUsWsel >= bridge.highChord) {
      status = 'overtopping';
    } else if (freeboard <= 0) {
      status = 'pressure';
    } else if (freeboard <= freeboardThreshold) {
      status = 'low';
    } else {
      status = 'clear';
    }

    return {
      profileName: profile.name,
      ari: profile.ari,
      discharge: profile.discharge,
      dsWsel: profile.dsWsel,
      usWsel: worstUsWsel,
      lowChord,
      freeboard,
      status,
    };
  });

  let zeroFreeboardQ: number | null = null;
  for (let i = 0; i < freeboardResults.length - 1; i++) {
    const a = freeboardResults[i];
    const b = freeboardResults[i + 1];
    if ((a.freeboard > 0 && b.freeboard <= 0) || (a.freeboard <= 0 && b.freeboard > 0)) {
      const t = a.freeboard / (a.freeboard - b.freeboard);
      zeroFreeboardQ = a.discharge + t * (b.discharge - a.discharge);
      break;
    }
  }

  return { profiles: freeboardResults, zeroFreeboardQ };
}
