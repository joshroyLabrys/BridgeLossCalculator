'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectStore } from '@/store/project-store';

const METHOD_COLORS: Record<string, string> = {
  energy: 'bg-blue-500',
  momentum: 'bg-emerald-500',
  yarnell: 'bg-amber-500',
  wspro: 'bg-purple-500',
};

export function CoefficientsForm() {
  const coefficients = useProjectStore((s) => s.coefficients);
  const update = useProjectStore((s) => s.updateCoefficients);

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
      <CardContent className="space-y-6 max-w-lg">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Energy Method</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Contraction Coeff. (Cc)</Label>
              <Input type="number" value={coefficients.contractionCoeff} onChange={(e) => setField('contractionCoeff', parseFloat(e.target.value) || 0)} className="h-8 text-sm font-mono" step="0.1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expansion Coeff. (Ce)</Label>
              <Input type="number" value={coefficients.expansionCoeff} onChange={(e) => setField('expansionCoeff', parseFloat(e.target.value) || 0)} className="h-8 text-sm font-mono" step="0.1" />
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Yarnell Method</div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Pier Shape Coefficient (K)</Label>
            <Input type="number" value={coefficients.yarnellK ?? ''} onChange={(e) => update({ ...coefficients, yarnellK: e.target.value ? parseFloat(e.target.value) : null })} className="h-8 text-sm font-mono" step="0.1" placeholder="Auto from pier shape" />
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Iteration Settings</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Max Iterations</Label>
              <Input type="number" value={coefficients.maxIterations} onChange={(e) => setField('maxIterations', parseInt(e.target.value) || 100)} className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tolerance (ft)</Label>
              <Input type="number" value={coefficients.tolerance} onChange={(e) => setField('tolerance', parseFloat(e.target.value) || 0.01)} className="h-8 text-sm font-mono" step="0.001" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Initial Guess Offset (ft)</Label>
              <Input type="number" value={coefficients.initialGuessOffset} onChange={(e) => setField('initialGuessOffset', parseFloat(e.target.value) || 0.5)} className="h-8 text-sm font-mono" step="0.1" />
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Methods to Run</div>
          <div className="flex gap-6">
            {(['energy', 'momentum', 'yarnell', 'wspro'] as const).map((method) => (
              <div key={method} className="flex items-center gap-2">
                <Checkbox checked={coefficients.methodsToRun[method]} onCheckedChange={() => toggleMethod(method)} />
                <span className={`h-2 w-2 rounded-full ${METHOD_COLORS[method]}`} />
                <Label className="text-sm">{method === 'wspro' ? 'WSPRO' : method.charAt(0).toUpperCase() + method.slice(1)}</Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
