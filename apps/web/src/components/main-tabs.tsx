'use client';

import { useRef, useCallback, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Toaster } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@flowsuite/ui';
import { Button } from '@flowsuite/ui';
import { Card, CardContent, CardHeader } from '@flowsuite/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@flowsuite/ui';
import { CrossSectionForm } from '@/components/input/cross-section-form';
import { BridgeGeometryForm } from '@/components/input/bridge-geometry-form';
import { FlowProfilesForm } from '@/components/input/flow-profiles-form';
import { CoefficientsForm } from '@/components/input/coefficients-form';
import { ActionButtons } from '@/components/input/action-buttons';
import { useProjectStore } from '@/store/project-store';
import type { WhatIfOverrides } from '@/components/what-if/what-if-controls';
import { buildHydraulicProfile } from '@flowsuite/engine/simulation-profile';
import { runAllMethods } from '@flowsuite/engine';
import type { CalculationResults } from '@flowsuite/engine/types';
import { toDisplay, unitLabel } from '@flowsuite/data';
import { DropZone } from '@/components/import/drop-zone';
import { Waves, Ruler, FlaskConical, FileInput, FileOutput, FileText, Save, Sparkles, Database, Droplets, ShieldCheck, Zap, RotateCcw } from 'lucide-react';

const MethodTabs = dynamic(() => import('@/components/results/method-tabs').then((mod) => mod.MethodTabs));
const ComparisonTables = dynamic(() => import('@/components/summary/comparison-tables').then((mod) => mod.ComparisonTables));
const RegimeMatrix = dynamic(() => import('@/components/summary/regime-matrix').then((mod) => mod.RegimeMatrix));
const ScenarioComparison = dynamic(() => import('@/components/summary/scenario-comparison').then((mod) => mod.ScenarioComparison));
const AffluxCharts = dynamic(() => import('@/components/summary/afflux-charts').then((mod) => mod.AffluxCharts));
const AiCalloutInline = dynamic(() => import('@/components/summary/ai-callout').then((mod) => mod.AiCalloutInline));
const AiCalloutGroupedInline = dynamic(() => import('@/components/summary/ai-callout').then((mod) => mod.AiCalloutGroupedInline));
const MethodSuitability = dynamic(() => import('@/components/summary/method-suitability').then((mod) => mod.MethodSuitability));
const AdequacyPanel = dynamic(() => import('@/components/assessment/adequacy-panel').then((mod) => mod.AdequacyPanel));
const RegulatoryChecklist = dynamic(() => import('@/components/assessment/regulatory-checklist').then((mod) => mod.RegulatoryChecklist));
const SimulationScene = dynamic(() => import('@/components/simulation/scene-3d/simulation-scene').then((mod) => mod.SimulationScene), {
  ssr: false,
});
const EnergyGradeDiagram = dynamic(() => import('@/components/simulation/energy-grade-diagram').then((mod) => mod.EnergyGradeDiagram));
const WhatIfControls = dynamic(() => import('@/components/what-if/what-if-controls').then((mod) => mod.WhatIfControls));
const OptimizerCard = dynamic(() => import('@/components/simulation/optimizer-card').then((mod) => mod.OptimizerCard));
const DebrisGuidance = dynamic(() => import('@/components/simulation/debris-guidance').then((mod) => mod.DebrisGuidance));
const HecRasImportDialog = dynamic(() => import('@/components/import/hecras-import-dialog').then((mod) => mod.HecRasImportDialog), {
  ssr: false,
});
const ChatPanel = dynamic(() => import('@/components/ai-chat/chat-panel').then((mod) => mod.ChatPanel), {
  ssr: false,
});
const ScourPanel = dynamic(() => import('@/components/analysis/scour-panel').then((mod) => mod.ScourPanel));
const ArrLookup = dynamic(() => import('@/components/hydrology/arr-lookup').then((mod) => mod.ArrLookup), {
  ssr: false,
});
const CatchmentCalculator = dynamic(() => import('@/components/hydrology/catchment-calculator').then((mod) => mod.CatchmentCalculator), {
  ssr: false,
});
const ImportPanel = dynamic(() => import('@/components/data/import-panel').then((mod) => mod.ImportPanel));
const ExportPanel = dynamic(() => import('@/components/report/export-panel').then((mod) => mod.ExportPanel));
const NarrativeEditor = dynamic(() => import('@/components/report/narrative-editor').then((mod) => mod.NarrativeEditor));
const HistoryPanel = dynamic(() => import('@/components/report/history-panel').then((mod) => mod.HistoryPanel), {
  ssr: false,
});
const QaqcPanel = dynamic(() => import('@/components/analysis/qaqc-panel').then((mod) => mod.QaqcPanel));
const ReachManager = dynamic(() => import('@/components/data/reach-manager').then((mod) => mod.ReachManager));
const HydroImportBanner = dynamic(() => import('@/components/data/hydro-import-banner').then((mod) => mod.HydroImportBanner));

