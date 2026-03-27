import { describe, it, expect } from 'vitest';
import { parseProjectJson, serializeProject } from '@/lib/json-io';
import { ProjectState } from '@/engine/types';

const minimalState: Omit<ProjectState, 'results'> = {
  crossSection: [],
  bridgeGeometry: {
    lowChordLeft: 98,
    lowChordRight: 98,
    highChord: 102,
    leftAbutmentStation: 20,
    rightAbutmentStation: 80,
    skewAngle: 0,
    contractionLength: 0,
    expansionLength: 0,
    orificeCd: 0.8,
    weirCw: 1.4,
    deckWidth: 0,
    piers: [],
    lowChordProfile: [],
  },
  flowProfiles: [],
  coefficients: {
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
  hecRasComparison: [],
};

describe('serializeProject', () => {
  it('adds version field', () => {
    const json = serializeProject(minimalState);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(2);
  });

  it('excludes results', () => {
    const json = serializeProject(minimalState);
    const parsed = JSON.parse(json);
    expect(parsed.results).toBeUndefined();
  });
});

describe('parseProjectJson', () => {
  it('parses valid JSON', () => {
    const json = serializeProject(minimalState);
    const result = parseProjectJson(json);
    expect(result.crossSection).toEqual([]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseProjectJson('not json')).toThrow();
  });

  it('throws on missing version', () => {
    expect(() => parseProjectJson('{}')).toThrow();
  });
});

describe('parseProjectJson backward compatibility', () => {
  it('migrates contractionLength/expansionLength from flowProfiles to bridgeGeometry', () => {
    const oldJson = JSON.stringify({
      version: 1,
      crossSection: [],
      bridgeGeometry: {
        lowChordLeft: 9, lowChordRight: 9, highChord: 12,
        leftAbutmentStation: 5, rightAbutmentStation: 95,
        leftAbutmentSlope: 0, rightAbutmentSlope: 0,
        skewAngle: 0, piers: [], lowChordProfile: [],
      },
      flowProfiles: [
        { name: 'Q100', ari: '1% AEP', discharge: 100, dsWsel: 5, channelSlope: 0.001, contractionLength: 80, expansionLength: 120 },
      ],
      coefficients: {
        contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
        maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
        debrisBlockagePct: 0, manningsNSensitivityPct: null,
        methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
      },
      hecRasComparison: [],
    });

    const data = parseProjectJson(oldJson);

    expect(data.bridgeGeometry.contractionLength).toBe(80);
    expect(data.bridgeGeometry.expansionLength).toBe(120);
    expect((data.bridgeGeometry as any).leftAbutmentSlope).toBeUndefined();
    expect((data.bridgeGeometry as any).rightAbutmentSlope).toBeUndefined();
    expect(data.bridgeGeometry.orificeCd).toBe(0.8);
    expect(data.bridgeGeometry.weirCw).toBe(1.4);
    expect(data.bridgeGeometry.deckWidth).toBe(0);
    expect((data.flowProfiles[0] as any).contractionLength).toBeUndefined();
    expect((data.flowProfiles[0] as any).expansionLength).toBeUndefined();
    expect(data.coefficients.alphaOverride).toBeNull();
    expect(data.coefficients.freeboardThreshold).toBeCloseTo(0.984, 2);
  });
});
