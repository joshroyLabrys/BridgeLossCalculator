import { describe, it, expect } from 'vitest';
import {
  computeAdequacy,
  interpolateThreshold,
  interpolateZeroFreeboard,
  generateVerdict,
} from '@/engine/adequacy/decision-engine';
import type {
  CalculationResults,
  BridgeGeometry,
  FlowProfile,
  MethodResult,
  AdequacyResult,
} from '@/engine/types';

// ── Fixtures ────────────────────────────────────────────────────────

function makeResult(overrides: Partial<MethodResult> = {}): MethodResult {
  return {
    profileName: 'Q100',
    upstreamWsel: 101.5,
    totalHeadLoss: 0.1,
    approachVelocity: 1.5,
    bridgeVelocity: 2.0,
    froudeApproach: 0.3,
    froudeBridge: 0.4,
    flowRegime: 'free-surface',
    flowCalculationType: 'free-surface',
    iterationLog: [],
    converged: true,
    calculationSteps: [],
    tuflowPierFLC: 0,
    tuflowSuperFLC: null,
    inputEcho: {
      flowArea: 100,
      hydraulicRadius: 2.5,
      bridgeOpeningArea: 60,
      pierBlockage: 5,
    },
    error: null,
    ...overrides,
  };
}

const BRIDGE: BridgeGeometry = {
  lowChordLeft: 103,
  lowChordRight: 103,
  highChord: 105,
  leftAbutmentStation: 30,
  rightAbutmentStation: 70,
  skewAngle: 0,
  contractionLength: 100,
  expansionLength: 50,
  orificeCd: 0.8,
  weirCw: 1.4,
  deckWidth: 10,
  piers: [],
  lowChordProfile: [],
};

function makeProfiles(): FlowProfile[] {
  return [
    { name: 'Q10', ari: '10% AEP', discharge: 200, dsWsel: 99, channelSlope: 0.001 },
    { name: 'Q50', ari: '2% AEP', discharge: 500, dsWsel: 100, channelSlope: 0.001 },
    { name: 'Q100', ari: '1% AEP', discharge: 800, dsWsel: 101, channelSlope: 0.001 },
  ];
}

function makeResults(wsels: number[]): CalculationResults {
  return {
    energy: wsels.map((w, i) => makeResult({ upstreamWsel: w, profileName: `P${i}` })),
    momentum: [],
    yarnell: [],
    wspro: [],
  };
}

// ── Regime classification ───────────────────────────────────────────

describe('computeAdequacy - regime classification', () => {
  it('classifies free-surface when WSEL is below low chord', () => {
    const profiles = makeProfiles();
    const results = makeResults([100, 101, 102]);
    const adequacy = computeAdequacy(results, BRIDGE, profiles, 0.3, 'tmr');

    expect(adequacy.profiles[0].regime).toBe('free-surface');
    expect(adequacy.profiles[1].regime).toBe('free-surface');
    expect(adequacy.profiles[2].regime).toBe('free-surface');
  });

  it('classifies pressure when WSEL equals or exceeds low chord but below high chord', () => {
    const profiles = makeProfiles();
    const results = makeResults([100, 103, 104]);
    const adequacy = computeAdequacy(results, BRIDGE, profiles, 0.3, 'tmr');

    expect(adequacy.profiles[0].regime).toBe('free-surface');
    expect(adequacy.profiles[1].regime).toBe('pressure');
    expect(adequacy.profiles[2].regime).toBe('pressure');
  });

  it('classifies overtopping when WSEL equals or exceeds high chord', () => {
    const profiles = makeProfiles();
    const results = makeResults([100, 104, 106]);
    const adequacy = computeAdequacy(results, BRIDGE, profiles, 0.3, 'tmr');

    expect(adequacy.profiles[2].regime).toBe('overtopping');
  });

  it('uses worst-case WSEL across methods', () => {
    const profiles = makeProfiles();
    const results: CalculationResults = {
      energy: [makeResult({ upstreamWsel: 100 }), makeResult({ upstreamWsel: 101 }), makeResult({ upstreamWsel: 102 })],
      momentum: [makeResult({ upstreamWsel: 100.5 }), makeResult({ upstreamWsel: 103.5 }), makeResult({ upstreamWsel: 102.5 })],
      yarnell: [],
      wspro: [],
    };
    const adequacy = computeAdequacy(results, BRIDGE, profiles, 0.3, 'tmr');

    // Momentum had higher WSEL for profile 1 (103.5 > 101)
    expect(adequacy.profiles[1].worstCaseWsel).toBe(103.5);
    expect(adequacy.profiles[1].regime).toBe('pressure');
  });
});

