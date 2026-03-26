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
    leftAbutmentSlope: 0,
    rightAbutmentSlope: 0,
    skewAngle: 0,
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
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
  hecRasComparison: [],
};

describe('serializeProject', () => {
  it('adds version field', () => {
    const json = serializeProject(minimalState);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
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
