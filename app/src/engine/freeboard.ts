import { BridgeGeometry, FlowProfile, CalculationResults, FreeboardResult, FreeboardSummary } from './types';
import { interpolateLowChord } from './bridge-geometry';

export function computeFreeboard(
  energyResults: CalculationResults['energy'],
  bridge: BridgeGeometry,
  profiles: FlowProfile[]
): FreeboardSummary {
  const centerStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, centerStation);

  const freeboardResults: FreeboardResult[] = energyResults.map((r, i) => {
    const profile = profiles[i];
    const freeboard = lowChord - r.upstreamWsel;

    let status: FreeboardResult['status'];
    if (r.upstreamWsel >= bridge.highChord) {
      status = 'overtopping';
    } else if (freeboard <= 0) {
      status = 'pressure';
    } else if (freeboard <= 1) {
      status = 'low';
    } else {
      status = 'clear';
    }

    return {
      profileName: r.profileName,
      ari: profile?.ari ?? '',
      discharge: profile?.discharge ?? 0,
      dsWsel: profile?.dsWsel ?? 0,
      usWsel: r.upstreamWsel,
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
