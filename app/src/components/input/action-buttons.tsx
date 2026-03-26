'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { runAllMethods } from '@/engine/index';
import { validateInputs } from '@/lib/validation';
import { CrossSectionChart } from '@/components/cross-section-chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ActionButtons() {
  const [plotOpen, setPlotOpen] = useState(false);
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const results = useProjectStore((s) => s.results);
  const setResults = useProjectStore((s) => s.setResults);
  const clearResults = useProjectStore((s) => s.clearResults);

  function handleRunAll() {
    const errors = validateInputs(crossSection, bridgeGeometry, flowProfiles);
    if (errors.length > 0) {
      alert('Validation errors:\n' + errors.map((e) => `• ${e.message}`).join('\n'));
      return;
    }
    const calcResults = runAllMethods(crossSection, bridgeGeometry, flowProfiles, coefficients);
    setResults(calcResults);
  }

  // Build per-method WSEL lines for the first profile (if results exist)
  const methodWsels: Record<string, number> = {};
  if (results) {
    for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
      const r = results[method][0];
      if (r && !r.error) methodWsels[method] = r.upstreamWsel;
    }
  }

  return (
    <>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={() => setPlotOpen(true)}>
          Plot Cross-Section
        </Button>
        <Button variant="outline" onClick={clearResults}>
          Clear Results
        </Button>
        <Button onClick={handleRunAll}>
          Run All Methods
        </Button>
      </div>

      <Dialog open={plotOpen} onOpenChange={setPlotOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cross-Section with Bridge Overlay</DialogTitle>
          </DialogHeader>
          <div className="h-[500px]">
            <CrossSectionChart
              crossSection={crossSection}
              bridge={bridgeGeometry}
              wsel={flowProfiles[0]?.dsWsel}
              methodWsels={Object.keys(methodWsels).length > 0 ? methodWsels : undefined}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
