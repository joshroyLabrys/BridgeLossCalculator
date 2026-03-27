// src/components/simulation/simulation-tab.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';
import { buildHydraulicProfile } from '@/engine/simulation-profile';
import { runAllMethods } from '@/engine';
import { HydraulicProfileChart } from './hydraulic-profile-chart';
import { SimulationControls } from './simulation-controls';
import { WhatIfControls, type WhatIfOverrides } from '@/components/what-if/what-if-controls';
import { toDisplay, unitLabel } from '@/lib/units';
import type { CalculationResults } from '@/engine/types';
import { Waves, FlaskConical, RotateCcw, ChevronRight, ChevronDown } from 'lucide-react';

const METHOD_KEYS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

function Delta({ baseline, modified, unit }: { baseline: number; modified: number; unit: string }) {
  const diff = modified - baseline;
  if (Math.abs(diff) < 0.0001) return null;
  return (
    <span className={`text-[10px] font-mono ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
      {diff > 0 ? '+' : ''}{diff.toFixed(3)} {unit}
    </span>
  );
}

export function SimulationTab() {
  const results = useProjectStore((s) => s.results);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const crossSection = useProjectStore((s) => s.crossSection);
  const coefficients = useProjectStore((s) => s.coefficients);
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);
  const vel = unitLabel('velocity', us);

  const [selectedProfileIdx, setSelectedProfileIdx] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string>('energy');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [whatIfOpen, setWhatIfOpen] = useState(false);

  const defaults: WhatIfOverrides = {
    manningsNMultiplier: 1.0,
    debrisBlockagePct: coefficients.debrisBlockagePct,
    contractionCoeff: coefficients.contractionCoeff,
    expansionCoeff: coefficients.expansionCoeff,
    dischargeMultiplier: 1.0,
  };
  const [overrides, setOverrides] = useState<WhatIfOverrides>(defaults);
  const hasChanges = JSON.stringify(overrides) !== JSON.stringify(defaults);

  const activeMethods = METHOD_KEYS.filter(
    (m) => coefficients.methodsToRun[m] && results?.[m]?.length,
  );

  // Run modified engine when What-If is active
  const modifiedResults = useMemo(() => {
    if (!hasChanges || crossSection.length < 2 || flowProfiles.length === 0) return null;

    const modifiedXs = crossSection.map((p) => ({
      ...p,
      manningsN: p.manningsN * overrides.manningsNMultiplier,
    }));
    const modifiedProfiles = flowProfiles.map((p) => ({
      ...p,
      discharge: p.discharge * overrides.dischargeMultiplier,
    }));
    const modifiedCoeffs = {
      ...coefficients,
      debrisBlockagePct: overrides.debrisBlockagePct,
      contractionCoeff: overrides.contractionCoeff,
      expansionCoeff: overrides.expansionCoeff,
    };

    return runAllMethods(modifiedXs, bridgeGeometry, modifiedProfiles, modifiedCoeffs);
  }, [crossSection, bridgeGeometry, flowProfiles, coefficients, overrides, hasChanges]);

  // Use modified results if What-If is active, otherwise baseline
  const activeResults = hasChanges ? modifiedResults : results;
  const baselineResult = results?.[selectedMethod as keyof CalculationResults]?.[selectedProfileIdx];
  const activeResult = activeResults?.[selectedMethod as keyof CalculationResults]?.[selectedProfileIdx];
  const flowProfile = flowProfiles[selectedProfileIdx];

  // Build profile from whichever results are active — use modified cross-section if What-If
  const hydraulicProfile = useMemo(() => {
    if (!activeResult || !flowProfile || crossSection.length < 2) return null;
    const xs = hasChanges
      ? crossSection.map((p) => ({ ...p, manningsN: p.manningsN * overrides.manningsNMultiplier }))
      : crossSection;
    const fp = hasChanges
      ? { ...flowProfile, discharge: flowProfile.discharge * overrides.dischargeMultiplier }
      : flowProfile;
    return buildHydraulicProfile(xs, bridgeGeometry, fp, activeResult);
  }, [crossSection, bridgeGeometry, flowProfile, activeResult, hasChanges, overrides]);

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Waves className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No results yet</p>
        <p className="text-xs mt-1">Run calculations from the Input tab to see the simulation</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Hydraulic Simulation</h2>
        <p className="text-sm text-muted-foreground max-w-prose text-pretty">
          Animated cross-section with flow visualization. Adjust &ldquo;What If&rdquo; parameters to see impacts in real-time.
        </p>
      </div>

      <div className="flex gap-4">
        {/* Main chart area */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader>
              <SimulationControls
                profiles={flowProfiles}
                selectedProfileIdx={selectedProfileIdx}
                onProfileChange={setSelectedProfileIdx}
                methods={activeMethods}
                selectedMethod={selectedMethod}
                onMethodChange={setSelectedMethod}
                isPlaying={isPlaying}
                onPlayingChange={setIsPlaying}
                speed={speed}
                onSpeedChange={setSpeed}
              />
            </CardHeader>
            <CardContent>
              {hydraulicProfile ? (
                <HydraulicProfileChart
                  profile={hydraulicProfile}
                  isPlaying={isPlaying}
                  speed={speed}
                  particleCount={40}
                />
              ) : (
                <div className="flex items-center justify-center h-[420px] text-muted-foreground text-sm">
                  Select a profile and method with results to view the simulation
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status bar */}
          {hydraulicProfile && (
            <div className="flex items-center gap-3 text-xs mt-3">
              <span className={`px-2 py-1 rounded-md font-medium ${
                hydraulicProfile.flowRegime === 'free-surface'
                  ? 'bg-blue-500/15 text-blue-400'
                  : hydraulicProfile.flowRegime === 'pressure'
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'bg-red-500/15 text-red-400'
              }`}>
                {hydraulicProfile.flowRegime.toUpperCase().replace('-', ' ')}
              </span>
              <span className="text-muted-foreground font-mono">
                WSEL {toDisplay(hydraulicProfile.usWsel, 'length', us).toFixed(2)} {len}
              </span>
              <span className="text-muted-foreground font-mono">
                Δh {toDisplay(hydraulicProfile.totalHeadLoss, 'length', us).toFixed(3)} {len}
              </span>
              {hasChanges && baselineResult && activeResult && (
                <span className="ml-auto text-muted-foreground">
                  vs baseline: <Delta baseline={baselineResult.upstreamWsel} modified={activeResult.upstreamWsel} unit={len} />
                </span>
              )}
            </div>
          )}
        </div>

        {/* What-If sidebar */}
        <div className={`shrink-0 transition-all duration-200 ${whatIfOpen ? 'w-64' : 'w-10'}`}>
          {whatIfOpen ? (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">What If?</span>
                  </div>
                  <button
                    onClick={() => setWhatIfOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <WhatIfControls overrides={overrides} defaults={defaults} onChange={setOverrides} />

                {/* Impact deltas */}
                {hasChanges && baselineResult && activeResult && (
                  <div className="border-t border-border/40 pt-3 space-y-1.5">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Impact</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">US WSEL</span>
                        <div className="text-right">
                          <span className="font-mono">{toDisplay(activeResult.upstreamWsel, 'length', us).toFixed(3)} {len}</span>
                          <div><Delta baseline={baselineResult.upstreamWsel} modified={activeResult.upstreamWsel} unit={len} /></div>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Head Loss</span>
                        <div className="text-right">
                          <span className="font-mono">{toDisplay(activeResult.totalHeadLoss, 'length', us).toFixed(3)} {len}</span>
                          <div><Delta baseline={baselineResult.totalHeadLoss} modified={activeResult.totalHeadLoss} unit={len} /></div>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Velocity</span>
                        <div className="text-right">
                          <span className="font-mono">{toDisplay(activeResult.approachVelocity, 'velocity', us).toFixed(2)} {vel}</span>
                          <div><Delta baseline={baselineResult.approachVelocity} modified={activeResult.approachVelocity} unit={vel} /></div>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Froude</span>
                        <div className="text-right">
                          <span className="font-mono">{activeResult.froudeApproach.toFixed(3)}</span>
                          <div><Delta baseline={baselineResult.froudeApproach} modified={activeResult.froudeApproach} unit="" /></div>
                        </div>
                      </div>
                    </div>

                    {activeResult.flowRegime !== baselineResult.flowRegime && (
                      <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-1.5 text-[11px] text-amber-400">
                        Regime: {baselineResult.flowRegime} → <span className="font-semibold">{activeResult.flowRegime}</span>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  disabled={!hasChanges}
                  onClick={() => setOverrides(defaults)}
                >
                  <RotateCcw className="h-3 w-3 mr-1.5" />
                  Reset to Baseline
                </Button>
              </CardContent>
            </Card>
          ) : (
            <button
              onClick={() => setWhatIfOpen(true)}
              className="h-full w-10 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors flex flex-col items-center justify-center gap-2"
              title="Open What If? panel"
            >
              <FlaskConical className="h-4 w-4 text-primary" />
              <span className="text-[10px] text-muted-foreground font-medium [writing-mode:vertical-lr] rotate-180">
                What If?
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
