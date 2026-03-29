import { describe, it, expect, vi } from 'vitest';
import type { BridgeProject, FlowProfile, CalculationResults, MethodResult } from '@flowsuite/engine/types';

// Mock runAllMethods so we don't need the full calculation engine
vi.mock('@flowsuite/engine', () => ({
  runAllMethods: vi.fn(),
}));

import { runReachAnalysis } from '@flowsuite/engine/reach/reach-solver';
import { runAllMethods } from '@flowsuite/engine';

const mockedRunAllMethods = vi.mocked(runAllMethods);

/* ── Helpers ─────────────────────────────────────────────────────── */

function makeBridge(overrides: Partial<BridgeProject> = {}): BridgeProject {
  return {
    id: overrides.id ?? 'bridge-1',
    name: overrides.name ?? 'Test Bridge',
    chainage: overrides.chainage ?? 0,
    crossSection: overrides.crossSection ?? [
      { station: 0, elevation: 10, manningsN: 0.035, bankStation: null },
      { station: 10, elevation: 5, manningsN: 0.035, bankStation: null },
      { station: 20, elevation: 10, manningsN: 0.035, bankStation: null },
    ],
    bridgeGeometry: overrides.bridgeGeometry ?? {
      lowChordLeft: 8,
      lowChordRight: 8,
      highChord: 10,
      leftAbutmentStation: 2,
      rightAbutmentStation: 18,
      skewAngle: 0,
      contractionLength: 50,
      expansionLength: 50,
      orificeCd: 0.8,
      weirCw: 1.4,
      deckWidth: 10,
      piers: [],
      lowChordProfile: [],
    },
    coefficients: overrides.coefficients ?? {
      contractionCoeff: 0.3,
      expansionCoeff: 0.5,
      yarnellK: null,
      maxIterations: 100,
      tolerance: 0.01,
      initialGuessOffset: 0.5,
      debrisBlockagePct: 0,
      manningsNSensitivityPct: null,
      alphaOverride: null,
      freeboardThreshold: 0.984,
      methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
    },
    results: null,
    scourInputs: { bedMaterial: 'sand', d50: 1, d95: 5, upstreamBedElevation: 0, countermeasure: 'none' },
    scourResults: null,
  };
}

function makeProfile(overrides: Partial<FlowProfile> = {}): FlowProfile {
  return {
    name: overrides.name ?? 'Q100',
    ari: overrides.ari ?? '1% AEP',
    discharge: overrides.discharge ?? 100,
    dsWsel: overrides.dsWsel ?? 7.0,
    channelSlope: overrides.channelSlope ?? 0.001,
  };
}

function makeMethodResult(upstreamWsel: number, profileName = 'Q100'): MethodResult {
  return {
    profileName,
    upstreamWsel,
    totalHeadLoss: upstreamWsel - 7.0,
    approachVelocity: 1.5,
    bridgeVelocity: 3.0,
    froudeApproach: 0.3,
    froudeBridge: 0.6,
    flowRegime: 'free-surface',
    flowCalculationType: 'free-surface',
    iterationLog: [],
    converged: true,
    calculationSteps: [],
    tuflowPierFLC: 0,
    tuflowSuperFLC: null,
    inputEcho: { flowArea: 50, hydraulicRadius: 2.5, bridgeOpeningArea: 40, pierBlockage: 0 },
    error: null,
  };
}

function makeResults(usWsel: number, profileName = 'Q100'): CalculationResults {
  const r = makeMethodResult(usWsel, profileName);
  return { energy: [r], momentum: [r], yarnell: [r], wspro: [r] };
}

/* ── Tests ───────────────────────────────────────────────────────── */

