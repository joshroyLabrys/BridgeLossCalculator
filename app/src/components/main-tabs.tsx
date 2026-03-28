'use client';

import { useRef, useCallback, useState } from 'react';
import { Toaster } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CrossSectionForm } from '@/components/input/cross-section-form';
import { BridgeGeometryForm } from '@/components/input/bridge-geometry-form';
import { FlowProfilesForm } from '@/components/input/flow-profiles-form';
import { CoefficientsForm } from '@/components/input/coefficients-form';
import { ActionButtons } from '@/components/input/action-buttons';
import { MethodTabs } from '@/components/results/method-tabs';
import { ComparisonTables } from '@/components/summary/comparison-tables';
import { RegimeMatrix } from '@/components/summary/regime-matrix';
import { FreeboardCheck } from '@/components/summary/freeboard-check';
import { ScenarioComparison } from '@/components/summary/scenario-comparison';
import { AffluxCharts } from '@/components/summary/afflux-charts';
import { AiSummaryBanner } from '@/components/summary/ai-summary-banner';
import { AiCallout, AiCalloutGrouped } from '@/components/summary/ai-callout';
import { MethodSuitability } from '@/components/summary/method-suitability';
import { useProjectStore } from '@/store/project-store';
import type { PdfReportData } from '@/components/pdf-report';
import { SimulationTab } from '@/components/simulation/simulation-tab';
import { DropZone } from '@/components/import/drop-zone';
import { HecRasImportDialog } from '@/components/import/hecras-import-dialog';
import { Waves, Ruler, Settings2, FlaskConical, BarChart3, FileInput, FileOutput, FileText, Layers, Landmark, Activity, SlidersHorizontal, Zap, Save, Sparkles } from 'lucide-react';
import { ChatPanel } from '@/components/ai-chat/chat-panel';
import type { WhatIfOverrides } from '@/components/what-if/what-if-controls';

export function MainTabs() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportProject = useProjectStore((s) => s.exportProject);
  const importProject = useProjectStore((s) => s.importProject);
  const unitSystem = useProjectStore((s) => s.unitSystem);
  const setUnitSystem = useProjectStore((s) => s.setUnitSystem);
  const activeMainTab = useProjectStore((s) => s.activeMainTab);
  const setActiveMainTab = useProjectStore((s) => s.setActiveMainTab);
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
    if (typeof value === 'string') setActiveMainTab(value);
  }, [setActiveMainTab]);

  async function handlePdf() {
    setPdfLoading(true);
    try {
      // Capture the 3D scene canvas if it exists (Three.js renders into a plain <canvas>)
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
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">Bridge Loss Calculator</h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
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

        {/* Row 2: Centred page tabs */}
        <div className="flex justify-center px-4 sm:px-6 pb-2.5">
          <div className="scroll-snap-x inline-flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5 max-w-full">
            <TabsList className="w-fit gap-0 bg-transparent p-0">
              <TabsTrigger value="input" className="rounded-md px-3 sm:px-3.5 py-1.5 text-xs whitespace-nowrap">
                <Settings2 className="h-3.5 w-3.5 hidden sm:block" />
                Input
              </TabsTrigger>
              <div className="h-4 w-px bg-border/50 hidden sm:block" aria-hidden="true" />
              <TabsTrigger value="results" className="rounded-md px-3 sm:px-3.5 py-1.5 text-xs whitespace-nowrap">
                <FlaskConical className="h-3.5 w-3.5 hidden sm:block" />
                Results
              </TabsTrigger>
              <div className="h-4 w-px bg-border/50 hidden sm:block" aria-hidden="true" />
              <TabsTrigger value="summary" className="rounded-md px-3 sm:px-3.5 py-1.5 text-xs whitespace-nowrap">
                <BarChart3 className="h-3.5 w-3.5 hidden sm:block" />
                Summary
              </TabsTrigger>
              <div className="h-4 w-px bg-border/50 hidden sm:block" aria-hidden="true" />
              <TabsTrigger value="simulation" className="rounded-md px-3 sm:px-3.5 py-1.5 text-xs whitespace-nowrap">
                <Zap className="h-3.5 w-3.5 hidden sm:block" />
                Simulation
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
      </header>

      <TabsContent value="input" className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
        <DropZone onFiles={handleHecRasFiles} accept={HECRAS_EXTENSIONS}>
          <Tabs defaultValue="cross-section">
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
              </TabsList>
            </div>
            <TabsContent value="cross-section"><CrossSectionForm /></TabsContent>
            <TabsContent value="bridge"><BridgeGeometryForm /></TabsContent>
            <TabsContent value="profiles"><FlowProfilesForm /></TabsContent>
            <TabsContent value="coefficients"><CoefficientsForm /></TabsContent>
          </Tabs>
        </DropZone>
        <ActionButtons />
      </TabsContent>

      <TabsContent value="results" className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
        <MethodTabs />
      </TabsContent>

      <TabsContent value="summary" className="flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-6 sm:space-y-8">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Assessment Summary</h2>
          <p className="text-sm text-muted-foreground max-w-prose text-pretty">
            Independent bridge loss calculations for QA verification. Four methods are compared —
            significant divergence may indicate a flow regime transition and warrants investigation.
          </p>
        </div>
        <AiSummaryBanner />
        <MethodSuitability />
        <AiCallout text={aiSummary?.callouts.geometry ?? null} loading={aiLoading} />
        <RegimeMatrix callout={<AiCallout text={aiSummary?.callouts.regime ?? null} loading={aiLoading} />} />
        <ComparisonTables callout={
          <AiCalloutGrouped
            loading={aiLoading}
            sections={[
              { label: 'Method Agreement', text: aiSummary?.callouts.comparison ?? null },
              { label: 'Coefficients', text: aiSummary?.callouts.coefficients ?? null },
              { label: 'HEC-RAS Comparison', text: aiSummary?.callouts.hecras ?? null },
            ]}
          />
        } />
        <AffluxCharts callout={<AiCallout text={aiSummary?.callouts.afflux ?? null} loading={aiLoading} />} />
        <FreeboardCheck callout={<AiCallout text={aiSummary?.callouts.freeboard ?? null} loading={aiLoading} />} />
        {scenarios.length >= 2 && (
          <>
            <div className="h-px bg-border/40" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Scenario Comparison</h2>
              <p className="text-sm text-muted-foreground max-w-prose text-pretty">
                Compare saved scenarios side-by-side.
              </p>
            </div>
            <ScenarioComparison />
          </>
        )}
      </TabsContent>

      <TabsContent value="simulation" className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
        <SimulationTab />
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
