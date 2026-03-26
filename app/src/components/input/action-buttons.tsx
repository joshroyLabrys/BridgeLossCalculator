'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { runAllMethods } from '@/engine/index';
import { validateInputs } from '@/lib/validation';
import { CrossSectionChart } from '@/components/cross-section-chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, LineChart, RotateCcw, AlertTriangle } from 'lucide-react';

export function ActionButtons() {
  const [plotOpen, setPlotOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const results = useProjectStore((s) => s.results);
  const setResults = useProjectStore((s) => s.setResults);
  const clearResults = useProjectStore((s) => s.clearResults);

  function handleRunAll() {
    const validationErrors = validateInputs(crossSection, bridgeGeometry, flowProfiles);
    if (validationErrors.length > 0) { setErrors(validationErrors.map((e) => e.message)); return; }
    setErrors([]);
    const calcResults = runAllMethods(crossSection, bridgeGeometry, flowProfiles, coefficients);
    setResults(calcResults);
  }

  const methodWsels: Record<string, number> = {};
  if (results) {
    for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
      const r = results[method][0];
      if (r && !r.error) methodWsels[method] = r.upstreamWsel;
    }
  }

  return (
    <>
      {errors.length > 0 && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
            <AlertTriangle className="h-4 w-4" />
            Validation Errors
          </div>
          <ul className="text-sm text-destructive/80 space-y-0.5 pl-6 list-disc">
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}
      <div className="sticky bottom-0 flex justify-end gap-2 pt-4 pb-3 mt-4 border-t backdrop-blur-sm bg-background/80 -mx-6 px-6">
        <Button variant="outline" size="sm" onClick={() => setPlotOpen(true)}><LineChart className="h-4 w-4 mr-1.5" />Plot Cross-Section</Button>
        <Button variant="outline" size="sm" onClick={() => { clearResults(); setErrors([]); }}><RotateCcw className="h-4 w-4 mr-1.5" />Clear</Button>
        <Button onClick={handleRunAll}><Play className="h-4 w-4 mr-1.5" />Run All Methods</Button>
      </div>
      <Dialog open={plotOpen} onOpenChange={setPlotOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Cross-Section with Bridge Overlay</DialogTitle></DialogHeader>
          <div className="h-[500px]">
            <CrossSectionChart crossSection={crossSection} bridge={bridgeGeometry} wsel={flowProfiles[0]?.dsWsel} methodWsels={Object.keys(methodWsels).length > 0 ? methodWsels : undefined} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
