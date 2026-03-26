import { create } from 'zustand';
import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  CalculationResults,
  HecRasComparison,
  SensitivityResults,
} from '@/engine/types';
import { serializeProject, parseProjectJson } from '@/lib/json-io';
import { UnitSystem } from '@/lib/units';

interface ProjectStore {
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  flowProfiles: FlowProfile[];
  coefficients: Coefficients;
  results: CalculationResults | null;
  hecRasComparison: HecRasComparison[];
  unitSystem: UnitSystem;
  sensitivityResults: SensitivityResults | null;
  projectName: string;

  updateCrossSection: (points: CrossSectionPoint[]) => void;
  updateBridgeGeometry: (geom: BridgeGeometry) => void;
  updateFlowProfiles: (profiles: FlowProfile[]) => void;
  updateCoefficients: (coeffs: Coefficients) => void;
  setResults: (results: CalculationResults) => void;
  clearResults: () => void;
  updateHecRasComparison: (data: HecRasComparison[]) => void;
  setUnitSystem: (system: UnitSystem) => void;
  setSensitivityResults: (results: SensitivityResults | null) => void;
  setProjectName: (name: string) => void;
  exportProject: () => string;
  importProject: (json: string) => void;
  reset: () => void;
}

const defaultBridgeGeometry: BridgeGeometry = {
  lowChordLeft: 0,
  lowChordRight: 0,
  highChord: 0,
  leftAbutmentStation: 0,
  rightAbutmentStation: 0,
  leftAbutmentSlope: 0,
  rightAbutmentSlope: 0,
  skewAngle: 0,
  piers: [],
  lowChordProfile: [],
};

const defaultCoefficients: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  debrisBlockagePct: 0,
  manningsNSensitivity: false,
  manningsNSensitivityPct: 20,
  methodsToRun: {
    energy: true,
    momentum: true,
    yarnell: true,
    wspro: true,
  },
};

const initialState = {
  crossSection: [] as CrossSectionPoint[],
  bridgeGeometry: defaultBridgeGeometry,
  flowProfiles: [] as FlowProfile[],
  coefficients: defaultCoefficients,
  results: null as CalculationResults | null,
  hecRasComparison: [] as HecRasComparison[],
  unitSystem: 'metric' as UnitSystem,
  sensitivityResults: null as SensitivityResults | null,
  projectName: '' as string,
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...initialState,

  updateCrossSection: (points) => set({ crossSection: points }),
  updateBridgeGeometry: (geom) => set({ bridgeGeometry: geom }),
  updateFlowProfiles: (profiles) => set({ flowProfiles: profiles }),
  updateCoefficients: (coeffs) => set({ coefficients: coeffs }),
  setResults: (results) => set({ results }),
  clearResults: () => set({ results: null }),
  updateHecRasComparison: (data) => set({ hecRasComparison: data }),
  setUnitSystem: (system) => set({ unitSystem: system }),
  setSensitivityResults: (results) => set({ sensitivityResults: results }),
  setProjectName: (name) => set({ projectName: name }),

  exportProject: () => {
    const state = get();
    return serializeProject({
      crossSection: state.crossSection,
      bridgeGeometry: state.bridgeGeometry,
      flowProfiles: state.flowProfiles,
      coefficients: state.coefficients,
      hecRasComparison: state.hecRasComparison,
      unitSystem: state.unitSystem,
    });
  },

  importProject: (json) => {
    const data = parseProjectJson(json);
    set({
      ...data,
      results: null,
    });
  },

  reset: () => set(initialState),
}));
