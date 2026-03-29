// apps/web/src/__tests__/engine/hydrology/design-storm-runner.test.ts
import { describe, it, expect } from 'vitest';
import { runDesignStorms, runSingleStorm } from '@flowsuite/engine/hydrology/design-storm-runner';
import type { DesignStormConfig } from '@flowsuite/engine/hydrology/types';

describe('runSingleStorm', () => {
  it('produces a hydrograph with positive peak', () => {
    const result = runSingleStorm({
      rainfallDepthMM: 50,
      pattern: [0.1, 0.15, 0.25, 0.25, 0.15, 0.1],
      arf: 0.95,
      initialLoss: 10,
      continuingLoss: 2.5,
      preBurst: 5,
      imperviousFraction: 0,
      tc: 1.0,
      r: 1.5,
      catchmentArea: 20,
      durationMin: 60,
    });
    expect(result.peakQ).toBeGreaterThan(0);
    expect(result.hydrograph.length).toBeGreaterThan(0);
    expect(result.timeToPeak).toBeGreaterThan(0);
  });

  it('returns zero peak when all rainfall absorbed by losses', () => {
    const result = runSingleStorm({
      rainfallDepthMM: 5,
      pattern: [0.5, 0.5],
      arf: 1.0,
      initialLoss: 100,
      continuingLoss: 0,
      preBurst: 0,
      imperviousFraction: 0,
      tc: 1.0,
      r: 1.5,
      catchmentArea: 20,
      durationMin: 30,
    });
    expect(result.peakQ).toBeCloseTo(0, 1);
  });
});

describe('runDesignStorms', () => {
  it('finds critical duration and returns summary per AEP', () => {
    const config: DesignStormConfig = {
      ifd: {
        durations: [30, 60, 120],
        aeps: ['1%'],
        depths: [[40], [60], [80]],
      },
      temporalPatterns: [
        { group: 'rare', durationMin: 30, patterns: [[0.3, 0.4, 0.3]] },
        { group: 'rare', durationMin: 60, patterns: [[0.1, 0.2, 0.3, 0.2, 0.1, 0.1]] },
        { group: 'rare', durationMin: 120, patterns: [[0.05, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.05]] },
      ],
      arf: { durations: [30, 60, 120], aeps: ['1%'], factors: [[0.98], [0.95], [0.92]] },
      losses: {
        initialLoss: 15,
        continuingLoss: 2.5,
        preBurst: [{ aep: '1%', durationMin: 60, depth: 10 }],
        imperviousFraction: 0,
      },
      tc: 0.75,
      r: 1.125,
      catchmentArea: 15,
      aeps: ['1%'],
      durationRange: [30, 60, 120],
    };

    const results = runDesignStorms(config);
    expect(results.summary.length).toBe(1);
    expect(results.summary[0].aep).toBe('1%');
    expect(results.summary[0].medianPeakQ).toBeGreaterThan(0);
    expect(results.summary[0].criticalDurationMin).toBeGreaterThan(0);
  });
});
