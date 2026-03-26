# Unit Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Imperial/Metric toggle to the Bridge Loss Calculator UI with a display-only conversion layer.

**Architecture:** Engine stays Imperial. New `units.ts` module handles all conversions. Store gains `unitSystem` field. Every UI component reads the active system and converts on input/display.

**Spec:** `docs/superpowers/specs/2026-03-26-unit-toggle-design.md`

---

## Task 1: Conversion Module + Tests

**Files:**
- Create: `app/src/lib/units.ts`, `app/tests/lib/units.test.ts`

- [ ] **Step 1: Write tests**

Create `app/tests/lib/units.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toImperial, toDisplay, unitLabel } from '@/lib/units';

describe('toImperial', () => {
  it('returns identity for imperial system', () => {
    expect(toImperial(100, 'length', 'imperial')).toBe(100);
  });

  it('converts meters to feet', () => {
    expect(toImperial(1, 'length', 'metric')).toBeCloseTo(3.28084, 3);
  });

  it('converts m² to ft²', () => {
    expect(toImperial(1, 'area', 'metric')).toBeCloseTo(10.7639, 2);
  });

  it('converts m/s to ft/s', () => {
    expect(toImperial(1, 'velocity', 'metric')).toBeCloseTo(3.28084, 3);
  });

  it('converts m³/s to cfs', () => {
    expect(toImperial(1, 'discharge', 'metric')).toBeCloseTo(35.3147, 2);
  });

  it('returns identity for dimensionless types', () => {
    expect(toImperial(0.035, 'manningsN', 'metric')).toBe(0.035);
    expect(toImperial(0.001, 'slope', 'metric')).toBe(0.001);
    expect(toImperial(30, 'angle', 'metric')).toBe(30);
  });
});

describe('toDisplay', () => {
  it('returns identity for imperial system', () => {
    expect(toDisplay(100, 'length', 'imperial')).toBe(100);
  });

  it('converts feet to meters', () => {
    expect(toDisplay(1, 'length', 'metric')).toBeCloseTo(0.3048, 4);
  });

  it('converts ft² to m²', () => {
    expect(toDisplay(1, 'area', 'metric')).toBeCloseTo(0.0929, 3);
  });

  it('converts cfs to m³/s', () => {
    expect(toDisplay(1, 'discharge', 'metric')).toBeCloseTo(0.02832, 4);
  });

  it('roundtrips correctly', () => {
    const original = 100;
    const displayed = toDisplay(original, 'length', 'metric');
    const back = toImperial(displayed, 'length', 'metric');
    expect(back).toBeCloseTo(original, 6);
  });
});

describe('unitLabel', () => {
  it('returns imperial labels', () => {
    expect(unitLabel('length', 'imperial')).toBe('ft');
    expect(unitLabel('discharge', 'imperial')).toBe('cfs');
    expect(unitLabel('velocity', 'imperial')).toBe('ft/s');
    expect(unitLabel('area', 'imperial')).toBe('ft²');
  });

  it('returns metric labels', () => {
    expect(unitLabel('length', 'metric')).toBe('m');
    expect(unitLabel('discharge', 'metric')).toBe('m³/s');
    expect(unitLabel('velocity', 'metric')).toBe('m/s');
    expect(unitLabel('area', 'metric')).toBe('m²');
  });
});
```

- [ ] **Step 2: Implement units.ts**

Create `app/src/lib/units.ts`:

