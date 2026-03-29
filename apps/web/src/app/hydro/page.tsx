'use client';

import { useHydroStore } from './store';
import { WizardNav } from './components/wizard-nav';
import { StepCatchment } from './components/step-catchment';
import { StepArrData } from './components/step-arr-data';
import { StepLosses } from './components/step-losses';
import { StepTc } from './components/step-tc';
import { StepDesignStorms } from './components/step-design-storms';
import { StepDesignFlows } from './components/step-design-flows';

export default function HydroPage() {
  const currentStep = useHydroStore((s) => s.currentStep);
  const catchmentArea = useHydroStore((s) => s.catchmentArea);
  const arrData = useHydroStore((s) => s.arrData);
  const results = useHydroStore((s) => s.results);

  // Determine if current step allows advancing
  const canAdvance = (() => {
    switch (currentStep) {
      case 0: return catchmentArea > 0;
      case 1: return arrData !== null;
      case 2: return true; // losses always have defaults
      case 3: return true; // Tc always calculable
      case 4: return results !== null;
      case 5: return false; // last step
      default: return false;
    }
  })();

  const steps = [
    <StepCatchment key={0} />,
    <StepArrData key={1} />,
    <StepLosses key={2} />,
    <StepTc key={3} />,
    <StepDesignStorms key={4} />,
    <StepDesignFlows key={5} />,
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Hydrology</h1>
        <p className="text-sm text-muted-foreground mt-1">ARR2019 design flood estimation</p>
      </div>

      <WizardNav canAdvance={canAdvance} />

      <div className="min-h-[400px]">
        {steps[currentStep]}
      </div>
    </div>
  );
}
