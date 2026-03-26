import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '@/store/project-store';

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('has default state', () => {
    const state = useProjectStore.getState();
    expect(state.crossSection).toEqual([]);
    expect(state.results).toBeNull();
    expect(state.coefficients.contractionCoeff).toBe(0.3);
  });

  it('updates cross section', () => {
    const points = [
      { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' as const },
    ];
    useProjectStore.getState().updateCrossSection(points);
    expect(useProjectStore.getState().crossSection).toEqual(points);
  });

  it('clears results', () => {
    useProjectStore.getState().setResults({
      energy: [], momentum: [], yarnell: [], wspro: [],
    });
    useProjectStore.getState().clearResults();
    expect(useProjectStore.getState().results).toBeNull();
  });

  it('exports and imports project', () => {
    const points = [
      { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' as const },
    ];
    useProjectStore.getState().updateCrossSection(points);
    const json = useProjectStore.getState().exportProject();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.crossSection).toEqual(points);

    // Reset and reimport
    useProjectStore.getState().reset();
    expect(useProjectStore.getState().crossSection).toEqual([]);

    useProjectStore.getState().importProject(json);
    expect(useProjectStore.getState().crossSection).toEqual(points);
  });
});
