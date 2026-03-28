'use client';

import { useEffect, useState } from 'react';
import { FileInput, Check, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  parseHecRasGeometry,
  parseHecRasFlow,
  type ParsedCrossSection,
  type ParsedBridge,
  type HecRasFlowResult,
} from '@/lib/hecras-parser';
import { useProjectStore } from '@/store/project-store';

interface HecRasImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
}

interface ParsedData {
  crossSections: ParsedCrossSection[];
  bridges: ParsedBridge[];
  title: string;
  flowResult: HecRasFlowResult | null;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function HecRasImportDialog({ open, onOpenChange, files }: HecRasImportDialogProps) {
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [selectedXsIdx, setSelectedXsIdx] = useState<number>(0);
  const [selectedBridgeIdx, setSelectedBridgeIdx] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const updateCrossSection = useProjectStore((s) => s.updateCrossSection);
  const updateBridgeGeometry = useProjectStore((s) => s.updateBridgeGeometry);
  const updateFlowProfiles = useProjectStore((s) => s.updateFlowProfiles);
  const clearResults = useProjectStore((s) => s.clearResults);
  const setProjectName = useProjectStore((s) => s.setProjectName);

  const hasExistingData =
    crossSection.length > 0 ||
    flowProfiles.length > 0 ||
    bridgeGeometry.highChord !== 0 ||
    bridgeGeometry.leftAbutmentStation !== 0 ||
    bridgeGeometry.rightAbutmentStation !== 0;

  // Parse files whenever dialog opens with new files
  useEffect(() => {
    if (!open || files.length === 0) {
      setParsed(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data: ParsedData = {
          crossSections: [],
          bridges: [],
          title: '',
          flowResult: null,
        };

        for (const file of files) {
          const name = file.name.toLowerCase();
          const text = await readFileAsText(file);

          if (/\.g0[1-9]$/.test(name)) {
            const geo = parseHecRasGeometry(text);
            data.crossSections.push(...geo.crossSections);
            data.bridges.push(...geo.bridges);
            if (!data.title && geo.title) data.title = geo.title;
          } else if (/\.f0[1-9]$/.test(name)) {
            data.flowResult = parseHecRasFlow(text);
          }
        }

        setParsed(data);
        setSelectedXsIdx(0);
        setSelectedBridgeIdx(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, files]);

  function handleImport() {
    if (!parsed) return;

    const xs = parsed.crossSections[selectedXsIdx];
    if (xs) updateCrossSection(xs.points);

    const bridge = parsed.bridges[selectedBridgeIdx];
    if (bridge) {
      updateBridgeGeometry({
        ...bridge.geometry,
        contractionLength: 0,
        expansionLength: 0,
        orificeCd: 0.8,
        weirCw: 1.4,
      });
    }

    if (parsed.flowResult && parsed.flowResult.profiles.length > 0) {
      updateFlowProfiles(parsed.flowResult.profiles);
    }

    clearResults();

    if (parsed.title) setProjectName(parsed.title);

    onOpenChange(false);
  }

  const xsCount = parsed?.crossSections[selectedXsIdx]?.points.length ?? 0;
  const pierCount = parsed?.bridges[selectedBridgeIdx]?.geometry.piers.length ?? 0;
  const profileCount = parsed?.flowResult?.profiles.length ?? 0;

  const hasAnything =
    (parsed?.crossSections.length ?? 0) > 0 ||
    (parsed?.bridges.length ?? 0) > 0 ||
    profileCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <div className="flex items-center gap-2 mb-1">
          <FileInput className="h-5 w-5 text-primary shrink-0" />
          <DialogTitle>Import HEC-RAS File</DialogTitle>
        </div>
        <DialogDescription>
          {parsed?.title
            ? `Project: "${parsed.title}"`
            : 'Preview and confirm data before importing.'}
        </DialogDescription>

        <div className="mt-3 space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-6">Parsing file…</p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && parsed && (
            <>
              {/* Cross-section selector */}
              {parsed.crossSections.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Cross-Section
                  </label>
                  <select
                    value={selectedXsIdx}
                    onChange={(e) => setSelectedXsIdx(Number(e.target.value))}
                    className="w-full rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {parsed.crossSections.map((xs, i) => (
                      <option key={i} value={i}>
                        RS {xs.riverStation} ({xs.points.length} pts)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Bridge selector */}
              {parsed.bridges.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Bridge
                  </label>
                  <select
                    value={selectedBridgeIdx}
                    onChange={(e) => setSelectedBridgeIdx(Number(e.target.value))}
                    className="w-full rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {parsed.bridges.map((b, i) => (
                      <option key={i} value={i}>
                        RS {b.riverStation} ({b.geometry.piers.length} pier
                        {b.geometry.piers.length !== 1 ? 's' : ''})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Summary card */}
              {hasAnything && (
                <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Import Summary
                  </p>
                  {xsCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{xsCount} cross-section point{xsCount !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {parsed.bridges.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>
                        {pierCount} pier{pierCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {profileCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>
                        {profileCount} flow profile{profileCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {!xsCount && parsed.bridges.length === 0 && profileCount === 0 && (
                    <p className="text-sm text-muted-foreground">No recognisable data found in file.</p>
                  )}
                </div>
              )}

              {!hasAnything && !loading && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No cross-sections, bridges, or flow profiles found.
                </p>
              )}

              {/* Existing data warning */}
              {hasExistingData && hasAnything && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>This will replace your current project data.</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={loading || !!error || !hasAnything}
          >
            Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
