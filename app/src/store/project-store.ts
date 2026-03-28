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
import type { AiSummaryResponse } from '@/lib/api/ai-summary-prompt';

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
  activeMainTab: string;
  aiSummary: AiSummaryResponse | null;
  aiSummaryLoading: boolean;
  aiSummaryError: string | null;

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
  setActiveMainTab: (tab: string) => void;
  fetchAiSummary: () => Promise<void>;
  clearAiSummary: () => void;
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
  skewAngle: 0,
  contractionLength: 0,
  expansionLength: 0,
  orificeCd: 0.8,
  weirCw: 1.4,
  deckWidth: 0,
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
  manningsNSensitivityPct: null,
  alphaOverride: null,
  freeboardThreshold: 0.984,
  methodsToRun: {
    energy: true,
    momentum: true,
    yarnell: true,
    wspro: true,
  },
};

let hecRasDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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
  activeMainTab: 'input' as string,
  aiSummary: null as AiSummaryResponse | null,
  aiSummaryLoading: false,
  aiSummaryError: null as string | null,
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...initialState,

  updateCrossSection: (points) => set({ crossSection: points }),
  updateBridgeGeometry: (geom) => set({ bridgeGeometry: geom }),
  updateFlowProfiles: (profiles) => set({ flowProfiles: profiles }),
  updateCoefficients: (coeffs) => set({ coefficients: coeffs }),
  setResults: (results) => set({ results }),
  clearResults: () => set({ results: null, aiSummary: null, aiSummaryLoading: false, aiSummaryError: null }),
  updateHecRasComparison: (data) => {
    set({ hecRasComparison: data });
    // Only re-fetch AI when every profile has both upstreamWsel and headLoss filled
    if (hecRasDebounceTimer) clearTimeout(hecRasDebounceTimer);
    const state = get();
    const profileCount = state.flowProfiles.length;
    const allFilled = profileCount > 0
      && data.length >= profileCount
      && data.every((c) => c.upstreamWsel !== null && c.headLoss !== null);
    if (state.results && allFilled) {
      hecRasDebounceTimer = setTimeout(() => {
        hecRasDebounceTimer = null;
        get().fetchAiSummary();
      }, 500);
    }
  },
  setUnitSystem: (system) => set({ unitSystem: system }),
  setSensitivityResults: (results) => set({ sensitivityResults: results }),
  setProjectName: (name) => set({ projectName: name }),
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),

  clearAiSummary: () => set({ aiSummary: null, aiSummaryLoading: false, aiSummaryError: null }),

  fetchAiSummary: async () => {
    const state = get();
    if (!state.results) return;

    set({ aiSummaryLoading: true, aiSummaryError: null, aiSummary: null });

    const bridge = state.bridgeGeometry;
    const cs = state.crossSection;
    const coeffs = state.coefficients;

    // Cross-section statistics
    const stations = cs.map((p) => p.station);
    const elevations = cs.map((p) => p.elevation);
    const nValues = cs.map((p) => p.manningsN).filter((n) => n > 0);
    const channelNValues = cs
      .filter((p) => !p.bankStation) // points between bank stations are "channel"
      .map((p) => p.manningsN)
      .filter((n) => n > 0);

    // Hydraulic ratios from first profile's energy result
    let hydraulicRatios: { openingRatio: number; contractionRatio: number; pierBlockageRatio: number } | null = null;
    const firstEnergy = state.results!.energy[0];
    if (firstEnergy && !firstEnergy.error) {
      const approachArea = firstEnergy.inputEcho.flowArea;
      const bridgeArea = firstEnergy.inputEcho.bridgeOpeningArea;
      const pierBlock = firstEnergy.inputEcho.pierBlockage;
      const grossBridgeArea = bridgeArea + pierBlock;
      hydraulicRatios = {
        openingRatio: approachArea > 0 ? bridgeArea / approachArea : 0,
        contractionRatio: approachArea > 0 ? 1 - bridgeArea / approachArea : 0,
        pierBlockageRatio: grossBridgeArea > 0 ? pierBlock / grossBridgeArea : 0,
      };
    }

    const payload = {
      bridgeGeometry: {
        lowChordLeft: bridge.lowChordLeft,
        lowChordRight: bridge.lowChordRight,
        highChord: bridge.highChord,
        span: bridge.rightAbutmentStation - bridge.leftAbutmentStation,
        pierCount: bridge.piers.length,
        debrisBlockagePct: coeffs.debrisBlockagePct,
        skewAngle: bridge.skewAngle,
        contractionLength: bridge.contractionLength,
        expansionLength: bridge.expansionLength,
        deckWidth: bridge.deckWidth,
      },
      crossSectionStats: {
        pointCount: cs.length,
        stationRange: [stations.length > 0 ? Math.min(...stations) : 0, stations.length > 0 ? Math.max(...stations) : 0] as [number, number],
        manningsN: {
          min: nValues.length > 0 ? Math.min(...nValues) : 0,
          max: nValues.length > 0 ? Math.max(...nValues) : 0,
          channel: channelNValues.length > 0 ? channelNValues[Math.floor(channelNValues.length / 2)] : (nValues.length > 0 ? nValues[0] : 0),
        },
        hasBankStations: cs.some((p) => p.bankStation === 'left') && cs.some((p) => p.bankStation === 'right'),
        minElevation: elevations.length > 0 ? Math.min(...elevations) : 0,
        maxElevation: elevations.length > 0 ? Math.max(...elevations) : 0,
      },
      hydraulicRatios,
      coefficients: {
        contraction: coeffs.contractionCoeff,
        expansion: coeffs.expansionCoeff,
        yarnellK: coeffs.yarnellK,
        maxIterations: coeffs.maxIterations,
        tolerance: coeffs.tolerance,
        freeboardThreshold: coeffs.freeboardThreshold,
      },
      flowProfiles: state.flowProfiles.map((p) => ({
        name: p.name,
        ari: p.ari,
        discharge: p.discharge,
        dsWsel: p.dsWsel,
      })),
      methods: Object.fromEntries(
        (['energy', 'momentum', 'yarnell', 'wspro'] as const).map((m) => [
          m,
          state.results![m].map((r) => ({
            profileName: r.profileName,
            upstreamWsel: r.upstreamWsel,
            totalHeadLoss: r.totalHeadLoss,
            approachVelocity: r.approachVelocity,
            bridgeVelocity: r.bridgeVelocity,
            froudeApproach: r.froudeApproach,
            froudeBridge: r.froudeBridge,
            flowRegime: r.flowRegime,
            converged: r.converged,
            iterationCount: r.iterationLog.length,
            bridgeOpeningArea: r.inputEcho.bridgeOpeningArea,
            pierBlockage: r.inputEcho.pierBlockage,
            hydraulicRadius: r.inputEcho.hydraulicRadius,
            tuflowPierFLC: r.tuflowPierFLC,
            tuflowSuperFLC: r.tuflowSuperFLC,
            error: r.error,
          })),
        ])
      ),
      freeboard: state.results!.energy.length > 0
        ? (() => {
            const energyResults = state.results!.energy;
            return energyResults.map((r) => {
              const lowChord = Math.min(bridge.lowChordLeft, bridge.lowChordRight);
              const fb = lowChord - r.upstreamWsel;
              return {
                profileName: r.profileName,
                freeboard: fb,
                status: fb > 1 ? 'clear' : fb > 0 ? 'low' : r.flowRegime === 'overtopping' ? 'overtopping' : 'pressure',
              };
            });
          })()
        : null,
      hecRasComparison: state.hecRasComparison.length > 0
        ? state.hecRasComparison.map((c) => ({
            profileName: c.profileName,
            upstreamWsel: c.upstreamWsel,
            headLoss: c.headLoss,
          }))
        : null,
      sensitivityEnabled: coeffs.manningsNSensitivityPct != null &&
        coeffs.manningsNSensitivityPct > 0,
    };

    try {
      const response = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        set({ aiSummaryError: err.error || `HTTP ${response.status}`, aiSummaryLoading: false });
        return;
      }

      const data = await response.json();
      set({ aiSummary: data, aiSummaryLoading: false });
    } catch (err) {
      set({
        aiSummaryError: err instanceof Error ? err.message : 'Network error',
        aiSummaryLoading: false,
      });
    }
  },

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
