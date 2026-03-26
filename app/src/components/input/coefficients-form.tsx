'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjectStore } from '@/store/project-store';
import { toImperial, toDisplay, unitLabel } from '@/lib/units';

export function CoefficientsForm() {
  const coefficients = useProjectStore((s) => s.coefficients);
  const update = useProjectStore((s) => s.updateCoefficients);
  const us = useProjectStore((s) => s.unitSystem);

  const lengthUnit = unitLabel('length', us);

  function setField(field: string, value: number) {
    update({ ...coefficients, [field]: value });
  }

  function toggleMethod(method: keyof typeof coefficients.methodsToRun) {
    update({
      ...coefficients,
      methodsToRun: {
        ...coefficients.methodsToRun,
        [method]: !coefficients.methodsToRun[method],
      },
    });
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-medium mb-3">Energy Method Coefficients</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Contraction Coefficient (Cc)</Label>
            <Input type="number" value={coefficients.contractionCoeff} onChange={(e) => setField('contractionCoeff', parseFloat(e.target.value) || 0)} className="h-8 text-sm" step="0.1" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Expansion Coefficient (Ce)</Label>
            <Input type="number" value={coefficients.expansionCoeff} onChange={(e) => setField('expansionCoeff', parseFloat(e.target.value) || 0)} className="h-8 text-sm" step="0.1" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Yarnell Method</h3>
        <div className="space-y-1">
          <Label className="text-xs">Pier Shape Coefficient (K) — leave blank for auto</Label>
          <Input
            type="number"
            value={coefficients.yarnellK ?? ''}
            onChange={(e) => update({ ...coefficients, yarnellK: e.target.value ? parseFloat(e.target.value) : null })}
            className="h-8 text-sm"
            step="0.1"
            placeholder="Auto from pier shape"
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Iteration Settings</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Max Iterations</Label>
            <Input type="number" value={coefficients.maxIterations} onChange={(e) => setField('maxIterations', parseInt(e.target.value) || 100)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tolerance ({lengthUnit})</Label>
            <Input
              type="number"
              value={toDisplay(coefficients.tolerance, 'length', us)}
              onChange={(e) => setField('tolerance', toImperial(parseFloat(e.target.value) || 0.01, 'length', us))}
              className="h-8 text-sm"
              step="0.001"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Initial Guess Offset ({lengthUnit})</Label>
            <Input
              type="number"
              value={toDisplay(coefficients.initialGuessOffset, 'length', us)}
              onChange={(e) => setField('initialGuessOffset', toImperial(parseFloat(e.target.value) || 0.5, 'length', us))}
              className="h-8 text-sm"
              step="0.1"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Methods to Run</h3>
        <div className="flex gap-6">
          {(['energy', 'momentum', 'yarnell', 'wspro'] as const).map((method) => (
            <div key={method} className="flex items-center gap-2">
              <Checkbox
                checked={coefficients.methodsToRun[method]}
                onCheckedChange={() => toggleMethod(method)}
              />
              <Label className="text-sm capitalize">{method === 'wspro' ? 'WSPRO' : method}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
