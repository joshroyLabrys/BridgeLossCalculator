import { describe, it, expect } from 'vitest';
import { calcEffectiveWeirLength } from '@/engine/deck-profile';

describe('calcEffectiveWeirLength', () => {
  it('returns deckWidth when skew is 0', () => {
    expect(calcEffectiveWeirLength(10, 0)).toBe(10);
  });

  it('reduces length by cos(skew) for skewed bridges', () => {
    expect(calcEffectiveWeirLength(10, 30)).toBeCloseTo(8.66, 1);
  });

  it('returns 0 for deckWidth 0', () => {
    expect(calcEffectiveWeirLength(0, 0)).toBe(0);
  });
});
