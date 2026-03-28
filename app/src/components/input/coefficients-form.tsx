'use client';

import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NumericInput, NullableNumericInput } from '@/components/ui/numeric-input';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, toImperial, unitLabel } from '@/lib/units';

const METHOD_META = [
  { key: 'energy', label: 'Energy', color: 'bg-blue-500', ring: 'ring-blue-500/40' },
  { key: 'momentum', label: 'Momentum', color: 'bg-emerald-500', ring: 'ring-emerald-500/40' },
  { key: 'yarnell', label: 'Yarnell', color: 'bg-amber-500', ring: 'ring-amber-500/40' },
  { key: 'wspro', label: 'WSPRO', color: 'bg-purple-500', ring: 'ring-purple-500/40' },
] as const;

export function CoefficientsForm() {
  const coefficients = useProjectStore((s) => s.coefficients);
  const update = useProjectStore((s) => s.updateCoefficients);
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);

  function setField(field: string, value: number) { update({ ...coefficients, [field]: value }); }

  function toggleMethod(method: keyof typeof coefficients.methodsToRun) {
    update({ ...coefficients, methodsToRun: { ...coefficients.methodsToRun, [method]: !coefficients.methodsToRun[method] } });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coefficients &amp; Settings</CardTitle>
        <CardDescription>Loss coefficients, iteration parameters, and method selection</CardDescription>
      </CardHeader>
      <CardContent className="space-y-0 max-w-xl">
        {/* Methods — toggle buttons */}
        <div className="pb-5">
          <div className="flex flex-wrap gap-2">
            {METHOD_META.map((m) => {
              const active = coefficients.methodsToRun[m.key];
              return (
                <button
                  key={m.key}
                  onClick={() => toggleMethod(m.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 sm:px-3.5 py-2 text-sm font-medium transition-all ${
                    active
                      ? `border-transparent bg-muted/40 text-foreground ring-2 ${m.ring}`
                      : 'border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/20'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full transition-opacity ${m.color} ${active ? 'opacity-100' : 'opacity-30'}`} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border/50" />

        {/* Energy coefficients */}
        <div className="py-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Energy Coefficients</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Contraction (Cc)</Label>
              <NumericInput value={coefficients.contractionCoeff} onCommit={(v) => setField('contractionCoeff', v)} className="h-8 text-sm font-mono" step="0.1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expansion (Ce)</Label>
              <NumericInput value={coefficients.expansionCoeff} onCommit={(v) => setField('expansionCoeff', v)} className="h-8 text-sm font-mono" step="0.1" />
            </div>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        {/* Yarnell K + Debris blockage */}
        <div className="py-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Yarnell K</Label>
              <NullableNumericInput
                value={coefficients.yarnellK}
                onCommit={(v) => update({ ...coefficients, yarnellK: v })}
                className="h-8 text-sm font-mono" step="0.1" placeholder="Auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Debris Blockage (%)</Label>
              <NumericInput
                value={coefficients.debrisBlockagePct}
                onCommit={(v) => setField('debrisBlockagePct', Math.min(100, Math.max(0, v)))}
                className="h-8 text-sm font-mono" step="5" min="0" max="100"
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        {/* Solver + Sensitivity */}
        <div className="py-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Solver</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Max Iter.</Label>
              <NumericInput value={coefficients.maxIterations} onCommit={(v) => setField('maxIterations', Math.round(v) || 100)} className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tol. ({lenUnit})</Label>
              <NumericInput
                value={toDisplay(coefficients.tolerance, 'length', us)}
                onCommit={(v) => setField('tolerance', toImperial(v || 0.01, 'length', us))}
                className="h-8 text-sm font-mono" step="0.001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Guess Offset ({lenUnit})</Label>
              <NumericInput
                value={toDisplay(coefficients.initialGuessOffset, 'length', us)}
                onCommit={(v) => setField('initialGuessOffset', toImperial(v || 0.5, 'length', us))}
                className="h-8 text-sm font-mono" step="0.1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">n Sensitivity (±%)</Label>
              <NullableNumericInput
                value={coefficients.manningsNSensitivityPct}
                onCommit={(v) => update({ ...coefficients, manningsNSensitivityPct: v != null ? Math.max(1, v) : null })}
                className="h-8 text-sm font-mono" step="5" min="1" max="100" placeholder="Off"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Alpha (α₁)</Label>
              <NullableNumericInput
                value={coefficients.alphaOverride}
                onCommit={(v) => update({ ...coefficients, alphaOverride: v != null ? Math.max(0.5, v) : null })}
                className="h-8 text-sm font-mono" step="0.1" min="0.5" max="5" placeholder="Auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Freeboard Thr. ({lenUnit})</Label>
              <NumericInput
                value={toDisplay(coefficients.freeboardThreshold, 'length', us)}
                onCommit={(v) => setField('freeboardThreshold', toImperial(v || 0.3, 'length', us))}
                className="h-8 text-sm font-mono" step="0.1"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
