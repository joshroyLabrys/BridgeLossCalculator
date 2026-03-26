'use client';

import { useRef, useCallback } from 'react';
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
import { useProjectStore } from '@/store/project-store';
import { Waves, Upload, Download, Ruler, Settings2, FlaskConical, BarChart3, FileText } from 'lucide-react';

export function MainTabs() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportProject = useProjectStore((s) => s.exportProject);
  const importProject = useProjectStore((s) => s.importProject);
  const unitSystem = useProjectStore((s) => s.unitSystem);
  const setUnitSystem = useProjectStore((s) => s.setUnitSystem);
  const activeMainTab = useProjectStore((s) => s.activeMainTab);
  const setActiveMainTab = useProjectStore((s) => s.setActiveMainTab);

  const handleTabChange = useCallback((value: string | number | null) => {
    if (typeof value === 'string') setActiveMainTab(value);
  }, [setActiveMainTab]);

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
    <Tabs defaultValue="input" className="flex-1 flex flex-col">
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
            </TabsList>
          </div>

          <div className="flex-1" />

          {/* Right: utilities */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/40 px-1 py-0.5">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground ml-2" />
              <button
                onClick={() => setUnitSystem('metric')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${unitSystem === 'metric' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Metric
              </button>
              <button
                onClick={() => setUnitSystem('imperial')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${unitSystem === 'imperial' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Imperial
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1.5" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileText className="h-4 w-4 mr-1.5" />
              PDF
            </Button>
          </div>
        </div>
      </header>

      <TabsContent value="input" className="flex-1 px-6 py-5">
        <Tabs defaultValue="cross-section">
          <div className="mb-5 border-b border-border/40">
            <TabsList variant="line" className="w-fit gap-0 bg-transparent p-0">
              <TabsTrigger value="cross-section" className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-[13px] after:hidden data-active:border-b-primary">Cross-Section</TabsTrigger>
              <TabsTrigger value="bridge" className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-[13px] after:hidden data-active:border-b-primary">Bridge Geometry</TabsTrigger>
              <TabsTrigger value="profiles" className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-[13px] after:hidden data-active:border-b-primary">Flow Profiles</TabsTrigger>
              <TabsTrigger value="coefficients" className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-[13px] after:hidden data-active:border-b-primary">Coefficients</TabsTrigger>
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
        <FreeboardCheck />
        <ComparisonTables />
        <RegimeMatrix />
        <AffluxCharts />
      </TabsContent>
    </Tabs>
  );
}
