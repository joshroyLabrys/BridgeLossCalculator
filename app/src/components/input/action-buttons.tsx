'use client';

import { Button } from '@/components/ui/button';
import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';
import { runAllMethods, runWithSensitivity } from '@/engine/index';
import { validateInputs } from '@/lib/validation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, RotateCcw, AlertTriangle, FlaskConical, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { TEST_BRIDGES, type TestBridge } from '@/lib/test-bridges';
import { toImperial } from '@/lib/units';

export function ActionButtons() {
  const [testOpen, setTestOpen] = useState(false);
  const [selectedBridge, setSelectedBridge] = useState<TestBridge | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
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
  }

  const handleVideoHover = useCallback((bridgeId: string, hovering: boolean) => {
    const video = videoRefs.current[bridgeId];
    if (!video) return;
    if (hovering) {
      video.play().catch(() => {});
    } else if (selectedBridge?.id !== bridgeId) {
      video.pause();
      video.currentTime = 0;
    }
  }, [selectedBridge]);

  function handleSelectBridge(bridge: TestBridge) {
    // Pause previously selected video if different
    if (selectedBridge && selectedBridge.id !== bridge.id) {
      const prev = videoRefs.current[selectedBridge.id];
      if (prev) { prev.pause(); prev.currentTime = 0; }
    }
    setSelectedBridge(bridge);
    // Start playing the newly selected video
    const video = videoRefs.current[bridge.id];
    if (video) video.play().catch(() => {});
  }

  function handleConfirmBridge() {
    if (!selectedBridge) return;
    handleLoadTestBridge(selectedBridge);
    setTestOpen(false);
    setSelectedBridge(null);

    // Auto-run calculations after loading
    clearAiSummary();
    setIsProcessing(true);
    setTimeout(() => {
      const state = useProjectStore.getState();
      const calcResults = runAllMethods(state.crossSection, state.bridgeGeometry, state.flowProfiles, state.coefficients);
      setResults(calcResults);
      if (state.coefficients.manningsNSensitivityPct != null) {
        const sensResults = runWithSensitivity(state.crossSection, state.bridgeGeometry, state.flowProfiles, state.coefficients);
        setSensitivityResults(sensResults);
      } else {
        setSensitivityResults(null);
      }
      setIsProcessing(false);
      setActiveMainTab('summary');
      toast.success('Bridge loaded & calculated', {
        description: `${selectedBridge.name} — viewing summary.`,
      });
      useProjectStore.getState().fetchAiSummary();
    }, 50);
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

      <Dialog open={testOpen} onOpenChange={(open) => { setTestOpen(open); if (!open) setSelectedBridge(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Test Bridge</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select a bridge to auto-populate inputs, run calculations, and view the summary.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {TEST_BRIDGES.map((bridge) => {
              const isSelected = selectedBridge?.id === bridge.id;
              return (
                <button
                  key={bridge.id}
                  onClick={() => handleSelectBridge(bridge)}
                  onMouseEnter={() => handleVideoHover(bridge.id, true)}
                  onMouseLeave={() => handleVideoHover(bridge.id, false)}
                  className={`group text-left rounded-lg overflow-hidden transition-all duration-200 ${
                    isSelected
                      ? 'ring-2 ring-primary bg-primary/5 border border-primary/30'
                      : 'border border-border/50 bg-muted/30 hover:ring-1 hover:ring-ring hover:bg-muted/50'
                  }`}
                >
                  <div className="relative h-40 bg-muted overflow-hidden">
                    <video
                      ref={(el) => { videoRefs.current[bridge.id] = el; }}
                      src={`/bridges/${bridge.id}.mp4`}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground uppercase tracking-wider">
                        Selected
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-sm">{bridge.name}</div>
                    <div className="text-xs text-muted-foreground">{bridge.location}</div>
                    <div className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed line-clamp-2">{bridge.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Confirm button */}
          <div className="border-t border-border/50 pt-3 -mx-6 px-6 -mb-2">
            <Button
              onClick={handleConfirmBridge}
              disabled={!selectedBridge}
              className="w-full"
            >
              {selectedBridge ? (
                <>Load {selectedBridge.name} <ArrowRight className="h-4 w-4 ml-1.5" /></>
              ) : (
                <span className="text-muted-foreground">Select a bridge above</span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
