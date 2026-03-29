'use client';

import { useHydroStore } from './store';
import { WizardNav } from './components/wizard-nav';

// Placeholder step components (replaced in subsequent tasks)
function StepPlaceholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <p className="text-sm">{name} — coming next</p>
    </div>
  );
}

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
    <StepPlaceholder key={0} name="Catchment" />,
    <StepPlaceholder key={1} name="ARR Data" />,
    <StepPlaceholder key={2} name="Losses" />,
    <StepPlaceholder key={3} name="Time of Concentration" />,
    <StepPlaceholder key={4} name="Design Storms" />,
    <StepPlaceholder key={5} name="Design Flows" />,
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
