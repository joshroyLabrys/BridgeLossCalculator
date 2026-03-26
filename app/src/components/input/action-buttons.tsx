'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { runAllMethods } from '@/engine/index';
import { validateInputs } from '@/lib/validation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, RotateCcw, AlertTriangle, FlaskConical } from 'lucide-react';
import { TEST_BRIDGES, type TestBridge } from '@/lib/test-bridges';

export function ActionButtons() {
  const [testOpen, setTestOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const setResults = useProjectStore((s) => s.setResults);
  const clearResults = useProjectStore((s) => s.clearResults);
  const updateCrossSection = useProjectStore((s) => s.updateCrossSection);
  const updateBridgeGeometry = useProjectStore((s) => s.updateBridgeGeometry);
  const updateFlowProfiles = useProjectStore((s) => s.updateFlowProfiles);
  const updateCoefficients = useProjectStore((s) => s.updateCoefficients);

  function handleLoadTestBridge(bridge: TestBridge) {
    updateCrossSection(bridge.crossSection);
    updateBridgeGeometry(bridge.bridgeGeometry);
    updateFlowProfiles(bridge.flowProfiles);
    updateCoefficients(bridge.coefficients);
    clearResults();
    setErrors([]);
    setTestOpen(false);
  }

  function handleRunAll() {
    const validationErrors = validateInputs(crossSection, bridgeGeometry, flowProfiles);
    if (validationErrors.length > 0) { setErrors(validationErrors.map((e) => e.message)); return; }
    setErrors([]);
    const calcResults = runAllMethods(crossSection, bridgeGeometry, flowProfiles, coefficients);
    setResults(calcResults);
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
        <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}><FlaskConical className="h-4 w-4 mr-1.5" />Load Test Bridge</Button>
        <Button variant="outline" size="sm" onClick={() => { clearResults(); setErrors([]); }}><RotateCcw className="h-4 w-4 mr-1.5" />Clear</Button>
        <Button onClick={handleRunAll}><Play className="h-4 w-4 mr-1.5" />Run All Methods</Button>
      </div>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Load Test Bridge</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select an Australian bridge to auto-populate all input fields.
          </p>
          <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
            {TEST_BRIDGES.map((bridge) => (
              <button
                key={bridge.id}
                onClick={() => handleLoadTestBridge(bridge)}
                className="text-left rounded-lg border overflow-hidden hover:ring-2 hover:ring-ring transition-all"
              >
                <div className="flex gap-3">
                  <img
                    src={bridge.imageUrl}
                    alt={bridge.name}
                    className="w-24 h-24 object-cover shrink-0"
                  />
                  <div className="py-2 pr-3">
                    <div className="font-medium">{bridge.name}</div>
                    <div className="text-sm text-muted-foreground">{bridge.location}</div>
                    <div className="text-xs text-muted-foreground mt-1">{bridge.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