describe('runReachAnalysis', () => {
  beforeEach(() => {
    mockedRunAllMethods.mockReset();
  });

  it('single bridge behaves the same as a normal run', () => {
    const bridge = makeBridge();
    const profile = makeProfile();
    const expectedResults = makeResults(7.5);

    mockedRunAllMethods.mockReturnValueOnce(expectedResults);

    const result = runReachAnalysis([bridge], [profile]);

    expect(result.bridgeResults).toHaveLength(1);
    expect(result.bridgeResults[0].bridgeId).toBe('bridge-1');
    expect(result.bridgeResults[0].results).toBe(expectedResults);
    expect(result.tailwaterCascade).toHaveLength(1);
    expect(result.tailwaterCascade[0].dsWsel).toBe(7.0);
    expect(result.tailwaterCascade[0].usWsel).toBe(7.5);
  });

  it('two bridges: upstream bridge gets modified tailwater', () => {
    const dsBridge = makeBridge({ id: 'ds', chainage: 100 });
    const usBridge = makeBridge({ id: 'us', chainage: 200 });
    const profile = makeProfile({ dsWsel: 7.0 });

    // Downstream bridge produces usWsel = 7.5
    const dsResults = makeResults(7.5);
    // Upstream bridge should receive dsWsel = 7.5 and produce usWsel = 8.0
    const usResults = makeResults(8.0);

    mockedRunAllMethods.mockReturnValueOnce(dsResults);
    mockedRunAllMethods.mockReturnValueOnce(usResults);

    const result = runReachAnalysis([dsBridge, usBridge], [profile]);

    // Should process downstream first (higher chainage = usBridge? No, chainage 200 > 100 so sorted descending: usBridge first? Wait...)
    // Actually chainage descending means higher chainage first. But the spec says downstream first.
    // chainage 200 (us) > chainage 100 (ds). Sorted descending = [200, 100].
    // But bridge at chainage 200 is upstream...
    // The spec says "sort by chainage descending (downstream first)" implying higher chainage = downstream.
    // The solver sorts descending, so chainage 200 processes first, then 100.

    expect(mockedRunAllMethods).toHaveBeenCalledTimes(2);

    // First call: the bridge with higher chainage (200) gets original dsWsel=7.0
    const firstCallProfiles = mockedRunAllMethods.mock.calls[0][2] as FlowProfile[];
    expect(firstCallProfiles[0].dsWsel).toBe(7.0);

    // Second call: the bridge with lower chainage (100) gets modified dsWsel=7.5
    const secondCallProfiles = mockedRunAllMethods.mock.calls[1][2] as FlowProfile[];
    expect(secondCallProfiles[0].dsWsel).toBe(7.5);

    expect(result.bridgeResults).toHaveLength(2);
    expect(result.tailwaterCascade).toHaveLength(2);
  });

  it('sorts bridges by chainage descending', () => {
    const bridgeA = makeBridge({ id: 'a', chainage: 50 });
    const bridgeB = makeBridge({ id: 'b', chainage: 300 });
    const bridgeC = makeBridge({ id: 'c', chainage: 150 });
    const profile = makeProfile();

    mockedRunAllMethods.mockReturnValue(makeResults(7.5));

    const result = runReachAnalysis([bridgeA, bridgeB, bridgeC], [profile]);

    // Order should be: B (300), C (150), A (50)
    expect(result.bridgeResults[0].bridgeId).toBe('b');
    expect(result.bridgeResults[1].bridgeId).toBe('c');
    expect(result.bridgeResults[2].bridgeId).toBe('a');
  });

  it('skips bridges with incomplete configuration (too few cross-section points)', () => {
    const complete = makeBridge({ id: 'complete', chainage: 100 });
    const incomplete = makeBridge({
      id: 'incomplete',
      chainage: 200,
      crossSection: [{ station: 0, elevation: 10, manningsN: 0.035, bankStation: null }], // only 1 point
    });
    const profile = makeProfile();

    mockedRunAllMethods.mockReturnValue(makeResults(7.5));

    const result = runReachAnalysis([complete, incomplete], [profile]);

    expect(result.bridgeResults).toHaveLength(1);
    expect(result.bridgeResults[0].bridgeId).toBe('complete');
    expect(mockedRunAllMethods).toHaveBeenCalledTimes(1);
  });

  it('skips bridges with highChord === 0', () => {
    const complete = makeBridge({ id: 'complete', chainage: 100 });
    const noChord = makeBridge({
      id: 'nochord',
      chainage: 200,
      bridgeGeometry: {
        lowChordLeft: 0,
        lowChordRight: 0,
        highChord: 0,
        leftAbutmentStation: 0,
        rightAbutmentStation: 0,
        skewAngle: 0,
        contractionLength: 0,
        expansionLength: 0,
        orificeCd: 0.8,
        weirCw: 1.4,
        deckWidth: 0,
        piers: [],
        lowChordProfile: [],
      },
    });
    const profile = makeProfile();

    mockedRunAllMethods.mockReturnValue(makeResults(7.5));

    const result = runReachAnalysis([complete, noChord], [profile]);

    expect(result.bridgeResults).toHaveLength(1);
    expect(result.bridgeResults[0].bridgeId).toBe('complete');
  });

  it('returns empty results for no bridges', () => {
    const result = runReachAnalysis([], [makeProfile()]);
    expect(result.bridgeResults).toHaveLength(0);
    expect(result.tailwaterCascade).toHaveLength(0);
  });

  it('returns empty results for no profiles', () => {
    const bridge = makeBridge();
    mockedRunAllMethods.mockReturnValue({ energy: [], momentum: [], yarnell: [], wspro: [] });

    const result = runReachAnalysis([bridge], []);
    // The bridge should still be processed even with empty profiles
    expect(result.bridgeResults).toHaveLength(1);
  });
});
