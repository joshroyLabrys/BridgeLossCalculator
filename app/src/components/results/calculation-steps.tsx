'use client';

import { CalculationStep } from '@/engine/types';

export function CalculationSteps({ steps }: { steps: CalculationStep[] }) {
  return (
    <div className="space-y-1 font-mono text-sm bg-card p-3 rounded-md border">
      {steps.map((step) => (
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
            {step.formula} = <span className="text-blue-400 font-medium">{step.result.toFixed(4)} {step.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
