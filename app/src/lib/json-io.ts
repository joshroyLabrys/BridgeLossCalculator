import { ProjectState } from '@/engine/types';
import { UnitSystem } from '@/lib/units';

interface ExportData {
  version: number;
  unitSystem?: UnitSystem;
  crossSection: ProjectState['crossSection'];
  bridgeGeometry: ProjectState['bridgeGeometry'];
  flowProfiles: ProjectState['flowProfiles'];
  coefficients: ProjectState['coefficients'];
  hecRasComparison: ProjectState['hecRasComparison'];
}

export function serializeProject(
  state: Omit<ProjectState, 'results'> & { unitSystem?: UnitSystem }
): string {
  const data: ExportData = {
    version: 1,
    unitSystem: state.unitSystem,
    crossSection: state.crossSection,
    bridgeGeometry: state.bridgeGeometry,
    flowProfiles: state.flowProfiles,
    coefficients: state.coefficients,
    hecRasComparison: state.hecRasComparison,
  };
  return JSON.stringify(data, null, 2);
}

export function parseProjectJson(json: string): Omit<ProjectState, 'results'> & { unitSystem: UnitSystem } {
  let data: ExportData;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }

  if (!data.version || data.version !== 1) {
    throw new Error('Invalid or missing version field');
  }

  return {
    crossSection: data.crossSection ?? [],
    bridgeGeometry: data.bridgeGeometry,
    flowProfiles: data.flowProfiles ?? [],
    coefficients: data.coefficients,
    hecRasComparison: data.hecRasComparison ?? [],
    unitSystem: data.unitSystem ?? 'imperial',
  };
}
