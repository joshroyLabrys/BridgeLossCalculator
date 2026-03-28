import { create } from 'zustand';
import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  CalculationResults,
  HecRasComparison,
  SensitivityResults,
  BedMaterial,
  ScourInputs,
  ScourResults,
  HydrologyState,
  AdequacyResults,
  Jurisdiction,
  ChecklistItem,
  NarrativeSection,
  ProjectSnapshot,
  SerializedProjectState,
  BridgeProject,
  ReachResults,
} from '@/engine/types';
import { serializeProject, parseProjectJson } from '@/lib/json-io';
import { UnitSystem } from '@/lib/units';
import type { AiSummaryResponse } from '@/lib/api/ai-summary-prompt';

export interface Scenario {
  name: string;
  snapshot: {
    crossSection: CrossSectionPoint[];
    bridgeGeometry: BridgeGeometry;
    flowProfiles: FlowProfile[];
    coefficients: Coefficients;
    results: CalculationResults;
    hecRasComparison: HecRasComparison[];
  };
  savedAt: number;
}

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
  scenarios: Scenario[];
  hydrology: HydrologyState;
  scourInputs: ScourInputs;
  scourResults: ScourResults[] | null;
  adequacyResults: AdequacyResults | null;
  regulatoryJurisdiction: Jurisdiction;
  regulatoryChecklist: ChecklistItem[];
  narrativeSections: NarrativeSection[];
  narrativeTone: 'technical' | 'summary';
  snapshots: ProjectSnapshot[];
  bridges: BridgeProject[];
  activeBridgeIndex: number;
  reachMode: boolean;
  reachResults: ReachResults | null;
  activeSubTab: Record<string, string>;

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
  saveScenario: (name: string) => void;
  deleteScenario: (index: number) => void;
  exportProject: () => string;
  importProject: (json: string) => void;
  reset: () => void;
  updateHydrology: (hydrology: Partial<HydrologyState>) => void;
  updateScourInputs: (inputs: Partial<ScourInputs>) => void;
  setScourResults: (results: ScourResults[] | null) => void;
  setAdequacyResults: (results: AdequacyResults | null) => void;
  setJurisdiction: (j: Jurisdiction) => void;
  updateChecklistItem: (id: string, status: ChecklistItem['status']) => void;
  updateNarrativeSection: (id: string, updates: Partial<NarrativeSection>) => void;
  setNarrativeTone: (tone: 'technical' | 'summary') => void;
  saveSnapshot: (name: string, note?: string) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  addBridge: (name: string, chainage: number) => void;
  removeBridge: (id: string) => void;
  updateBridge: (id: string, updates: Partial<BridgeProject>) => void;
  setActiveBridgeIndex: (index: number) => void;
  setReachMode: (enabled: boolean) => void;
  setReachResults: (results: ReachResults | null) => void;
  setActiveSubTab: (mainTab: string, subTab: string) => void;
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
  activeMainTab: 'data' as string,
  aiSummary: null as AiSummaryResponse | null,
  aiSummaryLoading: false,
  aiSummaryError: null as string | null,
  scenarios: [] as Scenario[],
  hydrology: {
    location: null,
    catchmentArea: 0,
    streamLength: 0,
    equalAreaSlope: 0,
    ifdData: null,
    tcMethod: 'bransby-williams' as const,
    tcManual: 0,
    runoffCoefficient: 0.5,
    calculatedDischarges: [],
  },
  scourInputs: {
    bedMaterial: 'sand' as BedMaterial,
    d50: 1,
    d95: 5,
    upstreamBedElevation: 0,
    countermeasure: 'none' as const,
  },
  scourResults: null as ScourResults[] | null,
  adequacyResults: null as AdequacyResults | null,
  regulatoryJurisdiction: 'tmr' as Jurisdiction,
  regulatoryChecklist: [] as ChecklistItem[],
  narrativeSections: [] as NarrativeSection[],
  narrativeTone: 'technical' as const,
  snapshots: [] as ProjectSnapshot[],
  bridges: [] as BridgeProject[],
  activeBridgeIndex: 0,
  reachMode: false,
  reachResults: null as ReachResults | null,
  activeSubTab: {} as Record<string, string>,
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

  saveScenario: (name) => {
    const state = get();
    if (!state.results) return;
    const scenario: Scenario = {
      name,
      snapshot: {
        crossSection: structuredClone(state.crossSection),
        bridgeGeometry: structuredClone(state.bridgeGeometry),
        flowProfiles: structuredClone(state.flowProfiles),
        coefficients: structuredClone(state.coefficients),
        results: structuredClone(state.results),
        hecRasComparison: structuredClone(state.hecRasComparison),
      },
      savedAt: Date.now(),
    };
    set((prev) => ({
      scenarios: [...prev.scenarios.slice(-4), scenario], // max 5
    }));
  },

  deleteScenario: (index) => {
    set((prev) => ({
      scenarios: prev.scenarios.filter((_, i) => i !== index),
    }));
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

  updateHydrology: (hydrology) =>
    set((prev) => ({ hydrology: { ...prev.hydrology, ...hydrology } })),

  updateScourInputs: (inputs) =>
    set((prev) => ({ scourInputs: { ...prev.scourInputs, ...inputs } })),

  setScourResults: (results) => set({ scourResults: results }),

  setAdequacyResults: (results) => set({ adequacyResults: results }),

  setJurisdiction: (j) => set({ regulatoryJurisdiction: j }),

  updateChecklistItem: (id, status) =>
    set((prev) => ({
      regulatoryChecklist: prev.regulatoryChecklist.map((item) =>
        item.id === id ? { ...item, status } : item,
      ),
    })),

  updateNarrativeSection: (id, updates) =>
    set((prev) => ({
      narrativeSections: prev.narrativeSections.map((section) =>
        section.id === id ? { ...section, ...updates } : section,
      ),
    })),

  setNarrativeTone: (tone) => set({ narrativeTone: tone }),

  saveSnapshot: (name, note) => {
    const state = get();
    const serialized: SerializedProjectState = {
      crossSection: structuredClone(state.crossSection),
      bridgeGeometry: structuredClone(state.bridgeGeometry),
      flowProfiles: structuredClone(state.flowProfiles),
      coefficients: structuredClone(state.coefficients),
      results: state.results ? structuredClone(state.results) : null,
      hecRasComparison: structuredClone(state.hecRasComparison),
      scourInputs: structuredClone(state.scourInputs),
      scourResults: state.scourResults ? structuredClone(state.scourResults) : null,
      adequacyResults: state.adequacyResults ? structuredClone(state.adequacyResults) : null,
      regulatoryJurisdiction: state.regulatoryJurisdiction,
      regulatoryChecklist: structuredClone(state.regulatoryChecklist),
      narrativeSections: structuredClone(state.narrativeSections),
      narrativeTone: state.narrativeTone,
      hydrology: structuredClone(state.hydrology),
    };
    const snapshot: ProjectSnapshot = {
      id: crypto.randomUUID(),
      name,
      note: note ?? '',
      timestamp: Date.now(),
      summaryLine: `${state.flowProfiles.length} profiles, ${state.bridges.length} bridges`,
      state: serialized,
    };
    set((prev) => {
      const updated = [...prev.snapshots, snapshot].slice(-20);
      try {
        localStorage.setItem('project-snapshots', JSON.stringify(updated));
      } catch {
        // storage full – silently ignore
      }
      return { snapshots: updated };
    });
  },

  restoreSnapshot: (id) => {
    const state = get();
    const snapshot = state.snapshots.find((s) => s.id === id);
    if (!snapshot) return;
    const s = snapshot.state;
    set({
      crossSection: s.crossSection,
      bridgeGeometry: s.bridgeGeometry,
      flowProfiles: s.flowProfiles,
      coefficients: s.coefficients,
      results: s.results,
      hecRasComparison: s.hecRasComparison,
      scourInputs: s.scourInputs,
      scourResults: s.scourResults,
      adequacyResults: s.adequacyResults,
      regulatoryJurisdiction: s.regulatoryJurisdiction,
      regulatoryChecklist: s.regulatoryChecklist,
      narrativeSections: s.narrativeSections,
      narrativeTone: s.narrativeTone,
      hydrology: s.hydrology,
    });
  },

  deleteSnapshot: (id) =>
    set((prev) => ({
      snapshots: prev.snapshots.filter((s) => s.id !== id),
    })),

  addBridge: (name, chainage) => {
    const state = get();
    const bridge: BridgeProject = {
      id: crypto.randomUUID(),
      name,
      chainage,
      crossSection: [],
      bridgeGeometry: structuredClone(state.bridgeGeometry),
      coefficients: structuredClone(state.coefficients),
      results: null,
      scourInputs: structuredClone(state.scourInputs),
      scourResults: null,
    };
    set((prev) => ({ bridges: [...prev.bridges, bridge] }));
  },

  removeBridge: (id) =>
    set((prev) => ({
      bridges: prev.bridges.filter((b) => b.id !== id),
    })),

  updateBridge: (id, updates) =>
    set((prev) => ({
      bridges: prev.bridges.map((b) =>
        b.id === id ? { ...b, ...updates } : b,
      ),
    })),

  setActiveBridgeIndex: (index) => set({ activeBridgeIndex: index }),

  setReachMode: (enabled) => set({ reachMode: enabled }),

  setReachResults: (results) => set({ reachResults: results }),

  setActiveSubTab: (mainTab, subTab) =>
    set((prev) => ({
      activeSubTab: { ...prev.activeSubTab, [mainTab]: subTab },
    })),
}));
