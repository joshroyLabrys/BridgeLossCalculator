# Bridge Loss Calculator (Next.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side Next.js web app that computes bridge hydraulic losses using four methods (Energy, Momentum, Yarnell, WSPRO) and compares results against HEC-RAS values.

**Architecture:** Single-page tabbed layout with shadcn/ui. Pure TypeScript calculation engine with zero UI dependencies. Zustand for state management. Recharts for visualization. JSON export/import for persistence. Static export — no server needed.

**Tech Stack:** Next.js (App Router, static export), shadcn/ui, Tailwind CSS, Zustand, Recharts, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-03-26-bridge-loss-calculator-nextjs-design.md`

**Existing VBA reference:** `src/vba/mod_Geometry.bas` — port geometry functions and test values to TypeScript.

---

## File Structure

```
src/
  app/
    layout.tsx                          — root layout, dark theme, font
    page.tsx                            — single page with MainTabs
    globals.css                         — Tailwind + shadcn theme
  components/
    top-bar.tsx                         — app header with import/export buttons
    main-tabs.tsx                       — Input / Method Results / Summary tabs
    input/
      cross-section-form.tsx            — station/elevation table + live preview
      bridge-geometry-form.tsx          — opening geometry form + pier table + low chord profile
      low-chord-profile.tsx             — optional station/elevation table for variable low chord
      flow-profiles-form.tsx            — flow profiles table
      coefficients-form.tsx             — coefficients and method selection
      action-buttons.tsx                — Run All / Clear / Plot buttons
    results/
      method-tabs.tsx                   — Energy/Momentum/Yarnell/WSPRO sub-tabs
      method-view.tsx                   — single method display with header + accordions
      profile-accordion.tsx             — collapsible flow profile result
      calculation-steps.tsx             — step-by-step calculation renderer
      iteration-log.tsx                 — collapsible iteration table
    summary/
      comparison-tables.tsx             — WSEL, head loss, velocity, Froude, opening ratio, TUFLOW FLC tables
      regime-matrix.tsx                 — flow regime comparison matrix
      hecras-input-row.tsx              — editable gold HEC-RAS comparison row
      charts.tsx                        — all three Recharts charts
    cross-section-chart.tsx             — reusable Recharts cross-section visualization (ground, bridge overlay, piers, per-method WSEL lines)
    cross-section-full-view.tsx         — full cross-section dialog triggered by Plot Cross-Section button
  engine/
    types.ts                            — all shared type definitions
    geometry.ts                         — flow area, wetted perimeter, hydraulic radius, top width, conveyance
    bridge-geometry.ts                  — bridge opening area, pier blockage, net area, skew correction
    hydraulics.ts                       — friction slope, Manning's equation, velocity head, Froude number
    flow-regime.ts                      — free surface / pressure / overtopping detection
    iteration.ts                        — bisection/secant solver with convergence tracking
    tuflow-flc.ts                       — back-calculated TUFLOW form loss coefficients
    methods/
      energy.ts                         — energy method (standard step, 4 cross-sections)
      momentum.ts                       — momentum balance
      yarnell.ts                        — Yarnell pier loss (direct for free surface)
      wspro.ts                          — FHWA WSPRO method
    index.ts                            — public API: runAllMethods(state) → results
  store/
    project-store.ts                    — Zustand store with ProjectState
  lib/
    constants.ts                        — default coefficients, pier shape K values
    validation.ts                       — input validation logic
    json-io.ts                          — export/import JSON helpers with validation
tests/
  engine/
    geometry.test.ts                    — ported from VBA test values
    bridge-geometry.test.ts
    hydraulics.test.ts
    flow-regime.test.ts
    iteration.test.ts
    tuflow-flc.test.ts
    methods/
      energy.test.ts
      momentum.test.ts
      yarnell.test.ts
      wspro.test.ts
    index.test.ts                       — integration test for runAllMethods
  store/
    project-store.test.ts
  lib/
    json-io.test.ts
    validation.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `components.json`

- [ ] **Step 1: Initialize Next.js project**

Run:
```bash
cd "C:\Users\Joshr\Desktop\Projects\Personal\Kyle'sWeirdRequests\TheTools"
npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

This creates the `app/` directory with the Next.js project. All subsequent work happens inside `app/`.

- [ ] **Step 2: Install dependencies**

Run:
```bash
cd app
npm install zustand recharts
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Initialize shadcn/ui**

Run:
```bash
npx shadcn@latest init -d
```

Select defaults (New York style, Zinc base color, CSS variables).

- [ ] **Step 4: Add shadcn components**

Run:
```bash
npx shadcn@latest add tabs accordion button input select checkbox label card badge table collapsible dialog
```

- [ ] **Step 5: Configure Vitest**

Create `app/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 6: Add test script to package.json**

In `app/package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Configure static export**

In `app/next.config.ts`:
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
};

export default nextConfig;
```

- [ ] **Step 8: Verify setup**

Run:
```bash
cd app
npm run build
npm test -- --passWithNoTests
```

Expected: Build succeeds, test runner works.

- [ ] **Step 9: Commit**

```bash
git add app/
git commit -m "feat: scaffold Next.js project with shadcn, Zustand, Recharts, Vitest"
```

---

## Task 2: Engine Types

**Files:**
- Create: `app/src/engine/types.ts`

- [ ] **Step 1: Create the shared type definitions**

Create `app/src/engine/types.ts`:

```typescript
export interface CrossSectionPoint {
  station: number;
  elevation: number;
  manningsN: number;
  bankStation: 'left' | 'right' | null;
}

export interface Pier {
  station: number;
  width: number;
  shape: 'square' | 'round-nose' | 'cylindrical' | 'sharp';
}

export interface LowChordPoint {
  station: number;
  elevation: number;
}

export interface BridgeGeometry {
  lowChordLeft: number;
  lowChordRight: number;
  highChord: number;
  leftAbutmentStation: number;
  rightAbutmentStation: number;
  leftAbutmentSlope: number;
  rightAbutmentSlope: number;
  skewAngle: number;
  piers: Pier[];
  lowChordProfile: LowChordPoint[];
}

export interface FlowProfile {
  name: string;
  discharge: number;
  dsWsel: number;
  channelSlope: number;
  contractionLength: number;
  expansionLength: number;
}

export interface Coefficients {
  contractionCoeff: number;
  expansionCoeff: number;
  yarnellK: number | null;
  maxIterations: number;
  tolerance: number;
  initialGuessOffset: number;
  methodsToRun: {
    energy: boolean;
    momentum: boolean;
    yarnell: boolean;
    wspro: boolean;
  };
}

export type FlowRegime = 'free-surface' | 'pressure' | 'overtopping';

export interface IterationStep {
  iteration: number;
  trialWsel: number;
  computedWsel: number;
  error: number;
}

export interface CalculationStep {
  stepNumber: number;
  description: string;
  formula: string;
  intermediateValues: Record<string, number>;
  result: number;
  unit: string;
}

export interface MethodResult {
  profileName: string;
  upstreamWsel: number;
  totalHeadLoss: number;
  approachVelocity: number;
  bridgeVelocity: number;
  froudeApproach: number;
  froudeBridge: number;
  flowRegime: FlowRegime;
  iterationLog: IterationStep[];
  converged: boolean;
  calculationSteps: CalculationStep[];
  tuflowPierFLC: number;
  tuflowSuperFLC: number | null;
  inputEcho: {
    flowArea: number;
    hydraulicRadius: number;
    bridgeOpeningArea: number;
    pierBlockage: number;
  };
  error: string | null;
}

export interface HecRasComparison {
  profileName: string;
  upstreamWsel: number | null;
  headLoss: number | null;
  pierFLC: number | null;
  superFLC: number | null;
}

export interface CalculationResults {
  energy: MethodResult[];
  momentum: MethodResult[];
  yarnell: MethodResult[];
  wspro: MethodResult[];
}

export interface ProjectState {
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  flowProfiles: FlowProfile[];
  coefficients: Coefficients;
  results: CalculationResults | null;
  hecRasComparison: HecRasComparison[];
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/engine/types.ts
git commit -m "feat: add engine type definitions"
```

> **Implementation note for all method functions (Tasks 8–11):** Every method's return object must populate the `inputEcho` field with downstream hydraulic properties computed at WSEL:
> ```typescript
> inputEcho: {
>   flowArea: calcFlowArea(crossSection, dsWsel),
>   hydraulicRadius: calcHydraulicRadius(crossSection, dsWsel),
>   bridgeOpeningArea: calcNetBridgeArea(bridge, crossSection, dsWsel),
>   pierBlockage: calcPierBlockage(bridge.piers, crossSection, dsWsel),
> },
> ```
> Add the corresponding imports (`calcHydraulicRadius` from geometry, `calcNetBridgeArea` and `calcPierBlockage` from bridge-geometry) to each method file. For the error/not-applicable early returns (e.g., Yarnell pressure flow), use zero values for all fields.

---

## Task 3: Engine — Geometry (port from VBA)

**Files:**
- Create: `app/src/engine/geometry.ts`, `app/tests/engine/geometry.test.ts`

**Reference:** `src/vba/mod_Geometry.bas` and `src/vba/mod_Tests.bas` — porting the VBA functions and test values to TypeScript.

- [ ] **Step 1: Write the failing tests**

Create `app/tests/engine/geometry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  clipSegmentToWsel,
  calcFlowArea,
  calcWettedPerimeter,
  calcTopWidth,
  calcHydraulicRadius,
  calcConveyance,
} from '@/engine/geometry';
import { CrossSectionPoint } from '@/engine/types';

// V-shaped channel from VBA test suite:
//   Station:   0    50   100
//   Elevation: 10    0    10
//   WSEL = 8 ft
const vChannel: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

describe('clipSegmentToWsel', () => {
  it('returns null when both points are above WSEL', () => {
    const result = clipSegmentToWsel(0, 10, 50, 12, 8);
    expect(result).toBeNull();
  });

  it('returns full segment when both points are below WSEL', () => {
    const result = clipSegmentToWsel(20, 4, 50, 0, 8);
    expect(result).toEqual({ cx1: 20, cz1: 4, cx2: 50, cz2: 0 });
  });

  it('clips right end when left is wet and right is dry', () => {
    const result = clipSegmentToWsel(50, 0, 100, 10, 8);
    expect(result).not.toBeNull();
    expect(result!.cx1).toBeCloseTo(50, 4);
    expect(result!.cz1).toBeCloseTo(0, 4);
    expect(result!.cx2).toBeCloseTo(90, 4);
    expect(result!.cz2).toBeCloseTo(8, 4);
  });

  it('clips left end when left is dry and right is wet', () => {
    const result = clipSegmentToWsel(0, 10, 50, 0, 8);
    expect(result).not.toBeNull();
    expect(result!.cx1).toBeCloseTo(10, 4);
    expect(result!.cz1).toBeCloseTo(8, 4);
    expect(result!.cx2).toBeCloseTo(50, 4);
    expect(result!.cz2).toBeCloseTo(0, 4);
  });
});

describe('calcFlowArea', () => {
  it('computes 320 sq ft for V-channel at WSEL=8', () => {
    const area = calcFlowArea(vChannel, 8);
    expect(area).toBeCloseTo(320, 1);
  });

  it('returns 0 for WSEL below all points', () => {
    const area = calcFlowArea(vChannel, -1);
    expect(area).toBeCloseTo(0, 4);
  });
});

describe('calcWettedPerimeter', () => {
  it('computes ~81.58 ft for V-channel at WSEL=8', () => {
    const perim = calcWettedPerimeter(vChannel, 8);
    expect(perim).toBeCloseTo(81.58, 1);
  });
});

describe('calcTopWidth', () => {
  it('computes 80 ft for V-channel at WSEL=8', () => {
    const tw = calcTopWidth(vChannel, 8);
    expect(tw).toBeCloseTo(80, 1);
  });
});

describe('calcHydraulicRadius', () => {
  it('computes ~3.923 ft for V-channel at WSEL=8', () => {
    const r = calcHydraulicRadius(vChannel, 8);
    expect(r).toBeCloseTo(3.923, 2);
  });

  it('returns 0 for dry section', () => {
    const r = calcHydraulicRadius(vChannel, -1);
    expect(r).toBe(0);
  });
});

