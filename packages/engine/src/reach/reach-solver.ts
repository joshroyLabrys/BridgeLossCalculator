import type { BridgeProject, FlowProfile, ReachResults, CalculationResults } from '../types';
import { runAllMethods } from '..';

/**
 * Run reach analysis: process bridges downstream to upstream.
 * First (most downstream) bridge uses the profile's dsWsel.
 * Each subsequent upstream bridge uses the previous bridge's computed upstream WSEL as tailwater.
 * Bridges should be sorted by chainage descending (downstream first).
 */
export function runReachAnalysis(
  bridges: BridgeProject[],
  profiles: FlowProfile[],
): ReachResults {
  // Sort bridges by chainage descending (downstream first)
  const sorted = [...bridges].sort((a, b) => b.chainage - a.chainage);

  const bridgeResults: ReachResults['bridgeResults'] = [];
  const tailwaterCascade: ReachResults['tailwaterCascade'] = [];

  // Track modified profiles (tailwater cascades upstream)
  let currentProfiles = profiles;

  for (const bridge of sorted) {
    // Skip bridges with incomplete configuration
    if (bridge.crossSection.length < 2 || bridge.bridgeGeometry.highChord === 0) {
      continue;
    }

    // Run all methods for this bridge
    const results: CalculationResults = runAllMethods(
      bridge.crossSection,
      bridge.bridgeGeometry,
      currentProfiles,
      bridge.coefficients,
    );

    bridgeResults.push({ bridgeId: bridge.id, results });

    // For tailwater cascade: find worst-case upstream WSEL per profile
    // and use it as downstream WSEL for the next upstream bridge
    const cascadeEntry = {
      bridgeId: bridge.id,
      dsWsel: currentProfiles[0]?.dsWsel ?? 0,
      usWsel: 0,
    };

    // Build next profiles with updated tailwater
    currentProfiles = currentProfiles.map((profile, i) => {
      let worstUsWsel = profile.dsWsel;
      for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
        const r = results[method][i];
        if (r && !r.error && r.upstreamWsel > worstUsWsel) {
          worstUsWsel = r.upstreamWsel;
        }
      }
      if (i === 0) cascadeEntry.usWsel = worstUsWsel;
      return { ...profile, dsWsel: worstUsWsel };
    });

    tailwaterCascade.push(cascadeEntry);
  }

  return { bridgeResults, tailwaterCascade };
}
