import { FlowRegime } from './types';

/**
 * Detects flow regime based on WSEL relative to bridge chord elevations.
 * - WSEL <= low chord: free-surface
 * - low chord < WSEL <= high chord: pressure
 * - WSEL > high chord: overtopping
 */
export function detectFlowRegime(
  wsel: number,
  lowChord: number,
  highChord: number
): FlowRegime {
  if (wsel <= lowChord) return 'free-surface';
  if (wsel <= highChord) return 'pressure';
  return 'overtopping';
}
