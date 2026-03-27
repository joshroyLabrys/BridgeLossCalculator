import { CrossSectionPoint, BridgeGeometry, FlowProfile } from '@/engine/types';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export function validateInputs(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (crossSection.length < 2) {
    errors.push({ field: 'crossSection', message: 'At least 2 cross-section points required', severity: 'error' });
  }

  const hasLeftBank = crossSection.some(p => p.bankStation === 'left');
  const hasRightBank = crossSection.some(p => p.bankStation === 'right');
  if (!hasLeftBank || !hasRightBank) {
    errors.push({ field: 'crossSection', message: 'Left and right bank stations must be defined', severity: 'error' });
  }

  for (let i = 0; i < crossSection.length; i++) {
    if (crossSection[i].manningsN <= 0) {
      errors.push({ field: `crossSection[${i}].manningsN`, message: "Manning's n must be positive", severity: 'error' });
    }
  }

  if (bridge.leftAbutmentStation >= bridge.rightAbutmentStation) {
    errors.push({ field: 'bridge', message: 'Left abutment must be left of right abutment', severity: 'error' });
  }

  if (bridge.lowChordLeft >= bridge.highChord || bridge.lowChordRight >= bridge.highChord) {
    errors.push({ field: 'bridge', message: 'Low chord must be below high chord', severity: 'error' });
  }

  if (profiles.length === 0) {
    errors.push({ field: 'profiles', message: 'At least one flow profile required', severity: 'error' });
  }

  for (let i = 0; i < profiles.length; i++) {
    if (profiles[i].discharge <= 0) {
      errors.push({ field: `profiles[${i}].discharge`, message: 'Discharge must be positive', severity: 'error' });
    }
  }

  return errors;
}
