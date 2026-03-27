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
    if (crossSection[i].manningsN > 0 && (crossSection[i].manningsN < 0.01 || crossSection[i].manningsN > 0.3)) {
      errors.push({ field: `crossSection[${i}].manningsN`, message: `Manning's n of ${crossSection[i].manningsN} at station ${crossSection[i].station} is unusual — verify`, severity: 'warning' });
    }
  }

  if (bridge.leftAbutmentStation >= bridge.rightAbutmentStation) {
    errors.push({ field: 'bridge', message: 'Left abutment must be left of right abutment', severity: 'error' });
  }

  if (bridge.lowChordLeft >= bridge.highChord || bridge.lowChordRight >= bridge.highChord) {
    errors.push({ field: 'bridge', message: 'Low chord must be below high chord', severity: 'error' });
  }

  // Abutment stations within cross-section bounds
  if (crossSection.length >= 2) {
    const minSta = crossSection[0].station;
    const maxSta = crossSection[crossSection.length - 1].station;
    if (bridge.leftAbutmentStation < minSta || bridge.leftAbutmentStation > maxSta) {
      errors.push({ field: 'bridge', message: `Left abutment station is outside the cross-section extents (${minSta}–${maxSta})`, severity: 'error' });
    }
    if (bridge.rightAbutmentStation < minSta || bridge.rightAbutmentStation > maxSta) {
      errors.push({ field: 'bridge', message: `Right abutment station is outside the cross-section extents (${minSta}–${maxSta})`, severity: 'error' });
    }
  }

  // Pier stations within abutment range
  for (let i = 0; i < bridge.piers.length; i++) {
    const pier = bridge.piers[i];
    if (pier.station < bridge.leftAbutmentStation || pier.station > bridge.rightAbutmentStation) {
      errors.push({ field: `bridge.piers[${i}]`, message: `Pier ${i + 1} station (${pier.station}) is outside the bridge opening (${bridge.leftAbutmentStation}–${bridge.rightAbutmentStation})`, severity: 'error' });
    }
  }

  // Reach lengths
  if (bridge.contractionLength <= 0 || bridge.expansionLength <= 0) {
    errors.push({ field: 'bridge', message: 'Reach lengths must be positive', severity: 'error' });
  }

  if (profiles.length === 0) {
    errors.push({ field: 'profiles', message: 'At least one flow profile required', severity: 'error' });
  }

  const minElev = crossSection.length > 0 ? Math.min(...crossSection.map(p => p.elevation)) : 0;
  for (let i = 0; i < profiles.length; i++) {
    if (profiles[i].discharge <= 0) {
      errors.push({ field: `profiles[${i}].discharge`, message: 'Discharge must be positive', severity: 'error' });
    }
    if (profiles[i].dsWsel < minElev) {
      errors.push({ field: `profiles[${i}].dsWsel`, message: `DS WSEL (${profiles[i].dsWsel.toFixed(2)}) is below the lowest cross-section elevation (${minElev.toFixed(2)})`, severity: 'error' });
    }
  }

  return errors;
}
