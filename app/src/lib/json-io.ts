import { ProjectState } from '@/engine/types';

interface ExportData {
  version: number;
  crossSection: ProjectState['crossSection'];
  bridgeGeometry: ProjectState['bridgeGeometry'];
  flowProfiles: ProjectState['flowProfiles'];
  coefficients: ProjectState['coefficients'];
  hecRasComparison: ProjectState['hecRasComparison'];
}

export function serializeProject(
  state: Omit<ProjectState, 'results'>
): string {
  const data: ExportData = {
    version: 1,
    crossSection: state.crossSection,
    bridgeGeometry: state.bridgeGeometry,
    flowProfiles: state.flowProfiles,
    coefficients: state.coefficients,
    hecRasComparison: state.hecRasComparison,
  };
  return JSON.stringify(data, null, 2);
}

export function parseProjectJson(json: string): Omit<ProjectState, 'results'> {
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
  };
}
