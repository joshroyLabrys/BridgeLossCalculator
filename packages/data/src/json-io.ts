import { ProjectState, BridgeGeometry, FlowProfile, Coefficients } from '@flowsuite/engine/types';
import { UnitSystem } from './units';

interface ExportData {
  version: number;
  unitSystem?: UnitSystem;
  crossSection: ProjectState['crossSection'];
  bridgeGeometry: ProjectState['bridgeGeometry'];
  flowProfiles: ProjectState['flowProfiles'];
  coefficients: ProjectState['coefficients'];
  hecRasComparison: ProjectState['hecRasComparison'];
}

const BRIDGE_DEFAULTS: Pick<BridgeGeometry, 'contractionLength' | 'expansionLength' | 'orificeCd' | 'weirCw' | 'deckWidth'> = {
  contractionLength: 0,
  expansionLength: 0,
  orificeCd: 0.8,
  weirCw: 1.4,
  deckWidth: 0,
};

const COEFF_DEFAULTS: Pick<Coefficients, 'alphaOverride' | 'freeboardThreshold'> = {
  alphaOverride: null,
  freeboardThreshold: 0.984,
};

export function serializeProject(
  state: Omit<ProjectState, 'results'> & { unitSystem?: UnitSystem }
): string {
  const data: ExportData = {
    version: 2,
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
  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }

  if (!raw.version || (raw.version !== 1 && raw.version !== 2)) {
    throw new Error('Invalid or missing version field');
  }

  const rawBridge = raw.bridgeGeometry ?? {};
  const rawProfiles: any[] = raw.flowProfiles ?? [];

  // Migrate v1: move reach lengths from flowProfiles to bridgeGeometry
  const contractionLength = rawBridge.contractionLength ?? rawProfiles[0]?.contractionLength ?? 0;
  const expansionLength = rawBridge.expansionLength ?? rawProfiles[0]?.expansionLength ?? 0;

  const bridgeGeometry: BridgeGeometry = {
    lowChordLeft: rawBridge.lowChordLeft ?? 0,
    lowChordRight: rawBridge.lowChordRight ?? 0,
    highChord: rawBridge.highChord ?? 0,
    leftAbutmentStation: rawBridge.leftAbutmentStation ?? 0,
    rightAbutmentStation: rawBridge.rightAbutmentStation ?? 0,
    skewAngle: rawBridge.skewAngle ?? 0,
    contractionLength,
    expansionLength,
    orificeCd: rawBridge.orificeCd ?? BRIDGE_DEFAULTS.orificeCd,
    weirCw: rawBridge.weirCw ?? BRIDGE_DEFAULTS.weirCw,
    deckWidth: rawBridge.deckWidth ?? BRIDGE_DEFAULTS.deckWidth,
    piers: rawBridge.piers ?? [],
    lowChordProfile: rawBridge.lowChordProfile ?? [],
  };

  const flowProfiles: FlowProfile[] = rawProfiles.map((p: any) => ({
    name: p.name ?? '',
    ari: p.ari ?? '',
    discharge: p.discharge ?? 0,
    dsWsel: p.dsWsel ?? 0,
    channelSlope: p.channelSlope ?? 0,
  }));

  const rawCoeffs = raw.coefficients ?? {};
  const coefficients: Coefficients = {
    contractionCoeff: rawCoeffs.contractionCoeff ?? 0.3,
    expansionCoeff: rawCoeffs.expansionCoeff ?? 0.5,
    yarnellK: rawCoeffs.yarnellK ?? null,
    maxIterations: rawCoeffs.maxIterations ?? 100,
    tolerance: rawCoeffs.tolerance ?? 0.01,
    initialGuessOffset: rawCoeffs.initialGuessOffset ?? 0.5,
    debrisBlockagePct: rawCoeffs.debrisBlockagePct ?? 0,
    manningsNSensitivityPct: rawCoeffs.manningsNSensitivityPct ?? null,
    alphaOverride: rawCoeffs.alphaOverride ?? COEFF_DEFAULTS.alphaOverride,
    freeboardThreshold: rawCoeffs.freeboardThreshold ?? COEFF_DEFAULTS.freeboardThreshold,
    methodsToRun: rawCoeffs.methodsToRun ?? { energy: true, momentum: true, yarnell: true, wspro: true },
  };

  return {
    crossSection: raw.crossSection ?? [],
    bridgeGeometry,
    flowProfiles,
    coefficients,
    hecRasComparison: raw.hecRasComparison ?? [],
    unitSystem: raw.unitSystem ?? 'imperial',
  };
}
