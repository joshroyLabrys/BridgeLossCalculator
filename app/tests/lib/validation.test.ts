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
  skewAngle: 0, contractionLength: 90, expansionLength: 90,
  orificeCd: 0.8, weirCw: 1.4, deckWidth: 0,
  piers: [], lowChordProfile: [],
};

const validProfiles: FlowProfile[] = [
  { name: '10-yr', ari: '', discharge: 2500, dsWsel: 8, channelSlope: 0.001 },
];

describe('validateInputs', () => {
  it('returns no errors for valid input', () => {
    expect(validateInputs(validCrossSection, validBridge, validProfiles)).toEqual([]);
  });

  it('errors on too few cross-section points', () => {
    const errors = validateInputs([validCrossSection[0]], validBridge, validProfiles);
    expect(errors.some(e => e.field === 'crossSection' && e.severity === 'error')).toBe(true);
  });

  it('errors on missing bank stations', () => {
    const noBanks = validCrossSection.map(p => ({ ...p, bankStation: null as CrossSectionPoint['bankStation'] }));
    const errors = validateInputs(noBanks, validBridge, validProfiles);
    expect(errors.some(e => e.message.includes('bank') && e.severity === 'error')).toBe(true);
  });

  it('errors on negative mannings n', () => {
    const badN = validCrossSection.map((p, i) => i === 0 ? { ...p, manningsN: -0.01 } : p);
    const errors = validateInputs(badN, validBridge, validProfiles);
    expect(errors.some(e => e.message.includes("Manning's n") && e.severity === 'error')).toBe(true);
  });

  it('errors on inverted abutments', () => {
    const errors = validateInputs(validCrossSection, { ...validBridge, leftAbutmentStation: 95, rightAbutmentStation: 5 }, validProfiles);
    expect(errors.some(e => e.message.includes('abutment') && e.severity === 'error')).toBe(true);
  });

  it('errors on low chord above high chord', () => {
    const errors = validateInputs(validCrossSection, { ...validBridge, lowChordLeft: 15, highChord: 12 }, validProfiles);
    expect(errors.some(e => e.message.includes('chord') && e.severity === 'error')).toBe(true);
  });

  it('errors on no profiles', () => {
    const errors = validateInputs(validCrossSection, validBridge, []);
    expect(errors.some(e => e.field === 'profiles' && e.severity === 'error')).toBe(true);
  });

  it('errors on zero discharge', () => {
    const errors = validateInputs(validCrossSection, validBridge, [{ ...validProfiles[0], discharge: 0 }]);
    expect(errors.some(e => e.message.includes('Discharge') && e.severity === 'error')).toBe(true);
  });

  // New checks
  it('errors when DS WSEL is below channel invert', () => {
    const lowProfiles: FlowProfile[] = [{ name: 'Low', ari: '', discharge: 100, dsWsel: -1, channelSlope: 0.001 }];
    const errors = validateInputs(validCrossSection, validBridge, lowProfiles);
    expect(errors.some(e => e.severity === 'error' && e.message.includes('below'))).toBe(true);
  });

  it('errors when pier station is outside abutments', () => {
    const badPiers: BridgeGeometry = { ...validBridge, piers: [{ station: 200, width: 3, shape: 'round-nose' }] };
    const errors = validateInputs(validCrossSection, badPiers, validProfiles);
    expect(errors.some(e => e.severity === 'error' && e.message.includes('outside'))).toBe(true);
  });

  it('errors when abutment stations are outside cross-section', () => {
    const badBridge: BridgeGeometry = { ...validBridge, leftAbutmentStation: -50 };
    const errors = validateInputs(validCrossSection, badBridge, validProfiles);
    expect(errors.some(e => e.severity === 'error' && e.message.includes('outside'))).toBe(true);
  });

  it('errors when reach lengths are zero', () => {
    const noReach: BridgeGeometry = { ...validBridge, contractionLength: 0, expansionLength: 0 };
    const errors = validateInputs(validCrossSection, noReach, validProfiles);
    expect(errors.some(e => e.severity === 'error' && e.message.includes('positive'))).toBe(true);
  });

  it('warns on unusual mannings n', () => {
    const highN = validCrossSection.map((p, i) => i === 1 ? { ...p, manningsN: 0.5 } : p);
    const errors = validateInputs(highN, validBridge, validProfiles);
    expect(errors.some(e => e.severity === 'warning' && e.message.includes('unusual'))).toBe(true);
  });

  it('warns when DS WSEL is unreasonably high', () => {
    const highProfiles: FlowProfile[] = [{ name: 'High', ari: '', discharge: 100, dsWsel: 25, channelSlope: 0.001 }];
    const errors = validateInputs(validCrossSection, validBridge, highProfiles);
    expect(errors.some(e => e.severity === 'warning' && e.message.includes('unreasonably high'))).toBe(true);
  });

  it('warns when deck width is zero with overtopping expected', () => {
    const overtoppingProfiles: FlowProfile[] = [{ name: 'OT', ari: '', discharge: 5000, dsWsel: 15, channelSlope: 0.001 }];
    const zeroDeck: BridgeGeometry = { ...validBridge, deckWidth: 0 };
    const errors = validateInputs(validCrossSection, zeroDeck, overtoppingProfiles);
    expect(errors.some(e => e.severity === 'warning' && e.message.includes('zero'))).toBe(true);
  });
});