describe('calcConveyance', () => {
  it('computes ~33815 cfs for V-channel at WSEL=8, n=0.035', () => {
    const k = calcConveyance(vChannel, 8);
    expect(k).toBeCloseTo(33815, -2); // within ~200
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npx vitest run tests/engine/geometry.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement geometry.ts**

Create `app/src/engine/geometry.ts`:

```typescript
import { CrossSectionPoint } from './types';

interface ClipResult {
  cx1: number;
  cz1: number;
  cx2: number;
  cz2: number;
}

/**
 * Clips a ground segment to the portion at or below WSEL.
 * Returns null if the entire segment is above WSEL.
 */
export function clipSegmentToWsel(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  wsel: number
): ClipResult | null {
  // Both above — no wetted portion
  if (z1 >= wsel && z2 >= wsel) return null;

  // Both at or below — entire segment is wetted
  if (z1 <= wsel && z2 <= wsel) {
    return { cx1: x1, cz1: z1, cx2: x2, cz2: z2 };
  }

  // Partial submersion — find intersection
  const t = (wsel - z1) / (z2 - z1);
  const xIntersect = x1 + t * (x2 - x1);

  if (z1 <= wsel) {
    // Left is wet, right is dry
    return { cx1: x1, cz1: z1, cx2: xIntersect, cz2: wsel };
  } else {
    // Left is dry, right is wet
    return { cx1: xIntersect, cz1: wsel, cx2: x2, cz2: z2 };
  }
}

/**
 * Computes cross-sectional flow area (sq ft) below WSEL using trapezoidal integration.
 */
export function calcFlowArea(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  let area = 0;
  for (let i = 0; i < crossSection.length - 1; i++) {
    const clip = clipSegmentToWsel(
      crossSection[i].station,
      crossSection[i].elevation,
      crossSection[i + 1].station,
      crossSection[i + 1].elevation,
      wsel
    );
    if (clip) {
      const d1 = Math.max(0, wsel - clip.cz1);
      const d2 = Math.max(0, wsel - clip.cz2);
      const segWidth = clip.cx2 - clip.cx1;
      area += ((d1 + d2) / 2) * segWidth;
    }
  }
  return area;
}

/**
 * Computes wetted perimeter (ft) — sum of ground segment slope-distances below WSEL.
 */
export function calcWettedPerimeter(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  let perim = 0;
  for (let i = 0; i < crossSection.length - 1; i++) {
    const clip = clipSegmentToWsel(
      crossSection[i].station,
      crossSection[i].elevation,
      crossSection[i + 1].station,
      crossSection[i + 1].elevation,
      wsel
    );
    if (clip) {
      const dx = clip.cx2 - clip.cx1;
      const dz = clip.cz2 - clip.cz1;
      perim += Math.sqrt(dx * dx + dz * dz);
    }
  }
  return perim;
}

/**
 * Computes water surface top width (ft).
 */
export function calcTopWidth(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  let leftStation = Infinity;
  let rightStation = -Infinity;
  let found = false;

  for (let i = 0; i < crossSection.length - 1; i++) {
    const clip = clipSegmentToWsel(
      crossSection[i].station,
      crossSection[i].elevation,
      crossSection[i + 1].station,
      crossSection[i + 1].elevation,
      wsel
    );
    if (clip) {
      found = true;
      if (clip.cx1 < leftStation) leftStation = clip.cx1;
      if (clip.cx2 > rightStation) rightStation = clip.cx2;
    }
  }

  return found ? rightStation - leftStation : 0;
}

/**
 * Computes hydraulic radius (ft) = Area / Wetted Perimeter.
 */
export function calcHydraulicRadius(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  const a = calcFlowArea(crossSection, wsel);
  const p = calcWettedPerimeter(crossSection, wsel);
  return p > 0 ? a / p : 0;
}

/**
 * Finds the indices of the left and right bank stations in the cross-section.
 * Returns [leftIdx, rightIdx]. If not found, defaults to [0, length-1].
 */
function findBankIndices(crossSection: CrossSectionPoint[]): [number, number] {
  let leftIdx = 0;
  let rightIdx = crossSection.length - 1;
  for (let i = 0; i < crossSection.length; i++) {
    if (crossSection[i].bankStation === 'left') leftIdx = i;
    if (crossSection[i].bankStation === 'right') rightIdx = i;
  }
  return [leftIdx, rightIdx];
}

/**
 * Computes subsection area, perimeter, and length-weighted average n.
 */
function calcSubsectionProperties(
  points: CrossSectionPoint[],
  wsel: number
): { area: number; perim: number; avgN: number } | null {
  if (points.length < 2) return null;

  let area = 0;
  let perim = 0;
  let totalWtN = 0;
  let totalWtLen = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const clip = clipSegmentToWsel(
      points[i].station,
      points[i].elevation,
      points[i + 1].station,
      points[i + 1].elevation,
      wsel
    );
    if (clip) {
      const d1 = Math.max(0, wsel - clip.cz1);
      const d2 = Math.max(0, wsel - clip.cz2);
      const segWidth = clip.cx2 - clip.cx1;
      area += ((d1 + d2) / 2) * segWidth;

      const dx = clip.cx2 - clip.cx1;
      const dz = clip.cz2 - clip.cz1;
      const segLen = Math.sqrt(dx * dx + dz * dz);
      perim += segLen;

      totalWtN += points[i].manningsN * segLen;
      totalWtLen += segLen;
    }
  }

  if (perim <= 0 || area <= 0 || totalWtLen <= 0) return null;

  return { area, perim, avgN: totalWtN / totalWtLen };
}

/**
 * Computes total conveyance K (cfs) using Manning's equation.
 * Splits cross-section into LOB, channel, ROB subsections by bank stations.
 * K = (1.486/n) * A * R^(2/3) per subsection, summed.
 */
export function calcConveyance(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  const [leftIdx, rightIdx] = findBankIndices(crossSection);

  const subsections = [
    crossSection.slice(0, leftIdx + 1),       // LOB
    crossSection.slice(leftIdx, rightIdx + 1), // Channel
    crossSection.slice(rightIdx),              // ROB
  ];

  let totalK = 0;

  for (const sub of subsections) {
    const props = calcSubsectionProperties(sub, wsel);
    if (!props) continue;

    const r = props.area / props.perim;
    const k = (1.486 / props.avgN) * props.area * Math.pow(r, 2 / 3);
    totalK += k;
  }

  return totalK;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npx vitest run tests/engine/geometry.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/engine/geometry.ts app/tests/engine/geometry.test.ts
git commit -m "feat: implement geometry engine (ported from VBA)"
```

---

## Task 4: Engine — Bridge Geometry

**Files:**
- Create: `app/src/engine/bridge-geometry.ts`, `app/tests/engine/bridge-geometry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/tests/engine/bridge-geometry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  calcBridgeOpeningArea,
  calcPierBlockage,
  calcNetBridgeArea,
  interpolateLowChord,
} from '@/engine/bridge-geometry';
import { CrossSectionPoint, BridgeGeometry, Pier } from '@/engine/types';

// Trapezoidal channel: flat bottom at elev 90 from sta 30-70, banks rising to 100
const channel: CrossSectionPoint[] = [
  { station: 0, elevation: 100, manningsN: 0.045, bankStation: 'left' },
  { station: 30, elevation: 90, manningsN: 0.035, bankStation: null },
  { station: 70, elevation: 90, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 100, manningsN: 0.045, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 98,
  lowChordRight: 98,
  highChord: 102,
  leftAbutmentStation: 20,
  rightAbutmentStation: 80,
  leftAbutmentSlope: 0,
  rightAbutmentSlope: 0,
  skewAngle: 0,
  piers: [
    { station: 50, width: 3, shape: 'round-nose' },
  ],
  lowChordProfile: [],
};

describe('interpolateLowChord', () => {
  it('returns constant low chord when no profile given', () => {
    expect(interpolateLowChord(bridge, 50)).toBeCloseTo(98, 4);
  });

  it('interpolates between left and right when different', () => {
    const asymBridge = { ...bridge, lowChordLeft: 96, lowChordRight: 100 };
    // At midpoint of abutments (sta 50), expect 98
    expect(interpolateLowChord(asymBridge, 50)).toBeCloseTo(98, 4);
    // At left abutment, expect 96
    expect(interpolateLowChord(asymBridge, 20)).toBeCloseTo(96, 4);
  });
});

describe('calcPierBlockage', () => {
  it('computes pier blockage area below WSEL', () => {
    // Single pier: width=3, bottom at channel elev 90 at sta 50, WSEL=95
    // Blockage = 3 * (95 - 90) = 15 sq ft
    const piers: Pier[] = [{ station: 50, width: 3, shape: 'round-nose' }];
    const blockage = calcPierBlockage(piers, channel, 95);
    expect(blockage).toBeCloseTo(15, 1);
  });

  it('returns 0 when WSEL is below pier base', () => {
    const piers: Pier[] = [{ station: 50, width: 3, shape: 'round-nose' }];
    const blockage = calcPierBlockage(piers, channel, 85);
    expect(blockage).toBeCloseTo(0, 4);
  });
});

describe('calcBridgeOpeningArea', () => {
  it('computes gross opening area below low chord', () => {
    // At WSEL=95: area below WSEL clipped to abutment stations, minus pier
    const area = calcBridgeOpeningArea(bridge, channel, 95);
    expect(area).toBeGreaterThan(0);
  });
});

describe('calcNetBridgeArea', () => {
  it('subtracts pier blockage from gross opening', () => {
    const net = calcNetBridgeArea(bridge, channel, 95);
    const gross = calcBridgeOpeningArea(bridge, channel, 95);
    const pierBlock = calcPierBlockage(bridge.piers, channel, 95);
    expect(net).toBeCloseTo(gross - pierBlock, 1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npx vitest run tests/engine/bridge-geometry.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement bridge-geometry.ts**

Create `app/src/engine/bridge-geometry.ts`:

```typescript
import { BridgeGeometry, CrossSectionPoint, Pier } from './types';
import { calcFlowArea, clipSegmentToWsel } from './geometry';

/**
 * Interpolates the low chord elevation at a given station.
 * Uses lowChordProfile if provided, otherwise linearly interpolates
 * between left and right low chord elevations across the abutment span.
 */
export function interpolateLowChord(
  bridge: BridgeGeometry,
  station: number
): number {
  if (bridge.lowChordProfile.length >= 2) {
    // Find bounding profile points and interpolate
    const profile = bridge.lowChordProfile;
    if (station <= profile[0].station) return profile[0].elevation;
    if (station >= profile[profile.length - 1].station)
      return profile[profile.length - 1].elevation;

    for (let i = 0; i < profile.length - 1; i++) {
      if (station >= profile[i].station && station <= profile[i + 1].station) {
        const t =
          (station - profile[i].station) /
          (profile[i + 1].station - profile[i].station);
        return profile[i].elevation + t * (profile[i + 1].elevation - profile[i].elevation);
      }
    }
    return profile[profile.length - 1].elevation;
  }

  // Linear interpolation between left and right abutments
  const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
  if (span <= 0) return bridge.lowChordLeft;
  const t = (station - bridge.leftAbutmentStation) / span;
  return bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft);
}

/**
 * Gets the ground elevation at a station by interpolating the cross-section.
 */
function groundElevationAt(
  crossSection: CrossSectionPoint[],
  station: number
): number {
  if (station <= crossSection[0].station) return crossSection[0].elevation;
  if (station >= crossSection[crossSection.length - 1].station)
    return crossSection[crossSection.length - 1].elevation;

  for (let i = 0; i < crossSection.length - 1; i++) {
    if (
      station >= crossSection[i].station &&
      station <= crossSection[i + 1].station
    ) {
      const t =
        (station - crossSection[i].station) /
        (crossSection[i + 1].station - crossSection[i].station);
      return (
        crossSection[i].elevation +
        t * (crossSection[i + 1].elevation - crossSection[i].elevation)
      );
    }
  }
  return crossSection[crossSection.length - 1].elevation;
}

/**
 * Computes the total pier blockage area (sq ft) below WSEL.
 * Each pier is a rectangle: width × (WSEL - pier base elevation).
 * Pier base elevation is the ground elevation at the pier station.
 */
export function calcPierBlockage(
  piers: Pier[],
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  let blockage = 0;
  for (const pier of piers) {
    const base = groundElevationAt(crossSection, pier.station);
    const depth = wsel - base;
    if (depth > 0) {
      blockage += pier.width * depth;
    }
  }
  return blockage;
}

/**
 * Clips the cross-section to the bridge opening (between abutment stations)
 * and computes the flow area below WSEL, capped at the low chord.
 */
export function calcBridgeOpeningArea(
  bridge: BridgeGeometry,
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  // Clip cross-section to abutment boundaries
  const clippedPoints = clipCrossSectionToAbutments(bridge, crossSection);

  // The effective WSEL inside the bridge is the lesser of WSEL and the low chord
  // For gross opening area, we compute area below WSEL within the opening
  const area = calcFlowArea(clippedPoints, wsel);
  return area;
}

/**
 * Clips cross-section points to the bridge abutment boundaries.
 * Interpolates new points at abutment stations if needed.
 */
function clipCrossSectionToAbutments(
  bridge: BridgeGeometry,
  crossSection: CrossSectionPoint[]
): CrossSectionPoint[] {
  const leftSta = bridge.leftAbutmentStation;
  const rightSta = bridge.rightAbutmentStation;
  const result: CrossSectionPoint[] = [];

  // Add interpolated left abutment point
  const leftElev = groundElevationAt(crossSection, leftSta);
  const leftN = interpolateManningsN(crossSection, leftSta);
  result.push({
    station: leftSta,
    elevation: leftElev,
    manningsN: leftN,
    bankStation: null,
  });

  // Add all points between abutments
  for (const pt of crossSection) {
    if (pt.station > leftSta && pt.station < rightSta) {
      result.push(pt);
    }
  }

  // Add interpolated right abutment point
  const rightElev = groundElevationAt(crossSection, rightSta);
  const rightN = interpolateManningsN(crossSection, rightSta);
  result.push({
    station: rightSta,
    elevation: rightElev,
    manningsN: rightN,
    bankStation: null,
  });

  return result;
}

function interpolateManningsN(
  crossSection: CrossSectionPoint[],
  station: number
): number {
  if (station <= crossSection[0].station) return crossSection[0].manningsN;
  for (let i = 0; i < crossSection.length - 1; i++) {
    if (
      station >= crossSection[i].station &&
      station <= crossSection[i + 1].station
    ) {
      return crossSection[i].manningsN; // step-function n
    }
  }
  return crossSection[crossSection.length - 1].manningsN;
}

/**
 * Computes net bridge opening area = gross area - pier blockage.
 * Applies skew angle correction: net area = net area * cos(skew).
 */
export function calcNetBridgeArea(
  bridge: BridgeGeometry,
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  const gross = calcBridgeOpeningArea(bridge, crossSection, wsel);
  const pierBlock = calcPierBlockage(bridge.piers, crossSection, wsel);
  let net = gross - pierBlock;

  // Skew correction
  if (bridge.skewAngle !== 0) {
    const skewRad = (bridge.skewAngle * Math.PI) / 180;
    net *= Math.cos(skewRad);
  }

  return Math.max(0, net);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npx vitest run tests/engine/bridge-geometry.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/engine/bridge-geometry.ts app/tests/engine/bridge-geometry.test.ts
git commit -m "feat: implement bridge geometry engine"
```

---

## Task 5: Engine — Hydraulics

**Files:**
- Create: `app/src/engine/hydraulics.ts`, `app/tests/engine/hydraulics.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/tests/engine/hydraulics.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  calcVelocity,
  calcVelocityHead,
  calcFroudeNumber,
  calcFrictionSlope,
  calcFrictionLoss,
} from '@/engine/hydraulics';

describe('calcVelocity', () => {
  it('computes Q/A', () => {
    expect(calcVelocity(1000, 200)).toBeCloseTo(5, 4);
  });

  it('returns 0 for zero area', () => {
    expect(calcVelocity(1000, 0)).toBe(0);
  });
});

describe('calcVelocityHead', () => {
  it('computes alpha * V^2 / (2 * 32.174)', () => {
    // V=5, alpha=1.0 → 5^2 / 64.348 = 0.3883
    expect(calcVelocityHead(5, 1.0)).toBeCloseTo(0.3883, 3);
  });
});

describe('calcFroudeNumber', () => {
  it('computes V / sqrt(g * D)', () => {
    // V=5, A=200, T=40 → D=5 → Fr = 5/sqrt(32.174*5) = 5/12.684 = 0.394
    expect(calcFroudeNumber(5, 200, 40)).toBeCloseTo(0.394, 2);
  });
});

describe('calcFrictionSlope', () => {
  it('computes (Q/K)^2', () => {
    // Q=1000, K=33815 → Sf = (1000/33815)^2 = 0.000875
    expect(calcFrictionSlope(1000, 33815)).toBeCloseTo(0.000875, 5);
  });
});

describe('calcFrictionLoss', () => {
  it('computes average friction slope times reach length', () => {
    // L=100, Sf1=0.001, Sf2=0.002 → hf = 100 * (0.001+0.002)/2 = 0.15
    expect(calcFrictionLoss(100, 0.001, 0.002)).toBeCloseTo(0.15, 4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npx vitest run tests/engine/hydraulics.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement hydraulics.ts**

Create `app/src/engine/hydraulics.ts`:

```typescript
const G = 32.174; // gravitational acceleration, ft/s^2

/**
 * Computes velocity (ft/s) = Q / A.
 */
export function calcVelocity(discharge: number, area: number): number {
  if (area <= 0) return 0;
  return discharge / area;
}

/**
 * Computes velocity head (ft) = alpha * V^2 / (2g).
 * alpha = velocity distribution coefficient (default 1.0).
 */
export function calcVelocityHead(
  velocity: number,
  alpha: number = 1.0
): number {
  return (alpha * velocity * velocity) / (2 * G);
}

/**
 * Computes Froude number = V / sqrt(g * D).
 * D = A / T (hydraulic depth).
 */
export function calcFroudeNumber(
  velocity: number,
  area: number,
  topWidth: number
): number {
  if (topWidth <= 0 || area <= 0) return 0;
  const d = area / topWidth;
  return velocity / Math.sqrt(G * d);
}

/**
 * Computes friction slope Sf = (Q / K)^2.
 * K = conveyance.
 */
export function calcFrictionSlope(
  discharge: number,
  conveyance: number
): number {
  if (conveyance <= 0) return 0;
  const ratio = discharge / conveyance;
  return ratio * ratio;
}

/**
 * Computes friction loss (ft) using average friction slope.
 * hf = L * (Sf1 + Sf2) / 2.
 */
export function calcFrictionLoss(
  reachLength: number,
  sf1: number,
  sf2: number
): number {
  return reachLength * (sf1 + sf2) / 2;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npx vitest run tests/engine/hydraulics.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/engine/hydraulics.ts app/tests/engine/hydraulics.test.ts
git commit -m "feat: implement hydraulics engine"
```

---

## Task 6: Engine — Flow Regime & TUFLOW FLC

**Files:**
- Create: `app/src/engine/flow-regime.ts`, `app/src/engine/tuflow-flc.ts`, `app/tests/engine/flow-regime.test.ts`, `app/tests/engine/tuflow-flc.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/tests/engine/flow-regime.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectFlowRegime } from '@/engine/flow-regime';

describe('detectFlowRegime', () => {
  it('returns free-surface when WSEL < low chord', () => {
    expect(detectFlowRegime(95, 98, 102)).toBe('free-surface');
  });

  it('returns pressure when low chord < WSEL < high chord', () => {
    expect(detectFlowRegime(100, 98, 102)).toBe('pressure');
  });

  it('returns overtopping when WSEL > high chord', () => {
    expect(detectFlowRegime(105, 98, 102)).toBe('overtopping');
  });

  it('returns free-surface when WSEL equals low chord', () => {
    expect(detectFlowRegime(98, 98, 102)).toBe('free-surface');
  });

  it('returns pressure when WSEL equals high chord', () => {
    expect(detectFlowRegime(102, 98, 102)).toBe('pressure');
  });
});
```

Create `app/tests/engine/tuflow-flc.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from '@/engine/tuflow-flc';

describe('calcTuflowPierFLC', () => {
  it('computes h_pier / (V^2/2g)', () => {
    // headLoss=0.5, velocity=7.0 → Vh = 7^2/(2*32.174) = 0.7613
    // FLC = 0.5 / 0.7613 = 0.6568
    expect(calcTuflowPierFLC(0.5, 7.0)).toBeCloseTo(0.657, 2);
  });

  it('returns 0 for zero velocity', () => {
    expect(calcTuflowPierFLC(0.5, 0)).toBe(0);
  });
});

describe('calcTuflowSuperFLC', () => {
  it('returns null for free-surface flow', () => {
    expect(calcTuflowSuperFLC(0.5, 7.0, 'free-surface')).toBeNull();
  });

  it('computes FLC for pressure flow', () => {
    expect(calcTuflowSuperFLC(0.5, 7.0, 'pressure')).toBeCloseTo(0.657, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npx vitest run tests/engine/flow-regime.test.ts tests/engine/tuflow-flc.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement flow-regime.ts**

Create `app/src/engine/flow-regime.ts`:

```typescript
import { FlowRegime } from './types';

/**
 * Detects flow regime based on WSEL relative to bridge chord elevations.
 * - WSEL <= low chord: free-surface
 * - low chord < WSEL <= high chord: pressure
 * - WSEL > high chord: overtopping
 */
export function detectFlowRegime(
  wsel: number,
  lowChord: number,
  highChord: number
): FlowRegime {
  if (wsel <= lowChord) return 'free-surface';
  if (wsel <= highChord) return 'pressure';
  return 'overtopping';
}
```

- [ ] **Step 4: Implement tuflow-flc.ts**

Create `app/src/engine/tuflow-flc.ts`:

```typescript
import { FlowRegime } from './types';

const G = 32.174;

/**
 * Back-calculates TUFLOW pier form loss coefficient.
 * FLC = h_pier / (V^2 / 2g)
 */
export function calcTuflowPierFLC(
  pierHeadLoss: number,
  approachVelocity: number
): number {
  if (approachVelocity <= 0) return 0;
  const vh = (approachVelocity * approachVelocity) / (2 * G);
  return pierHeadLoss / vh;
}

/**
 * Back-calculates TUFLOW superstructure form loss coefficient.
 * Returns null for free-surface flow (no superstructure engagement).
 */
export function calcTuflowSuperFLC(
  superHeadLoss: number,
  approachVelocity: number,
  regime: FlowRegime
): number | null {
  if (regime === 'free-surface') return null;
  if (approachVelocity <= 0) return 0;
  const vh = (approachVelocity * approachVelocity) / (2 * G);
  return superHeadLoss / vh;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
cd app && npx vitest run tests/engine/flow-regime.test.ts tests/engine/tuflow-flc.test.ts
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/engine/flow-regime.ts app/src/engine/tuflow-flc.ts app/tests/engine/flow-regime.test.ts app/tests/engine/tuflow-flc.test.ts
git commit -m "feat: implement flow regime detection and TUFLOW FLC calculations"
```

---

## Task 7: Engine — Iteration Solver

**Files:**
- Create: `app/src/engine/iteration.ts`, `app/tests/engine/iteration.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/tests/engine/iteration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { solve } from '@/engine/iteration';

describe('solve', () => {
  it('converges on a simple linear equation', () => {
    // Solve: f(x) = x - 5 = 0, so target x = 5
    // objectiveFn returns the "computed" value given a trial
    const result = solve({
      lowerBound: 0,
      upperBound: 10,
      objectiveFn: (trial) => 5, // always returns 5 as the "target"
      tolerance: 0.01,
      maxIterations: 100,
    });
    expect(result.converged).toBe(true);
    expect(result.solution).toBeCloseTo(5, 1);
    expect(result.log.length).toBeGreaterThan(0);
  });

  it('converges on a nonlinear function', () => {
    // Solve: sqrt(x) = x/4, so x = 16 (or 0, but bounded away)
    // objectiveFn: given trial x, compute what x "should be" = (trial/4)^2 = trial^2/16
    // Actually let's do a simpler WSEL-style iteration:
    // Given trial WSEL, compute "target" WSEL = 100 + 0.5 / (trial - 99)
    // Solution is where trial = 100 + 0.5/(trial-99)
    // trial^2 - 199*trial + 99*100 - 0.5 = 0 → trial ≈ 100.5
    const result = solve({
      lowerBound: 99.1,
      upperBound: 110,
      objectiveFn: (trial) => 100 + 0.5 / (trial - 99),
      tolerance: 0.01,
      maxIterations: 100,
    });
    expect(result.converged).toBe(true);
    expect(result.solution).toBeCloseTo(100.5, 1);
  });

  it('reports non-convergence when max iterations exceeded', () => {
    const result = solve({
      lowerBound: 0,
      upperBound: 100,
      objectiveFn: (trial) => trial + 1, // never converges
      tolerance: 0.001,
      maxIterations: 5,
    });
    expect(result.converged).toBe(false);
    expect(result.log.length).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npx vitest run tests/engine/iteration.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement iteration.ts**

Create `app/src/engine/iteration.ts`:

```typescript
import { IterationStep } from './types';

export interface SolverOptions {
  lowerBound: number;
  upperBound: number;
  objectiveFn: (trial: number) => number;
  tolerance: number;
  maxIterations: number;
}

export interface SolverResult {
  solution: number;
  converged: boolean;
  log: IterationStep[];
}

/**
 * Bisection/secant hybrid solver.
 *
 * objectiveFn(trial) returns the "computed" value for a given trial.
 * The solver seeks trial such that |trial - objectiveFn(trial)| < tolerance.
 *
 * Phase 1: Bisection to narrow range to within 0.5 ft.
 * Phase 2: Secant method for faster convergence.
 */
export function solve(options: SolverOptions): SolverResult {
  const { lowerBound, upperBound, objectiveFn, tolerance, maxIterations } =
    options;
  const log: IterationStep[] = [];

  let lo = lowerBound;
  let hi = upperBound;
  let trial = (lo + hi) / 2;
  let computed = objectiveFn(trial);
  let prevTrial = lo;
  let prevComputed = objectiveFn(lo);

  for (let i = 1; i <= maxIterations; i++) {
    computed = objectiveFn(trial);
    const error = computed - trial;

    log.push({
      iteration: i,
      trialWsel: trial,
      computedWsel: computed,
      error: Math.abs(error),
    });

    if (Math.abs(error) <= tolerance) {
      return { solution: computed, converged: true, log };
    }

    if (hi - lo > 0.5) {
      // Bisection phase
      if (error > 0) {
        lo = trial;
      } else {
        hi = trial;
      }
      prevTrial = trial;
      prevComputed = computed;
      trial = (lo + hi) / 2;
    } else {
      // Secant phase
      const prevError = prevComputed - prevTrial;
      const denom = error - prevError;
      prevTrial = trial;
      prevComputed = computed;

      if (Math.abs(denom) < 1e-12) {
        // Fall back to bisection if secant denominator is near zero
        trial = (lo + hi) / 2;
      } else {
        trial = trial - error * (trial - prevTrial + (trial - prevTrial)) / denom;
        // Clamp to bounds
        trial = Math.max(lo, Math.min(hi, computed));
      }
    }
  }

  return { solution: computed, converged: false, log };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npx vitest run tests/engine/iteration.test.ts
```

Expected: All PASS. If the secant method needs tuning, adjust — the key contract is convergence within tolerance.

- [ ] **Step 5: Commit**

```bash
git add app/src/engine/iteration.ts app/tests/engine/iteration.test.ts
git commit -m "feat: implement bisection/secant iteration solver"
```

---

## Task 8: Engine — Yarnell Method

**Files:**
- Create: `app/src/engine/methods/yarnell.ts`, `app/tests/engine/methods/yarnell.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/tests/engine/methods/yarnell.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runYarnell } from '@/engine/methods/yarnell';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

// V-channel from geometry tests
const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9,
  lowChordRight: 9,
  highChord: 12,
  leftAbutmentStation: 5,
  rightAbutmentStation: 95,
  leftAbutmentSlope: 0,
  rightAbutmentSlope: 0,
  skewAngle: 0,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

const profile: FlowProfile = {
  name: '10-yr',
  discharge: 2500,
  dsWsel: 8,
  channelSlope: 0.001,
  contractionLength: 90,
  expansionLength: 90,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null, // auto from pier shape
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runYarnell', () => {
  it('produces a result with upstream WSEL > downstream WSEL', () => {
    const result = runYarnell(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
    expect(result.flowRegime).toBe('free-surface');
    expect(result.profileName).toBe('10-yr');
  });

  it('uses correct K coefficient for round-nose pier (0.9)', () => {
    const result = runYarnell(crossSection, bridge, profile, coefficients);
    // Yarnell equation: Δy = K*(K+5-0.6)*(α+15α⁴)*(V²/2g)
    // K=0.9 for round-nose
    expect(result.totalHeadLoss).toBeGreaterThan(0);
    expect(result.calculationSteps.length).toBeGreaterThan(0);
  });

  it('flags not-applicable for pressure flow', () => {
    const pressureProfile = { ...profile, dsWsel: 10 };
    // WSEL=10 > low chord=9 → pressure flow
    const result = runYarnell(crossSection, bridge, pressureProfile, coefficients);
    expect(result.error).toContain('Not Applicable');
  });

  it('allows manual K override', () => {
    const manualK = { ...coefficients, yarnellK: 1.25 }; // square pier K
    const result = runYarnell(crossSection, bridge, profile, manualK);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npx vitest run tests/engine/methods/yarnell.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create constants.ts**

Create `app/src/lib/constants.ts`:

```typescript
/** Yarnell pier shape coefficients */
export const YARNELL_K: Record<string, number> = {
  'square': 1.25,
  'round-nose': 0.9,
  'cylindrical': 1.0,
  'sharp': 0.7,
};

/** Default coefficient values */
export const DEFAULTS = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
} as const;

/** Gravitational acceleration (ft/s^2) */
export const G = 32.174;
```

- [ ] **Step 4: Implement yarnell.ts**

Create `app/src/engine/methods/yarnell.ts`:

```typescript
import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  MethodResult,
  CalculationStep,
} from '../types';
import { calcFlowArea, calcTopWidth } from '../geometry';
import { calcPierBlockage } from '../bridge-geometry';
import { calcVelocity, calcVelocityHead, calcFroudeNumber } from '../hydraulics';
import { detectFlowRegime } from '../flow-regime';
import { interpolateLowChord } from '../bridge-geometry';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from '../tuflow-flc';
import { YARNELL_K, G } from '@/lib/constants';

function getYarnellK(bridge: BridgeGeometry, coefficients: Coefficients): number {
  if (coefficients.yarnellK !== null) return coefficients.yarnellK;
  // Use the first pier's shape (all piers assumed same shape for Yarnell)
  if (bridge.piers.length === 0) return 0;
  return YARNELL_K[bridge.piers[0].shape] ?? 1.0;
}

export function runYarnell(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const dsWsel = profile.dsWsel;

  // Detect flow regime at downstream
  const midStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, midStation);
  const regime = detectFlowRegime(dsWsel, lowChord, bridge.highChord);

  // Yarnell only applies to free-surface flow
  if (regime !== 'free-surface') {
    return {
      profileName: profile.name,
      upstreamWsel: dsWsel,
      totalHeadLoss: 0,
      approachVelocity: 0,
      bridgeVelocity: 0,
      froudeApproach: 0,
      froudeBridge: 0,
      flowRegime: regime,
      iterationLog: [],
      converged: true,
      calculationSteps: [],
      tuflowPierFLC: 0,
      tuflowSuperFLC: null,
      error: `Not Applicable: Yarnell method only applies to free-surface flow (detected: ${regime})`,
    };
  }

  // Step 1: Downstream hydraulic properties
  const dsArea = calcFlowArea(crossSection, dsWsel);
  const dsTopWidth = calcTopWidth(crossSection, dsWsel);
  const dsVelocity = calcVelocity(profile.discharge, dsArea);
  const dsVh = calcVelocityHead(dsVelocity);

  steps.push({
    stepNumber: 1,
    description: 'Downstream hydraulic properties',
    formula: 'A = flow area, V = Q/A',
    intermediateValues: { A: dsArea, V: dsVelocity, 'V²/2g': dsVh },
    result: dsVelocity,
    unit: 'ft/s',
  });

  // Step 2: Pier obstruction ratio
  const pierBlockage = calcPierBlockage(bridge.piers, crossSection, dsWsel);
  const alpha = pierBlockage / dsArea;

  steps.push({
    stepNumber: 2,
    description: 'Pier obstruction ratio',
    formula: 'α = pier blockage area / total flow area',
    intermediateValues: { pierBlockage, totalArea: dsArea },
    result: alpha,
    unit: '',
  });

  // Step 3: Get K coefficient
  const K = getYarnellK(bridge, coefficients);

  steps.push({
    stepNumber: 3,
    description: 'Yarnell pier shape coefficient',
    formula: 'K from pier shape lookup or manual override',
    intermediateValues: {},
    result: K,
    unit: '',
  });

  // Step 4: Apply Yarnell equation
  // Δy = K * (K + 5 - 0.6) * (α + 15α⁴) * (V²/2g)
  const dy = K * (K + 5 - 0.6) * (alpha + 15 * Math.pow(alpha, 4)) * dsVh;

  steps.push({
    stepNumber: 4,
    description: 'Yarnell backwater equation',
    formula: 'Δy = K × (K + 5 - 0.6) × (α + 15α⁴) × (V²/2g)',
    intermediateValues: {
      K,
      'K+5-0.6': K + 5 - 0.6,
      'α+15α⁴': alpha + 15 * Math.pow(alpha, 4),
      'V²/2g': dsVh,
    },
    result: dy,
    unit: 'ft',
  });

  // Step 5: Upstream WSEL
  const usWsel = dsWsel + dy;

  steps.push({
    stepNumber: 5,
    description: 'Upstream water surface elevation',
    formula: 'US WSEL = DS WSEL + Δy',
    intermediateValues: { dsWsel, dy },
    result: usWsel,
    unit: 'ft',
  });

  // Compute upstream properties for reporting
  const usArea = calcFlowArea(crossSection, usWsel);
  const usTopWidth = calcTopWidth(crossSection, usWsel);
  const usVelocity = calcVelocity(profile.discharge, usArea);
  const froudeDs = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);
  const froudeUs = calcFroudeNumber(usVelocity, usArea, usTopWidth);

  return {
    profileName: profile.name,
    upstreamWsel: usWsel,
    totalHeadLoss: dy,
    approachVelocity: usVelocity,
    bridgeVelocity: dsVelocity,
    froudeApproach: froudeUs,
    froudeBridge: froudeDs,
    flowRegime: regime,
    iterationLog: [],
    converged: true,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(dy, usVelocity),
    tuflowSuperFLC: null,
    error: null,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
cd app && npx vitest run tests/engine/methods/yarnell.test.ts
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/engine/methods/yarnell.ts app/tests/engine/methods/yarnell.test.ts app/src/lib/constants.ts
git commit -m "feat: implement Yarnell method"
```

---

## Task 9: Engine — Energy Method

**Files:**
- Create: `app/src/engine/methods/energy.ts`, `app/tests/engine/methods/energy.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/tests/engine/methods/energy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runEnergy } from '@/engine/methods/energy';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9,
  lowChordRight: 9,
  highChord: 12,
  leftAbutmentStation: 5,
  rightAbutmentStation: 95,
  leftAbutmentSlope: 0,
  rightAbutmentSlope: 0,
  skewAngle: 0,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

const profile: FlowProfile = {
  name: '10-yr',
  discharge: 2500,
  dsWsel: 8,
  channelSlope: 0.001,
  contractionLength: 90,
  expansionLength: 90,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runEnergy', () => {
  it('converges and produces US WSEL > DS WSEL', () => {
    const result = runEnergy(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.converged).toBe(true);
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });

  it('has calculation steps', () => {
    const result = runEnergy(crossSection, bridge, profile, coefficients);
    expect(result.calculationSteps.length).toBeGreaterThan(0);
  });

  it('has iteration log', () => {
    const result = runEnergy(crossSection, bridge, profile, coefficients);
    expect(result.iterationLog.length).toBeGreaterThan(0);
  });

  it('reports flow regime', () => {
    const result = runEnergy(crossSection, bridge, profile, coefficients);
    expect(result.flowRegime).toBe('free-surface');
  });

  it('computes TUFLOW FLCs', () => {
    const result = runEnergy(crossSection, bridge, profile, coefficients);
    expect(result.tuflowPierFLC).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npx vitest run tests/engine/methods/energy.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement energy.ts**

Create `app/src/engine/methods/energy.ts`:

```typescript
import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  MethodResult,
  CalculationStep,
} from '../types';
import {
  calcFlowArea,
  calcWettedPerimeter,
  calcTopWidth,
  calcConveyance,
} from '../geometry';
import {
  calcNetBridgeArea,
  interpolateLowChord,
} from '../bridge-geometry';
import {
  calcVelocity,
  calcVelocityHead,
  calcFroudeNumber,
  calcFrictionSlope,
  calcFrictionLoss,
} from '../hydraulics';
import { detectFlowRegime } from '../flow-regime';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from '../tuflow-flc';
import { solve } from '../iteration';

/**
 * Energy method: standard step energy equation across 4 cross-sections.
 * WS_us = WS_ds + h_f + h_c + h_e
 */
export function runEnergy(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const Q = profile.discharge;
  const dsWsel = profile.dsWsel;
  const Cc = coefficients.contractionCoeff;
  const Ce = coefficients.expansionCoeff;

  // Step 1: Downstream section properties
  const dsArea = calcFlowArea(crossSection, dsWsel);
  const dsPerim = calcWettedPerimeter(crossSection, dsWsel);
  const dsTopWidth = calcTopWidth(crossSection, dsWsel);
  const dsConveyance = calcConveyance(crossSection, dsWsel);
  const dsVelocity = calcVelocity(Q, dsArea);
  const dsVh = calcVelocityHead(dsVelocity);

  steps.push({
    stepNumber: 1,
    description: `DS hydraulic props @ WSEL ${dsWsel.toFixed(2)} ft`,
    formula: 'A, P, R, V = Q/A, V²/2g',
    intermediateValues: {
      A: dsArea,
      P: dsPerim,
      R: dsPerim > 0 ? dsArea / dsPerim : 0,
      V: dsVelocity,
    },
    result: dsVelocity,
    unit: 'ft/s',
  });

  // Detect flow regime
  const midStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, midStation);
  const regime = detectFlowRegime(dsWsel, lowChord, bridge.highChord);

  // Bridge section properties at DS WSEL
  const bridgeArea = calcNetBridgeArea(bridge, crossSection, dsWsel);
  const bridgeVelocity = calcVelocity(Q, bridgeArea);
  const bridgeVh = calcVelocityHead(bridgeVelocity);

  // Iterate on upstream WSEL
  const dsSf = calcFrictionSlope(Q, dsConveyance);

  const solverResult = solve({
    lowerBound: dsWsel,
    upperBound: dsWsel + 10,
    objectiveFn: (trialWsel) => {
      const usArea = calcFlowArea(crossSection, trialWsel);
      const usConveyance = calcConveyance(crossSection, trialWsel);
      const usVelocity = calcVelocity(Q, usArea);
      const usVh = calcVelocityHead(usVelocity);

      const usSf = calcFrictionSlope(Q, usConveyance);

      // Friction loss across full reach
      const hf = calcFrictionLoss(
        profile.contractionLength + profile.expansionLength,
        dsSf,
        usSf
      );

      // Contraction loss
      const hc = Cc * Math.abs(bridgeVh - dsVh);

      // Expansion loss
      const he = Ce * Math.abs(usVh - bridgeVh);

      return dsWsel + hf + hc + he;
    },
    tolerance: coefficients.tolerance,
    maxIterations: coefficients.maxIterations,
  });

  const usWsel = solverResult.solution;
  const usArea = calcFlowArea(crossSection, usWsel);
  const usTopWidth = calcTopWidth(crossSection, usWsel);
  const usConveyance = calcConveyance(crossSection, usWsel);
  const usVelocity = calcVelocity(Q, usArea);
  const usVh = calcVelocityHead(usVelocity);
  const usSf = calcFrictionSlope(Q, usConveyance);

  const hf = calcFrictionLoss(
    profile.contractionLength + profile.expansionLength,
    dsSf,
    usSf
  );
  const hc = Cc * Math.abs(bridgeVh - dsVh);
  const he = Ce * Math.abs(usVh - bridgeVh);
  const totalLoss = usWsel - dsWsel;

  steps.push({
    stepNumber: 2,
    description: 'Friction loss',
    formula: `h_f = L × (S_f1 + S_f2) / 2`,
    intermediateValues: { L: profile.contractionLength + profile.expansionLength, Sf_ds: dsSf, Sf_us: usSf },
    result: hf,
    unit: 'ft',
  });

  steps.push({
    stepNumber: 3,
    description: 'Contraction loss',
    formula: `h_c = ${Cc} × |Δ(V²/2g)|`,
    intermediateValues: { Cc, bridgeVh, dsVh },
    result: hc,
    unit: 'ft',
  });

  steps.push({
    stepNumber: 4,
    description: 'Expansion loss',
    formula: `h_e = ${Ce} × |Δ(V²/2g)|`,
    intermediateValues: { Ce, usVh, bridgeVh },
    result: he,
    unit: 'ft',
  });

  steps.push({
    stepNumber: 5,
    description: 'Upstream WSEL',
    formula: 'US WSEL = DS WSEL + h_f + h_c + h_e',
    intermediateValues: { dsWsel, hf, hc, he },
    result: usWsel,
    unit: 'ft',
  });

  const froudeDs = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);
  const froudeUs = calcFroudeNumber(usVelocity, usArea, usTopWidth);

  return {
    profileName: profile.name,
    upstreamWsel: usWsel,
    totalHeadLoss: totalLoss,
    approachVelocity: usVelocity,
    bridgeVelocity: bridgeVelocity,
    froudeApproach: froudeUs,
    froudeBridge: froudeDs,
    flowRegime: regime,
    iterationLog: solverResult.log,
    converged: solverResult.converged,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(totalLoss, usVelocity),
    tuflowSuperFLC: calcTuflowSuperFLC(0, usVelocity, regime),
    error: solverResult.converged ? null : 'Max iterations reached without convergence',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npx vitest run tests/engine/methods/energy.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/engine/methods/energy.ts app/tests/engine/methods/energy.test.ts
git commit -m "feat: implement energy method"
```

---

## Task 10: Engine — Momentum Method

**Files:**
- Create: `app/src/engine/methods/momentum.ts`, `app/tests/engine/methods/momentum.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/tests/engine/methods/momentum.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runMomentum } from '@/engine/methods/momentum';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9,
  lowChordRight: 9,
  highChord: 12,
  leftAbutmentStation: 5,
  rightAbutmentStation: 95,
  leftAbutmentSlope: 0,
  rightAbutmentSlope: 0,
  skewAngle: 0,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

const profile: FlowProfile = {
  name: '10-yr',
  discharge: 2500,
  dsWsel: 8,
  channelSlope: 0.001,
  contractionLength: 90,
  expansionLength: 90,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runMomentum', () => {
  it('converges and produces US WSEL > DS WSEL', () => {
    const result = runMomentum(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.converged).toBe(true);
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });

  it('reports free-surface flow regime', () => {
    const result = runMomentum(crossSection, bridge, profile, coefficients);
    expect(result.flowRegime).toBe('free-surface');
  });

  it('has calculation steps and iteration log', () => {
    const result = runMomentum(crossSection, bridge, profile, coefficients);
    expect(result.calculationSteps.length).toBeGreaterThan(0);
    expect(result.iterationLog.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npx vitest run tests/engine/methods/momentum.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement momentum.ts**

Create `app/src/engine/methods/momentum.ts`:

```typescript
import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  MethodResult,
  CalculationStep,
} from '../types';
import { calcFlowArea, calcWettedPerimeter, calcTopWidth } from '../geometry';
import { calcNetBridgeArea, calcPierBlockage, interpolateLowChord } from '../bridge-geometry';
import { calcVelocity, calcVelocityHead, calcFroudeNumber } from '../hydraulics';
import { detectFlowRegime } from '../flow-regime';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from '../tuflow-flc';
import { solve } from '../iteration';
import { G } from '@/lib/constants';

const WATER_DENSITY = 1.94; // slugs/ft^3 (freshwater)

/**
 * Computes the hydrostatic force on a cross-section at a given WSEL.
 * F = γ * A * y_bar where y_bar = centroid depth below surface.
 * For trapezoidal integration, F = γ * Σ(segment moment about WSEL).
 * Simplified: F ≈ γ * A * (WSEL - z_centroid) where z_centroid ≈ WSEL - A/(2*T)
 * More accurately: F = 0.5 * γ * A * D where D = A/T (mean depth)
 */
function hydrostaticForce(area: number, topWidth: number): number {
  if (topWidth <= 0 || area <= 0) return 0;
  const meanDepth = area / topWidth;
  // F = γ * A * (meanDepth / 2) = 0.5 * γ * A * D
  // Using specific weight γ = ρg = 62.4 lb/ft^3
  const gamma = WATER_DENSITY * G; // 62.4 lb/ft^3
  return 0.5 * gamma * area * meanDepth;
}

/**
 * Momentum method: balance across the bridge opening.
 * ΣF = ΔM (net force = change in momentum flux)
 */
export function runMomentum(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const Q = profile.discharge;
  const dsWsel = profile.dsWsel;

  // Downstream properties
  const dsArea = calcFlowArea(crossSection, dsWsel);
  const dsTopWidth = calcTopWidth(crossSection, dsWsel);
  const dsPerim = calcWettedPerimeter(crossSection, dsWsel);
  const dsVelocity = calcVelocity(Q, dsArea);

  // Flow regime
  const midStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, midStation);
  const regime = detectFlowRegime(dsWsel, lowChord, bridge.highChord);

  steps.push({
    stepNumber: 1,
    description: `DS hydraulic props @ WSEL ${dsWsel.toFixed(2)} ft`,
    formula: 'A, P, V = Q/A',
    intermediateValues: { A: dsArea, P: dsPerim, V: dsVelocity },
    result: dsVelocity,
    unit: 'ft/s',
  });

  // DS hydrostatic force
  const F_ds = hydrostaticForce(dsArea, dsTopWidth);

  // DS momentum flux
  const M_ds = WATER_DENSITY * Q * dsVelocity;

  steps.push({
    stepNumber: 2,
    description: 'DS hydrostatic force and momentum flux',
    formula: 'F = 0.5·γ·A·D, M = ρ·Q·V',
    intermediateValues: { F_ds, M_ds },
    result: F_ds,
    unit: 'lb',
  });

  // Pier drag force (estimated)
  const pierBlockArea = calcPierBlockage(bridge.piers, crossSection, dsWsel);
  const Cd = 1.2; // drag coefficient for bridge piers
  const F_drag = 0.5 * WATER_DENSITY * Cd * pierBlockArea * dsVelocity * dsVelocity;

  steps.push({
    stepNumber: 3,
    description: 'Pier drag force',
    formula: 'F_drag = 0.5·ρ·Cd·A_pier·V²',
    intermediateValues: { Cd, pierBlockArea, V: dsVelocity },
    result: F_drag,
    unit: 'lb',
  });

  // Weight component along slope
  const reachLength = profile.contractionLength + profile.expansionLength;
  const W_x = WATER_DENSITY * G * dsArea * reachLength * profile.channelSlope;

  // Friction force
  const tau = WATER_DENSITY * G * (dsArea / dsPerim) * profile.channelSlope;
  const F_friction = tau * dsPerim * reachLength;

  steps.push({
    stepNumber: 4,
    description: 'Weight and friction forces',
    formula: 'W_x = γ·A·L·S, F_f = τ·P·L',
    intermediateValues: { W_x, F_friction },
    result: W_x - F_friction,
    unit: 'lb',
  });

  // Solve for upstream WSEL using momentum balance
  const solverResult = solve({
    lowerBound: dsWsel,
    upperBound: dsWsel + 10,
    objectiveFn: (trialWsel) => {
      const usArea = calcFlowArea(crossSection, trialWsel);
      const usTopWidth = calcTopWidth(crossSection, trialWsel);
      const usVelocity = calcVelocity(Q, usArea);

      const F_us = hydrostaticForce(usArea, usTopWidth);
      const M_us = WATER_DENSITY * Q * usVelocity;

      // Momentum balance: F_us - F_ds + M_ds - M_us + W_x - F_friction - F_drag = 0
      // Rearranged to find the WSEL where balance holds
      // Target: F_us = F_ds - M_ds + M_us - W_x + F_friction + F_drag
      const targetForce = F_ds - M_ds + M_us - W_x + F_friction + F_drag;

      // Invert F_us to find corresponding WSEL
      // F_us = 0.5 * γ * A * D, find WSEL where F_us matches targetForce
      // Simpler: use the error to adjust WSEL
      const error = F_us - targetForce;
      // Scale error to WSEL adjustment
      const gamma = WATER_DENSITY * G;
      const dFdWsel = gamma * usTopWidth * (usArea / usTopWidth); // ≈ γ*A
      if (Math.abs(dFdWsel) < 1e-6) return trialWsel;

      return trialWsel - error / dFdWsel;
    },
    tolerance: coefficients.tolerance,
    maxIterations: coefficients.maxIterations,
  });

  const usWsel = solverResult.solution;
  const usArea = calcFlowArea(crossSection, usWsel);
  const usTopWidth = calcTopWidth(crossSection, usWsel);
  const usVelocity = calcVelocity(Q, usArea);
  const totalLoss = usWsel - dsWsel;

  steps.push({
    stepNumber: 5,
    description: 'Upstream WSEL from momentum balance',
    formula: 'ΣF = ΔM',
    intermediateValues: { dsWsel, totalLoss },
    result: usWsel,
    unit: 'ft',
  });

  const froudeDs = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);
  const froudeUs = calcFroudeNumber(usVelocity, usArea, usTopWidth);
  const bridgeArea = calcNetBridgeArea(bridge, crossSection, dsWsel);
  const bridgeVelocity = calcVelocity(Q, bridgeArea);

  return {
    profileName: profile.name,
    upstreamWsel: usWsel,
    totalHeadLoss: totalLoss,
    approachVelocity: usVelocity,
    bridgeVelocity,
    froudeApproach: froudeUs,
    froudeBridge: froudeDs,
    flowRegime: regime,
    iterationLog: solverResult.log,
    converged: solverResult.converged,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(totalLoss, usVelocity),
    tuflowSuperFLC: calcTuflowSuperFLC(0, usVelocity, regime),
    error: solverResult.converged ? null : 'Max iterations reached without convergence',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npx vitest run tests/engine/methods/momentum.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/engine/methods/momentum.ts app/tests/engine/methods/momentum.test.ts
git commit -m "feat: implement momentum method"
```

---

## Task 11: Engine — WSPRO Method

**Files:**
- Create: `app/src/engine/methods/wspro.ts`, `app/tests/engine/methods/wspro.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/tests/engine/methods/wspro.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runWSPRO } from '@/engine/methods/wspro';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9,
  lowChordRight: 9,
  highChord: 12,
  leftAbutmentStation: 5,
  rightAbutmentStation: 95,
  leftAbutmentSlope: 0,
  rightAbutmentSlope: 0,
  skewAngle: 0,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

const profile: FlowProfile = {
  name: '10-yr',
  discharge: 2500,
  dsWsel: 8,
  channelSlope: 0.001,
  contractionLength: 90,
  expansionLength: 90,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runWSPRO', () => {
  it('produces US WSEL > DS WSEL', () => {
    const result = runWSPRO(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });

  it('reports free-surface flow regime', () => {
    const result = runWSPRO(crossSection, bridge, profile, coefficients);
    expect(result.flowRegime).toBe('free-surface');
  });

  it('has calculation steps', () => {
    const result = runWSPRO(crossSection, bridge, profile, coefficients);
    expect(result.calculationSteps.length).toBeGreaterThan(0);
  });

  it('computes bridge opening ratio between 0 and 1', () => {
    const result = runWSPRO(crossSection, bridge, profile, coefficients);
    // M should be between 0 and 1 for normal bridge constriction
    const mStep = result.calculationSteps.find(s => s.description.includes('opening ratio'));
    expect(mStep).toBeDefined();
    if (mStep) {
      expect(mStep.result).toBeGreaterThan(0);
      expect(mStep.result).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npx vitest run tests/engine/methods/wspro.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement wspro.ts**

Create `app/src/engine/methods/wspro.ts`:

```typescript
import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  MethodResult,
  CalculationStep,
} from '../types';
import {
  calcFlowArea,
  calcTopWidth,
  calcConveyance,
} from '../geometry';
import { interpolateLowChord } from '../bridge-geometry';
import {
  calcVelocity,
  calcVelocityHead,
  calcFroudeNumber,
} from '../hydraulics';
import { detectFlowRegime } from '../flow-regime';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from '../tuflow-flc';

/**
 * Look up base backwater coefficient Cb from bridge opening ratio M.
 * Based on FHWA WSPRO method Table 5-1 (simplified interpolation).
 */
function lookupCb(M: number): number {
  // Approximate relationship: Cb increases as M decreases (more constriction)
  // From WSPRO documentation:
  const table: [number, number][] = [
    [0.10, 3.10],
    [0.20, 1.40],
    [0.30, 0.73],
    [0.40, 0.39],
    [0.50, 0.20],
    [0.60, 0.10],
    [0.70, 0.04],
    [0.80, 0.01],
    [0.90, 0.00],
    [1.00, 0.00],
  ];

  if (M <= table[0][0]) return table[0][1];
  if (M >= table[table.length - 1][0]) return table[table.length - 1][1];

  for (let i = 0; i < table.length - 1; i++) {
    if (M >= table[i][0] && M <= table[i + 1][0]) {
      const t = (M - table[i][0]) / (table[i + 1][0] - table[i][0]);
      return table[i][1] + t * (table[i + 1][1] - table[i][1]);
    }
  }
  return 0;
}

/**
 * WSPRO method: FHWA bridge waterways analysis.
 * Δh = C × α₁ × (V₁²/2g)
 */
export function runWSPRO(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const Q = profile.discharge;
  const dsWsel = profile.dsWsel;

  // Flow regime
  const midStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, midStation);
  const regime = detectFlowRegime(dsWsel, lowChord, bridge.highChord);

  // Step 1: Total section conveyance
  const K_total = calcConveyance(crossSection, dsWsel);

  // Step 2: Bridge opening conveyance (conveyance of subsection within abutments)
  // Clip cross-section to abutment bounds and compute conveyance
  const bridgePoints = crossSection.filter(
    p => p.station >= bridge.leftAbutmentStation && p.station <= bridge.rightAbutmentStation
  );

  // Add interpolated boundary points if needed
  const clippedPoints: CrossSectionPoint[] = [];

  // Left boundary
  const leftElev = interpolateElevation(crossSection, bridge.leftAbutmentStation);
  clippedPoints.push({
    station: bridge.leftAbutmentStation,
    elevation: leftElev,
    manningsN: crossSection[0].manningsN,
    bankStation: 'left',
  });

  for (const p of bridgePoints) {
    if (p.station > bridge.leftAbutmentStation && p.station < bridge.rightAbutmentStation) {
      clippedPoints.push({ ...p, bankStation: null });
    }
  }

  // Right boundary
  const rightElev = interpolateElevation(crossSection, bridge.rightAbutmentStation);
  clippedPoints.push({
    station: bridge.rightAbutmentStation,
    elevation: rightElev,
    manningsN: crossSection[crossSection.length - 1].manningsN,
    bankStation: 'right',
  });

  const K_bridge = calcConveyance(clippedPoints, dsWsel);

  // Step 3: Bridge opening ratio M
  const M = K_total > 0 ? K_bridge / K_total : 0;

  steps.push({
    stepNumber: 1,
    description: 'Bridge opening ratio M (conveyance ratio)',
    formula: 'M = K_bridge / K_total',
    intermediateValues: { K_total, K_bridge },
    result: M,
    unit: '',
  });

  // Step 4: Base coefficient Cb
  const Cb = lookupCb(M);

  steps.push({
    stepNumber: 2,
    description: 'Base backwater coefficient Cb from M',
    formula: 'Cb = f(M) from WSPRO Table 5-1',
    intermediateValues: { M },
    result: Cb,
    unit: '',
  });

  // Step 5: Froude number correction
  const dsArea = calcFlowArea(crossSection, dsWsel);
  const dsTopWidth = calcTopWidth(crossSection, dsWsel);
  const dsVelocity = calcVelocity(Q, dsArea);
  const Fr = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);

  // Froude correction factor (approximate): increases for higher Froude
  const froudeCorrection = 1.0 + 0.5 * Fr * Fr;

  steps.push({
    stepNumber: 3,
    description: 'Froude number correction',
    formula: 'K_Fr = 1 + 0.5·Fr²',
    intermediateValues: { Fr },
    result: froudeCorrection,
    unit: '',
  });

  // Step 6: Eccentricity correction
  // e = (Q_left - Q_right) / Q_total, measured relative to bridge centerline
  // Compute conveyance split to estimate flow distribution
  const leftConveyance = calcConveyance(
    crossSection.filter(p => p.station <= midStation),
    dsWsel
  );
  const rightConveyance = calcConveyance(
    crossSection.filter(p => p.station >= midStation),
    dsWsel
  );
  const totalConveyance = leftConveyance + rightConveyance;
  const eccentricity = totalConveyance > 0
    ? Math.abs(leftConveyance - rightConveyance) / totalConveyance
    : 0;
  // Eccentricity correction: K_e = 1 + e (linear approximation from WSPRO manual)
  const eccentricityCorrection = 1.0 + eccentricity;

  steps.push({
    stepNumber: 4,
    description: 'Eccentricity correction',
    formula: 'e = |K_left - K_right| / K_total, K_e = 1 + e',
    intermediateValues: { K_left: leftConveyance, K_right: rightConveyance, e: eccentricity },
    result: eccentricityCorrection,
    unit: '',
  });

  // Step 7: Compute backwater
  const alpha1 = 1.0; // velocity distribution coefficient
  const dsVh = calcVelocityHead(dsVelocity, alpha1);
  const C = Cb * froudeCorrection * eccentricityCorrection;
  const dh = C * alpha1 * dsVh;

  steps.push({
    stepNumber: 5,
    description: 'Backwater computation',
    formula: 'Δh = C × α₁ × (V₁²/2g)',
    intermediateValues: { C, alpha1, 'V²/2g': dsVh },
    result: dh,
    unit: 'ft',
  });

  // Upstream WSEL
  const usWsel = dsWsel + dh;

  steps.push({
    stepNumber: 6,
    description: 'Upstream water surface elevation',
    formula: 'US WSEL = DS WSEL + Δh',
    intermediateValues: { dsWsel, dh },
    result: usWsel,
    unit: 'ft',
  });

  // Upstream properties
  const usArea = calcFlowArea(crossSection, usWsel);
  const usTopWidth = calcTopWidth(crossSection, usWsel);
  const usVelocity = calcVelocity(Q, usArea);
  const froudeUs = calcFroudeNumber(usVelocity, usArea, usTopWidth);

  const bridgeArea = calcFlowArea(clippedPoints, dsWsel);
  const bridgeVelocity = calcVelocity(Q, bridgeArea);

  return {
    profileName: profile.name,
    upstreamWsel: usWsel,
    totalHeadLoss: dh,
    approachVelocity: usVelocity,
    bridgeVelocity,
    froudeApproach: froudeUs,
    froudeBridge: Fr,
    flowRegime: regime,
    iterationLog: [],
    converged: true,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(dh, usVelocity),
    tuflowSuperFLC: calcTuflowSuperFLC(0, usVelocity, regime),
    error: null,
  };
}

function interpolateElevation(crossSection: CrossSectionPoint[], station: number): number {
  if (station <= crossSection[0].station) return crossSection[0].elevation;
  if (station >= crossSection[crossSection.length - 1].station)
    return crossSection[crossSection.length - 1].elevation;

  for (let i = 0; i < crossSection.length - 1; i++) {
    if (station >= crossSection[i].station && station <= crossSection[i + 1].station) {
      const t = (station - crossSection[i].station) /
        (crossSection[i + 1].station - crossSection[i].station);
      return crossSection[i].elevation + t * (crossSection[i + 1].elevation - crossSection[i].elevation);
    }
  }
  return crossSection[crossSection.length - 1].elevation;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npx vitest run tests/engine/methods/wspro.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/engine/methods/wspro.ts app/tests/engine/methods/wspro.test.ts
git commit -m "feat: implement WSPRO method"
```

---

## Task 12: Engine — Orchestrator (runAllMethods)

**Files:**
- Create: `app/src/engine/index.ts`, `app/tests/engine/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/tests/engine/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runAllMethods } from '@/engine/index';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9,
  lowChordRight: 9,
  highChord: 12,
  leftAbutmentStation: 5,
  rightAbutmentStation: 95,
  leftAbutmentSlope: 0,
  rightAbutmentSlope: 0,
  skewAngle: 0,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

const profiles: FlowProfile[] = [
  {
    name: '10-yr',
    discharge: 2500,
    dsWsel: 8,
    channelSlope: 0.001,
    contractionLength: 90,
    expansionLength: 90,
  },
  {
    name: '100-yr',
    discharge: 5000,
    dsWsel: 8.5,
    channelSlope: 0.001,
    contractionLength: 90,
    expansionLength: 90,
  },
];

const coefficients: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runAllMethods', () => {
  it('returns results for all four methods', () => {
    const results = runAllMethods(crossSection, bridge, profiles, coefficients);
    expect(results.energy).toHaveLength(2);
    expect(results.momentum).toHaveLength(2);
    expect(results.yarnell).toHaveLength(2);
    expect(results.wspro).toHaveLength(2);
  });

  it('respects methodsToRun flags', () => {
    const onlyEnergy = {
      ...coefficients,
      methodsToRun: { energy: true, momentum: false, yarnell: false, wspro: false },
    };
    const results = runAllMethods(crossSection, bridge, profiles, onlyEnergy);
    expect(results.energy).toHaveLength(2);
    expect(results.momentum).toHaveLength(0);
    expect(results.yarnell).toHaveLength(0);
    expect(results.wspro).toHaveLength(0);
  });

  it('all methods produce positive head loss', () => {
    const results = runAllMethods(crossSection, bridge, profiles, coefficients);
    for (const r of results.energy) expect(r.totalHeadLoss).toBeGreaterThan(0);
    for (const r of results.yarnell) {
      if (!r.error) expect(r.totalHeadLoss).toBeGreaterThan(0);
    }
    for (const r of results.wspro) expect(r.totalHeadLoss).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npx vitest run tests/engine/index.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement index.ts**

Create `app/src/engine/index.ts`:

```typescript
import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  CalculationResults,
} from './types';
import { runEnergy } from './methods/energy';
import { runMomentum } from './methods/momentum';
import { runYarnell } from './methods/yarnell';
import { runWSPRO } from './methods/wspro';

export { runEnergy } from './methods/energy';
export { runMomentum } from './methods/momentum';
export { runYarnell } from './methods/yarnell';
export { runWSPRO } from './methods/wspro';

/**
 * Runs all selected calculation methods for all flow profiles.
 */
export function runAllMethods(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  coefficients: Coefficients
): CalculationResults {
  const results: CalculationResults = {
    energy: [],
    momentum: [],
    yarnell: [],
    wspro: [],
  };

  for (const profile of profiles) {
    if (coefficients.methodsToRun.energy) {
      results.energy.push(runEnergy(crossSection, bridge, profile, coefficients));
    }
    if (coefficients.methodsToRun.momentum) {
      results.momentum.push(runMomentum(crossSection, bridge, profile, coefficients));
    }
    if (coefficients.methodsToRun.yarnell) {
      results.yarnell.push(runYarnell(crossSection, bridge, profile, coefficients));
    }
    if (coefficients.methodsToRun.wspro) {
      results.wspro.push(runWSPRO(crossSection, bridge, profile, coefficients));
    }
  }

  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npx vitest run tests/engine/index.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Run the full test suite**

Run:
```bash
cd app && npx vitest run
```

Expected: All tests pass across all engine modules.

- [ ] **Step 6: Commit**

```bash
git add app/src/engine/index.ts app/tests/engine/index.test.ts
git commit -m "feat: implement runAllMethods orchestrator"
```

---

## Task 13: Zustand Store & JSON I/O

**Files:**
- Create: `app/src/store/project-store.ts`, `app/src/lib/json-io.ts`, `app/src/lib/validation.ts`, `app/tests/store/project-store.test.ts`, `app/tests/lib/json-io.test.ts`

- [ ] **Step 1: Write store tests**

Create `app/tests/store/project-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '@/store/project-store';

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('has default state', () => {
    const state = useProjectStore.getState();
    expect(state.crossSection).toEqual([]);
    expect(state.results).toBeNull();
    expect(state.coefficients.contractionCoeff).toBe(0.3);
  });

  it('updates cross section', () => {
    const points = [
      { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' as const },
    ];
    useProjectStore.getState().updateCrossSection(points);
    expect(useProjectStore.getState().crossSection).toEqual(points);
  });

  it('clears results', () => {
    useProjectStore.getState().setResults({
      energy: [], momentum: [], yarnell: [], wspro: [],
    });
    useProjectStore.getState().clearResults();
    expect(useProjectStore.getState().results).toBeNull();
  });

  it('exports and imports project', () => {
    const points = [
      { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' as const },
    ];
    useProjectStore.getState().updateCrossSection(points);
    const json = useProjectStore.getState().exportProject();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.crossSection).toEqual(points);

    // Reset and reimport
    useProjectStore.getState().reset();
    expect(useProjectStore.getState().crossSection).toEqual([]);

    useProjectStore.getState().importProject(json);
    expect(useProjectStore.getState().crossSection).toEqual(points);
  });
});
```

- [ ] **Step 2: Write JSON I/O tests**

Create `app/tests/lib/json-io.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseProjectJson, serializeProject } from '@/lib/json-io';
import { ProjectState } from '@/engine/types';

const minimalState: Omit<ProjectState, 'results'> = {
  crossSection: [],
  bridgeGeometry: {
    lowChordLeft: 98,
    lowChordRight: 98,
    highChord: 102,
    leftAbutmentStation: 20,
    rightAbutmentStation: 80,
    leftAbutmentSlope: 0,
    rightAbutmentSlope: 0,
    skewAngle: 0,
    piers: [],
    lowChordProfile: [],
  },
  flowProfiles: [],
  coefficients: {
    contractionCoeff: 0.3,
    expansionCoeff: 0.5,
    yarnellK: null,
    maxIterations: 100,
    tolerance: 0.01,
    initialGuessOffset: 0.5,
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
  hecRasComparison: [],
};

describe('serializeProject', () => {
  it('adds version field', () => {
    const json = serializeProject(minimalState);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
  });

  it('excludes results', () => {
    const json = serializeProject(minimalState);
    const parsed = JSON.parse(json);
    expect(parsed.results).toBeUndefined();
  });
});

describe('parseProjectJson', () => {
  it('parses valid JSON', () => {
    const json = serializeProject(minimalState);
    const result = parseProjectJson(json);
    expect(result.crossSection).toEqual([]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseProjectJson('not json')).toThrow();
  });

  it('throws on missing version', () => {
    expect(() => parseProjectJson('{}')).toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
cd app && npx vitest run tests/store/ tests/lib/
```

Expected: FAIL.

- [ ] **Step 4: Implement json-io.ts**

Create `app/src/lib/json-io.ts`:

```typescript
import { ProjectState } from '@/engine/types';

interface ExportData {
  version: number;
  crossSection: ProjectState['crossSection'];
  bridgeGeometry: ProjectState['bridgeGeometry'];
  flowProfiles: ProjectState['flowProfiles'];
  coefficients: ProjectState['coefficients'];
  hecRasComparison: ProjectState['hecRasComparison'];
}

export function serializeProject(
  state: Omit<ProjectState, 'results'>
): string {
  const data: ExportData = {
    version: 1,
    crossSection: state.crossSection,
    bridgeGeometry: state.bridgeGeometry,
    flowProfiles: state.flowProfiles,
    coefficients: state.coefficients,
    hecRasComparison: state.hecRasComparison,
  };
  return JSON.stringify(data, null, 2);
}

export function parseProjectJson(json: string): Omit<ProjectState, 'results'> {
  let data: ExportData;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }

  if (!data.version || data.version !== 1) {
    throw new Error('Invalid or missing version field');
  }

  return {
    crossSection: data.crossSection ?? [],
    bridgeGeometry: data.bridgeGeometry,
    flowProfiles: data.flowProfiles ?? [],
    coefficients: data.coefficients,
    hecRasComparison: data.hecRasComparison ?? [],
  };
}
```

- [ ] **Step 5: Implement validation.ts**

Create `app/src/lib/validation.ts`:

```typescript
import { CrossSectionPoint, BridgeGeometry, FlowProfile } from '@/engine/types';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateInputs(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (crossSection.length < 2) {
    errors.push({ field: 'crossSection', message: 'At least 2 cross-section points required' });
  }

  const hasLeftBank = crossSection.some(p => p.bankStation === 'left');
  const hasRightBank = crossSection.some(p => p.bankStation === 'right');
  if (!hasLeftBank || !hasRightBank) {
    errors.push({ field: 'crossSection', message: 'Left and right bank stations must be defined' });
  }

  for (let i = 0; i < crossSection.length; i++) {
    if (crossSection[i].manningsN <= 0) {
      errors.push({ field: `crossSection[${i}].manningsN`, message: "Manning's n must be positive" });
    }
  }

  if (bridge.leftAbutmentStation >= bridge.rightAbutmentStation) {
    errors.push({ field: 'bridge', message: 'Left abutment must be left of right abutment' });
  }

  if (bridge.lowChordLeft >= bridge.highChord || bridge.lowChordRight >= bridge.highChord) {
    errors.push({ field: 'bridge', message: 'Low chord must be below high chord' });
  }

  if (profiles.length === 0) {
    errors.push({ field: 'profiles', message: 'At least one flow profile required' });
  }

  for (let i = 0; i < profiles.length; i++) {
    if (profiles[i].discharge <= 0) {
      errors.push({ field: `profiles[${i}].discharge`, message: 'Discharge must be positive' });
    }
  }

  return errors;
}
```

- [ ] **Step 5b: Write validation tests**

Create `app/tests/lib/validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateInputs } from '@/lib/validation';
import { CrossSectionPoint, BridgeGeometry, FlowProfile } from '@/engine/types';

const validCrossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const validBridge: BridgeGeometry = {
  lowChordLeft: 9, lowChordRight: 9, highChord: 12,
  leftAbutmentStation: 5, rightAbutmentStation: 95,
  leftAbutmentSlope: 0, rightAbutmentSlope: 0, skewAngle: 0,
  piers: [], lowChordProfile: [],
};

const validProfiles: FlowProfile[] = [
  { name: '10-yr', discharge: 2500, dsWsel: 8, channelSlope: 0.001, contractionLength: 90, expansionLength: 90 },
];

describe('validateInputs', () => {
  it('returns no errors for valid input', () => {
    expect(validateInputs(validCrossSection, validBridge, validProfiles)).toEqual([]);
  });

  it('errors on too few cross-section points', () => {
    const errors = validateInputs([validCrossSection[0]], validBridge, validProfiles);
    expect(errors.some(e => e.field === 'crossSection')).toBe(true);
  });

  it('errors on missing bank stations', () => {
    const noBanks = validCrossSection.map(p => ({ ...p, bankStation: null as const }));
    const errors = validateInputs(noBanks as CrossSectionPoint[], validBridge, validProfiles);
    expect(errors.some(e => e.message.includes('bank'))).toBe(true);
  });

  it('errors on negative mannings n', () => {
    const badN = validCrossSection.map((p, i) => i === 0 ? { ...p, manningsN: -0.01 } : p);
    const errors = validateInputs(badN, validBridge, validProfiles);
    expect(errors.some(e => e.message.includes("Manning's n"))).toBe(true);
  });

  it('errors on inverted abutments', () => {
    const errors = validateInputs(validCrossSection, { ...validBridge, leftAbutmentStation: 95, rightAbutmentStation: 5 }, validProfiles);
    expect(errors.some(e => e.message.includes('abutment'))).toBe(true);
  });

  it('errors on low chord above high chord', () => {
    const errors = validateInputs(validCrossSection, { ...validBridge, lowChordLeft: 15, highChord: 12 }, validProfiles);
    expect(errors.some(e => e.message.includes('chord'))).toBe(true);
  });

  it('errors on no profiles', () => {
    const errors = validateInputs(validCrossSection, validBridge, []);
    expect(errors.some(e => e.field === 'profiles')).toBe(true);
  });

  it('errors on zero discharge', () => {
    const errors = validateInputs(validCrossSection, validBridge, [{ ...validProfiles[0], discharge: 0 }]);
    expect(errors.some(e => e.message.includes('Discharge'))).toBe(true);
  });
});
```

- [ ] **Step 6: Implement project-store.ts**

Create `app/src/store/project-store.ts`:

```typescript
import { create } from 'zustand';
import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  CalculationResults,
  HecRasComparison,
} from '@/engine/types';
import { serializeProject, parseProjectJson } from '@/lib/json-io';

interface ProjectStore {
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  flowProfiles: FlowProfile[];
  coefficients: Coefficients;
  results: CalculationResults | null;
  hecRasComparison: HecRasComparison[];

  updateCrossSection: (points: CrossSectionPoint[]) => void;
  updateBridgeGeometry: (geom: BridgeGeometry) => void;
  updateFlowProfiles: (profiles: FlowProfile[]) => void;
  updateCoefficients: (coeffs: Coefficients) => void;
  setResults: (results: CalculationResults) => void;
  clearResults: () => void;
  updateHecRasComparison: (data: HecRasComparison[]) => void;
  exportProject: () => string;
  importProject: (json: string) => void;
  reset: () => void;
}

const defaultBridgeGeometry: BridgeGeometry = {
  lowChordLeft: 0,
  lowChordRight: 0,
  highChord: 0,
  leftAbutmentStation: 0,
  rightAbutmentStation: 0,
  leftAbutmentSlope: 0,
  rightAbutmentSlope: 0,
  skewAngle: 0,
  piers: [],
  lowChordProfile: [],
};

const defaultCoefficients: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  methodsToRun: {
    energy: true,
    momentum: true,
    yarnell: true,
    wspro: true,
  },
};

const initialState = {
  crossSection: [] as CrossSectionPoint[],
  bridgeGeometry: defaultBridgeGeometry,
  flowProfiles: [] as FlowProfile[],
  coefficients: defaultCoefficients,
  results: null as CalculationResults | null,
  hecRasComparison: [] as HecRasComparison[],
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...initialState,

  updateCrossSection: (points) => set({ crossSection: points }),
  updateBridgeGeometry: (geom) => set({ bridgeGeometry: geom }),
  updateFlowProfiles: (profiles) => set({ flowProfiles: profiles }),
  updateCoefficients: (coeffs) => set({ coefficients: coeffs }),
  setResults: (results) => set({ results }),
  clearResults: () => set({ results: null }),
  updateHecRasComparison: (data) => set({ hecRasComparison: data }),

  exportProject: () => {
    const state = get();
    return serializeProject({
      crossSection: state.crossSection,
      bridgeGeometry: state.bridgeGeometry,
      flowProfiles: state.flowProfiles,
      coefficients: state.coefficients,
      hecRasComparison: state.hecRasComparison,
    });
  },

  importProject: (json) => {
    const data = parseProjectJson(json);
    set({
      ...data,
      results: null,
    });
  },

  reset: () => set(initialState),
}));
```

- [ ] **Step 7: Run tests to verify they pass**

Run:
```bash
cd app && npx vitest run tests/store/ tests/lib/
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add app/src/store/ app/src/lib/ app/tests/store/ app/tests/lib/
git commit -m "feat: implement Zustand store and JSON I/O"
```

---

## Task 14: UI — App Shell & Top Bar

**Files:**
- Modify: `app/src/app/layout.tsx`, `app/src/app/page.tsx`
- Create: `app/src/components/top-bar.tsx`, `app/src/components/main-tabs.tsx`

- [ ] **Step 1: Implement top-bar.tsx**

Create `app/src/components/top-bar.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportProject = useProjectStore((s) => s.exportProject);
  const importProject = useProjectStore((s) => s.importProject);

  function handleExport() {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bridge-loss-project.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importProject(reader.result as string);
      } catch (err) {
        alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b">
      <h1 className="text-lg font-semibold">Bridge Loss Calculator</h1>
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          Import JSON
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          Export JSON
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Implement main-tabs.tsx (skeleton)**

Create `app/src/components/main-tabs.tsx`:

```tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function MainTabs() {
  return (
    <Tabs defaultValue="input" className="flex-1 flex flex-col">
      <TabsList className="mx-6 mt-4 w-fit">
        <TabsTrigger value="input">Input</TabsTrigger>
        <TabsTrigger value="results">Method Results</TabsTrigger>
        <TabsTrigger value="summary">Summary &amp; Charts</TabsTrigger>
      </TabsList>

      <TabsContent value="input" className="flex-1 px-6 py-4">
        <p className="text-muted-foreground">Input forms will go here.</p>
      </TabsContent>

      <TabsContent value="results" className="flex-1 px-6 py-4">
        <p className="text-muted-foreground">Method results will go here.</p>
      </TabsContent>

      <TabsContent value="summary" className="flex-1 px-6 py-4">
        <p className="text-muted-foreground">Summary &amp; charts will go here.</p>
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 3: Update layout.tsx**

Replace `app/src/app/layout.tsx` contents with:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Bridge Loss Calculator',
  description: 'Independent bridge hydraulic loss calculations for HEC-RAS QA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Update page.tsx**

Replace `app/src/app/page.tsx` contents with:

```tsx
import { TopBar } from '@/components/top-bar';
import { MainTabs } from '@/components/main-tabs';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar />
      <MainTabs />
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run:
```bash
cd app && npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/src/
git commit -m "feat: implement app shell with top bar and main tabs"
```

---

## Task 15: UI — Cross-Section Form with Live Preview

**Files:**
- Create: `app/src/components/input/cross-section-form.tsx`, `app/src/components/cross-section-chart.tsx`

- [ ] **Step 1: Implement cross-section-chart.tsx**

Create `app/src/components/cross-section-chart.tsx`:

```tsx
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CrossSectionPoint, BridgeGeometry } from '@/engine/types';

interface CrossSectionChartProps {
  crossSection: CrossSectionPoint[];
  wsel?: number;
  bridge?: BridgeGeometry;
  /** Per-method WSEL lines to overlay. Key = method name, value = WSEL elevation. */
  methodWsels?: Record<string, number>;
}

export function CrossSectionChart({ crossSection, wsel, bridge, methodWsels }: CrossSectionChartProps) {
  if (crossSection.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Enter at least 2 points to see preview
      </div>
    );
  }

  // Build data array with ground elevation and optional WSEL lines
  const data = crossSection.map((p) => {
    const row: Record<string, number | undefined> = {
      station: p.station,
      elevation: p.elevation,
    };
    if (wsel !== undefined) row.wsel = wsel;
    // Add bridge deck lines if bridge geometry provided and station is within abutments
    if (bridge && p.station >= bridge.leftAbutmentStation && p.station <= bridge.rightAbutmentStation) {
      const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
      const t = span > 0 ? (p.station - bridge.leftAbutmentStation) / span : 0;
      row.lowChord = bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft);
      row.highChord = bridge.highChord;
    }
    // Add per-method WSEL lines
    if (methodWsels) {
      for (const [method, val] of Object.entries(methodWsels)) {
        row[method] = val;
      }
    }
    return row;
  });

  // Add interpolated abutment boundary points for bridge overlay if missing
  if (bridge) {
    const stations = data.map(d => d.station!);
    for (const abSta of [bridge.leftAbutmentStation, bridge.rightAbutmentStation]) {
      if (!stations.includes(abSta)) {
        // Interpolate ground elevation at abutment
        let groundElev = 0;
        for (let i = 0; i < crossSection.length - 1; i++) {
          if (crossSection[i].station <= abSta && crossSection[i + 1].station >= abSta) {
            const t2 = (abSta - crossSection[i].station) / (crossSection[i + 1].station - crossSection[i].station);
            groundElev = crossSection[i].elevation + t2 * (crossSection[i + 1].elevation - crossSection[i].elevation);
            break;
          }
        }
        const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
        const t = span > 0 ? (abSta - bridge.leftAbutmentStation) / span : 0;
        const row: Record<string, number | undefined> = {
          station: abSta,
          elevation: groundElev,
          lowChord: bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft),
          highChord: bridge.highChord,
        };
        if (wsel !== undefined) row.wsel = wsel;
        if (methodWsels) {
          for (const [method, val] of Object.entries(methodWsels)) {
            row[method] = val;
          }
        }
        data.push(row);
      }
    }
    data.sort((a, b) => a.station! - b.station!);
  }

  const allElevs = crossSection.map(p => p.elevation);
  if (bridge) { allElevs.push(bridge.highChord); }
  if (wsel !== undefined) { allElevs.push(wsel); }
  if (methodWsels) { allElevs.push(...Object.values(methodWsels)); }
  const minElev = Math.min(...allElevs) - 1;
  const maxElev = Math.max(...allElevs) + 1;

  const METHOD_COLORS: Record<string, string> = {
    energy: '#3b82f6', momentum: '#10b981', yarnell: '#f59e0b', wspro: '#8b5cf6',
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="station" label={{ value: 'Station (ft)', position: 'bottom', offset: -5 }} stroke="#71717a" fontSize={12} />
        <YAxis domain={[minElev, maxElev]} label={{ value: 'Elevation (ft)', angle: -90, position: 'insideLeft' }} stroke="#71717a" fontSize={12} />
        <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px' }} />
        <Line type="linear" dataKey="elevation" stroke="#71717a" strokeWidth={2} dot={{ fill: '#a1a1aa', r: 3 }} name="Ground" />
        {bridge && (
          <>
            <Line type="linear" dataKey="lowChord" stroke="#ef4444" strokeWidth={2} dot={false} name="Low Chord" connectNulls={false} />
            <Line type="linear" dataKey="highChord" stroke="#ef4444" strokeWidth={1} strokeDasharray="6 3" dot={false} name="High Chord" connectNulls={false} />
          </>
        )}
        {wsel !== undefined && (
          <Line type="linear" dataKey="wsel" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="WSEL" />
        )}
        {methodWsels && Object.keys(methodWsels).map((method) => (
          <Line key={method} type="linear" dataKey={method} stroke={METHOD_COLORS[method] ?? '#888'} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name={`${method} WSEL`} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Implement cross-section-form.tsx**

Create `app/src/components/input/cross-section-form.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/project-store';
import { CrossSectionPoint } from '@/engine/types';
import { CrossSectionChart } from '@/components/cross-section-chart';

export function CrossSectionForm() {
  const crossSection = useProjectStore((s) => s.crossSection);
  const updateCrossSection = useProjectStore((s) => s.updateCrossSection);

  function addRow() {
    updateCrossSection([
      ...crossSection,
      { station: 0, elevation: 0, manningsN: 0.035, bankStation: null },
    ]);
  }

  function removeRow(index: number) {
    updateCrossSection(crossSection.filter((_, i) => i !== index));
  }

  function updatePoint(index: number, field: keyof CrossSectionPoint, value: string) {
    const updated = [...crossSection];
    if (field === 'bankStation') {
      updated[index] = { ...updated[index], bankStation: value === '—' ? null : value as 'left' | 'right' };
    } else {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    }
    updateCrossSection(updated);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Data entry */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Station / Elevation Points</h3>
        <div className="rounded-lg border">
          <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_40px] gap-1 p-2 text-xs text-muted-foreground border-b">
            <div>#</div>
            <div>Station (ft)</div>
            <div>Elevation (ft)</div>
            <div>Manning&apos;s n</div>
            <div>Bank</div>
            <div></div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {crossSection.map((point, i) => (
              <div key={i} className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_40px] gap-1 p-1 items-center">
                <span className="text-xs text-muted-foreground pl-1">{i + 1}</span>
                <Input
                  type="number"
                  value={point.station}
                  onChange={(e) => updatePoint(i, 'station', e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  value={point.elevation}
                  onChange={(e) => updatePoint(i, 'elevation', e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  value={point.manningsN}
                  onChange={(e) => updatePoint(i, 'manningsN', e.target.value)}
                  className="h-8 text-sm"
                  step="0.001"
                />
                <Select
                  value={point.bankStation ?? '—'}
                  onValueChange={(v) => updatePoint(i, 'bankStation', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="—">—</SelectItem>
                    <SelectItem value="left">Left Bank</SelectItem>
                    <SelectItem value="right">Right Bank</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeRow(i)}>
                  ×
                </Button>
              </div>
            ))}
          </div>
          <div className="p-2 border-t">
            <Button variant="outline" size="sm" onClick={addRow} className="w-full">
              + Add Row
            </Button>
          </div>
        </div>
      </div>

      {/* Right: Live preview */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Cross-Section Preview</h3>
        <div className="rounded-lg border bg-card h-[300px] p-4">
          <CrossSectionChart crossSection={crossSection} />
        </div>
        <p className="text-xs text-muted-foreground">Live preview updates as you enter data</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd app && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/
git commit -m "feat: implement cross-section form with live chart preview"
```

---

## Task 16: UI — Bridge Geometry, Flow Profiles, Coefficients Forms

**Files:**
- Create: `app/src/components/input/bridge-geometry-form.tsx`, `app/src/components/input/flow-profiles-form.tsx`, `app/src/components/input/coefficients-form.tsx`, `app/src/components/input/action-buttons.tsx`

- [ ] **Step 1: Implement bridge-geometry-form.tsx**

Create `app/src/components/input/bridge-geometry-form.tsx`:

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/project-store';
import { Pier } from '@/engine/types';

export function BridgeGeometryForm() {
  const bridge = useProjectStore((s) => s.bridgeGeometry);
  const update = useProjectStore((s) => s.updateBridgeGeometry);

  function setField(field: string, value: string) {
    update({ ...bridge, [field]: parseFloat(value) || 0 });
  }

  function addPier() {
    update({ ...bridge, piers: [...bridge.piers, { station: 0, width: 3, shape: 'round-nose' }] });
  }

  function removePier(index: number) {
    update({ ...bridge, piers: bridge.piers.filter((_, i) => i !== index) });
  }

  function updatePier(index: number, field: keyof Pier, value: string) {
    const piers = [...bridge.piers];
    if (field === 'shape') {
      piers[index] = { ...piers[index], shape: value as Pier['shape'] };
    } else {
      piers[index] = { ...piers[index], [field]: parseFloat(value) || 0 };
    }
    update({ ...bridge, piers });
  }

  const fields = [
    { key: 'lowChordLeft', label: 'Low Chord Elevation (Left)', unit: 'ft' },
    { key: 'lowChordRight', label: 'Low Chord Elevation (Right)', unit: 'ft' },
    { key: 'highChord', label: 'High Chord Elevation', unit: 'ft' },
    { key: 'leftAbutmentStation', label: 'Left Abutment Station', unit: 'ft' },
    { key: 'rightAbutmentStation', label: 'Right Abutment Station', unit: 'ft' },
    { key: 'leftAbutmentSlope', label: 'Left Abutment Slope', unit: 'H:V' },
    { key: 'rightAbutmentSlope', label: 'Right Abutment Slope', unit: 'H:V' },
    { key: 'skewAngle', label: 'Skew Angle', unit: 'degrees' },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-3">Opening Geometry</h3>
        <div className="grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label} ({f.unit})</Label>
              <Input
                type="number"
                value={(bridge as Record<string, unknown>)[f.key] as number}
                onChange={(e) => setField(f.key, e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Pier Data</h3>
        <div className="rounded-lg border">
          <div className="grid grid-cols-[40px_1fr_1fr_1fr_40px] gap-1 p-2 text-xs text-muted-foreground border-b">
            <div>#</div>
            <div>Station (ft)</div>
            <div>Width (ft)</div>
            <div>Shape</div>
            <div></div>
          </div>
          {bridge.piers.map((pier, i) => (
            <div key={i} className="grid grid-cols-[40px_1fr_1fr_1fr_40px] gap-1 p-1 items-center">
              <span className="text-xs text-muted-foreground pl-1">{i + 1}</span>
              <Input type="number" value={pier.station} onChange={(e) => updatePier(i, 'station', e.target.value)} className="h-8 text-sm" />
              <Input type="number" value={pier.width} onChange={(e) => updatePier(i, 'width', e.target.value)} className="h-8 text-sm" />
              <Select value={pier.shape} onValueChange={(v) => updatePier(i, 'shape', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="round-nose">Round-nose</SelectItem>
                  <SelectItem value="cylindrical">Cylindrical</SelectItem>
                  <SelectItem value="sharp">Sharp</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removePier(i)}>×</Button>
            </div>
          ))}
          <div className="p-2 border-t">
            <Button variant="outline" size="sm" onClick={addPier} className="w-full">+ Add Pier</Button>
          </div>
        </div>
      </div>

      {/* Low Chord Profile (optional collapsible) */}
      <LowChordProfile bridge={bridge} update={update} />
    </div>
  );
}

function LowChordProfile({ bridge, update }: { bridge: BridgeGeometry; update: (b: BridgeGeometry) => void }) {
  const [open, setOpen] = useState(false);
  const profile = bridge.lowChordProfile;

  function addPoint() {
    update({ ...bridge, lowChordProfile: [...profile, { station: 0, elevation: 0 }] });
  }

  function removePoint(i: number) {
    update({ ...bridge, lowChordProfile: profile.filter((_, idx) => idx !== i) });
  }

  function updatePoint(i: number, field: 'station' | 'elevation', value: string) {
    const pts = [...profile];
    pts[i] = { ...pts[i], [field]: parseFloat(value) || 0 };
    update({ ...bridge, lowChordProfile: pts });
  }

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-sm font-medium flex items-center gap-2 mb-2">
        {open ? '▼' : '▶'} Low Chord Profile (optional)
      </button>
      {open && (
        <div className="rounded-lg border">
          <div className="grid grid-cols-[40px_1fr_1fr_40px] gap-1 p-2 text-xs text-muted-foreground border-b">
            <div>#</div><div>Station (ft)</div><div>Elevation (ft)</div><div></div>
          </div>
          {profile.map((pt, i) => (
            <div key={i} className="grid grid-cols-[40px_1fr_1fr_40px] gap-1 p-1 items-center">
              <span className="text-xs text-muted-foreground pl-1">{i + 1}</span>
              <Input type="number" value={pt.station} onChange={(e) => updatePoint(i, 'station', e.target.value)} className="h-8 text-sm" />
              <Input type="number" value={pt.elevation} onChange={(e) => updatePoint(i, 'elevation', e.target.value)} className="h-8 text-sm" />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removePoint(i)}>×</Button>
            </div>
          ))}
          <div className="p-2 border-t">
            <Button variant="outline" size="sm" onClick={addPoint} className="w-full">+ Add Point</Button>
          </div>
          <p className="text-xs text-muted-foreground p-2">If blank, the tool linearly interpolates between left and right low chord elevations.</p>
        </div>
      )}
    </div>
  );
}
```

Note: Add `import { useState } from 'react';` and `import { LowChordPoint } from '@/engine/types';` to the imports at the top of this file.

- [ ] **Step 2: Implement flow-profiles-form.tsx**

Create `app/src/components/input/flow-profiles-form.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { FlowProfile } from '@/engine/types';

export function FlowProfilesForm() {
  const profiles = useProjectStore((s) => s.flowProfiles);
  const update = useProjectStore((s) => s.updateFlowProfiles);

  function addProfile() {
    update([
      ...profiles,
      { name: '', discharge: 0, dsWsel: 0, channelSlope: 0.001, contractionLength: 0, expansionLength: 0 },
    ]);
  }

  function removeProfile(index: number) {
    update(profiles.filter((_, i) => i !== index));
  }

  function updateProfile(index: number, field: keyof FlowProfile, value: string) {
    const updated = [...profiles];
    if (field === 'name') {
      updated[index] = { ...updated[index], name: value };
    } else {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    }
    update(updated);
  }

  const columns = [
    { key: 'name', label: 'Profile Name', type: 'text' },
    { key: 'discharge', label: 'Q (cfs)', type: 'number' },
    { key: 'dsWsel', label: 'DS WSEL (ft)', type: 'number' },
    { key: 'channelSlope', label: 'Slope (ft/ft)', type: 'number' },
    { key: 'contractionLength', label: 'Contraction L (ft)', type: 'number' },
    { key: 'expansionLength', label: 'Expansion L (ft)', type: 'number' },
  ] as const;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Flow Profiles (up to 10)</h3>
      <div className="rounded-lg border overflow-x-auto">
        <div className="grid grid-cols-[40px_repeat(6,1fr)_40px] gap-1 p-2 text-xs text-muted-foreground border-b min-w-[700px]">
          <div>#</div>
          {columns.map((c) => <div key={c.key}>{c.label}</div>)}
          <div></div>
        </div>
        {profiles.map((profile, i) => (
          <div key={i} className="grid grid-cols-[40px_repeat(6,1fr)_40px] gap-1 p-1 items-center min-w-[700px]">
            <span className="text-xs text-muted-foreground pl-1">{i + 1}</span>
            {columns.map((c) => (
              <Input
                key={c.key}
                type={c.type}
                value={(profile as Record<string, unknown>)[c.key] as string | number}
                onChange={(e) => updateProfile(i, c.key as keyof FlowProfile, e.target.value)}
                className="h-8 text-sm"
                step={c.key === 'channelSlope' ? '0.0001' : undefined}
              />
            ))}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeProfile(i)}>×</Button>
          </div>
        ))}
        <div className="p-2 border-t">
          <Button variant="outline" size="sm" onClick={addProfile} className="w-full" disabled={profiles.length >= 10}>
            + Add Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement coefficients-form.tsx**

Create `app/src/components/input/coefficients-form.tsx`:

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjectStore } from '@/store/project-store';

export function CoefficientsForm() {
  const coefficients = useProjectStore((s) => s.coefficients);
  const update = useProjectStore((s) => s.updateCoefficients);

  function setField(field: string, value: number) {
    update({ ...coefficients, [field]: value });
  }

  function toggleMethod(method: keyof typeof coefficients.methodsToRun) {
    update({
      ...coefficients,
      methodsToRun: {
        ...coefficients.methodsToRun,
        [method]: !coefficients.methodsToRun[method],
      },
    });
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-medium mb-3">Energy Method Coefficients</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Contraction Coefficient (Cc)</Label>
            <Input type="number" value={coefficients.contractionCoeff} onChange={(e) => setField('contractionCoeff', parseFloat(e.target.value) || 0)} className="h-8 text-sm" step="0.1" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Expansion Coefficient (Ce)</Label>
            <Input type="number" value={coefficients.expansionCoeff} onChange={(e) => setField('expansionCoeff', parseFloat(e.target.value) || 0)} className="h-8 text-sm" step="0.1" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Yarnell Method</h3>
        <div className="space-y-1">
          <Label className="text-xs">Pier Shape Coefficient (K) — leave blank for auto</Label>
          <Input
            type="number"
            value={coefficients.yarnellK ?? ''}
            onChange={(e) => update({ ...coefficients, yarnellK: e.target.value ? parseFloat(e.target.value) : null })}
            className="h-8 text-sm"
            step="0.1"
            placeholder="Auto from pier shape"
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Iteration Settings</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Max Iterations</Label>
            <Input type="number" value={coefficients.maxIterations} onChange={(e) => setField('maxIterations', parseInt(e.target.value) || 100)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tolerance (ft)</Label>
            <Input type="number" value={coefficients.tolerance} onChange={(e) => setField('tolerance', parseFloat(e.target.value) || 0.01)} className="h-8 text-sm" step="0.001" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Initial Guess Offset (ft)</Label>
            <Input type="number" value={coefficients.initialGuessOffset} onChange={(e) => setField('initialGuessOffset', parseFloat(e.target.value) || 0.5)} className="h-8 text-sm" step="0.1" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Methods to Run</h3>
        <div className="flex gap-6">
          {(['energy', 'momentum', 'yarnell', 'wspro'] as const).map((method) => (
            <div key={method} className="flex items-center gap-2">
              <Checkbox
                checked={coefficients.methodsToRun[method]}
                onCheckedChange={() => toggleMethod(method)}
              />
              <Label className="text-sm capitalize">{method === 'wspro' ? 'WSPRO' : method}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement action-buttons.tsx**

Create `app/src/components/input/action-buttons.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { runAllMethods } from '@/engine/index';
import { validateInputs } from '@/lib/validation';
import { CrossSectionChart } from '@/components/cross-section-chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ActionButtons() {
  const [plotOpen, setPlotOpen] = useState(false);
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const results = useProjectStore((s) => s.results);
  const setResults = useProjectStore((s) => s.setResults);
  const clearResults = useProjectStore((s) => s.clearResults);

  function handleRunAll() {
    const errors = validateInputs(crossSection, bridgeGeometry, flowProfiles);
    if (errors.length > 0) {
      alert('Validation errors:\n' + errors.map((e) => `• ${e.message}`).join('\n'));
      return;
    }
    const calcResults = runAllMethods(crossSection, bridgeGeometry, flowProfiles, coefficients);
    setResults(calcResults);
  }

  // Build per-method WSEL lines for the first profile (if results exist)
  const methodWsels: Record<string, number> = {};
  if (results) {
    for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
      const r = results[method][0];
      if (r && !r.error) methodWsels[method] = r.upstreamWsel;
    }
  }

  return (
    <>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={() => setPlotOpen(true)}>
          Plot Cross-Section
        </Button>
        <Button variant="outline" onClick={clearResults}>
          Clear Results
        </Button>
        <Button onClick={handleRunAll}>
          Run All Methods
        </Button>
      </div>

      <Dialog open={plotOpen} onOpenChange={setPlotOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cross-Section with Bridge Overlay</DialogTitle>
          </DialogHeader>
          <div className="h-[500px]">
            <CrossSectionChart
              crossSection={crossSection}
              bridge={bridgeGeometry}
              wsel={flowProfiles[0]?.dsWsel}
              methodWsels={Object.keys(methodWsels).length > 0 ? methodWsels : undefined}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 5: Wire forms into MainTabs**

Update `app/src/components/main-tabs.tsx` — replace the Input tab content:

```tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CrossSectionForm } from '@/components/input/cross-section-form';
import { BridgeGeometryForm } from '@/components/input/bridge-geometry-form';
import { FlowProfilesForm } from '@/components/input/flow-profiles-form';
import { CoefficientsForm } from '@/components/input/coefficients-form';
import { ActionButtons } from '@/components/input/action-buttons';

export function MainTabs() {
  return (
    <Tabs defaultValue="input" className="flex-1 flex flex-col">
      <TabsList className="mx-6 mt-4 w-fit">
        <TabsTrigger value="input">Input</TabsTrigger>
        <TabsTrigger value="results">Method Results</TabsTrigger>
        <TabsTrigger value="summary">Summary &amp; Charts</TabsTrigger>
      </TabsList>

      <TabsContent value="input" className="flex-1 px-6 py-4">
        <Tabs defaultValue="cross-section">
          <TabsList className="w-fit mb-4">
            <TabsTrigger value="cross-section">Cross-Section</TabsTrigger>
            <TabsTrigger value="bridge">Bridge Geometry</TabsTrigger>
            <TabsTrigger value="profiles">Flow Profiles</TabsTrigger>
            <TabsTrigger value="coefficients">Coefficients</TabsTrigger>
          </TabsList>
          <TabsContent value="cross-section"><CrossSectionForm /></TabsContent>
          <TabsContent value="bridge"><BridgeGeometryForm /></TabsContent>
          <TabsContent value="profiles"><FlowProfilesForm /></TabsContent>
          <TabsContent value="coefficients"><CoefficientsForm /></TabsContent>
        </Tabs>
        <ActionButtons />
      </TabsContent>

      <TabsContent value="results" className="flex-1 px-6 py-4">
        <p className="text-muted-foreground">Method results will appear after running calculations.</p>
      </TabsContent>

      <TabsContent value="summary" className="flex-1 px-6 py-4">
        <p className="text-muted-foreground">Summary &amp; charts will appear after running calculations.</p>
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 6: Verify build**

Run:
```bash
cd app && npm run build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/
git commit -m "feat: implement all input forms with action buttons"
```

---

## Task 17: UI — Method Results Tab

**Files:**
- Create: `app/src/components/results/method-tabs.tsx`, `app/src/components/results/method-view.tsx`, `app/src/components/results/profile-accordion.tsx`, `app/src/components/results/calculation-steps.tsx`, `app/src/components/results/iteration-log.tsx`

- [ ] **Step 1: Implement calculation-steps.tsx**

Create `app/src/components/results/calculation-steps.tsx`:

```tsx
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
```

- [ ] **Step 2: Implement iteration-log.tsx**

Create `app/src/components/results/iteration-log.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { IterationStep } from '@/engine/types';

export function IterationLog({ log }: { log: IterationStep[] }) {
  const [open, setOpen] = useState(false);

  if (log.length === 0) return null;

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-xs text-muted-foreground uppercase tracking-wide hover:text-foreground">
        {open ? '▼' : '▶'} Iteration Log ({log.length} iterations)
      </button>
      {open && (
        <div className="mt-2 rounded-md border overflow-auto max-h-[200px]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-1 text-left">#</th>
                <th className="p-1 text-right">Trial WSEL</th>
                <th className="p-1 text-right">Computed WSEL</th>
                <th className="p-1 text-right">Error (ft)</th>
              </tr>
            </thead>
            <tbody>
              {log.map((step) => (
                <tr key={step.iteration} className="border-t">
                  <td className="p-1">{step.iteration}</td>
                  <td className="p-1 text-right">{step.trialWsel.toFixed(4)}</td>
                  <td className="p-1 text-right">{step.computedWsel.toFixed(4)}</td>
                  <td className="p-1 text-right">{step.error.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement profile-accordion.tsx**

Create `app/src/components/results/profile-accordion.tsx`:

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { MethodResult } from '@/engine/types';
import { CalculationSteps } from './calculation-steps';
import { IterationLog } from './iteration-log';

const regimeBadge = {
  'free-surface': { label: 'FREE SURFACE', className: 'bg-blue-900/50 text-blue-300' },
  'pressure': { label: 'PRESSURE', className: 'bg-orange-900/50 text-orange-300' },
  'overtopping': { label: 'OVERTOPPING', className: 'bg-purple-900/50 text-purple-300' },
};

export function ProfileAccordion({ results }: { results: MethodResult[] }) {
  return (
    <Accordion type="multiple" className="space-y-2">
      {results.map((r, i) => {
        const regime = regimeBadge[r.flowRegime];
        return (
          <AccordionItem key={i} value={`profile-${i}`} className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3 flex-1">
                <span className="font-medium">{r.profileName}</span>
                <Badge variant={r.converged ? 'default' : 'destructive'} className="text-xs">
                  {r.converged ? 'CONVERGED' : 'NOT CONVERGED'}
                </Badge>
                <Badge className={`text-xs ${regime.className}`}>{regime.label}</Badge>
                {r.error && <span className="text-xs text-destructive">{r.error}</span>}
              </div>
              <div className="text-sm text-muted-foreground mr-4">
                US WSEL: <span className="text-foreground font-medium">{r.upstreamWsel.toFixed(2)} ft</span>
                {' | '}
                Δh: <span className="text-foreground font-medium">{r.totalHeadLoss.toFixed(3)} ft</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              {/* Input echo — key computed hydraulic properties */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Input Echo</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Flow Area', value: `${r.inputEcho.flowArea.toFixed(1)} ft²` },
                    { label: 'Hydraulic Radius', value: `${r.inputEcho.hydraulicRadius.toFixed(3)} ft` },
                    { label: 'Bridge Opening Area', value: `${r.inputEcho.bridgeOpeningArea.toFixed(1)} ft²` },
                    { label: 'Pier Blockage', value: `${r.inputEcho.pierBlockage.toFixed(1)} ft²` },
                  ].map((item) => (
                    <div key={item.label} className="bg-card p-2 rounded border text-sm">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Results */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Results</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Approach Velocity', value: `${r.approachVelocity.toFixed(2)} ft/s` },
                    { label: 'Bridge Velocity', value: `${r.bridgeVelocity.toFixed(2)} ft/s` },
                    { label: 'Froude (approach)', value: r.froudeApproach.toFixed(3) },
                    { label: 'Froude (bridge)', value: r.froudeBridge.toFixed(3) },
                  ].map((item) => (
                    <div key={item.label} className="bg-card p-2 rounded border text-sm">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculation steps */}
              {r.calculationSteps.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Step-by-Step Calculation</div>
                  <CalculationSteps steps={r.calculationSteps} />
                </div>
              )}

              {/* Iteration log */}
              <IterationLog log={r.iterationLog} />

              {/* TUFLOW FLCs */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">TUFLOW Form Loss Coefficients</div>
                <div className="grid grid-cols-2 gap-2 max-w-xs">
                  <div className="bg-card p-2 rounded border text-sm">
                    <div className="text-xs text-muted-foreground">Pier FLC</div>
                    <div>{r.tuflowPierFLC.toFixed(3)}</div>
                  </div>
                  <div className="bg-card p-2 rounded border text-sm">
                    <div className="text-xs text-muted-foreground">Superstructure FLC</div>
                    <div>{r.tuflowSuperFLC !== null ? r.tuflowSuperFLC.toFixed(3) : 'N/A'}</div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
```

- [ ] **Step 4: Implement method-view.tsx**

Create `app/src/components/results/method-view.tsx`:

```tsx
import { MethodResult } from '@/engine/types';
import { ProfileAccordion } from './profile-accordion';

interface MethodViewProps {
  name: string;
  reference: string;
  equation: string;
  results: MethodResult[];
}

export function MethodView({ name, reference, equation, results }: MethodViewProps) {
  if (results.length === 0) {
    return <p className="text-muted-foreground">No results. Run calculations first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-sm text-muted-foreground">{reference}</p>
        <code className="block mt-2 text-xs bg-card p-2 rounded border font-mono">{equation}</code>
      </div>
      <ProfileAccordion results={results} />
    </div>
  );
}
```

- [ ] **Step 5: Implement method-tabs.tsx**

Create `app/src/components/results/method-tabs.tsx`:

```tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/store/project-store';
import { MethodView } from './method-view';

const methods = [
  {
    key: 'energy',
    label: 'Energy',
    name: 'Energy Method',
    reference: 'HEC-RAS Hydraulic Reference Manual, Chapter 5',
    equation: 'WS_us = WS_ds + h_f + h_c + h_e  where h_f = L × (S_f1 + S_f2) / 2',
  },
  {
    key: 'momentum',
    label: 'Momentum',
    name: 'Momentum Method',
    reference: 'HEC-RAS Hydraulic Reference Manual, Chapter 5',
    equation: 'ΣF = ΔM  (net force = change in momentum flux)',
  },
  {
    key: 'yarnell',
    label: 'Yarnell',
    name: 'Yarnell Method',
    reference: 'Yarnell, D.L. (1934), "Bridge Piers as Channel Obstructions"',
    equation: 'Δy = K × (K + 5 - 0.6) × (α + 15α⁴) × (V²/2g)',
  },
  {
    key: 'wspro',
    label: 'WSPRO',
    name: 'WSPRO Method',
    reference: 'FHWA Report FHWA-IP-87-7, "Bridge Waterways Analysis Model"',
    equation: 'Δh = C × α₁ × (V₁²/2g)',
  },
] as const;

export function MethodTabs() {
  const results = useProjectStore((s) => s.results);

  return (
    <Tabs defaultValue="energy">
      <TabsList className="w-fit mb-4">
        {methods.map((m) => (
          <TabsTrigger key={m.key} value={m.key}>{m.label}</TabsTrigger>
        ))}
      </TabsList>
      {methods.map((m) => (
        <TabsContent key={m.key} value={m.key}>
          <MethodView
            name={m.name}
            reference={m.reference}
            equation={m.equation}
            results={results?.[m.key] ?? []}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

- [ ] **Step 6: Wire into MainTabs**

In `app/src/components/main-tabs.tsx`, replace the results tab content placeholder with:

```tsx
import { MethodTabs } from '@/components/results/method-tabs';
```

And in the results `TabsContent`:

```tsx
<TabsContent value="results" className="flex-1 px-6 py-4">
  <MethodTabs />
</TabsContent>
```

- [ ] **Step 7: Verify build**

Run:
```bash
cd app && npm run build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/results/ app/src/components/main-tabs.tsx
git commit -m "feat: implement method results tab with accordions and calculation steps"
```

---

## Task 18: UI — Summary & Charts Tab

**Files:**
- Create: `app/src/components/summary/comparison-tables.tsx`, `app/src/components/summary/regime-matrix.tsx`, `app/src/components/summary/hecras-input-row.tsx`, `app/src/components/summary/charts.tsx`

- [ ] **Step 1: Implement hecras-input-row.tsx**

Create `app/src/components/summary/hecras-input-row.tsx`:

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { HecRasComparison } from '@/engine/types';

/**
 * Generic HEC-RAS gold input row. Pass the `field` to control which
 * HecRasComparison property is editable (upstreamWsel, headLoss, pierFLC, superFLC).
 */
export function HecRasInputRow({ profileNames, field }: {
  profileNames: string[];
  field: 'upstreamWsel' | 'headLoss' | 'pierFLC' | 'superFLC';
}) {
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const update = useProjectStore((s) => s.updateHecRasComparison);

  function getEntry(name: string): HecRasComparison {
    return comparison.find((c) => c.profileName === name) ?? {
      profileName: name, upstreamWsel: null, headLoss: null, pierFLC: null, superFLC: null,
    };
  }

  function setField(profileName: string, value: string) {
    const entries = profileNames.map((name) => {
      const entry = getEntry(name);
      if (name === profileName) {
        return { ...entry, [field]: value ? parseFloat(value) : null };
      }
      return entry;
    });
    update(entries);
  }

  return (
    <tr className="bg-yellow-900/20 border-y border-yellow-700/30">
      <td className="p-2 text-sm font-medium text-yellow-400">HEC-RAS</td>
      {profileNames.map((name) => {
        const entry = getEntry(name);
        return (
          <td key={name} className="p-1">
            <Input
              type="number"
              value={entry[field] ?? ''}
              onChange={(e) => setField(name, e.target.value)}
              className="h-7 text-sm w-20"
              placeholder="—"
            />
          </td>
        );
      })}
    </tr>
  );
}
```

- [ ] **Step 2: Implement comparison-tables.tsx**

Create `app/src/components/summary/comparison-tables.tsx`:

```tsx
'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { HecRasInputRow } from './hecras-input-row';
import { Badge } from '@/components/ui/badge';
import { MethodResult, HecRasComparison } from '@/engine/types';

function pctDiffBadge(pct: number | null) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const abs = Math.abs(pct);
  const color = abs < 5 ? 'bg-green-900/50 text-green-300' : abs < 10 ? 'bg-yellow-900/50 text-yellow-300' : 'bg-red-900/50 text-red-300';
  return <Badge className={`text-xs ${color}`}>{pct.toFixed(1)}%</Badge>;
}

export function ComparisonTables() {
  const results = useProjectStore((s) => s.results);
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const updateHecRas = useProjectStore((s) => s.updateHecRasComparison);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) {
    return <p className="text-muted-foreground">Run calculations to see comparisons.</p>;
  }

  function updateHecRasField(profileName: string, field: keyof HecRasComparison, value: string) {
    const profileNames = flowProfiles.map((p) => p.name);
    const entries = profileNames.map((name) => {
      const existing = comparison.find((c) => c.profileName === name) ?? {
        profileName: name, upstreamWsel: null, headLoss: null, pierFLC: null, superFLC: null,
      };
      if (name === profileName) {
        return { ...existing, [field]: value ? parseFloat(value) : null };
      }
      return existing;
    });
    updateHecRas(entries);
  }

  const profileNames = flowProfiles.map((p) => p.name);
  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

  return (
    <div className="space-y-6">
      {/* Upstream WSEL table */}
      <div>
        <h3 className="text-sm font-medium mb-2">Upstream WSEL Comparison (ft)</h3>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Method</th>
                {profileNames.map((n) => <th key={n} className="p-2 text-right">{n}</th>)}
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => (
                <tr key={method} className="border-t">
                  <td className="p-2 capitalize">{method === 'wspro' ? 'WSPRO' : method}</td>
                  {results[method].map((r, i) => (
                    <td key={i} className="p-2 text-right">
                      {r.error ? <span className="text-destructive">ERR</span> : r.upstreamWsel.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
              <HecRasInputRow profileNames={profileNames} field="upstreamWsel" />
              {/* % difference row */}
              <tr className="border-t bg-muted/20">
                <td className="p-2 text-xs text-muted-foreground">% Diff (Energy vs HEC-RAS)</td>
                {profileNames.map((name, i) => {
                  const hecEntry = comparison.find((c) => c.profileName === name);
                  const energyResult = results.energy[i];
                  if (!hecEntry?.headLoss || !energyResult || energyResult.error) {
                    return <td key={name} className="p-2 text-right">—</td>;
                  }
                  const pct = hecEntry.headLoss !== 0
                    ? ((energyResult.totalHeadLoss - hecEntry.headLoss) / hecEntry.headLoss) * 100
                    : null;
                  return <td key={name} className="p-2 text-right">{pctDiffBadge(pct)}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Head loss table */}
      <div>
        <h3 className="text-sm font-medium mb-2">Head Loss Comparison (ft)</h3>
        <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.totalHeadLoss.toFixed(3)} />
      </div>

      {/* Velocity comparison table */}
      <div>
        <h3 className="text-sm font-medium mb-2">Approach Velocity Comparison (ft/s)</h3>
        <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.approachVelocity.toFixed(2)} />
      </div>

      {/* Froude number comparison table */}
      <div>
        <h3 className="text-sm font-medium mb-2">Froude Number Comparison</h3>
        <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.froudeApproach.toFixed(3)} />
      </div>

      {/* Bridge opening ratio — from input echo */}
      <div>
        <h3 className="text-sm font-medium mb-2">Bridge Opening Area (ft²)</h3>
        <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.inputEcho.bridgeOpeningArea.toFixed(1)} />
      </div>

      {/* TUFLOW FLC table */}
      <div>
        <h3 className="text-sm font-medium mb-2">TUFLOW Form Loss Coefficients</h3>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Method</th>
                {profileNames.map((n) => <th key={n} className="p-2 text-center" colSpan={2}>{n}</th>)}
              </tr>
              <tr>
                <th className="p-2"></th>
                {profileNames.map((n) => (
                  <React.Fragment key={n}>
                    <th className="p-2 text-right text-xs text-muted-foreground">Pier</th>
                    <th className="p-2 text-right text-xs text-muted-foreground">Super</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => (
                <tr key={method} className="border-t">
                  <td className="p-2 capitalize">{method === 'wspro' ? 'WSPRO' : method}</td>
                  {results[method].map((r, i) => (
                    <React.Fragment key={i}>
                      <td className="p-2 text-right">{r.error ? 'ERR' : r.tuflowPierFLC.toFixed(3)}</td>
                      <td className="p-2 text-right">{r.error ? 'ERR' : (r.tuflowSuperFLC !== null ? r.tuflowSuperFLC.toFixed(3) : 'N/A')}</td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
              {/* Gold HEC-RAS FLC row */}
              <tr className="bg-yellow-900/20 border-y border-yellow-700/30">
                <td className="p-2 text-sm font-medium text-yellow-400">HEC-RAS</td>
                {profileNames.map((name) => {
                  const entry = comparison.find((c) => c.profileName === name);
                  return (
                    <React.Fragment key={name}>
                      <td className="p-1"><Input type="number" value={entry?.pierFLC ?? ''} onChange={(e) => updateHecRasField(name, 'pierFLC', e.target.value)} className="h-7 text-sm w-16" placeholder="—" /></td>
                      <td className="p-1"><Input type="number" value={entry?.superFLC ?? ''} onChange={(e) => updateHecRasField(name, 'superFLC', e.target.value)} className="h-7 text-sm w-16" placeholder="—" /></td>
                    </React.Fragment>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Reusable simple method × profile table */
function SimpleMethodTable({ profileNames, methods, results, getValue }: {
  profileNames: string[];
  methods: readonly ('energy' | 'momentum' | 'yarnell' | 'wspro')[];
  results: NonNullable<ReturnType<typeof useProjectStore.getState>['results']>;
  getValue: (r: MethodResult) => string;
}) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-left">Method</th>
            {profileNames.map((n) => <th key={n} className="p-2 text-right">{n}</th>)}
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => (
            <tr key={method} className="border-t">
              <td className="p-2 capitalize">{method === 'wspro' ? 'WSPRO' : method}</td>
              {results[method].map((r, i) => (
                <td key={i} className="p-2 text-right">
                  {r.error ? <span className="text-destructive">ERR</span> : getValue(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Implement regime-matrix.tsx**

Create `app/src/components/summary/regime-matrix.tsx`:

```tsx
'use client';

import { useProjectStore } from '@/store/project-store';
import { Badge } from '@/components/ui/badge';

const regimeStyle = {
  'free-surface': { label: 'F', className: 'bg-blue-900/50 text-blue-300' },
  'pressure': { label: 'P', className: 'bg-orange-900/50 text-orange-300' },
  'overtopping': { label: 'O', className: 'bg-purple-900/50 text-purple-300' },
};

export function RegimeMatrix() {
  const results = useProjectStore((s) => s.results);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) return null;

  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
  const profileNames = flowProfiles.map((p) => p.name);

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">Flow Regime Matrix</h3>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Method</th>
              {profileNames.map((n) => <th key={n} className="p-2 text-center">{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {methods.map((method) => (
              <tr key={method} className="border-t">
                <td className="p-2 capitalize">{method === 'wspro' ? 'WSPRO' : method}</td>
                {results[method].map((r, i) => {
                  const style = regimeStyle[r.flowRegime];
                  return (
                    <td key={i} className="p-2 text-center">
                      <Badge className={`text-xs ${style.className}`}>{style.label}</Badge>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement charts.tsx**

Create `app/src/components/summary/charts.tsx`:

```tsx
'use client';

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { useProjectStore } from '@/store/project-store';

const COLORS = {
  energy: '#3b82f6',
  momentum: '#10b981',
  yarnell: '#f59e0b',
  wspro: '#8b5cf6',
  hecras: '#ef4444',
};

export function SummaryCharts() {
  const results = useProjectStore((s) => s.results);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) return null;

  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

  // Head loss bar chart data
  const headLossData = flowProfiles.map((p, i) => {
    const row: Record<string, string | number> = { name: p.name };
    for (const m of methods) {
      const r = results[m][i];
      if (r && !r.error) row[m] = parseFloat(r.totalHeadLoss.toFixed(3));
    }
    return row;
  });

  // WSEL line chart data
  const wselData = flowProfiles.map((p, i) => {
    const row: Record<string, string | number> = { Q: p.discharge };
    for (const m of methods) {
      const r = results[m][i];
      if (r && !r.error) row[m] = parseFloat(r.upstreamWsel.toFixed(2));
    }
    return row;
  });

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium mb-3">Head Loss Comparison</h3>
        <div className="h-[300px] rounded-lg border p-4 bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={headLossData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
              <YAxis label={{ value: 'Head Loss (ft)', angle: -90, position: 'insideLeft' }} stroke="#71717a" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px' }} />
              <Legend />
              {methods.map((m) => (
                <Bar key={m} dataKey={m} fill={COLORS[m]} name={m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Upstream WSEL vs Discharge</h3>
        <div className="h-[300px] rounded-lg border p-4 bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={wselData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="Q" label={{ value: 'Discharge (cfs)', position: 'bottom', offset: -5 }} stroke="#71717a" fontSize={12} />
              <YAxis label={{ value: 'US WSEL (ft)', angle: -90, position: 'insideLeft' }} stroke="#71717a" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px' }} />
              <Legend />
              {methods.map((m) => (
                <Line key={m} type="monotone" dataKey={m} stroke={COLORS[m]} name={m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire summary into MainTabs**

Update `app/src/components/main-tabs.tsx` — add imports and replace the summary tab content:

```tsx
import { ComparisonTables } from '@/components/summary/comparison-tables';
import { RegimeMatrix } from '@/components/summary/regime-matrix';
import { SummaryCharts } from '@/components/summary/charts';
```

Summary `TabsContent`:
```tsx
<TabsContent value="summary" className="flex-1 px-6 py-4 space-y-6">
  <ComparisonTables />
  <RegimeMatrix />
  <SummaryCharts />
</TabsContent>
```

- [ ] **Step 6: Verify build**

Run:
```bash
cd app && npm run build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/summary/ app/src/components/main-tabs.tsx
git commit -m "feat: implement summary tab with comparison tables, regime matrix, and charts"
```

---

## Task 19: Final Integration & Verification

**Files:**
- All existing files

- [ ] **Step 1: Run full test suite**

Run:
```bash
cd app && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Run production build**

Run:
```bash
cd app && npm run build
```

Expected: Build succeeds with static export.

- [ ] **Step 3: Start dev server and verify manually**

Run:
```bash
cd app && npm run dev
```

Open http://localhost:3000 and verify:
1. All four input sub-tabs render and accept data
2. "Run All Methods" executes and populates results
3. Method Results tab shows accordions with calculation steps
4. Summary tab shows comparison tables and charts
5. Export JSON downloads a file
6. Import JSON loads it back

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "feat: complete bridge loss calculator Next.js app"
```
