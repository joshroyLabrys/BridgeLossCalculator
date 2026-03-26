# Metric/Imperial Unit Toggle — Design Spec

**Date:** 2026-03-26
**Author:** Joshua / Claude
**Purpose:** Add a toggle to switch between Imperial (ft, cfs) and Metric (m, m³/s) units throughout the Bridge Loss Calculator UI

---

## 1. Overview

A display-only conversion layer that lets users work in either Imperial or Metric units. The calculation engine always operates in Imperial internally. The conversion module wraps all UI input/output — converting metric values to Imperial on entry and Imperial results to metric on display.

### Key Constraints

- **Engine unchanged** — all calculations, constants (Manning's 1.486, g=32.174 ft/s², ρ=1.94 slugs/ft³), and tests remain in Imperial
- **Conversion is bidirectional** — input fields accept values in the active unit system and convert to Imperial for the store; display values convert from Imperial to the active system
- **Toggle location** — top bar, always visible, next to Import/Export buttons
- **Persisted** — unit system preference is saved in JSON export and restored on import

---

## 2. Conversion Module

New file: `app/src/lib/units.ts`

### 2.1 Unit Types

Seven distinct unit types used across the app:

| Unit Type | Imperial | Metric | Conversion Factor |
|-----------|----------|--------|-------------------|
| `length` | ft | m | × 0.3048 |
| `area` | ft² | m² | × 0.09290304 |
| `velocity` | ft/s | m/s | × 0.3048 |
| `discharge` | cfs | m³/s | × 0.028316846592 |
| `slope` | ft/ft | m/m | × 1 (dimensionless) |
| `manningsN` | — | — | × 1 (dimensionless) |
| `angle` | degrees | degrees | × 1 |

Additional display-only types (no input conversion needed):
| Unit Type | Imperial | Metric | Conversion Factor |
|-----------|----------|--------|-------------------|
| `force` | lb | N | × 4.44822 |
| `headLoss` | ft | m | × 0.3048 (same as length) |

### 2.2 Functions

```typescript
type UnitSystem = 'imperial' | 'metric';
type UnitType = 'length' | 'area' | 'velocity' | 'discharge' | 'slope' | 'manningsN' | 'angle';

// Convert a display value (in active unit system) to Imperial for storage
function toImperial(value: number, unitType: UnitType, system: UnitSystem): number;

// Convert an Imperial value (from store/engine) to display value
function toDisplay(value: number, unitType: UnitType, system: UnitSystem): number;

// Get the label string for a unit type in the active system
function unitLabel(unitType: UnitType, system: UnitSystem): string;
```

When `system === 'imperial'`, `toImperial` and `toDisplay` are identity functions. This keeps the conversion layer zero-cost in the default case.

### 2.3 Label Map

| UnitType | Imperial Label | Metric Label |
|----------|---------------|--------------|
| `length` | `ft` | `m` |
| `area` | `ft²` | `m²` |
| `velocity` | `ft/s` | `m/s` |
| `discharge` | `cfs` | `m³/s` |
| `slope` | `ft/ft` | `m/m` |
| `manningsN` | ` ` | ` ` |
| `angle` | `degrees` | `degrees` |

---

## 3. State Changes

### 3.1 Zustand Store

Add `unitSystem: UnitSystem` to the store with a `setUnitSystem` action. Default: `'imperial'`.

### 3.2 JSON Export

Add `unitSystem` field to the export format (version remains 1, field is optional for backward compatibility — defaults to `'imperial'` if missing on import).

Note: Exported values are always stored in Imperial in the store, regardless of display unit. The `unitSystem` field only records the user's preference so it's restored on import.

---

## 4. UI Changes

### 4.1 Top Bar Toggle

A segmented control or switch in the top bar: **Imperial | Metric**. Uses shadcn `Button` group or a simple toggle.

### 4.2 Input Forms

Every input field that currently shows a hardcoded unit label needs to:
1. Read the active unit system from the store
2. Display the correct label via `unitLabel()`
3. On value change: convert from display units to Imperial via `toImperial()` before updating the store
4. On render: convert from Imperial to display units via `toDisplay()` for the input value

**Affected components:**
- `cross-section-form.tsx` — Station (length), Elevation (length), Manning's n (no conversion)
- `bridge-geometry-form.tsx` — all ft fields (length), slope (no conversion), angle (no conversion), pier station/width (length)
- `flow-profiles-form.tsx` — Q (discharge), DS WSEL (length), Slope (no conversion), Contraction/Expansion L (length)
- `coefficients-form.tsx` — Tolerance (length), Initial Guess Offset (length)

### 4.3 Results Display

Every result display reads from the store (Imperial) and converts via `toDisplay()`:
- `profile-accordion.tsx` — WSEL, head loss, velocities, areas
- `iteration-log.tsx` — error values
- `comparison-tables.tsx` — all table headers and values
- `charts.tsx` — axis labels and data values
- `cross-section-chart.tsx` — axis labels

### 4.4 Calculation Steps

The `CalculationStep.unit` field stores Imperial unit strings. The `calculation-steps.tsx` renderer converts the `unit` field and `result`/`intermediateValues` to the active system for display.

---

## 5. What Does NOT Change

- `engine/geometry.ts` — Manning's 1.486 constant stays
- `engine/hydraulics.ts` — g=32.174 stays
- `engine/methods/momentum.ts` — ρ=1.94, γ=62.4 stays
- All other engine files — no changes
- All test files — no changes
- Iteration solver — works in Imperial
- `CalculationStep` type — `unit` field still stores Imperial strings (conversion at render time)
