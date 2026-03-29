// packages/engine/src/hydrology/design-storm-runner.ts
import type { DesignStormConfig, DesignStormResults, DesignStormSummary, StormRunResult, ARRTemporalPattern } from './types';
import { applyLosses } from './loss-model';
import { clarkUnitHydrograph } from './clark-uh';

interface SingleStormInput {
  rainfallDepthMM: number;
  pattern: number[];
  arf: number;
  initialLoss: number;
  continuingLoss: number;
  preBurst: number;
  imperviousFraction: number;
  tc: number;
  r: number;
  catchmentArea: number;
  durationMin: number;
}

export function runSingleStorm(input: SingleStormInput): Omit<StormRunResult, 'aep' | 'durationMin' | 'patternIndex'> {
  const { rainfallDepthMM, pattern, arf, initialLoss, continuingLoss, preBurst, imperviousFraction, tc, r, catchmentArea, durationMin } = input;

  // Timestep: duration / number of pattern intervals
  const nIntervals = pattern.length;
  const dtMinutes = durationMin / nIntervals;
  const dtHours = dtMinutes / 60;

  // Build rainfall hyetograph: depth × ARF × pattern fractions
  const arealDepth = rainfallDepthMM * arf;
  const rainfall = pattern.map(f => arealDepth * f);

  // Apply losses
  const excess = applyLosses(rainfall, initialLoss, continuingLoss, preBurst, imperviousFraction, dtMinutes);

  // Route through Clark UH
  const hydrographQ = clarkUnitHydrograph(excess, tc, r, dtHours, catchmentArea);

  // Extract results
  let peakQ = 0;
  let timeToPeak = 0;
  const hydrograph: { time: number; q: number }[] = [];

  for (let i = 0; i < hydrographQ.length; i++) {
    const t = i * dtHours;
    const q = hydrographQ[i];
    hydrograph.push({ time: t, q });
    if (q > peakQ) {
      peakQ = q;
      timeToPeak = t;
    }
  }

  // Volume = sum(Q × dt) in m³, convert to ML
  const volumeM3 = hydrographQ.reduce((sum, q) => sum + q * dtHours * 3600, 0);
  const volumeML = volumeM3 / 1e6;

  // Runoff coefficient = volume out / volume in
  const totalRainM3 = (arealDepth / 1000) * catchmentArea * 1e6;
  const runoffCoefficient = totalRainM3 > 0 ? volumeM3 / totalRainM3 : 0;

  return { peakQ, timeToPeak, runoffVolume: volumeML, runoffCoefficient, hydrograph };
}

