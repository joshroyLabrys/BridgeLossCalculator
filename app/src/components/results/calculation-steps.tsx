'use client';

import { CalculationStep } from '@/engine/types';
import { Math } from '@/components/ui/math';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel, UnitType } from '@/lib/units';

const UNIT_MAP: Record<string, UnitType> = {
  'ft': 'length', 'ft/s': 'velocity', 'ft²': 'area', 'cfs': 'discharge',
};

export function CalculationSteps({ steps }: { steps: CalculationStep[] }) {
  const us = useProjectStore((s) => s.unitSystem);

  function convertStep(value: number, unit: string): { val: number; label: string } {
    const ut = UNIT_MAP[unit];
    if (!ut) return { val: value, label: unit };
    return { val: toDisplay(value, ut, us), label: unitLabel(ut, us) };
  }

  return (
    <div className="space-y-2 font-mono text-sm bg-muted/30 p-4 rounded-lg border border-border/50">
      {steps.map((step) => {
        const { val, label } = convertStep(step.result, step.unit);
        return (
          <div key={step.stepNumber} className="space-y-0.5">
            <div>
              <span className="text-muted-foreground font-semibold">{step.stepNumber}.</span>{' '}
              <span className="font-sans">{step.description}</span>
            </div>
            <div className="pl-5 text-muted-foreground text-xs tabular-nums">
              {Object.entries(step.intermediateValues).map(([k, v]) => (
                <span key={k} className="mr-3">{k} = {typeof v === 'number' ? v.toFixed(4) : v}</span>
              ))}
            </div>
            <div className="pl-5 text-xs flex items-baseline gap-1.5">
              <Math tex={step.formula} className="text-primary" />
              <span className="text-muted-foreground">=</span>
              <span className="text-blue-400 font-semibold font-mono">{val.toFixed(4)} {label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