// ── Status classification ───────────────────────────────────────────

describe('computeAdequacy - status classification', () => {
  it('marks clear when freeboard exceeds threshold', () => {
    const profiles = makeProfiles();
    const results = makeResults([100, 101, 102]);
    const adequacy = computeAdequacy(results, BRIDGE, profiles, 0.3, 'tmr');

    // freeboard for profile 2: 103 - 102 = 1.0 > 0.3
    expect(adequacy.profiles[2].status).toBe('clear');
    expect(adequacy.profiles[2].freeboard).toBeCloseTo(1.0);
  });

  it('marks low when freeboard is positive but below threshold', () => {
    const profiles = makeProfiles();
    const results = makeResults([100, 101, 102.8]);
    const adequacy = computeAdequacy(results, BRIDGE, profiles, 0.3, 'tmr');

    // freeboard for profile 2: 103 - 102.8 = 0.2 < 0.3
    expect(adequacy.profiles[2].status).toBe('low');
  });

  it('marks pressure when WSEL at or above low chord', () => {
    const profiles = makeProfiles();
    const results = makeResults([100, 101, 103.5]);
    const adequacy = computeAdequacy(results, BRIDGE, profiles, 0.3, 'tmr');

    expect(adequacy.profiles[2].status).toBe('pressure');
  });

  it('marks overtopping when WSEL at or above high chord', () => {
    const profiles = makeProfiles();
    const results = makeResults([100, 101, 105.5]);
    const adequacy = computeAdequacy(results, BRIDGE, profiles, 0.3, 'tmr');

    expect(adequacy.profiles[2].status).toBe('overtopping');
  });
});

// ── Threshold interpolation ─────────────────────────────────────────

describe('interpolateThreshold', () => {
  it('interpolates Q when WSEL crosses threshold between profiles', () => {
    const profiles: AdequacyResult[] = [
      { profileName: 'P1', ari: '10%', discharge: 200, worstCaseWsel: 100, regime: 'free-surface', freeboard: 3, status: 'clear' },
      { profileName: 'P2', ari: '1%', discharge: 800, worstCaseWsel: 104, regime: 'pressure', freeboard: -1, status: 'pressure' },
    ];

    // threshold = 103 (low chord); WSEL goes from 100 to 104
    // t = (103 - 100) / (104 - 100) = 0.75
    // Q = 200 + 0.75 * (800 - 200) = 650
    const result = interpolateThreshold(profiles, 103);
    expect(result).toBeCloseTo(650);
  });

  it('returns null when threshold is never crossed', () => {
    const profiles: AdequacyResult[] = [
      { profileName: 'P1', ari: '10%', discharge: 200, worstCaseWsel: 100, regime: 'free-surface', freeboard: 3, status: 'clear' },
      { profileName: 'P2', ari: '1%', discharge: 800, worstCaseWsel: 102, regime: 'free-surface', freeboard: 1, status: 'clear' },
    ];

    const result = interpolateThreshold(profiles, 103);
    expect(result).toBeNull();
  });
});