export function runDesignStorms(config: DesignStormConfig): DesignStormResults {
  const runs: StormRunResult[] = [];

  for (const aep of config.aeps) {
    const aepIdx = config.ifd.aeps.indexOf(aep);
    if (aepIdx === -1) continue;

    // Determine which temporal pattern group to use
    const patternGroup = getPatternGroup(aep);

    for (const durationMin of config.durationRange) {
      // Get rainfall depth from IFD
      const durIdx = config.ifd.durations.indexOf(durationMin);
      if (durIdx === -1) continue;
      const rainfallDepthMM = config.ifd.depths[durIdx][aepIdx];

      // Get ARF
      const arf = lookupARF(config.arf, durationMin, aep);

      // Get pre-burst for this AEP/duration
      const preBurst = lookupPreBurst(config.losses.preBurst, aep, durationMin);

      // Get temporal patterns for this duration and group
      const patterns = findPatterns(config.temporalPatterns, patternGroup, durationMin);
      if (patterns.length === 0) continue;

      for (let pi = 0; pi < patterns.length; pi++) {
        const result = runSingleStorm({
          rainfallDepthMM,
          pattern: patterns[pi],
          arf,
          initialLoss: config.losses.initialLoss,
          continuingLoss: config.losses.continuingLoss,
          preBurst,
          imperviousFraction: config.losses.imperviousFraction,
          tc: config.tc,
          r: config.r,
          catchmentArea: config.catchmentArea,
          durationMin,
        });

        runs.push({
          aep,
          durationMin,
          patternIndex: pi,
          ...result,
        });
      }
    }
  }

  // Build summary: for each AEP, find critical duration
  const summary: DesignStormSummary[] = [];

  for (const aep of config.aeps) {
    const aepRuns = runs.filter(r => r.aep === aep);
    if (aepRuns.length === 0) continue;

    // Group by duration, compute median peak Q per duration
    const byDuration = new Map<number, StormRunResult[]>();
    for (const run of aepRuns) {
      const arr = byDuration.get(run.durationMin) ?? [];
      arr.push(run);
      byDuration.set(run.durationMin, arr);
    }

    let criticalDur = 0;
    let maxMedianQ = 0;

    for (const [dur, durRuns] of byDuration) {
      const peaks = durRuns.map(r => r.peakQ).sort((a, b) => a - b);
      const median = peaks[Math.floor(peaks.length / 2)];
      if (median > maxMedianQ) {
        maxMedianQ = median;
        criticalDur = dur;
      }
    }

    // Get all runs at critical duration
    const critRuns = byDuration.get(criticalDur) ?? [];
    const peaks = critRuns.map(r => r.peakQ).sort((a, b) => a - b);
    const medianIdx = Math.floor(peaks.length / 2);

    // Find the median hydrograph (the run closest to median peak)
    const medianRun = critRuns.reduce((best, r) =>
      Math.abs(r.peakQ - peaks[medianIdx]) < Math.abs(best.peakQ - peaks[medianIdx]) ? r : best
    , critRuns[0]);

    summary.push({
      aep,
      criticalDurationMin: criticalDur,
      medianPeakQ: peaks[medianIdx],
      minPeakQ: peaks[0],
      maxPeakQ: peaks[peaks.length - 1],
      medianHydrograph: medianRun?.hydrograph ?? [],
    });
  }

  return { runs, summary };
}

function getPatternGroup(aep: string): ARRTemporalPattern['group'] {
  if (aep === '50%' || aep === '20%') return 'frequent';
  if (aep === '10%' || aep === '5%') return 'infrequent';
  return 'rare';
}

function lookupARF(arf: DesignStormConfig['arf'], durationMin: number, aep: string): number {
  const durIdx = arf.durations.indexOf(durationMin);
  const aepIdx = arf.aeps.indexOf(aep);
  if (durIdx === -1 || aepIdx === -1) return 1.0;
  return arf.factors[durIdx][aepIdx];
}

function lookupPreBurst(preBurst: DesignStormConfig['losses']['preBurst'], aep: string, durationMin: number): number {
  // Find exact match first
  const exact = preBurst.find(p => p.aep === aep && p.durationMin === durationMin);
  if (exact) return exact.depth;
  // Fall back to same AEP any duration
  const sameAEP = preBurst.find(p => p.aep === aep);
  if (sameAEP) return sameAEP.depth;
  // Fall back to first available
  return preBurst[0]?.depth ?? 0;
}

function findPatterns(allPatterns: ARRTemporalPattern[], group: ARRTemporalPattern['group'], durationMin: number): number[][] {
  // Exact match
  const exact = allPatterns.find(p => p.group === group && p.durationMin === durationMin);
  if (exact) return exact.patterns;
  // Same group, closest duration
  const sameGroup = allPatterns.filter(p => p.group === group);
  if (sameGroup.length > 0) {
    sameGroup.sort((a, b) => Math.abs(a.durationMin - durationMin) - Math.abs(b.durationMin - durationMin));
    return sameGroup[0].patterns;
  }
  // Any group, closest duration
  if (allPatterns.length > 0) {
    const sorted = [...allPatterns].sort((a, b) => Math.abs(a.durationMin - durationMin) - Math.abs(b.durationMin - durationMin));
    return sorted[0].patterns;
  }
  return [];
}
