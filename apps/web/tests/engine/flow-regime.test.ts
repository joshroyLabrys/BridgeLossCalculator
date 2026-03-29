import { describe, it, expect } from 'vitest';
import { detectFlowRegime } from '@flowsuite/engine/flow-regime';

describe('detectFlowRegime', () => {
  it('returns free-surface when WSEL < low chord', () => {
    expect(detectFlowRegime(95, 98, 102)).toBe('free-surface');
  });

  it('returns pressure when low chord < WSEL < high chord', () => {
    expect(detectFlowRegime(100, 98, 102)).toBe('pressure');
  });

  it('returns overtopping when WSEL > high chord', () => {
    expect(detectFlowRegime(105, 98, 102)).toBe('overtopping');
  });

  it('returns free-surface when WSEL equals low chord', () => {
    expect(detectFlowRegime(98, 98, 102)).toBe('free-surface');
  });

  it('returns pressure when WSEL equals high chord', () => {
    expect(detectFlowRegime(102, 98, 102)).toBe('pressure');
  });
});
