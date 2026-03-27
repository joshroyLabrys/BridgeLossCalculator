// src/components/what-if/what-if-controls.tsx
'use client';

export interface WhatIfOverrides {
  manningsNMultiplier: number;       // 1.0 = unchanged
  debrisBlockagePct: number;         // 0-50
  contractionCoeff: number;          // 0.1-0.6
  expansionCoeff: number;            // 0.1-0.8
  dischargeMultiplier: number;       // 0.5-2.0
}

export const DEFAULT_OVERRIDES: WhatIfOverrides = {
  manningsNMultiplier: 1.0,
  debrisBlockagePct: 0,
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  dischargeMultiplier: 1.0,
};

interface SliderDef {
  key: keyof WhatIfOverrides;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDERS: SliderDef[] = [
  { key: 'dischargeMultiplier', label: 'Discharge', min: 0.5, max: 2.0, step: 0.1, format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'manningsNMultiplier', label: "Manning's n", min: 0.5, max: 1.5, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'debrisBlockagePct', label: 'Debris Blockage', min: 0, max: 50, step: 5, format: (v) => `${v}%` },
  { key: 'contractionCoeff', label: 'Contraction Coeff', min: 0.1, max: 0.6, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'expansionCoeff', label: 'Expansion Coeff', min: 0.1, max: 0.8, step: 0.05, format: (v) => v.toFixed(2) },
];

interface WhatIfControlsProps {
  overrides: WhatIfOverrides;
  defaults: WhatIfOverrides;
  onChange: (overrides: WhatIfOverrides) => void;
}

export function WhatIfControls({ overrides, defaults, onChange }: WhatIfControlsProps) {
  return (
    <div className="space-y-3">
      {SLIDERS.map((s) => {
        const value = overrides[s.key];
        const isChanged = value !== defaults[s.key];
        return (
          <div key={s.key} className="space-y-1">
            <div className="flex items-baseline justify-between">
              <label className="text-xs font-medium text-foreground">{s.label}</label>
              <span className={`text-xs font-mono ${isChanged ? 'text-primary' : 'text-muted-foreground'}`}>
                {s.format(value)}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={value}
              onChange={(e) => onChange({ ...overrides, [s.key]: parseFloat(e.target.value) })}
              className="w-full accent-primary h-1.5"
            />
          </div>
        );
      })}
    </div>
  );
}
