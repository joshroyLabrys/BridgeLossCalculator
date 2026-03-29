import { describe, it, expect } from 'vitest';
import { runOptimization, OptimizationConfig } from '@flowsuite/engine/optimizer';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@flowsuite/engine/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const XS: CrossSectionPoint[] = [
  { station: 0, elevation: 105, manningsN: 0.05, bankStation: null },
  { station: 30, elevation: 100, manningsN: 0.05, bankStation: 'left' },
  { station: 50, elevation: 98.5, manningsN: 0.035, bankStation: null },
  { station: 70, elevation: 100, manningsN: 0.05, bankStation: 'right' },
  { station: 100, elevation: 105, manningsN: 0.05, bankStation: null },
];

const BRIDGE: BridgeGeometry = {
  lowChordLeft: 103,
  lowChordRight: 103,
  highChord: 105,
  leftAbutmentStation: 30,
  rightAbutmentStation: 70,
  skewAngle: 0,
  contractionLength: 50,
  expansionLength: 50,
  orificeCd: 0.8,
  weirCw: 1.4,
  deckWidth: 10,
  piers: [],
  lowChordProfile: [],
};

const PROFILE: FlowProfile = {
  name: 'Q100',
  ari: 'Q100',
  discharge: 500,
  dsWsel: 101,
  channelSlope: 0.001,
};

const COEFFS: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  debrisBlockagePct: 0,
  manningsNSensitivityPct: null,
  alphaOverride: null,
  freeboardThreshold: 0.3,
  methodsToRun: { energy: true, momentum: false, yarnell: false, wspro: false },
};

// ─── Base config ──────────────────────────────────────────────────────────────

const BASE_CONFIG: OptimizationConfig = {
  parameter: 'openingWidth',
  target: 'freeboard',
  threshold: 0.3,
  method: 'energy',
  profileIdx: 0,
};

// ─── Shape / contract tests ───────────────────────────────────────────────────

