'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { runAllMethods, runWithSensitivity } from '@/engine/index';
import { validateInputs } from '@/lib/validation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, RotateCcw, AlertTriangle, FlaskConical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { TEST_BRIDGES, type TestBridge } from '@/lib/test-bridges';
import { toImperial } from '@/lib/units';

export function ActionButtons() {
  const [testOpen, setTestOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const setResults = useProjectStore((s) => s.setResults);
  const clearResults = useProjectStore((s) => s.clearResults);
  const setSensitivityResults = useProjectStore((s) => s.setSensitivityResults);
  const setActiveMainTab = useProjectStore((s) => s.setActiveMainTab);
  const updateCrossSection = useProjectStore((s) => s.updateCrossSection);
  const updateBridgeGeometry = useProjectStore((s) => s.updateBridgeGeometry);
  const updateFlowProfiles = useProjectStore((s) => s.updateFlowProfiles);
  const updateCoefficients = useProjectStore((s) => s.updateCoefficients);
  const fetchAiSummary = useProjectStore((s) => s.fetchAiSummary);
  const clearAiSummary = useProjectStore((s) => s.clearAiSummary);

  function handleLoadTestBridge(bridge: TestBridge) {
    // Test bridge data is authored in metric — convert to imperial for engine storage
    const m2i = (v: number, ut: 'length' | 'area' | 'velocity' | 'discharge') => toImperial(v, ut, 'metric');

    updateCrossSection(bridge.crossSection.map((p) => ({
      ...p,
      station: m2i(p.station, 'length'),
      elevation: m2i(p.elevation, 'length'),
    })));

    const bg = bridge.bridgeGeometry;
    updateBridgeGeometry({
      ...bg,
      lowChordLeft: m2i(bg.lowChordLeft, 'length'),
      lowChordRight: m2i(bg.lowChordRight, 'length'),
      highChord: m2i(bg.highChord, 'length'),
      leftAbutmentStation: m2i(bg.leftAbutmentStation, 'length'),
      rightAbutmentStation: m2i(bg.rightAbutmentStation, 'length'),
      contractionLength: m2i(bg.contractionLength, 'length'),
      expansionLength: m2i(bg.expansionLength, 'length'),
      deckWidth: m2i(bg.deckWidth, 'length'),
      orificeCd: bg.orificeCd,
      weirCw: bg.weirCw,
      piers: bg.piers.map((p) => ({ ...p, station: m2i(p.station, 'length'), width: m2i(p.width, 'length') })),
      lowChordProfile: bg.lowChordProfile.map((p) => ({ station: m2i(p.station, 'length'), elevation: m2i(p.elevation, 'length') })),
    });

    updateFlowProfiles(bridge.flowProfiles.map((fp) => ({
      ...fp,
      discharge: m2i(fp.discharge, 'discharge'),
      dsWsel: m2i(fp.dsWsel, 'length'),
    })));

    updateCoefficients({
      ...bridge.coefficients,
      tolerance: m2i(bridge.coefficients.tolerance, 'length'),
      initialGuessOffset: m2i(bridge.coefficients.initialGuessOffset, 'length'),
      alphaOverride: bridge.coefficients.alphaOverride,
      freeboardThreshold: bridge.coefficients.freeboardThreshold,
    });

    clearResults();
    setErrors([]);
    setTestOpen(false);
  }

  function handleRunAll() {
    const validationResults = validateInputs(crossSection, bridgeGeometry, flowProfiles);
    const blockingErrors = validationResults.filter(e => e.severity === 'error');
    if (blockingErrors.length > 0) { setErrors(blockingErrors.map(e => e.message)); return; }
    setErrors(validationResults.filter(e => e.severity === 'warning').map(e => e.message));
    clearAiSummary();
    setIsProcessing(true);

    // Defer computation so the UI can paint the loading state
    setTimeout(() => {
      const calcResults = runAllMethods(crossSection, bridgeGeometry, flowProfiles, coefficients);
      setResults(calcResults);
      if (coefficients.manningsNSensitivityPct != null) {
        const sensResults = runWithSensitivity(crossSection, bridgeGeometry, flowProfiles, coefficients);
        setSensitivityResults(sensResults);
      } else {
        setSensitivityResults(null);
      }
      setIsProcessing(false);
      setActiveMainTab('summary');
      toast.success('Processing complete', {
        description: 'All methods have been calculated. Viewing summary.',
      });
      fetchAiSummary();
    }, 50);
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
      <div className="sticky bottom-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 pt-4 pb-3 mt-4 border-t backdrop-blur-sm bg-background/80 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <Button variant="outline" size="sm" onClick={() => setTestOpen(true)} className="w-full sm:w-auto"><FlaskConical className="h-4 w-4 mr-1.5" />Load Test Bridge</Button>
        <div className="hidden sm:block flex-1" />
        <div className="flex gap-2 sm:gap-6">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-initial text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" onClick={() => { clearResults(); setSensitivityResults(null); setErrors([]); }}><RotateCcw className="h-4 w-4 mr-1.5" />Clear</Button>
          <Button onClick={handleRunAll} disabled={isProcessing} className="flex-1 sm:flex-initial">
            {isProcessing
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Processing…</>
              : <><Play className="h-4 w-4 mr-1.5" />Run All Methods</>}
          </Button>
        </div>
      </div>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Test Bridge</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select a bridge to auto-populate all input fields.
          </p>
          <div className="grid gap-3 max-h-[70vh] overflow-y-auto pr-1">
            {TEST_BRIDGES.map((bridge) => (
              <button
                key={bridge.id}
                onClick={() => handleLoadTestBridge(bridge)}
                className="group text-left rounded-lg border overflow-hidden bg-muted/30 hover:bg-muted/60 hover:ring-2 hover:ring-ring transition-all"
              >
                <div className="flex flex-col sm:flex-row gap-0 sm:gap-4">
                  <img
                    src={bridge.imageUrl}
                    alt={bridge.name}
                    className="w-full sm:w-32 h-36 sm:h-32 object-cover shrink-0 grayscale group-hover:grayscale-[20%] transition-all duration-300"
                  />
                  <div className="p-3 sm:py-3 sm:pr-4 sm:pl-0 min-w-0">
                    <div className="font-medium">{bridge.name}</div>
                    <div className="text-sm text-muted-foreground">{bridge.location}</div>
                    <div className="text-xs text-muted-foreground/80 mt-2 leading-relaxed">{bridge.description}</div>
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
