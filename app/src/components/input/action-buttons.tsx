'use client';

import { Button } from '@/components/ui/button';
import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';
import { runAllMethods, runWithSensitivity } from '@/engine/index';
import { validateInputs } from '@/lib/validation';
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, RotateCcw, AlertTriangle, FlaskConical, Loader2, ArrowRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { TEST_BRIDGES, type TestBridge } from '@/lib/test-bridges';
import { toImperial } from '@/lib/units';

export function ActionButtons() {
  const [testOpen, setTestOpen] = useState(false);
  const [selectedBridge, setSelectedBridge] = useState<TestBridge | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [unavailableVideos, setUnavailableVideos] = useState<Record<string, boolean>>({});
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
      setActiveMainTab('analysis');
      toast.success('Bridge loaded & calculated', {
        description: `${selectedBridge.name} — viewing analysis.`,
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
      setActiveMainTab('analysis');
      toast.success('Processing complete', {
        description: 'All methods have been calculated. Viewing analysis.',
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
        <DialogContent
          showCloseButton={false}
          className="max-w-[100vw] max-h-[100dvh] h-[100dvh] w-[100vw] rounded-none sm:rounded-2xl sm:max-w-4xl sm:h-auto sm:max-h-[90vh] p-0 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-2">
            <div>
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">Load Test Bridge</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground mt-1">
                Select a bridge to auto-populate inputs and run calculations.
              </p>
            </div>
            <DialogClose
              className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>

          {/* Card grid */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEST_BRIDGES.map((bridge) => {
                const isSelected = selectedBridge?.id === bridge.id;
                const hasVideo = !unavailableVideos[bridge.id];
                return (
                  <button
                    key={bridge.id}
                    onClick={() => handleSelectBridge(bridge)}
                    onMouseEnter={() => handleVideoHover(bridge.id, true)}
                    onMouseLeave={() => handleVideoHover(bridge.id, false)}
                    className={`group text-left rounded-xl overflow-hidden transition-all duration-200 ${
                      isSelected
                        ? 'ring-2 ring-primary bg-primary/5 border border-primary/30 shadow-lg shadow-primary/10'
                        : 'border border-border/50 bg-muted/20 hover:ring-1 hover:ring-ring hover:bg-muted/40 hover:shadow-md'
                    }`}
                  >
                    <div className="relative h-44 sm:h-48 bg-muted/50 overflow-hidden">
                      {hasVideo ? (
                        <video
                          ref={(el) => { videoRefs.current[bridge.id] = el; }}
                          src={`/Bridges/${bridge.id}.mp4`}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          onError={() => {
                            videoRefs.current[bridge.id] = null;
                            setUnavailableVideos((current) => current[bridge.id]
                              ? current
                              : { ...current, [bridge.id]: true });
                          }}
                          className={`w-full h-full object-cover transition-all duration-500 ${
                            isSelected
                              ? 'grayscale-0 scale-105'
                              : 'grayscale group-hover:grayscale-[30%] group-hover:scale-[1.02]'
                          }`}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 px-6 text-center">
                          <div>
                            <div className="text-sm font-semibold text-white">{bridge.name}</div>
                            <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/60">Preview unavailable</div>
                          </div>
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground uppercase tracking-widest shadow-sm">
                          Selected
                        </div>
                      )}
                      {/* Bottom gradient for text readability */}
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                    </div>
                    <div className="p-4">
                      <div className="font-semibold text-sm">{bridge.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{bridge.location}</div>
                      <div className="text-xs text-muted-foreground/60 mt-2 leading-relaxed line-clamp-2">{bridge.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confirm button — sticky bottom */}
          <div className="border-t border-border/40 px-5 sm:px-6 py-4 bg-popover/80 backdrop-blur-sm">
            <Button
              onClick={handleConfirmBridge}
              disabled={!selectedBridge}
              size="lg"
              className="w-full text-sm font-semibold"
            >
              {selectedBridge ? (
                <>Load {selectedBridge.name} <ArrowRight className="h-4 w-4 ml-2" /></>
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
