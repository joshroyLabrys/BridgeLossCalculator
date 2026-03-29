'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/store/project-store';
import type { PdfSections } from '@/components/pdf-report';
import { FileText, FileOutput, Download, Table2, ShieldCheck, FileCheck } from 'lucide-react';

/* ─── Section definition ─── */

interface SectionDef {
  key: keyof PdfSections;
  label: string;
  enabled: boolean;
  description: string;
}

export function ExportPanel() {
  const projectName = useProjectStore((s) => s.projectName);
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const results = useProjectStore((s) => s.results);
  const hecRasComparison = useProjectStore((s) => s.hecRasComparison);
  const aiSummary = useProjectStore((s) => s.aiSummary);
  const scourResults = useProjectStore((s) => s.scourResults);
  const scourInputs = useProjectStore((s) => s.scourInputs);
  const adequacyResults = useProjectStore((s) => s.adequacyResults);
  const regulatoryChecklist = useProjectStore((s) => s.regulatoryChecklist);
  const regulatoryJurisdiction = useProjectStore((s) => s.regulatoryJurisdiction);
  const narrativeSections = useProjectStore((s) => s.narrativeSections);
  const exportProject = useProjectStore((s) => s.exportProject);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [sections, setSections] = useState<PdfSections>({
    cover: true,
    inputs: true,
    hydraulicAnalysis: true,
    overview: true,
    scour: true,
    adequacy: true,
    regulatory: true,
    narrative: true,
    appendices: true,
  });

  const hasScour = scourResults != null && scourResults.length > 0;
  const hasAdequacy = adequacyResults != null;
  const hasChecklist = regulatoryChecklist.length > 0;
  const hasNarrative = narrativeSections.some((ns) => ns.content.length > 0);
  const hasResults = results != null;
  const hasHecRas = hecRasComparison.length > 0 && hecRasComparison.some((c) => c.upstreamWsel !== null || c.headLoss !== null);

  const sectionDefs: SectionDef[] = [
    { key: 'cover', label: 'Cover Page', enabled: true, description: 'Title page with project name and date' },
    { key: 'inputs', label: 'Input Summary', enabled: true, description: 'Cross-section, bridge geometry, flow profiles' },
    { key: 'hydraulicAnalysis', label: 'Hydraulic Analysis', enabled: hasResults, description: 'Method results, HEC-RAS comparison, AI analysis' },
    { key: 'overview', label: 'Analysis Overview', enabled: hasResults, description: 'Comparison tables, afflux charts, regime matrix' },
    { key: 'scour', label: 'Scour Assessment', enabled: hasScour, description: 'Pier and contraction scour results' },
    { key: 'adequacy', label: 'Adequacy & Freeboard', enabled: hasAdequacy, description: 'Bridge adequacy verdict and freeboard per AEP' },
    { key: 'regulatory', label: 'Regulatory Compliance', enabled: hasChecklist, description: 'Checklist pass/fail status' },
    { key: 'narrative', label: 'AI Narrative', enabled: hasNarrative, description: 'Generated narrative report sections' },
    { key: 'appendices', label: 'Appendices', enabled: hasResults, description: 'Iteration logs and detailed calculation steps' },
  ];

  function toggleSection(key: keyof PdfSections) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function selectAll() {
    const all: PdfSections = {};
    for (const def of sectionDefs) {
      all[def.key] = def.enabled;
    }
    setSections(all);
  }

  function deselectAll() {
    const none: PdfSections = {};
    for (const def of sectionDefs) {
      none[def.key] = false;
    }
    setSections(none);
  }

  async function handleGeneratePdf() {
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
        scourResults,
        scourInputs,
        adequacyResults,
        regulatoryChecklist,
        regulatoryJurisdiction,
        narrativeSections,
        sections,
      });
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert(`PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPdfLoading(false);
    }
  }

  function handleExportJson() {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(projectName || 'bridge-loss-project').replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportCrossSectionCsv() {
    const { exportCrossSectionCsv } = await import('@/components/pdf-report');
    exportCrossSectionCsv(crossSection, projectName);
  }

  async function handleExportResultsCsv() {
    if (!results) return;
    const { exportResultsCsv } = await import('@/components/pdf-report');
    exportResultsCsv(results, flowProfiles, projectName);
  }

  const selectedCount = sectionDefs.filter((d) => d.enabled && sections[d.key]).length;
  const enabledCount = sectionDefs.filter((d) => d.enabled).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Export</h2>
        <p className="text-sm text-muted-foreground max-w-prose text-pretty">
          Generate PDF reports with fine-grained section control, or export project data in other formats.
        </p>
      </div>

      {/* ── PDF Section Selection ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">PDF Report Sections</span>
              <Badge variant="secondary">{selectedCount}/{enabledCount}</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll} className="text-xs h-7">
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll} className="text-xs h-7">
                Deselect All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {sectionDefs.map((def) => (
              <div key={def.key} className="flex items-start gap-3">
                <Checkbox
                  checked={def.enabled && (sections[def.key] ?? true)}
                  onCheckedChange={() => toggleSection(def.key)}
                  disabled={!def.enabled}
                  className="mt-0.5"
                />
                <Label className="flex flex-col gap-0.5 cursor-pointer" onClick={() => def.enabled && toggleSection(def.key)}>
                  <span className={`text-sm ${!def.enabled ? 'text-muted-foreground' : ''}`}>
                    {def.label}
                    {!def.enabled ? (
                      <span className="text-xs text-muted-foreground ml-2">(no data)</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">{def.description}</span>
                </Label>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t">
            <Button onClick={handleGeneratePdf} disabled={pdfLoading || selectedCount === 0}>
              <FileText className="h-4 w-4 mr-2" />
              {pdfLoading ? 'Generating PDF...' : 'Generate PDF Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Other Exports ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Other Exports</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleExportJson}>
              <FileOutput className="h-4 w-4 mr-2" />
              Export Project JSON
            </Button>
            <Button variant="outline" onClick={handleExportCrossSectionCsv} disabled={crossSection.length === 0}>
              <Table2 className="h-4 w-4 mr-2" />
              Cross-Section CSV
            </Button>
            <Button variant="outline" onClick={handleExportResultsCsv} disabled={!hasResults}>
              <Table2 className="h-4 w-4 mr-2" />
              Results CSV
            </Button>
            {hasHecRas ? (
              <Button variant="outline" onClick={handleGeneratePdf}>
                <FileCheck className="h-4 w-4 mr-2" />
                QA/QC Memo PDF
              </Button>
            ) : null}
            {hasChecklist ? (
              <Button variant="outline" onClick={handleGeneratePdf}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Regulatory Summary PDF
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
