export interface CrossSectionPoint {
  station: number;
  elevation: number;
  manningsN: number;
  bankStation: 'left' | 'right' | null;
}

export interface Pier {
  station: number;
  width: number;
  shape: 'square' | 'round-nose' | 'cylindrical' | 'sharp';
}

export interface LowChordPoint {
  station: number;
  elevation: number;
}

export interface BridgeGeometry {
  lowChordLeft: number;
  lowChordRight: number;
  highChord: number;
  leftAbutmentStation: number;
  rightAbutmentStation: number;
  skewAngle: number;
  contractionLength: number;
  expansionLength: number;
  orificeCd: number;
  weirCw: number;
  deckWidth: number;
  piers: Pier[];
  lowChordProfile: LowChordPoint[];
}

export interface FlowProfile {
  name: string;
  ari: string;              // e.g. "1% AEP", "Q100", "PMF"
  discharge: number;
  dsWsel: number;
  channelSlope: number;
}

export interface Coefficients {
  contractionCoeff: number;
  expansionCoeff: number;
  yarnellK: number | null;
  maxIterations: number;
  tolerance: number;
  initialGuessOffset: number;
  debrisBlockagePct: number;       // 0-100, default 0
  manningsNSensitivityPct: number | null; // null or 0 = off, e.g. 20 means ±20%
  alphaOverride: number | null;
  freeboardThreshold: number;
  methodsToRun: {
    energy: boolean;
    momentum: boolean;
    yarnell: boolean;
    wspro: boolean;
  };
}

export type FlowRegime = 'free-surface' | 'pressure' | 'overtopping';

export interface IterationStep {
  iteration: number;
  trialWsel: number;
  computedWsel: number;
  error: number;
}

export interface CalculationStep {
  stepNumber: number;
  description: string;
  formula: string;
  intermediateValues: Record<string, number>;
  result: number;
  unit: string;
}

export interface MethodResult {
  profileName: string;
  upstreamWsel: number;
  totalHeadLoss: number;
  approachVelocity: number;
  bridgeVelocity: number;
  froudeApproach: number;
  froudeBridge: number;
  flowRegime: FlowRegime;
  flowCalculationType: 'free-surface' | 'orifice' | 'orifice+weir';
  iterationLog: IterationStep[];
  converged: boolean;
  calculationSteps: CalculationStep[];
  tuflowPierFLC: number;
  tuflowSuperFLC: number | null;
  inputEcho: {
    flowArea: number;
    hydraulicRadius: number;
    bridgeOpeningArea: number;
    pierBlockage: number;
  };
  error: string | null;
}

export interface HecRasComparison {
  profileName: string;
  upstreamWsel: number | null;
  headLoss: number | null;
  pierFLC: number | null;
  superFLC: number | null;
}

export interface CalculationResults {
  energy: MethodResult[];
  momentum: MethodResult[];
  yarnell: MethodResult[];
  wspro: MethodResult[];
}

export interface ProjectState {
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  flowProfiles: FlowProfile[];
  coefficients: Coefficients;
  results: CalculationResults | null;
  hecRasComparison: HecRasComparison[];
}

export interface FreeboardResult {
  profileName: string;
  ari: string;
  discharge: number;
  dsWsel: number;
  usWsel: number;
  lowChord: number;
  freeboard: number;
  status: 'clear' | 'low' | 'pressure' | 'overtopping';
}

export interface FreeboardSummary {
  profiles: FreeboardResult[];
  zeroFreeboardQ: number | null;
}

export interface SensitivityResults {
  low: CalculationResults;
  high: CalculationResults;
}

// ── Scour types ──
export type BedMaterial = 'sand' | 'gravel' | 'cobble' | 'clay' | 'rock';

export interface ScourInputs {
  bedMaterial: BedMaterial;
  d50: number;
  d95: number;
  upstreamBedElevation: number;
  countermeasure: 'none' | 'riprap' | 'sheet-pile' | 'gabions' | 'other';
}

export interface PierScourResult {
  pierIndex: number;
  station: number;
  width: number;
  k1: number;
  k2: number;
  k3: number;
  scourDepth: number;
  criticalBedElevation: number;
}

export interface ContractionScourResult {
  type: 'live-bed' | 'clear-water';
  criticalVelocity: number;
  approachVelocity: number;
  contractedDepth: number;
  existingDepth: number;
  scourDepth: number;
  criticalBedElevation: number;
}

export interface ScourResults {
  profileName: string;
  pierScour: PierScourResult[];
  contractionScour: ContractionScourResult;
  totalWorstCase: number;
}

// ── Hydrology types ──
export interface IFDTable {
  durations: number[];
  aeps: string[];
  intensities: number[][];
}

export interface HydrologyState {
  location: { lat: number; lng: number } | null;
  catchmentArea: number;
  streamLength: number;
  equalAreaSlope: number;
  ifdData: IFDTable | null;
  tcMethod: 'bransby-williams' | 'friends' | 'manual';
  tcManual: number;
  runoffCoefficient: number;
  calculatedDischarges: { aep: string; q: number }[];
}

// ── Adequacy types ──
export interface AdequacyResult {
  profileName: string;
  ari: string;
  discharge: number;
  worstCaseWsel: number;
  regime: FlowRegime;
  freeboard: number;
  status: 'clear' | 'low' | 'pressure' | 'overtopping';
}

export interface AdequacyResults {
  profiles: AdequacyResult[];
  pressureOnsetQ: number | null;
  overtoppingOnsetQ: number | null;
  zeroFreeboardQ: number | null;
  verdict: string;
  verdictSeverity: 'pass' | 'warning' | 'fail';
}

// ── Regulatory types ──
export type Jurisdiction = 'tmr' | 'vicroads' | 'dpie' | 'arr';

export interface ChecklistItem {
  id: string;
  requirement: string;
  jurisdiction: Jurisdiction;
  autoCheck: boolean;
  status: 'pass' | 'fail' | 'manual-pass' | 'manual-fail' | 'not-assessed';
}

// ── Narrative types ──
export interface NarrativeSection {
  id: string;
  title: string;
  description: string;
  content: string;
  status: 'empty' | 'generated' | 'edited';
}

// ── Snapshot types ──
export interface ProjectSnapshot {
  id: string;
  name: string;
  note: string;
  timestamp: number;
  summaryLine: string;
  state: SerializedProjectState;
}

export interface SerializedProjectState {
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  flowProfiles: FlowProfile[];
  coefficients: Coefficients;
  results: CalculationResults | null;
  hecRasComparison: HecRasComparison[];
  scourInputs: ScourInputs;
  scourResults: ScourResults[] | null;
  adequacyResults: AdequacyResults | null;
  regulatoryJurisdiction: Jurisdiction;
  regulatoryChecklist: ChecklistItem[];
  narrativeSections: NarrativeSection[];
  narrativeTone: 'technical' | 'summary';
  hydrology: HydrologyState;
}

// ── Multi-bridge types ──
export interface BridgeProject {
  id: string;
  name: string;
  chainage: number;
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  coefficients: Coefficients;
  results: CalculationResults | null;
  scourInputs: ScourInputs;
  scourResults: ScourResults[] | null;
}

export interface ReachResults {
  bridgeResults: { bridgeId: string; results: CalculationResults }[];
  tailwaterCascade: { bridgeId: string; dsWsel: number; usWsel: number }[];
}
