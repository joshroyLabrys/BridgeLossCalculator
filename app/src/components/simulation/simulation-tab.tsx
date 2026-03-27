'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/project-store';
import { buildHydraulicProfile } from '@/engine/simulation-profile';
import { runAllMethods } from '@/engine';
import { SimulationScene } from './scene-3d/simulation-scene';
import { EnergyGradeDiagram } from './energy-grade-diagram';
import { SimulationControls } from './simulation-controls';
import { WhatIfControls, type WhatIfOverrides } from '@/components/what-if/what-if-controls';
import { toDisplay, unitLabel } from '@/lib/units';
import type { CalculationResults } from '@/engine/types';
import { Waves, FlaskConical, RotateCcw } from 'lucide-react';

const METHOD_KEYS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

function methodLabel(m: string) {
  return m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1);
}

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
  const [isPlaying, setIsPlaying] = useState(true); // kept for controls API
  const [speed, setSpeed] = useState(1); // kept for controls API

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

  const activeResults = hasChanges ? modifiedResults : results;
  const baselineResult = results?.[selectedMethod as keyof CalculationResults]?.[selectedProfileIdx];
  const activeResult = activeResults?.[selectedMethod as keyof CalculationResults]?.[selectedProfileIdx];
  const flowProfile = flowProfiles[selectedProfileIdx];

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
          Animated cross-section with flow visualization. Adjust parameters to see impacts in real-time.
        </p>
      </div>

      <div className="flex gap-4 items-start">
        {/* Main chart area */}
        <div className="flex-1 min-w-0 space-y-3">
          {hydraulicProfile ? (
            <SimulationScene profile={hydraulicProfile} />
          ) : (
            <Card>
              <CardContent>
                <div className="flex items-center justify-center h-[500px] text-muted-foreground text-sm">
                  Select a profile and method with results to view the simulation
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status bar */}
          {hydraulicProfile && (
            <div className="flex items-center gap-3 text-xs">
              <span className={`px-2 py-0.5 rounded font-medium text-[11px] ${
                hydraulicProfile.flowRegime === 'free-surface'
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : hydraulicProfile.flowRegime === 'pressure'
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}>
                {hydraulicProfile.flowRegime.toUpperCase().replace('-', ' ')}
              </span>
              <span className="text-muted-foreground">
                WSEL <span className="font-mono text-foreground">{toDisplay(hydraulicProfile.usWsel, 'length', us).toFixed(2)}</span> {len}
              </span>
              <span className="text-muted-foreground">
                Δh <span className="font-mono text-foreground">{toDisplay(hydraulicProfile.totalHeadLoss, 'length', us).toFixed(3)}</span> {len}
              </span>
              {hasChanges && baselineResult && activeResult && (
                <span className="ml-auto">
                  <Delta baseline={baselineResult.upstreamWsel} modified={activeResult.upstreamWsel} unit={len} />
                </span>
              )}
            </div>
          )}

          {/* Energy Grade Line Diagram */}
          {hydraulicProfile && (
            <Card>
              <CardContent className="pt-4">
                <EnergyGradeDiagram profile={hydraulicProfile} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* What-If sidebar — always visible */}
        <Card className="w-64 shrink-0">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide">What If?</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-4">
            {/* Scenario selectors */}
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Profile</label>
                <Select value={String(selectedProfileIdx)} onValueChange={(v) => setSelectedProfileIdx(Number(v))}>
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {flowProfiles.map((p, i) => (
                      <SelectItem key={i} value={String(i)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Method</label>
                <Select value={selectedMethod} onValueChange={(v) => { if (v) setSelectedMethod(v); }}>
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMethods.map((m) => (
                      <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="h-px bg-border/40" />

            {/* Sliders */}
            <WhatIfControls overrides={overrides} defaults={defaults} onChange={setOverrides} />

            {/* Impact deltas */}
            {hasChanges && baselineResult && activeResult && (
              <>
                <div className="h-px bg-border/40" />
                <div className="space-y-1.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Impact</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-muted-foreground">US WSEL</span>
                      <div className="text-right">
                        <span className="font-mono text-foreground">{toDisplay(activeResult.upstreamWsel, 'length', us).toFixed(3)}</span>
                        <span className="text-muted-foreground"> {len} </span>
                        <Delta baseline={baselineResult.upstreamWsel} modified={activeResult.upstreamWsel} unit={len} />
                      </div>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-muted-foreground">Head Loss</span>
                      <div className="text-right">
                        <span className="font-mono text-foreground">{toDisplay(activeResult.totalHeadLoss, 'length', us).toFixed(3)}</span>
                        <span className="text-muted-foreground"> {len} </span>
                        <Delta baseline={baselineResult.totalHeadLoss} modified={activeResult.totalHeadLoss} unit={len} />
                      </div>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-muted-foreground">Velocity</span>
                      <div className="text-right">
                        <span className="font-mono text-foreground">{toDisplay(activeResult.approachVelocity, 'velocity', us).toFixed(2)}</span>
                        <span className="text-muted-foreground"> {vel} </span>
                        <Delta baseline={baselineResult.approachVelocity} modified={activeResult.approachVelocity} unit={vel} />
                      </div>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-muted-foreground">Froude</span>
                      <div className="text-right">
                        <span className="font-mono text-foreground">{activeResult.froudeApproach.toFixed(3)}</span>
                        {' '}
                        <Delta baseline={baselineResult.froudeApproach} modified={activeResult.froudeApproach} unit="" />
                      </div>
                    </div>
                  </div>

                  {activeResult.flowRegime !== baselineResult.flowRegime && (
                    <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-1.5 text-[11px] text-amber-400 mt-2">
                      {baselineResult.flowRegime} → <span className="font-semibold">{activeResult.flowRegime}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7"
              disabled={!hasChanges}
              onClick={() => setOverrides(defaults)}
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Reset to Baseline
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
