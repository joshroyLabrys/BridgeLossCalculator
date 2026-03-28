import { describe, it, expect } from 'vitest';
import { assessMethodSuitability, MethodFlag } from '@/engine/method-suitability';
import { CalculationResults, BridgeGeometry, MethodResult } from '@/engine/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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
  contractionLength: 50,
  expansionLength: 50,
  orificeCd: 0.8,
  weirCw: 1.4,
  deckWidth: 10,
  piers: [],
  lowChordProfile: [],
};

function emptyResults(): CalculationResults {
  return { energy: [], momentum: [], yarnell: [], wspro: [] };
}

function flagFor(flags: MethodFlag[], method: MethodFlag['method']): MethodFlag {
  const f = flags.find((f) => f.method === method);
  if (!f) throw new Error(`No flag for ${method}`);
  return f;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('assessMethodSuitability', () => {
  describe('1. All OK when conditions are normal', () => {
    it('returns ok for all methods with valid results', () => {
      const result = makeResult();
      const results: CalculationResults = {
        energy: [result],
        momentum: [result],
        yarnell: [result],
        wspro: [result],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      for (const flag of flags) {
        expect(flag.level).toBe('ok');
        expect(flag.reason).toBeNull();
      }
    });

    it('returns ok for empty method arrays', () => {
      const flags = assessMethodSuitability(emptyResults(), BRIDGE);
      expect(flags).toHaveLength(4);
      for (const flag of flags) {
        expect(flag.level).toBe('ok');
      }
    });
  });

  describe('2. Yarnell flagged as not-applicable under pressure flow', () => {
    it('flags yarnell not-applicable when energy reference shows pressure flow', () => {
      const energyResult = makeResult({ flowRegime: 'pressure' });
      const yarnellResult = makeResult({ flowRegime: 'free-surface' }); // yarnell itself ok, but energy says pressure
      const results: CalculationResults = {
        ...emptyResults(),
        energy: [energyResult],
        yarnell: [yarnellResult],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      const flag = flagFor(flags, 'yarnell');
      expect(flag.level).toBe('not-applicable');
      expect(flag.reason).toContain('Pressure/Overtopping');
      expect(flag.reason).toContain('Q100');
    });

    it('flags yarnell not-applicable when energy reference shows overtopping flow', () => {
      const energyResult = makeResult({ flowRegime: 'overtopping' });
      const yarnellResult = makeResult();
      const results: CalculationResults = {
        ...emptyResults(),
        energy: [energyResult],
        yarnell: [yarnellResult],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      expect(flagFor(flags, 'yarnell').level).toBe('not-applicable');
    });

    it('does not flag yarnell when all profiles are free-surface', () => {
      const result = makeResult({ flowRegime: 'free-surface' });
      const results: CalculationResults = {
        ...emptyResults(),
        energy: [result],
        yarnell: [result],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      expect(flagFor(flags, 'yarnell').level).toBe('ok');
    });
  });

  describe('3. Energy flagged as caution when Froude is high', () => {
    it('flags caution when froudeApproach > 0.8', () => {
      const result = makeResult({ froudeApproach: 0.85 });
      const results: CalculationResults = { ...emptyResults(), energy: [result] };
      const flags = assessMethodSuitability(results, BRIDGE);
      const flag = flagFor(flags, 'energy');
      expect(flag.level).toBe('caution');
      expect(flag.reason).toContain('approach Froude');
      expect(flag.reason).toContain('0.85');
    });

    it('flags caution when froudeBridge > 0.9', () => {
      const result = makeResult({ froudeBridge: 0.95 });
      const results: CalculationResults = { ...emptyResults(), energy: [result] };
      const flags = assessMethodSuitability(results, BRIDGE);
      const flag = flagFor(flags, 'energy');
      expect(flag.level).toBe('caution');
      expect(flag.reason).toContain('bridge Froude');
    });

    it('does not flag caution when Froude numbers are at boundary (exactly 0.8 / 0.9)', () => {
      const result = makeResult({ froudeApproach: 0.8, froudeBridge: 0.9 });
      const results: CalculationResults = { ...emptyResults(), energy: [result] };
      const flags = assessMethodSuitability(results, BRIDGE);
      expect(flagFor(flags, 'energy').level).toBe('ok');
    });
  });

  describe('4. Methods with errors flagged as error level', () => {
    it('flags energy as error when result has error', () => {
      const result = makeResult({ error: 'Calculation failed' });
      const results: CalculationResults = { ...emptyResults(), energy: [result] };
      const flags = assessMethodSuitability(results, BRIDGE);
      expect(flagFor(flags, 'energy').level).toBe('error');
    });

    it('flags momentum as error when result has error', () => {
      const result = makeResult({ error: 'Momentum solver diverged' });
      const results: CalculationResults = { ...emptyResults(), momentum: [result] };
      const flags = assessMethodSuitability(results, BRIDGE);
      expect(flagFor(flags, 'momentum').level).toBe('error');
    });

    it('flags yarnell as error when result has error (free-surface regime)', () => {
      const energyResult = makeResult({ flowRegime: 'free-surface' });
      const yarnellResult = makeResult({ error: 'Yarnell error', flowRegime: 'free-surface' });
      const results: CalculationResults = {
        ...emptyResults(),
        energy: [energyResult],
        yarnell: [yarnellResult],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      expect(flagFor(flags, 'yarnell').level).toBe('error');
    });

    it('flags wspro as error when result has error', () => {
      const result = makeResult({ error: 'WSPRO diverged' });
      const results: CalculationResults = { ...emptyResults(), wspro: [result] };
      const flags = assessMethodSuitability(results, BRIDGE);
      expect(flagFor(flags, 'wspro').level).toBe('error');
    });
  });

  describe('5. Non-converged methods flagged as caution', () => {
    it('flags energy caution when not converged', () => {
      const result = makeResult({ converged: false });
      const results: CalculationResults = { ...emptyResults(), energy: [result] };
      const flags = assessMethodSuitability(results, BRIDGE);
      const flag = flagFor(flags, 'energy');
      expect(flag.level).toBe('caution');
      expect(flag.reason).toContain('converge');
    });

    it('flags momentum caution when not converged', () => {
      const result = makeResult({ converged: false });
      const results: CalculationResults = { ...emptyResults(), momentum: [result] };
      const flags = assessMethodSuitability(results, BRIDGE);
      expect(flagFor(flags, 'momentum').level).toBe('caution');
    });

    it('flags wspro caution when not converged', () => {
      const result = makeResult({ converged: false });
      const results: CalculationResults = { ...emptyResults(), wspro: [result] };
      const flags = assessMethodSuitability(results, BRIDGE);
      expect(flagFor(flags, 'wspro').level).toBe('caution');
    });
  });

  describe('6. Worst-case profile used for flags', () => {
    it('returns worst level across multiple profiles (error beats caution)', () => {
      const okResult = makeResult({ profileName: 'Q10' });
      const errorResult = makeResult({ profileName: 'Q100', error: 'Diverged' });
      const cautionResult = makeResult({ profileName: 'PMF', froudeApproach: 0.85 });
      const results: CalculationResults = {
        ...emptyResults(),
        energy: [okResult, cautionResult, errorResult],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      const flag = flagFor(flags, 'energy');
      expect(flag.level).toBe('error');
      expect(flag.profile).toBe('Q100');
    });

    it('returns worst level across multiple profiles (not-applicable beats caution for yarnell)', () => {
      const freeSurfaceEnergy = makeResult({ profileName: 'Q10', flowRegime: 'free-surface' });
      const pressureEnergy = makeResult({ profileName: 'Q100', flowRegime: 'pressure' });
      const yarnellQ10 = makeResult({ profileName: 'Q10' });
      const yarnellQ100 = makeResult({ profileName: 'Q100' });
      const results: CalculationResults = {
        ...emptyResults(),
        energy: [freeSurfaceEnergy, pressureEnergy],
        yarnell: [yarnellQ10, yarnellQ100],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      const flag = flagFor(flags, 'yarnell');
      expect(flag.level).toBe('not-applicable');
      expect(flag.profile).toBe('Q100');
    });

    it('uses the worst profile name in the returned flag', () => {
      const okResult = makeResult({ profileName: 'Q10' });
      const cautionResult = makeResult({ profileName: 'PMF', froudeApproach: 0.9 });
      const results: CalculationResults = {
        ...emptyResults(),
        energy: [okResult, cautionResult],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      const flag = flagFor(flags, 'energy');
      expect(flag.level).toBe('caution');
      expect(flag.profile).toBe('PMF');
    });
  });

  describe('7. WSPRO flagged as caution for severe constriction', () => {
    it('flags caution when opening ratio < 0.3', () => {
      // bridgeOpeningArea / flowArea < 0.3
      const energyResult = makeResult({
        inputEcho: { flowArea: 200, hydraulicRadius: 2.5, bridgeOpeningArea: 50, pierBlockage: 5 },
      });
      const wsproResult = makeResult();
      const results: CalculationResults = {
        ...emptyResults(),
        energy: [energyResult],
        wspro: [wsproResult],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      const flag = flagFor(flags, 'wspro');
      expect(flag.level).toBe('caution');
      expect(flag.reason).toContain('constriction');
    });

    it('does not flag caution when opening ratio >= 0.3', () => {
      const energyResult = makeResult({
        inputEcho: { flowArea: 100, hydraulicRadius: 2.5, bridgeOpeningArea: 60, pierBlockage: 5 },
      });
      const wsproResult = makeResult();
      const results: CalculationResults = {
        ...emptyResults(),
        energy: [energyResult],
        wspro: [wsproResult],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      expect(flagFor(flags, 'wspro').level).toBe('ok');
    });

    it('uses first energy result inputEcho when no profile name match', () => {
      // wspro result has profile 'PMF' but energy only has 'Q100'
      const energyResult = makeResult({
        profileName: 'Q100',
        inputEcho: { flowArea: 300, hydraulicRadius: 2.5, bridgeOpeningArea: 60, pierBlockage: 5 },
      });
      const wsproResult = makeResult({ profileName: 'PMF' });
      const results: CalculationResults = {
        ...emptyResults(),
        energy: [energyResult],
        wspro: [wsproResult],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      // 60/300 = 0.2 < 0.3, so caution
      const flag = flagFor(flags, 'wspro');
      expect(flag.level).toBe('caution');
    });
  });

  describe('Priority ordering', () => {
    it('error takes priority over not-applicable (yarnell with both pressure flow and error)', () => {
      // When yarnell has pressure flow (not-applicable) AND an error on a free-surface profile,
      // error should win overall
      const energyFree = makeResult({ profileName: 'Q10', flowRegime: 'free-surface' });
      const energyPressure = makeResult({ profileName: 'Q100', flowRegime: 'pressure' });
      const yarnellFree = makeResult({ profileName: 'Q10', error: 'Solver error' });
      const yarnellPressure = makeResult({ profileName: 'Q100' });
      const results: CalculationResults = {
        ...emptyResults(),
        energy: [energyFree, energyPressure],
        yarnell: [yarnellFree, yarnellPressure],
      };
      const flags = assessMethodSuitability(results, BRIDGE);
      expect(flagFor(flags, 'yarnell').level).toBe('error');
    });
  });
});
