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
import { AffluxCharts } from '@/components/summary/afflux-charts';
import { AiSummaryBanner } from '@/components/summary/ai-summary-banner';
import { AiCallout, AiCalloutGrouped } from '@/components/summary/ai-callout';
import { useProjectStore } from '@/store/project-store';
import type { PdfReportData } from '@/components/pdf-report';
import { SimulationTab } from '@/components/simulation/simulation-tab';
import { Waves, Upload, Download, Ruler, Settings2, FlaskConical, BarChart3, FileText, Layers, Landmark, Activity, SlidersHorizontal, Zap, Lightbulb } from 'lucide-react';
import { WhatIfPanel } from '@/components/what-if/what-if-panel';

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

  const [pdfLoading, setPdfLoading] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);

  const handleTabChange = useCallback((value: string | number | null) => {
    if (typeof value === 'string') setActiveMainTab(value);
  }, [setActiveMainTab]);

  async function handlePdf() {
    setPdfLoading(true);
    try {
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
        <div className="flex items-center gap-6 px-6 py-3">
          {/* Left: brand + main nav inline */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Waves className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Bridge Loss Calculator</h1>
          </div>

          <div className="inline-flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5">
            <TabsList className="w-fit gap-0 bg-transparent p-0">
              <TabsTrigger value="input" className="rounded-md px-3.5 py-1.5 text-xs">
                <Settings2 className="h-3.5 w-3.5" />
                Input
              </TabsTrigger>
              <div className="h-4 w-px bg-border/50" aria-hidden="true" />
              <TabsTrigger value="results" className="rounded-md px-3.5 py-1.5 text-xs">
                <FlaskConical className="h-3.5 w-3.5" />
                Method Results
              </TabsTrigger>
              <div className="h-4 w-px bg-border/50" aria-hidden="true" />
              <TabsTrigger value="summary" className="rounded-md px-3.5 py-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                Summary
              </TabsTrigger>
              <div className="h-4 w-px bg-border/50" aria-hidden="true" />
              <TabsTrigger value="simulation" className="rounded-md px-3.5 py-1.5 text-xs">
                <Zap className="h-3.5 w-3.5" />
                Simulation
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1" />

          {/* Right: utilities */}
          <div className="flex items-center gap-2">
            {/* Unit toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground ml-2" />
              <button
                onClick={() => setUnitSystem('metric')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${unitSystem === 'metric' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Metric
              </button>
              <button
                onClick={() => setUnitSystem('imperial')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${unitSystem === 'imperial' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Imperial
              </button>
            </div>

            {results && (
              <>
                <div className="w-px h-6 bg-border/40 mx-1" />
                <Button
                  variant={showWhatIf ? 'default' : 'outline'}
                  size="default"
                  onClick={() => setShowWhatIf(!showWhatIf)}
                  className="gap-2 text-sm"
                >
                  <Lightbulb className="h-4 w-4" />
                  What If?
                </Button>
              </>
            )}

            <div className="w-px h-6 bg-border/40 mx-1" />

            {/* Action buttons */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button variant="outline" size="default" onClick={() => fileInputRef.current?.click()}
              className="gap-2 text-sm">
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" size="default" onClick={handleExport}
              className="gap-2 text-sm">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="default" onClick={handlePdf} disabled={pdfLoading}
              className="gap-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
              <FileText className="h-4 w-4" />
              {pdfLoading ? 'Generating…' : 'PDF Report'}
            </Button>
          </div>
        </div>
      </header>

      <TabsContent value="input" className="flex-1 px-6 py-5">
        <Tabs defaultValue="cross-section">
          <div className="mb-5 inline-flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5">
            <TabsList className="w-fit gap-0 bg-transparent p-0">
              <TabsTrigger value="cross-section" className="rounded-md px-3.5 py-1.5 text-xs">
                <Layers className="h-3.5 w-3.5" />
                Cross-Section
              </TabsTrigger>
              <div className="h-4 w-px bg-border/40" aria-hidden="true" />
              <TabsTrigger value="bridge" className="rounded-md px-3.5 py-1.5 text-xs">
                <Landmark className="h-3.5 w-3.5" />
                Bridge Geometry
              </TabsTrigger>
              <div className="h-4 w-px bg-border/40" aria-hidden="true" />
              <TabsTrigger value="profiles" className="rounded-md px-3.5 py-1.5 text-xs">
                <Activity className="h-3.5 w-3.5" />
                Flow Profiles
              </TabsTrigger>
              <div className="h-4 w-px bg-border/40" aria-hidden="true" />
              <TabsTrigger value="coefficients" className="rounded-md px-3.5 py-1.5 text-xs">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Coefficients
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="cross-section"><CrossSectionForm /></TabsContent>
          <TabsContent value="bridge"><BridgeGeometryForm /></TabsContent>
          <TabsContent value="profiles"><FlowProfilesForm /></TabsContent>
          <TabsContent value="coefficients"><CoefficientsForm /></TabsContent>
        </Tabs>
        <ActionButtons />
      </TabsContent>

      <TabsContent value="results" className="flex-1 px-6 py-5">
        <MethodTabs />
      </TabsContent>

      <TabsContent value="summary" className="flex-1 px-6 py-5 space-y-8">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Assessment Summary</h2>
          <p className="text-sm text-muted-foreground max-w-prose text-pretty">
            Independent bridge loss calculations for QA verification. Four methods are compared —
            significant divergence may indicate a flow regime transition and warrants investigation.
          </p>
        </div>
        <AiSummaryBanner />
        <RegimeMatrix callout={<AiCallout text={aiSummary?.callouts.regime ?? null} loading={aiLoading} />} />
        <ComparisonTables callout={
          <AiCalloutGrouped
            loading={aiLoading}
            sections={[
              { label: 'Method Agreement', text: aiSummary?.callouts.comparison ?? null },
              { label: 'HEC-RAS Comparison', text: aiSummary?.callouts.hecras ?? null },
            ]}
          />
        } />
        <AffluxCharts callout={<AiCallout text={aiSummary?.callouts.afflux ?? null} loading={aiLoading} />} />
        <FreeboardCheck callout={<AiCallout text={aiSummary?.callouts.freeboard ?? null} loading={aiLoading} />} />
      </TabsContent>

      <TabsContent value="simulation" className="flex-1 px-6 py-5">
        <SimulationTab />
      </TabsContent>

      {showWhatIf && results && <WhatIfPanel onClose={() => setShowWhatIf(false)} />}
    </Tabs>
  );
}
