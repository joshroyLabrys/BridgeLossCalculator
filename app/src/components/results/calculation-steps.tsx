'use client';

import { CalculationStep } from '@/engine/types';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, UnitType } from '@/lib/units';

/** Map the engine's unit string to a UnitType for conversion, or null for dimensionless/unknown. */
function unitStringToType(unit: string): UnitType | null {
  switch (unit) {
    case 'ft': return 'length';
    case 'ft/s': return 'velocity';
    case 'ft²': return 'area';
    case 'cfs': return 'discharge';
    default: return null;
  }
}

export function CalculationSteps({ steps }: { steps: CalculationStep[] }) {
  const us = useProjectStore((s) => s.unitSystem);

  return (
    <div className="space-y-1 font-mono text-sm bg-card p-3 rounded-md border">
      {steps.map((step) => {
        const unitType = unitStringToType(step.unit);
        const displayResult = unitType ? toDisplay(step.result, unitType, us) : step.result;
        return (
          <div key={step.stepNumber}>
            <div>
              <span className="text-muted-foreground">{step.stepNumber}.</span>{' '}
              {step.description}
            </div>
            <div className="pl-5 text-muted-foreground text-xs">
              {Object.entries(step.intermediateValues).map(([k, v]) => (
                <span key={k} className="mr-3">
                  {k} = {typeof v === 'number' ? v.toFixed(4) : v}
                </span>
              ))}
            </div>
            <div className="pl-5">
              {step.formula} = <span className="text-blue-400 font-medium">{displayResult.toFixed(4)} {step.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
