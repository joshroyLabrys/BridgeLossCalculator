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
  leftAbutmentSlope: number;
  rightAbutmentSlope: number;
  skewAngle: number;
  piers: Pier[];
  lowChordProfile: LowChordPoint[];
}

export interface FlowProfile {
  name: string;
  discharge: number;
  dsWsel: number;
  channelSlope: number;
  contractionLength: number;
  expansionLength: number;
}

export interface Coefficients {
  contractionCoeff: number;
  expansionCoeff: number;
  yarnellK: number | null;
  maxIterations: number;
  tolerance: number;
  initialGuessOffset: number;
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