```typescript
export type UnitSystem = 'imperial' | 'metric';
export type UnitType = 'length' | 'area' | 'velocity' | 'discharge' | 'slope' | 'manningsN' | 'angle';

// Conversion factors: multiply Imperial value by factor to get Metric
const TO_METRIC: Record<UnitType, number> = {
  length: 0.3048,
  area: 0.09290304,
  velocity: 0.3048,
  discharge: 0.028316846592,
  slope: 1,
  manningsN: 1,
  angle: 1,
};

const LABELS: Record<UnitType, { imperial: string; metric: string }> = {
  length: { imperial: 'ft', metric: 'm' },
  area: { imperial: 'ft²', metric: 'm²' },
  velocity: { imperial: 'ft/s', metric: 'm/s' },
  discharge: { imperial: 'cfs', metric: 'm³/s' },
  slope: { imperial: 'ft/ft', metric: 'm/m' },
  manningsN: { imperial: '', metric: '' },
  angle: { imperial: 'degrees', metric: 'degrees' },
};

/**
 * Convert a display value (in the active unit system) to Imperial for storage.
 * metric → imperial: divide by TO_METRIC factor
 */
export function toImperial(value: number, unitType: UnitType, system: UnitSystem): number {
  if (system === 'imperial') return value;
  const factor = TO_METRIC[unitType];
  return factor === 1 ? value : value / factor;
}

/**
 * Convert an Imperial value (from store/engine) to the active display system.
 * imperial → metric: multiply by TO_METRIC factor
 */
export function toDisplay(value: number, unitType: UnitType, system: UnitSystem): number {
  if (system === 'imperial') return value;
  const factor = TO_METRIC[unitType];
  return factor === 1 ? value : value * factor;
}

/**
 * Get the label string for a unit type in the active system.
 */
export function unitLabel(unitType: UnitType, system: UnitSystem): string {
  return LABELS[unitType][system];
}
```

- [ ] **Step 3: Run tests**

```bash
cd app && npx vitest run tests/lib/units.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/units.ts app/tests/lib/units.test.ts
git commit -m "feat: add unit conversion module with tests"
```

---

## Task 2: Store + JSON I/O Updates

**Files:**
- Modify: `app/src/store/project-store.ts`
- Modify: `app/src/lib/json-io.ts`

- [ ] **Step 1: Update store**

In `app/src/store/project-store.ts`, add to the store interface and state:

```typescript
// Add import
import { UnitSystem } from '@/lib/units';

// Add to ProjectStore interface:
unitSystem: UnitSystem;
setUnitSystem: (system: UnitSystem) => void;

// Add to initialState:
unitSystem: 'imperial' as UnitSystem,

// Add to create():
setUnitSystem: (system) => set({ unitSystem: system }),

// Update exportProject to include unitSystem:
exportProject: () => {
  const state = get();
  return serializeProject({
    ...existingFields,
    unitSystem: state.unitSystem,
  });
},

// Update importProject to restore unitSystem:
importProject: (json) => {
  const data = parseProjectJson(json);
  set({
    ...data,
    results: null,
  });
},

// Update reset to include unitSystem:
reset: () => set(initialState),
```

- [ ] **Step 2: Update json-io.ts**

In `app/src/lib/json-io.ts`, add `unitSystem` to the ExportData interface and serialize/parse it. Default to `'imperial'` if missing on import (backward compatibility).

- [ ] **Step 3: Run tests**

```bash
cd app && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add app/src/store/project-store.ts app/src/lib/json-io.ts
git commit -m "feat: add unitSystem to store and JSON export"
```

---

## Task 3: Top Bar Toggle

**Files:**
- Modify: `app/src/components/top-bar.tsx`

- [ ] **Step 1: Add toggle to top bar**

Add a segmented button group between the title and the import/export buttons:

```tsx
import { useProjectStore } from '@/store/project-store';
import { UnitSystem } from '@/lib/units';

// Inside TopBar component:
const unitSystem = useProjectStore((s) => s.unitSystem);
const setUnitSystem = useProjectStore((s) => s.setUnitSystem);

// In the JSX, between the title and import/export:
<div className="flex items-center gap-1 rounded-md border p-0.5">
  <Button
    variant={unitSystem === 'imperial' ? 'default' : 'ghost'}
    size="sm"
    className="h-7 text-xs"
    onClick={() => setUnitSystem('imperial')}
  >
    Imperial
  </Button>
  <Button
    variant={unitSystem === 'metric' ? 'default' : 'ghost'}
    size="sm"
    className="h-7 text-xs"
    onClick={() => setUnitSystem('metric')}
  >
    Metric
  </Button>
</div>
```

- [ ] **Step 2: Verify build**

```bash
cd app && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/top-bar.tsx
git commit -m "feat: add Imperial/Metric toggle to top bar"
```

