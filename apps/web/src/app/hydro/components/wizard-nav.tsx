'use client';

import { Button } from '@flowsuite/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHydroStore } from '../store';

const STEPS = [
  { label: 'Catchment', shortLabel: '1' },
  { label: 'ARR Data', shortLabel: '2' },
  { label: 'Losses', shortLabel: '3' },
  { label: 'Tc', shortLabel: '4' },
  { label: 'Design Storms', shortLabel: '5' },
  { label: 'Design Flows', shortLabel: '6' },
];

interface WizardNavProps {
  canAdvance: boolean;
}

export function WizardNav({ canAdvance }: WizardNavProps) {
  const currentStep = useHydroStore((s) => s.currentStep);
  const setStep = useHydroStore((s) => s.setStep);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center flex-1">
            <button
              onClick={() => i < currentStep ? setStep(i) : undefined}
              disabled={i > currentStep}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all shrink-0 ${
                i === currentStep
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : i < currentStep
                  ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30'
                  : 'bg-muted/30 text-muted-foreground'
              }`}
            >
              {step.shortLabel}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${
                i < currentStep ? 'bg-primary/40' : 'bg-muted/20'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step label */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Step {currentStep + 1}: {STEPS[currentStep].label}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep(currentStep - 1)}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            size="sm"
            onClick={() => setStep(currentStep + 1)}
            disabled={currentStep === STEPS.length - 1 || !canAdvance}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
