import { create } from 'zustand';
import type { ARRDataHubOutput, DesignStormResults, FFAResult } from '@flowsuite/engine/hydrology/types';

interface HydroStore {
  // Step 1: Catchment
  projectName: string;
  location: { lat: number; lng: number } | null;
  catchmentArea: number;
  streamLength: number;
  equalAreaSlope: number;

  // Step 2: ARR Data
  arrData: ARRDataHubOutput | null;

  // Step 3: Losses (adopted values, may differ from ARR defaults)
  adoptedInitialLoss: number;
  adoptedContinuingLoss: number;
  adoptedPreBurst: { aep: string; durationMin: number; depth: number }[];
  adoptedImperviousFraction: number;

  // Step 4: Tc
  tcMethod: 'bransby-williams' | 'friends' | 'manual';
  tcManual: number;
  rCoefficient: number;
  durationRange: number[];

  // Step 5: Results
  results: DesignStormResults | null;
  isRunning: boolean;

  // Step 6: FFA
  ffaData: { year: number; q: number }[] | null;
  ffaResults: FFAResult | null;

  // Navigation
  currentStep: number;

  // Actions
  setStep: (step: number) => void;
  setProjectName: (name: string) => void;
  setLocation: (loc: { lat: number; lng: number } | null) => void;
  setCatchmentArea: (area: number) => void;
  setStreamLength: (length: number) => void;
  setEqualAreaSlope: (slope: number) => void;
  setArrData: (data: ARRDataHubOutput) => void;
  setAdoptedInitialLoss: (val: number) => void;
  setAdoptedContinuingLoss: (val: number) => void;
  setAdoptedPreBurst: (val: HydroStore['adoptedPreBurst']) => void;
  setAdoptedImperviousFraction: (val: number) => void;
  setTcMethod: (method: HydroStore['tcMethod']) => void;
  setTcManual: (val: number) => void;
  setRCoefficient: (val: number) => void;
  setDurationRange: (durations: number[]) => void;
  setResults: (results: DesignStormResults) => void;
  setIsRunning: (running: boolean) => void;
  setFFAData: (data: { year: number; q: number }[]) => void;
  setFFAResults: (results: FFAResult) => void;
  reset: () => void;
}

const initialState = {
  projectName: '',
  location: null as { lat: number; lng: number } | null,
  catchmentArea: 0,
  streamLength: 0,
  equalAreaSlope: 0,
  arrData: null as ARRDataHubOutput | null,
  adoptedInitialLoss: 0,
  adoptedContinuingLoss: 0,
  adoptedPreBurst: [] as HydroStore['adoptedPreBurst'],
  adoptedImperviousFraction: 0,
  tcMethod: 'bransby-williams' as const,
  tcManual: 0,
  rCoefficient: 0,
  durationRange: [] as number[],
  results: null as DesignStormResults | null,
  isRunning: false,
  ffaData: null as { year: number; q: number }[] | null,
  ffaResults: null as FFAResult | null,
  currentStep: 0,
};

export const useHydroStore = create<HydroStore>((set) => ({
  ...initialState,
  setStep: (step) => set({ currentStep: step }),
  setProjectName: (name) => set({ projectName: name }),
  setLocation: (loc) => set({ location: loc }),
  setCatchmentArea: (area) => set({ catchmentArea: area }),
  setStreamLength: (length) => set({ streamLength: length }),
  setEqualAreaSlope: (slope) => set({ equalAreaSlope: slope }),
  setArrData: (data) => set({
    arrData: data,
    adoptedInitialLoss: data.losses.initialLoss,
    adoptedContinuingLoss: data.losses.continuingLoss,
    adoptedPreBurst: data.losses.preBurst,
  }),
  setAdoptedInitialLoss: (val) => set({ adoptedInitialLoss: val }),
  setAdoptedContinuingLoss: (val) => set({ adoptedContinuingLoss: val }),
  setAdoptedPreBurst: (val) => set({ adoptedPreBurst: val }),
  setAdoptedImperviousFraction: (val) => set({ adoptedImperviousFraction: val }),
  setTcMethod: (method) => set({ tcMethod: method }),
  setTcManual: (val) => set({ tcManual: val }),
  setRCoefficient: (val) => set({ rCoefficient: val }),
  setDurationRange: (durations) => set({ durationRange: durations }),
  setResults: (results) => set({ results }),
  setIsRunning: (running) => set({ isRunning: running }),
  setFFAData: (data) => set({ ffaData: data }),
  setFFAResults: (results) => set({ ffaResults: results }),
  reset: () => set(initialState),
}));