describe('interpolateZeroFreeboard', () => {
  it('interpolates Q at zero freeboard crossing', () => {
    const profiles: AdequacyResult[] = [
      { profileName: 'P1', ari: '10%', discharge: 200, worstCaseWsel: 101, regime: 'free-surface', freeboard: 2, status: 'clear' },
      { profileName: 'P2', ari: '1%', discharge: 800, worstCaseWsel: 104, regime: 'pressure', freeboard: -1, status: 'pressure' },
    ];

    // freeboard goes from 2 to -1
    // t = 2 / (2 - (-1)) = 2/3
    // Q = 200 + (2/3) * 600 = 600
    const result = interpolateZeroFreeboard(profiles);
    expect(result).toBeCloseTo(600);
  });

  it('returns null when freeboard never crosses zero', () => {
    const profiles: AdequacyResult[] = [
      { profileName: 'P1', ari: '10%', discharge: 200, worstCaseWsel: 100, regime: 'free-surface', freeboard: 3, status: 'clear' },
      { profileName: 'P2', ari: '1%', discharge: 800, worstCaseWsel: 102, regime: 'free-surface', freeboard: 1, status: 'clear' },
    ];

    const result = interpolateZeroFreeboard(profiles);
    expect(result).toBeNull();
  });
});

// ── Verdict generation ──────────────────────────────────────────────

describe('generateVerdict', () => {
  it('returns pass verdict when design profile is clear', () => {
    const profiles: AdequacyResult[] = [
      { profileName: 'Q100', ari: '1% AEP', discharge: 800, worstCaseWsel: 102, regime: 'free-surface', freeboard: 1.0, status: 'clear' },
    ];

    const result = generateVerdict(profiles, 'tmr', 0.3);
    expect(result.verdictSeverity).toBe('pass');
    expect(result.verdict).toContain('adequate');
    expect(result.verdict).toContain('1% AEP');
  });

  it('returns warning verdict when design profile has low freeboard', () => {
    const profiles: AdequacyResult[] = [
      { profileName: 'Q100', ari: '1% AEP', discharge: 800, worstCaseWsel: 102.8, regime: 'free-surface', freeboard: 0.2, status: 'low' },
    ];

    const result = generateVerdict(profiles, 'tmr', 0.3);
    expect(result.verdictSeverity).toBe('warning');
    expect(result.verdict).toContain('Low freeboard');
  });

  it('returns fail verdict when design profile has pressure flow', () => {
    const profiles: AdequacyResult[] = [
      { profileName: 'Q10', ari: '10% AEP', discharge: 200, worstCaseWsel: 101, regime: 'free-surface', freeboard: 2, status: 'clear' },
      { profileName: 'Q100', ari: '1% AEP', discharge: 800, worstCaseWsel: 104, regime: 'pressure', freeboard: -1, status: 'pressure' },
    ];

    const result = generateVerdict(profiles, 'tmr', 0.3);
    expect(result.verdictSeverity).toBe('fail');
    expect(result.verdict).toContain('Pressure flow');
  });

  it('returns fail verdict when design profile overtops', () => {
    const profiles: AdequacyResult[] = [
      { profileName: 'Q100', ari: '1% AEP', discharge: 800, worstCaseWsel: 106, regime: 'overtopping', freeboard: -3, status: 'overtopping' },
    ];

    const result = generateVerdict(profiles, 'tmr', 0.3);
    expect(result.verdictSeverity).toBe('fail');
    expect(result.verdict).toContain('overtops');
  });

  it('falls back to last profile when no 1% AEP profile exists', () => {
    const profiles: AdequacyResult[] = [
      { profileName: 'Q10', ari: '10% AEP', discharge: 200, worstCaseWsel: 101, regime: 'free-surface', freeboard: 2, status: 'clear' },
      { profileName: 'Q50', ari: '2% AEP', discharge: 500, worstCaseWsel: 102, regime: 'free-surface', freeboard: 1, status: 'clear' },
    ];

    const result = generateVerdict(profiles, 'tmr', 0.3);
    expect(result.verdictSeverity).toBe('pass');
    // Uses last profile (Q50)
    expect(result.verdict).toContain('2% AEP');
  });

  it('returns warning when no profiles at all', () => {
    const result = generateVerdict([], 'tmr', 0.3);
    expect(result.verdictSeverity).toBe('warning');
    expect(result.verdict).toContain('No profiles');
  });
});