---

## Task 4: Update Input Forms

**Files:**
- Modify: `app/src/components/input/cross-section-form.tsx`
- Modify: `app/src/components/input/bridge-geometry-form.tsx`
- Modify: `app/src/components/input/flow-profiles-form.tsx`
- Modify: `app/src/components/input/coefficients-form.tsx`

For each input form:
1. Import `useProjectStore`, `toImperial`, `toDisplay`, `unitLabel` from units
2. Read `unitSystem` from store
3. Replace hardcoded unit strings with `unitLabel()` calls
4. Wrap input values with `toDisplay()` for rendering
5. Wrap onChange handlers with `toImperial()` before storing

- [ ] **Step 1: Update cross-section-form.tsx**

Replace hardcoded `'Station (ft)'` / `'Elevation (ft)'` with dynamic labels using `unitLabel('length', unitSystem)`. Wrap station and elevation values with `toDisplay`/`toImperial`. Manning's n and bank station need no conversion.

- [ ] **Step 2: Update bridge-geometry-form.tsx**

Replace all `'ft'` labels in the fields array with `unitLabel('length', unitSystem)`. The `'H:V'` and `'degrees'` labels stay. Pier station and width get conversion. Low chord profile station/elevation get conversion.

- [ ] **Step 3: Update flow-profiles-form.tsx**

Column labels change: `Q (${unitLabel('discharge', us)})`, `DS WSEL (${unitLabel('length', us)})`, etc. Slope stays unchanged. Discharge gets discharge conversion, all length fields get length conversion.

- [ ] **Step 4: Update coefficients-form.tsx**

Tolerance and Initial Guess Offset labels change to use `unitLabel('length', us)`. Values get length conversion. All other fields (Cc, Ce, K, max iterations, method checkboxes) are dimensionless.

- [ ] **Step 5: Verify build**

```bash
cd app && npx next build
```

- [ ] **Step 6: Commit**

```bash
git add app/src/components/input/
git commit -m "feat: add unit conversion to all input forms"
```

---

## Task 5: Update Results & Summary Display

**Files:**
- Modify: `app/src/components/results/profile-accordion.tsx`
- Modify: `app/src/components/results/calculation-steps.tsx`
- Modify: `app/src/components/results/iteration-log.tsx`
- Modify: `app/src/components/summary/comparison-tables.tsx`
- Modify: `app/src/components/summary/charts.tsx`
- Modify: `app/src/components/cross-section-chart.tsx`

- [ ] **Step 1: Update profile-accordion.tsx**

Convert input echo values (flow area → area, hydraulic radius → length, bridge opening area → area, pier blockage → area). Convert result values (WSEL → length, head loss → length, velocities → velocity). Update unit labels.

- [ ] **Step 2: Update calculation-steps.tsx**

Map the `unit` field from CalculationStep through a unit-type lookup to convert both the result value and the unit label. Create a simple mapping: `'ft' → 'length'`, `'ft/s' → 'velocity'`, `'ft²' → 'area'`, `'lb' → 'force'`, `'' → null (no conversion)`.

Also convert `intermediateValues` — apply the same unit conversion based on the step's unit type. For mixed-unit intermediates, apply length conversion as the default (most intermediates are length-based).

- [ ] **Step 3: Update iteration-log.tsx**

Convert error column (length conversion). Update header label.

- [ ] **Step 4: Update comparison-tables.tsx**

Update all table heading labels and convert cell values. WSEL → length, head loss → length, velocity → velocity, area → area. FLC values are dimensionless (no conversion).

- [ ] **Step 5: Update charts.tsx**

Convert axis labels and data values for head loss (length), discharge (discharge), and WSEL (length).

- [ ] **Step 6: Update cross-section-chart.tsx**

Convert axis labels for station (length) and elevation (length). Convert data values for display.

- [ ] **Step 7: Verify build and tests**

```bash
cd app && npx vitest run && npx next build
```

- [ ] **Step 8: Commit**

```bash
git add app/src/components/
git commit -m "feat: add unit conversion to results and summary display"
```
