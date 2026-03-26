import { describe, it, expect } from 'vitest';
import { validateInputs } from '@/lib/validation';
import { CrossSectionPoint, BridgeGeometry, FlowProfile } from '@/engine/types';

const validCrossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const validBridge: BridgeGeometry = {
  lowChordLeft: 9, lowChordRight: 9, highChord: 12,
  leftAbutmentStation: 5, rightAbutmentStation: 95,
  leftAbutmentSlope: 0, rightAbutmentSlope: 0, skewAngle: 0,
  piers: [], lowChordProfile: [],
};

const validProfiles: FlowProfile[] = [
  { name: '10-yr', discharge: 2500, dsWsel: 8, channelSlope: 0.001, contractionLength: 90, expansionLength: 90 },
];

describe('validateInputs', () => {
  it('returns no errors for valid input', () => {
    expect(validateInputs(validCrossSection, validBridge, validProfiles)).toEqual([]);
  });

  it('errors on too few cross-section points', () => {
    const errors = validateInputs([validCrossSection[0]], validBridge, validProfiles);
    expect(errors.some(e => e.field === 'crossSection')).toBe(true);
  });

  it('errors on missing bank stations', () => {
    const noBanks = validCrossSection.map(p => ({ ...p, bankStation: null as const }));
    const errors = validateInputs(noBanks as CrossSectionPoint[], validBridge, validProfiles);
    expect(errors.some(e => e.message.includes('bank'))).toBe(true);
  });

  it('errors on negative mannings n', () => {
    const badN = validCrossSection.map((p, i) => i === 0 ? { ...p, manningsN: -0.01 } : p);
    const errors = validateInputs(badN, validBridge, validProfiles);
    expect(errors.some(e => e.message.includes("Manning's n"))).toBe(true);
  });

  it('errors on inverted abutments', () => {
    const errors = validateInputs(validCrossSection, { ...validBridge, leftAbutmentStation: 95, rightAbutmentStation: 5 }, validProfiles);
    expect(errors.some(e => e.message.includes('abutment'))).toBe(true);
  });

  it('errors on low chord above high chord', () => {
    const errors = validateInputs(validCrossSection, { ...validBridge, lowChordLeft: 15, highChord: 12 }, validProfiles);
    expect(errors.some(e => e.message.includes('chord'))).toBe(true);
  });

  it('errors on no profiles', () => {
    const errors = validateInputs(validCrossSection, validBridge, []);
    expect(errors.some(e => e.field === 'profiles')).toBe(true);
  });

  it('errors on zero discharge', () => {
    const errors = validateInputs(validCrossSection, validBridge, [{ ...validProfiles[0], discharge: 0 }]);
    expect(errors.some(e => e.message.includes('Discharge'))).toBe(true);
  });
});