/* ------------------------------------------------------------------ */
/*  Sub-tab defaults                                                   */
/* ------------------------------------------------------------------ */
const SUB_TAB_DEFAULTS: Record<string, string> = {
  data: 'cross-section',
  hydrology: 'arr-lookup',
  analysis: 'overview',
  assessment: 'adequacy',
  simulation: '3d-model',
  report: 'narrative',
};

const MAIN_TAB_VALUES = new Set(['data', 'hydrology', 'analysis', 'assessment', 'simulation', 'report']);

/* ------------------------------------------------------------------ */
/*  Simulation helpers (lifted from old SimulationTab)                 */
/* ------------------------------------------------------------------ */
const METHOD_KEYS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

function methodLabel(m: string) {
  return m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1);
}

function Delta({ baseline, modified, unit }: { baseline: number; modified: number; unit: string }) {
  const diff = modified - baseline;
  if (Math.abs(diff) < 0.0001) return null;
  return (
    <span className={`text-[10px] font-mono ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
      {diff > 0 ? '+' : ''}{diff.toFixed(3)} {unit}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  MainTabs                                                           */
/* ------------------------------------------------------------------ */
export function MainTabs() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportProject = useProjectStore((s) => s.exportProject);
  const importProject = useProjectStore((s) => s.importProject);
  const unitSystem = useProjectStore((s) => s.unitSystem);
  const setUnitSystem = useProjectStore((s) => s.setUnitSystem);
  const activeMainTab = useProjectStore((s) => s.activeMainTab);
  const setActiveMainTab = useProjectStore((s) => s.setActiveMainTab);
  const activeSubTab = useProjectStore((s) => s.activeSubTab);
  const setActiveSubTab = useProjectStore((s) => s.setActiveSubTab);
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const results = useProjectStore((s) => s.results);
  const projectName = useProjectStore((s) => s.projectName);
  const hecRasComparison = useProjectStore((s) => s.hecRasComparison);
  const aiSummary = useProjectStore((s) => s.aiSummary);
  const aiLoading = useProjectStore((s) => s.aiSummaryLoading);
  const saveScenario = useProjectStore((s) => s.saveScenario);
  const scenarios = useProjectStore((s) => s.scenarios);
  const reachMode = useProjectStore((s) => s.reachMode);
  const bridges = useProjectStore((s) => s.bridges);
  const activeBridgeIndex = useProjectStore((s) => s.activeBridgeIndex);
  const setActiveBridgeIndex = useProjectStore((s) => s.setActiveBridgeIndex);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [hecRasFiles, setHecRasFiles] = useState<File[]>([]);
  const [hecRasDialogOpen, setHecRasDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatOverrides, setChatOverrides] = useState<WhatIfOverrides>({
    manningsNMultiplier: 1.0,
    debrisBlockagePct: coefficients.debrisBlockagePct,
    contractionCoeff: coefficients.contractionCoeff,
    expansionCoeff: coefficients.expansionCoeff,
    dischargeMultiplier: 1.0,
  });

  /* --- Simulation state (lifted from old SimulationTab) --- */
  const us = unitSystem;
  const len = unitLabel('length', us);
  const vel = unitLabel('velocity', us);

  const [selectedProfileIdx, setSelectedProfileIdx] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string>('energy');
  const simDefaults: WhatIfOverrides = {
    manningsNMultiplier: 1.0,
    debrisBlockagePct: coefficients.debrisBlockagePct,
    contractionCoeff: coefficients.contractionCoeff,
    expansionCoeff: coefficients.expansionCoeff,
    dischargeMultiplier: 1.0,
  };
  const [simOverrides, setSimOverrides] = useState<WhatIfOverrides>(simDefaults);
  const simHasChanges = JSON.stringify(simOverrides) !== JSON.stringify(simDefaults);

  const activeMethods = METHOD_KEYS.filter(
    (m) => coefficients.methodsToRun[m] && results?.[m]?.length,
  );

  const modifiedResults = useMemo(() => {
    if (!simHasChanges || crossSection.length < 2 || flowProfiles.length === 0) return null;
    const modifiedXs = crossSection.map((p) => ({
      ...p,
      manningsN: p.manningsN * simOverrides.manningsNMultiplier,
    }));
    const modifiedProfiles = flowProfiles.map((p) => ({
      ...p,
      discharge: p.discharge * simOverrides.dischargeMultiplier,
    }));
    const modifiedCoeffs = {
      ...coefficients,
      debrisBlockagePct: simOverrides.debrisBlockagePct,
      contractionCoeff: simOverrides.contractionCoeff,
      expansionCoeff: simOverrides.expansionCoeff,
    };
    return runAllMethods(modifiedXs, bridgeGeometry, modifiedProfiles, modifiedCoeffs);
  }, [crossSection, bridgeGeometry, flowProfiles, coefficients, simOverrides, simHasChanges]);

  const activeResults = simHasChanges ? modifiedResults : results;
  const baselineResult = results?.[selectedMethod as keyof CalculationResults]?.[selectedProfileIdx];
  const activeResult = activeResults?.[selectedMethod as keyof CalculationResults]?.[selectedProfileIdx];
  const flowProfile = flowProfiles[selectedProfileIdx];

  const hydraulicProfile = useMemo(() => {
    if (!activeResult || !flowProfile || crossSection.length < 2) return null;
    const xs = simHasChanges
      ? crossSection.map((p) => ({ ...p, manningsN: p.manningsN * simOverrides.manningsNMultiplier }))
      : crossSection;
    const fp = simHasChanges
      ? { ...flowProfile, discharge: flowProfile.discharge * simOverrides.dischargeMultiplier }
      : flowProfile;
    return buildHydraulicProfile(xs, bridgeGeometry, fp, activeResult);
  }, [crossSection, bridgeGeometry, flowProfile, activeResult, simHasChanges, simOverrides]);

  /* --- Handlers --- */

  function handleSaveScenario() {
    const name = prompt('Scenario name:', `Scenario ${scenarios.length + 1}`);
    if (name) saveScenario(name);
  }

  function handleHecRasFiles(files: File[]) {
    setHecRasFiles(files);
    setHecRasDialogOpen(true);
  }

  const HECRAS_EXTENSIONS = [
    '.g01', '.g02', '.g03', '.g04', '.g05', '.g06', '.g07', '.g08', '.g09',
    '.f01', '.f02', '.f03', '.f04', '.f05', '.f06', '.f07', '.f08', '.f09',
  ];

  const handleTabChange = useCallback((value: string | number | null) => {
    if (typeof value === 'string' && MAIN_TAB_VALUES.has(value)) setActiveMainTab(value);
  }, [setActiveMainTab]);

  async function handlePdf() {
    setPdfLoading(true);
    try {
      let sceneCapture: string | null = null;
      const threeCanvas = document.querySelector('[data-scene-capture] canvas') as HTMLCanvasElement | null;
      if (threeCanvas) {
        try { sceneCapture = threeCanvas.toDataURL('image/png'); } catch { /* cross-origin or empty */ }
      }

      const { generatePdf } = await import('@/components/pdf-report');
      await generatePdf({
        projectName,
        crossSection,
        bridge: bridgeGeometry,
        profiles: flowProfiles,
        coefficients,
        results,
        hecRasComparison,
        aiSummary,
        sceneCapture,
      });
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert(`PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPdfLoading(false);
    }
  }

  function handleExport() {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bridge-loss-project.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importProject(reader.result as string);
      } catch (err) {
        alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  /* --- Sub-tab helper --- */
  function currentSubTab(mainTab: string) {
    return activeSubTab[mainTab] ?? SUB_TAB_DEFAULTS[mainTab];
  }

  function handleSubTabChange(mainTab: string) {
    return (value: string | number | null) => {
      if (typeof value === 'string') setActiveSubTab(mainTab, value);
    };
  }

  /* --- Simulation profile/method selectors (shared across sim sub-tabs) --- */
  const simSelectors = results ? (
    <div className="flex flex-wrap gap-2 items-end">
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Profile</label>
        <Select value={String(selectedProfileIdx)} onValueChange={(v) => setSelectedProfileIdx(Number(v))}>
          <SelectTrigger size="sm" className="w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {flowProfiles.map((p, i) => (
              <SelectItem key={i} value={String(i)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Method</label>
        <Select value={selectedMethod} onValueChange={(v) => { if (v) setSelectedMethod(v); }}>
          <SelectTrigger size="sm" className="w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {activeMethods.map((m) => (
              <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  ) : null;

  const noResultsPlaceholder = (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Waves className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm">No results yet</p>
      <p className="text-xs mt-1">Run calculations from the Data tab to see content here</p>
    </div>
  );

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <Tabs value={activeMainTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          classNames: {
            toast: '!bg-card !border-border/50 !text-foreground !shadow-lg !shadow-black/20 !backdrop-blur-xl',
            title: '!text-foreground !font-medium',
            description: '!text-muted-foreground',
            success: '!text-emerald-400 [&_[data-icon]]:!text-emerald-400',
          },
        }}
      />
      <header className="sticky top-0 z-50 border-b border-border/40 bg-card/80 backdrop-blur-xl shadow-sm">
        {/* Row 1: Brand + Utilities */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-2.5 pb-1.5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Waves className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
              <span className="sm:hidden">BLC</span>
              <span className="hidden sm:inline">Bridge Loss Calculator</span>
            </h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Bridge selector (reach mode) */}
            {reachMode && bridges.length > 1 && (
              <Select value={String(activeBridgeIndex)} onValueChange={(v) => setActiveBridgeIndex(Number(v))}>
                <SelectTrigger size="sm" className="w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bridges.map((b, i) => (
                    <SelectItem key={b.id} value={String(i)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Unit toggle */}
            <div className="flex items-center gap-0.5 sm:gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground ml-1.5 sm:ml-2 hidden sm:block" />
              <button
                onClick={() => setUnitSystem('metric')}
                className={`rounded-md px-2 sm:px-3 py-1.5 text-xs font-medium transition-all ${unitSystem === 'metric' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <span className="sm:hidden">M</span>
                <span className="hidden sm:inline">Metric</span>
              </button>
              <button
                onClick={() => setUnitSystem('imperial')}
                className={`rounded-md px-2 sm:px-3 py-1.5 text-xs font-medium transition-all ${unitSystem === 'imperial' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <span className="sm:hidden">I</span>
                <span className="hidden sm:inline">Imperial</span>
              </button>
            </div>

            <div className="w-px h-5 bg-border/40 mx-0.5 hidden sm:block" />

            {/* Icon action buttons */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}
              className="h-8 w-8" title="Import Project">
              <FileInput className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleExport}
              className="h-8 w-8 hidden sm:inline-flex" title="Export Project">
              <FileOutput className="h-4 w-4" />
            </Button>
            {results && (
              <Button variant="outline" size="icon" onClick={handleSaveScenario}
                className="h-8 w-8" title={`Save Scenario (${scenarios.length}/5)`}>
                <Save className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" onClick={handlePdf} disabled={pdfLoading}
              className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" title="PDF Report">
              <FileText className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Row 2: Centred page tabs (6 tabs) */}
        <div className="flex justify-center px-4 sm:px-6 pb-2.5">
          <div className="scroll-snap-x inline-flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5 max-w-full">
            <TabsList className="w-fit gap-0 bg-transparent p-0">
              <TabsTrigger value="data" className="rounded-md px-3 sm:px-3.5 py-1.5 text-xs whitespace-nowrap">
                <Database className="h-3.5 w-3.5 hidden sm:block" />
                Data
              </TabsTrigger>
              <div className="h-4 w-px bg-border/50 hidden sm:block" aria-hidden="true" />
              <TabsTrigger value="hydrology" className="rounded-md px-3 sm:px-3.5 py-1.5 text-xs whitespace-nowrap">
                <Droplets className="h-3.5 w-3.5 hidden sm:block" />
                Hydrology
              </TabsTrigger>
              <div className="h-4 w-px bg-border/50 hidden sm:block" aria-hidden="true" />
              <TabsTrigger value="analysis" className="rounded-md px-3 sm:px-3.5 py-1.5 text-xs whitespace-nowrap">
                <FlaskConical className="h-3.5 w-3.5 hidden sm:block" />
                Analysis
              </TabsTrigger>
              <div className="h-4 w-px bg-border/50 hidden sm:block" aria-hidden="true" />
              <TabsTrigger value="assessment" className="rounded-md px-3 sm:px-3.5 py-1.5 text-xs whitespace-nowrap">
                <ShieldCheck className="h-3.5 w-3.5 hidden sm:block" />
                Assessment
              </TabsTrigger>
              <div className="h-4 w-px bg-border/50 hidden sm:block" aria-hidden="true" />
              <TabsTrigger value="simulation" className="rounded-md px-3 sm:px-3.5 py-1.5 text-xs whitespace-nowrap">
                <Zap className="h-3.5 w-3.5 hidden sm:block" />
                Simulation
              </TabsTrigger>
              <div className="h-4 w-px bg-border/50 hidden sm:block" aria-hidden="true" />
              <TabsTrigger value="report" className="rounded-md px-3 sm:px-3.5 py-1.5 text-xs whitespace-nowrap">
                <FileText className="h-3.5 w-3.5 hidden sm:block" />
                Report
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  DATA TAB                                                     */}
      {/* ============================================================ */}
      <TabsContent value="data" className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
        <HydroImportBanner />
        <DropZone onFiles={handleHecRasFiles} accept={HECRAS_EXTENSIONS}>
          <Tabs value={currentSubTab('data')} onValueChange={handleSubTabChange('data')}>
            <div className="mb-4 sm:mb-5 border-b border-border/30 scroll-snap-x">
              <TabsList variant="line" className="gap-4 sm:gap-6 pb-0">
                <TabsTrigger value="cross-section" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                  Cross-Section
                </TabsTrigger>
                <TabsTrigger value="bridge" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                  Bridge
                </TabsTrigger>
                <TabsTrigger value="profiles" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                  Flow Profiles
                </TabsTrigger>
                <TabsTrigger value="coefficients" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                  Coefficients
                </TabsTrigger>
                <TabsTrigger value="import" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                  Import
                </TabsTrigger>
                {reachMode && (
                  <TabsTrigger value="reach" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                    Reach
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
            <TabsContent value="cross-section"><CrossSectionForm /></TabsContent>
            <TabsContent value="bridge"><BridgeGeometryForm /></TabsContent>
            <TabsContent value="profiles"><FlowProfilesForm /></TabsContent>
            <TabsContent value="coefficients"><CoefficientsForm /></TabsContent>
            <TabsContent value="import">
              <ImportPanel />
            </TabsContent>
            {reachMode && (
              <TabsContent value="reach">
                <ReachManager />
              </TabsContent>
            )}
          </Tabs>
        </DropZone>
        <ActionButtons />
      </TabsContent>

      {/* ============================================================ */}
      {/*  HYDROLOGY TAB                                                */}
      {/* ============================================================ */}
      <TabsContent value="hydrology" className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
        <Tabs value={currentSubTab('hydrology')} onValueChange={handleSubTabChange('hydrology')}>
          <div className="mb-4 sm:mb-5 border-b border-border/30 scroll-snap-x">
            <TabsList variant="line" className="gap-4 sm:gap-6 pb-0">
              <TabsTrigger value="arr-lookup" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                ARR Lookup
              </TabsTrigger>
              <TabsTrigger value="catchment" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                Catchment
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="arr-lookup">
            <ArrLookup />
          </TabsContent>
          <TabsContent value="catchment">
            <CatchmentCalculator />
          </TabsContent>
        </Tabs>
        <ActionButtons />
      </TabsContent>

      {/* ============================================================ */}
      {/*  ANALYSIS TAB                                                 */}
      {/* ============================================================ */}
      <TabsContent value="analysis" className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
        <Tabs value={currentSubTab('analysis')} onValueChange={handleSubTabChange('analysis')}>
          <div className="mb-4 sm:mb-5 border-b border-border/30 scroll-snap-x">
            <TabsList variant="line" className="gap-4 sm:gap-6 pb-0">
              <TabsTrigger value="overview" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                Overview
              </TabsTrigger>
              <TabsTrigger value="methods" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                Methods
              </TabsTrigger>
              <TabsTrigger value="scour" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                Scour
              </TabsTrigger>
              <TabsTrigger value="qaqc" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                QA/QC
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="overview">
            {results ? (
              <div className="space-y-6 sm:space-y-8">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">Analysis Overview</h2>
                  <p className="text-sm text-muted-foreground max-w-prose text-pretty">
                    Independent bridge loss calculations for QA verification. Four methods are compared —
                    significant divergence may indicate a flow regime transition and warrants investigation.
                  </p>
                </div>
                <MethodSuitability />
                <AiCalloutInline text={aiSummary?.callouts.geometry ?? null} loading={aiLoading} />
                <RegimeMatrix callout={<AiCalloutInline text={aiSummary?.callouts.regime ?? null} loading={aiLoading} />} />
                <ComparisonTables callout={
                  <AiCalloutGroupedInline
                    loading={aiLoading}
                    sections={[
                      { label: 'Method Agreement', text: aiSummary?.callouts.comparison ?? null },
                      { label: 'Coefficients', text: aiSummary?.callouts.coefficients ?? null },
                      { label: 'HEC-RAS Comparison', text: aiSummary?.callouts.hecras ?? null },
                    ]}
                  />
                } />
                <AffluxCharts callout={<AiCalloutInline text={aiSummary?.callouts.afflux ?? null} loading={aiLoading} />} />
              </div>
            ) : noResultsPlaceholder}
          </TabsContent>
          <TabsContent value="methods">
            <MethodTabs />
          </TabsContent>
          <TabsContent value="scour">
            <ScourPanel />
          </TabsContent>
          <TabsContent value="qaqc">
            <QaqcPanel />
          </TabsContent>
        </Tabs>
      </TabsContent>

      {/* ============================================================ */}
      {/*  ASSESSMENT TAB                                               */}
      {/* ============================================================ */}
      <TabsContent value="assessment" className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
        <Tabs value={currentSubTab('assessment')} onValueChange={handleSubTabChange('assessment')}>
          <div className="mb-4 sm:mb-5 border-b border-border/30 scroll-snap-x">
            <TabsList variant="line" className="gap-4 sm:gap-6 pb-0">
              <TabsTrigger value="adequacy" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                Adequacy
              </TabsTrigger>
              <TabsTrigger value="regulatory" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                Regulatory
              </TabsTrigger>
              <TabsTrigger value="scenarios" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                Scenarios
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="adequacy">
            {results ? (
              <AdequacyPanel />
            ) : noResultsPlaceholder}
          </TabsContent>
          <TabsContent value="regulatory">
            <RegulatoryChecklist />
          </TabsContent>
          <TabsContent value="scenarios">
            {scenarios.length >= 2 ? (
              <div className="space-y-6 sm:space-y-8">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">Scenario Comparison</h2>
                  <p className="text-sm text-muted-foreground max-w-prose text-pretty">
                    Compare saved scenarios side-by-side.
                  </p>
                </div>
                <ScenarioComparison />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p className="text-sm font-medium">Save at least 2 scenarios to compare</p>
                <p className="text-xs mt-1">Use the save button in the header after running calculations</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </TabsContent>

      {/* ============================================================ */}
      {/*  SIMULATION TAB — single screen: 3D + What-If side by side    */}
      {/* ============================================================ */}
      <TabsContent value="simulation" className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
        {results ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Hydraulic Simulation</h2>
              <p className="text-sm text-muted-foreground max-w-prose text-pretty">
                Animated cross-section with flow visualization. Adjust parameters to see impacts in real-time.
              </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-start">
              {/* Main content: 3D + status + EGL */}
              <div className="flex-1 min-w-0 w-full space-y-3">
                {/* Profile / method selectors */}
                {simSelectors}

                {/* 3D Scene */}
                {hydraulicProfile ? (
                  <SimulationScene profile={hydraulicProfile} debrisPct={simOverrides.debrisBlockagePct} />
                ) : (
                  <Card>
                    <CardContent>
                      <div className="flex items-center justify-center h-[300px] sm:h-[400px] lg:h-[500px] text-muted-foreground text-sm">
                        Select a profile and method with results to view the simulation
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Status bar */}
                {hydraulicProfile && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                    <span className={`px-2 py-0.5 rounded font-medium text-[11px] ${
                      hydraulicProfile.flowRegime === 'free-surface'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : hydraulicProfile.flowRegime === 'pressure'
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                        : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}>
                      {hydraulicProfile.flowRegime.toUpperCase().replace('-', ' ')}
                    </span>
                    <span className="text-muted-foreground">
                      WSEL <span className="font-mono text-foreground">{toDisplay(hydraulicProfile.usWsel, 'length', us).toFixed(2)}</span> {len}
                    </span>
                    <span className="text-muted-foreground">
                      Δh <span className="font-mono text-foreground">{toDisplay(hydraulicProfile.totalHeadLoss, 'length', us).toFixed(3)}</span> {len}
                    </span>
                    {simHasChanges && baselineResult && activeResult && (
                      <span className="ml-auto">
                        <Delta baseline={baselineResult.upstreamWsel} modified={activeResult.upstreamWsel} unit={len} />
                      </span>
                    )}
                  </div>
                )}

                {/* Energy Grade Diagram */}
                {hydraulicProfile && (
                  <Card>
                    <CardContent className="pt-4">
                      <EnergyGradeDiagram profile={hydraulicProfile} />
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* What-If sidebar — full-width on mobile, narrow sidebar on desktop */}
              <Card className="w-full lg:w-64 shrink-0">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide">What If?</span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-4">
                  <WhatIfControls overrides={simOverrides} defaults={simDefaults} onChange={setSimOverrides} />

                  {/* Impact deltas */}
                  {simHasChanges && baselineResult && activeResult && (
                    <>
                      <div className="h-px bg-border/40" />
                      <div className="space-y-1.5">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Impact</div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between items-baseline">
                            <span className="text-muted-foreground">US WSEL</span>
                            <div className="text-right">
                              <span className="font-mono text-foreground">{toDisplay(activeResult.upstreamWsel, 'length', us).toFixed(3)}</span>
                              <span className="text-muted-foreground"> {len} </span>
                              <Delta baseline={baselineResult.upstreamWsel} modified={activeResult.upstreamWsel} unit={len} />
                            </div>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-muted-foreground">Head Loss</span>
                            <div className="text-right">
                              <span className="font-mono text-foreground">{toDisplay(activeResult.totalHeadLoss, 'length', us).toFixed(3)}</span>
                              <span className="text-muted-foreground"> {len} </span>
                              <Delta baseline={baselineResult.totalHeadLoss} modified={activeResult.totalHeadLoss} unit={len} />
                            </div>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-muted-foreground">Velocity</span>
                            <div className="text-right">
                              <span className="font-mono text-foreground">{toDisplay(activeResult.approachVelocity, 'velocity', us).toFixed(2)}</span>
                              <span className="text-muted-foreground"> {vel} </span>
                              <Delta baseline={baselineResult.approachVelocity} modified={activeResult.approachVelocity} unit={vel} />
                            </div>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-muted-foreground">Froude</span>
                            <div className="text-right">
                              <span className="font-mono text-foreground">{activeResult.froudeApproach.toFixed(3)}</span>
                              {' '}
                              <Delta baseline={baselineResult.froudeApproach} modified={activeResult.froudeApproach} unit="" />
                            </div>
                          </div>
                        </div>

                        {activeResult.flowRegime !== baselineResult.flowRegime && (
                          <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-1.5 text-[11px] text-amber-400 mt-2">
                            {baselineResult.flowRegime} → <span className="font-semibold">{activeResult.flowRegime}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7"
                    disabled={!simHasChanges}
                    onClick={() => setSimOverrides(simDefaults)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1.5" />
                    Reset to Baseline
                  </Button>

                  <div className="h-px bg-border/40" />

                  <DebrisGuidance
                    bridgeSpan={bridgeGeometry.rightAbutmentStation - bridgeGeometry.leftAbutmentStation}
                    currentDebrisPct={simOverrides.debrisBlockagePct}
                    onSetDebris={(pct) => setSimOverrides({ ...simOverrides, debrisBlockagePct: pct })}
                  />
                </CardContent>
              </Card>

              <OptimizerCard
                selectedMethod={selectedMethod}
                selectedProfileIdx={selectedProfileIdx}
              />
            </div>
          </div>
        ) : noResultsPlaceholder}
      </TabsContent>

      {/* ============================================================ */}
      {/*  REPORT TAB                                                   */}
      {/* ============================================================ */}
      <TabsContent value="report" className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
        <Tabs value={currentSubTab('report')} onValueChange={handleSubTabChange('report')}>
          <div className="mb-4 sm:mb-5 border-b border-border/30 scroll-snap-x">
            <TabsList variant="line" className="gap-4 sm:gap-6 pb-0">
              <TabsTrigger value="narrative" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                Narrative
              </TabsTrigger>
              <TabsTrigger value="export" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                Export
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-none border-none px-0.5 py-2 text-xs sm:text-sm whitespace-nowrap">
                History
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="narrative">
            <NarrativeEditor />
          </TabsContent>
          <TabsContent value="export">
            <ExportPanel />
          </TabsContent>
          <TabsContent value="history">
            <HistoryPanel />
          </TabsContent>
        </Tabs>
      </TabsContent>

      <HecRasImportDialog
        open={hecRasDialogOpen}
        onOpenChange={setHecRasDialogOpen}
        files={hecRasFiles}
      />

      {/* AI Chat FAB */}
      {results && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-transform hover:scale-105"
          title="AI Assistant"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        overrides={chatOverrides}
        onOverridesChange={setChatOverrides}
      />
    </Tabs>
  );
}
