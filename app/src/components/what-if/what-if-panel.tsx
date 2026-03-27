// src/components/what-if/what-if-panel.tsx
'use client';

import { useState, useMemo } from 'react';
import { X, RotateCcw, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';
import { runAllMethods } from '@/engine';
import { toDisplay, unitLabel } from '@/lib/units';
import { WhatIfControls, DEFAULT_OVERRIDES, type WhatIfOverrides } from './what-if-controls';
import type { CalculationResults } from '@/engine/types';

function Delta({ baseline, modified, unit, inverted }: { baseline: number; modified: number; unit: string; inverted?: boolean }) {
  const diff = modified - baseline;
  if (Math.abs(diff) < 0.0001) return <span className="text-muted-foreground text-[10px] font-mono">—</span>;
  const isWorse = inverted ? diff > 0 : diff > 0;
  return (
    <span className={`text-[10px] font-mono ${isWorse ? 'text-red-400' : 'text-emerald-400'}`}>
      {diff > 0 ? '+' : ''}{diff.toFixed(3)} {unit}
    </span>
  );
}

export function WhatIfPanel({ onClose }: { onClose: () => void }) {
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const baselineResults = useProjectStore((s) => s.results);
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);
  const vel = unitLabel('velocity', us);

  const [selectedProfileIdx, setSelectedProfileIdx] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<keyof CalculationResults>('energy');

  const defaults: WhatIfOverrides = {
    manningsNMultiplier: 1.0,
    debrisBlockagePct: coefficients.debrisBlockagePct,
    contractionCoeff: coefficients.contractionCoeff,
    expansionCoeff: coefficients.expansionCoeff,
    dischargeMultiplier: 1.0,
  };

  const [overrides, setOverrides] = useState<WhatIfOverrides>(defaults);

  const modifiedResults = useMemo(() => {
    if (crossSection.length < 2 || flowProfiles.length === 0) return null;

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
  }, [crossSection, bridgeGeometry, flowProfiles, coefficients, overrides]);

  const baseResult = baselineResults?.[selectedMethod]?.[selectedProfileIdx];
  const modResult = modifiedResults?.[selectedMethod]?.[selectedProfileIdx];

  const hasChanges = JSON.stringify(overrides) !== JSON.stringify(defaults);

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-card border border-border/60 rounded-xl shadow-2xl shadow-black/30 z-50 flex flex-col max-h-[calc(100vh-6rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">What If?</h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Profile + method selectors */}
      <div className="px-4 py-2 border-b border-border/30 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide w-12">Profile</label>
          <select
            value={selectedProfileIdx}
            onChange={(e) => setSelectedProfileIdx(Number(e.target.value))}
            className="flex-1 rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs"
          >
            {flowProfiles.map((p, i) => (
              <option key={i} value={i}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide w-12">Method</label>
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value as keyof CalculationResults)}
            className="flex-1 rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs"
          >
            {(['energy', 'momentum', 'yarnell', 'wspro'] as const)
              .filter((m) => coefficients.methodsToRun[m])
              .map((m) => (
                <option key={m} value={m}>
                  {m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 overflow-y-auto flex-1">
        <WhatIfControls overrides={overrides} defaults={defaults} onChange={setOverrides} />
      </div>

      {/* Results delta */}
      {baseResult && modResult && (
        <div className="px-4 py-3 border-t border-border/40 bg-muted/20 space-y-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">Impact</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <div className="text-muted-foreground text-[10px]">US WSEL</div>
              <div className="font-mono font-medium">{toDisplay(modResult.upstreamWsel, 'length', us).toFixed(3)} {len}</div>
              <Delta baseline={baseResult.upstreamWsel} modified={modResult.upstreamWsel} unit={len} inverted />
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Head Loss</div>
              <div className="font-mono font-medium">{toDisplay(modResult.totalHeadLoss, 'length', us).toFixed(3)} {len}</div>
              <Delta baseline={baseResult.totalHeadLoss} modified={modResult.totalHeadLoss} unit={len} inverted />
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Velocity</div>
              <div className="font-mono font-medium">{toDisplay(modResult.approachVelocity, 'velocity', us).toFixed(2)} {vel}</div>
              <Delta baseline={baseResult.approachVelocity} modified={modResult.approachVelocity} unit={vel} inverted />
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Froude</div>
              <div className="font-mono font-medium">{modResult.froudeApproach.toFixed(3)}</div>
              <Delta baseline={baseResult.froudeApproach} modified={modResult.froudeApproach} unit="" inverted />
            </div>
          </div>

          {modResult.flowRegime !== baseResult.flowRegime && (
            <div className="mt-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 text-[11px] text-amber-400">
              Regime changed: {baseResult.flowRegime} → <span className="font-semibold">{modResult.flowRegime}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/30 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 px-2"
          disabled={!hasChanges}
          onClick={() => setOverrides(defaults)}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
        <span className="text-[10px] text-muted-foreground">
          {hasChanges ? 'Live re-calculation' : 'Adjust a parameter'}
        </span>
      </div>
    </div>
  );
}
