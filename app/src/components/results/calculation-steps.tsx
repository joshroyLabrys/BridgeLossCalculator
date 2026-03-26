'use client';

import { CalculationStep } from '@/engine/types';

export function CalculationSteps({ steps }: { steps: CalculationStep[] }) {
  return (
    <div className="space-y-2 font-mono text-sm bg-muted/20 p-4 rounded-lg border">
      {steps.map((step) => (
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
          <div className="pl-5 text-xs">
            <span className="text-primary">{step.formula}</span> = <span className="text-blue-400 font-semibold">{step.result.toFixed(4)} {step.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