describe('runOptimization – result shape', () => {
  const result = runOptimization(XS, BRIDGE, [PROFILE], COEFFS, BASE_CONFIG);

  it('returns sweepPoints array', () => {
    expect(Array.isArray(result.sweepPoints)).toBe(true);
  });

  it('sweepPoints has at least one entry', () => {
    expect(result.sweepPoints.length).toBeGreaterThan(0);
  });

  it('each sweepPoint has paramValue and metricValue numbers', () => {
    for (const pt of result.sweepPoints) {
      expect(typeof pt.paramValue).toBe('number');
      expect(typeof pt.metricValue).toBe('number');
    }
  });

  it('thresholdMet is a boolean', () => {
    expect(typeof result.thresholdMet).toBe('boolean');
  });

  it('summary is a non-empty string', () => {
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('parameterLabel is a non-empty string', () => {
    expect(typeof result.parameterLabel).toBe('string');
    expect(result.parameterLabel.length).toBeGreaterThan(0);
  });

  it('metricLabel is a non-empty string', () => {
    expect(typeof result.metricLabel).toBe('string');
    expect(result.metricLabel.length).toBeGreaterThan(0);
  });

  it('optimalValue is a number or null', () => {
    expect(result.optimalValue === null || typeof result.optimalValue === 'number').toBe(true);
  });

  it('optimalMetric is a number or null', () => {
    expect(result.optimalMetric === null || typeof result.optimalMetric === 'number').toBe(true);
  });
});

// ─── Sorted sweep points ──────────────────────────────────────────────────────

describe('runOptimization – sweep points sorted', () => {
  it('sweepPoints are sorted ascending by paramValue (openingWidth)', () => {
    const result = runOptimization(XS, BRIDGE, [PROFILE], COEFFS, BASE_CONFIG);
    for (let i = 1; i < result.sweepPoints.length; i++) {
      expect(result.sweepPoints[i].paramValue).toBeGreaterThanOrEqual(
        result.sweepPoints[i - 1].paramValue
      );
    }
  });

  it('sweepPoints are sorted ascending by paramValue (manningsNMultiplier)', () => {
    const result = runOptimization(XS, BRIDGE, [PROFILE], COEFFS, {
      ...BASE_CONFIG,
      parameter: 'manningsNMultiplier',
      target: 'afflux',
    });
    for (let i = 1; i < result.sweepPoints.length; i++) {
      expect(result.sweepPoints[i].paramValue).toBeGreaterThanOrEqual(
        result.sweepPoints[i - 1].paramValue
      );
    }
  });
});

// ─── Parameter-specific tests ─────────────────────────────────────────────────

describe('runOptimization – openingWidth parameter', () => {
  const result = runOptimization(XS, BRIDGE, [PROFILE], COEFFS, {
    ...BASE_CONFIG,
    parameter: 'openingWidth',
    target: 'freeboard',
  });

  it('produces 11 sweep points (0..10 inclusive)', () => {
    expect(result.sweepPoints).toHaveLength(11);
  });

  it('paramValues span a positive range', () => {
    const values = result.sweepPoints.map((p) => p.paramValue);
    expect(Math.max(...values)).toBeGreaterThan(Math.min(...values));
  });
});

describe('runOptimization – afflux target', () => {
  const result = runOptimization(XS, BRIDGE, [PROFILE], COEFFS, {
    ...BASE_CONFIG,
    target: 'afflux',
    threshold: 10, // very high threshold — afflux should easily be <= 10
  });

  it('thresholdMet is true when threshold is generous', () => {
    expect(result.thresholdMet).toBe(true);
  });

  it('optimalValue is not null when thresholdMet is true', () => {
    expect(result.optimalValue).not.toBeNull();
  });
});

describe('runOptimization – debrisBlockagePct parameter', () => {
  const result = runOptimization(XS, BRIDGE, [PROFILE], COEFFS, {
    ...BASE_CONFIG,
    parameter: 'debrisBlockagePct',
    target: 'afflux',
    threshold: 0, // effectively never met for lower-is-better with afflux > 0
  });

  it('sweep points paramValues stay within [0, 50]', () => {
    for (const pt of result.sweepPoints) {
      expect(pt.paramValue).toBeGreaterThanOrEqual(0);
      expect(pt.paramValue).toBeLessThanOrEqual(50);
    }
  });
});

describe('runOptimization – dischargeMultiplier parameter', () => {
  const result = runOptimization(XS, BRIDGE, [PROFILE], COEFFS, {
    ...BASE_CONFIG,
    parameter: 'dischargeMultiplier',
    target: 'bridgeVelocity',
    threshold: 100, // extremely generous — should always be met
  });

  it('thresholdMet is true with very generous threshold', () => {
    expect(result.thresholdMet).toBe(true);
  });

  it('sweep points paramValues stay within [0.5, 2.0]', () => {
    for (const pt of result.sweepPoints) {
      expect(pt.paramValue).toBeGreaterThanOrEqual(0.5);
      expect(pt.paramValue).toBeLessThanOrEqual(2.0);
    }
  });
});

describe('runOptimization – lowChord parameter', () => {
  const result = runOptimization(XS, BRIDGE, [PROFILE], COEFFS, {
    ...BASE_CONFIG,
    parameter: 'lowChord',
    target: 'freeboard',
    threshold: 0.5,
  });

  it('sweep points produced', () => {
    expect(result.sweepPoints.length).toBeGreaterThan(0);
  });

  it('summary is non-empty', () => {
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

// ─── Threshold not met scenario ───────────────────────────────────────────────

describe('runOptimization – threshold not met', () => {
  const result = runOptimization(XS, BRIDGE, [PROFILE], COEFFS, {
    ...BASE_CONFIG,
    target: 'freeboard',
    threshold: 999, // impossibly high freeboard — never met
  });

  it('thresholdMet is false', () => {
    expect(result.thresholdMet).toBe(false);
  });

  it('optimalValue is null', () => {
    expect(result.optimalValue).toBeNull();
  });

  it('optimalMetric is null', () => {
    expect(result.optimalMetric).toBeNull();
  });

  it('summary mentions threshold not met', () => {
    expect(result.summary.toLowerCase()).toContain('threshold');
  });
});
