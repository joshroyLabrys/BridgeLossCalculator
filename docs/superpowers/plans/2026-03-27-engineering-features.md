# Engineering Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 engineering features (ARI labels, debris blockage, Manning's n sensitivity, freeboard check, afflux rating curve, PDF report) to the Bridge Loss Calculator without increasing input complexity.

**Architecture:** Features 1-3 modify types/engine/inputs. Features 4-5 are pure display components consuming existing results. Feature 6 is an independent print-optimized view. Tasks 1-3 are sequential (type changes cascade). Tasks 4-5 can be parallelized after Task 3. Task 6 depends on Tasks 4-5 existing.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, D3 (for charts), Tailwind CSS 4, ShadCN

---

## Parallelization Map

```
Task 1 (types) → Task 2 (engine: blockage) → Task 3 (engine: sensitivity)
                                                      ↓
                                            ┌─────────┼─────────┐
                                            ↓         ↓         ↓
                                         Task 4    Task 5    Task 6
                                        (UI:inputs)(freeboard)(afflux)
                                            ↓         ↓         ↓
                                            └─────────┼─────────┘
                                                      ↓
                                                   Task 7
                                                (store+wiring)
                                                      ↓
                                                   Task 8
                                                  (PDF report)
```

Tasks 4, 5, 6 can run in parallel. Task 7 wires everything together. Task 8 depends on all others.

---

### Task 1: Update Types

**Files:**
- Modify: `app/src/engine/types.ts`

- [ ] **Step 1: Add `ari` to FlowProfile, blockage + sensitivity to Coefficients**

```typescript
// In engine/types.ts, update FlowProfile:
export interface FlowProfile {
  name: string;
  ari: string;              // NEW — e.g. "1% AEP", "Q100", "PMF"
  discharge: number;
  dsWsel: number;
  channelSlope: number;
  contractionLength: number;
  expansionLength: number;
}

// Update Coefficients:
export interface Coefficients {
  contractionCoeff: number;
  expansionCoeff: number;
  yarnellK: number | null;
  maxIterations: number;
  tolerance: number;
  initialGuessOffset: number;
  debrisBlockagePct: number;       // NEW — 0-100, default 0
  manningsNSensitivity: boolean;   // NEW — default false
  manningsNSensitivityPct: number; // NEW — default 20 (meaning ±20%)
  methodsToRun: {
    energy: boolean;
    momentum: boolean;
    yarnell: boolean;
    wspro: boolean;
  };
}

// Add new interfaces at the bottom of the file:
export interface FreeboardResult {
  profileName: string;
  ari: string;
  discharge: number;
  dsWsel: number;
  usWsel: number;
  lowChord: number;
  freeboard: number;
  status: 'clear' | 'low' | 'pressure' | 'overtopping';
}

export interface FreeboardSummary {
  profiles: FreeboardResult[];
  zeroFreeboardQ: number | null; // interpolated Q where freeboard = 0, null if can't determine
}

export interface SensitivityResults {
  low: CalculationResults;
  high: CalculationResults;
}
```

- [ ] **Step 2: Update store default coefficients**

In `app/src/store/project-store.ts`, update `defaultCoefficients`:

```typescript
const defaultCoefficients: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  debrisBlockagePct: 0,          // NEW
  manningsNSensitivity: false,   // NEW
  manningsNSensitivityPct: 20,   // NEW
  methodsToRun: {
    energy: true,
    momentum: true,
    yarnell: true,
    wspro: true,
  },
};
```

Also update the `ProjectStore` interface and `initialState` to add:
```typescript
// In ProjectStore interface:
sensitivityResults: SensitivityResults | null;
projectName: string;
setSensitivityResults: (results: SensitivityResults | null) => void;
setProjectName: (name: string) => void;

// In initialState:
sensitivityResults: null as SensitivityResults | null,
projectName: '' as string,

// In create callback, add:
setSensitivityResults: (results) => set({ sensitivityResults: results }),
setProjectName: (name) => set({ projectName: name }),
```

Update `addProfile` default in `flow-profiles-form.tsx` to include `ari: ''`.

- [ ] **Step 3: Verify build passes**

Run: `cd app && npm run build`
Expected: Build may fail on components still using old FlowProfile without `ari` — that's OK, we fix in Task 4.

- [ ] **Step 4: Fix any build errors from missing `ari` field**

Any place that constructs a `FlowProfile` literal needs `ari: ''` added. Check:
- `app/src/components/input/flow-profiles-form.tsx` — `addProfile()` function
- `app/src/lib/json-io.ts` — deserialization (add default `ari: ''` if missing)
- `app/src/lib/test-bridges.ts` — test bridge data (add `ari` to each profile)

- [ ] **Step 5: Verify build passes clean**

Run: `cd app && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/src/engine/types.ts app/src/store/project-store.ts app/src/components/input/flow-profiles-form.tsx app/src/lib/json-io.ts app/src/lib/test-bridges.ts
git commit -m "feat: add ARI, debris blockage, sensitivity types and store fields"
```

---

### Task 2: Engine — Debris Blockage

**Files:**
- Modify: `app/src/engine/bridge-geometry.ts`
- Modify: `app/src/engine/index.ts`

- [ ] **Step 1: Add `debrisBlockagePct` parameter to `calcNetBridgeArea`**

In `app/src/engine/bridge-geometry.ts`, update the `calcNetBridgeArea` function signature and body:

```typescript
export function calcNetBridgeArea(
  bridge: BridgeGeometry,
  crossSection: CrossSectionPoint[],
  wsel: number,
  debrisBlockagePct: number = 0   // NEW parameter, default 0 for backwards compatibility
): number {
  const gross = calcBridgeOpeningArea(bridge, crossSection, wsel);
  const pierBlock = calcPierBlockage(bridge.piers, crossSection, wsel);
  let net = gross - pierBlock;

  // Apply debris blockage to remaining (non-pier) area
  if (debrisBlockagePct > 0) {
    net *= (1 - debrisBlockagePct / 100);
  }

  // Skew correction
  if (bridge.skewAngle !== 0) {
    const skewRad = (bridge.skewAngle * Math.PI) / 180;
    net *= Math.cos(skewRad);
  }

  return Math.max(0, net);
}
```

- [ ] **Step 2: Pass `debrisBlockagePct` through from each method**

Each method file calls `calcNetBridgeArea(bridge, crossSection, wsel)`. They all receive `coefficients` as a parameter. Update each call site to pass the blockage:

In `app/src/engine/methods/energy.ts`, find:
```typescript
const bridgeArea = calcNetBridgeArea(bridge, crossSection, dsWsel);
```
Replace with:
```typescript
const bridgeArea = calcNetBridgeArea(bridge, crossSection, dsWsel, coefficients.debrisBlockagePct);
```

Do the same in:
- `app/src/engine/methods/momentum.ts` — the `calcNetBridgeArea` call
- `app/src/engine/methods/yarnell.ts` — the `calcNetBridgeArea` call (note: yarnell calls it in the return statement's `inputEcho`)
- `app/src/engine/methods/wspro.ts` — the `calcNetBridgeArea` call

For yarnell and wspro which call `calcNetBridgeArea` inside `inputEcho`, pass `coefficients.debrisBlockagePct` there too.

- [ ] **Step 3: Verify build passes**

Run: `cd app && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/src/engine/bridge-geometry.ts app/src/engine/methods/energy.ts app/src/engine/methods/momentum.ts app/src/engine/methods/yarnell.ts app/src/engine/methods/wspro.ts
git commit -m "feat: apply debris blockage percentage to bridge opening area"
```

---

### Task 3: Engine — Manning's n Sensitivity

**Files:**
- Modify: `app/src/engine/index.ts`

- [ ] **Step 1: Add `runWithSensitivity` function**

Add to `app/src/engine/index.ts`:

```typescript
import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  CalculationResults,
  SensitivityResults,
} from './types';

// ... existing imports and runAllMethods ...

/**
 * Runs all methods with Manning's n scaled by ± the sensitivity percentage.
 * Returns low (n reduced) and high (n increased) result sets.
 */
export function runWithSensitivity(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  coefficients: Coefficients
): SensitivityResults {
  const pct = coefficients.manningsNSensitivityPct / 100;

  const scaledLow = crossSection.map(p => ({
    ...p,
    manningsN: p.manningsN * (1 - pct),
  }));

  const scaledHigh = crossSection.map(p => ({
    ...p,
    manningsN: p.manningsN * (1 + pct),
  }));

  return {
    low: runAllMethods(scaledLow, bridge, profiles, coefficients),
    high: runAllMethods(scaledHigh, bridge, profiles, coefficients),
  };
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd app && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/engine/index.ts
git commit -m "feat: add Manning's n sensitivity engine function"
```

---

### Task 4: UI — Input Forms (ARI column, debris blockage, sensitivity inputs)

**Files:**
- Modify: `app/src/components/input/flow-profiles-form.tsx`
- Modify: `app/src/components/input/coefficients-form.tsx`

**Can run in parallel with Tasks 5 and 6.**

- [ ] **Step 1: Add ARI column to flow profiles table**

In `app/src/components/input/flow-profiles-form.tsx`, add `ari` to the columns array after `name`:

```typescript
  const columns = [
    { key: 'name', label: 'Name', type: 'text', unitType: null as UnitType | null },
    { key: 'ari', label: 'ARI/AEP', type: 'text', unitType: null as UnitType | null },  // NEW
    { key: 'discharge', label: `Q (${unitLabel('discharge', us)})`, type: 'number', unitType: 'discharge' as UnitType | null },
    // ... rest unchanged
  ] as const;
```

Also update `updateProfile` to handle `ari` the same as `name` (string field):
```typescript
  function updateProfile(index: number, field: keyof FlowProfile, value: string) {
    const updated = [...profiles];
    if (field === 'name' || field === 'ari') { updated[index] = { ...updated[index], [field]: value }; }
    else {
      const ut = fieldUnitType[field];
      const raw = parseFloat(value) || 0;
      updated[index] = { ...updated[index], [field]: ut ? toImperial(raw, ut, us) : raw };
    }
    update(updated);
  }
```

Add `ari: null` to `fieldUnitType`:
```typescript
  const fieldUnitType: Record<string, UnitType | null> = {
    name: null, ari: null, discharge: 'discharge', dsWsel: 'length',
    channelSlope: 'slope', contractionLength: 'length', expansionLength: 'length',
  };
```

And update `addProfile` to include `ari`:
```typescript
  function addProfile() {
    update([...profiles, { name: '', ari: '', discharge: 0, dsWsel: 0, channelSlope: 0.001, contractionLength: 0, expansionLength: 0 }]);
  }
```

- [ ] **Step 2: Add debris blockage and sensitivity sections to coefficients form**

In `app/src/components/input/coefficients-form.tsx`, add two new sections before the "Methods to Run" section:

After the "Iteration Settings" `</div>`, add:

```tsx
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Debris Blockage</div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Opening Blockage (%)</Label>
            <Input type="number" value={coefficients.debrisBlockagePct} onChange={(e) => setField('debrisBlockagePct', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} className="h-8 text-sm font-mono w-32" step="5" min="0" max="100" placeholder="0" />
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Manning's n Sensitivity</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={coefficients.manningsNSensitivity} onCheckedChange={() => update({ ...coefficients, manningsNSensitivity: !coefficients.manningsNSensitivity })} />
              <Label className="text-sm">Run sensitivity analysis</Label>
            </div>
            {coefficients.manningsNSensitivity && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Variation (±%)</Label>
                <Input type="number" value={coefficients.manningsNSensitivityPct} onChange={(e) => setField('manningsNSensitivityPct', Math.max(1, parseFloat(e.target.value) || 20))} className="h-8 text-sm font-mono w-24" step="5" min="1" max="100" />
              </div>
            )}
          </div>
        </div>
```

- [ ] **Step 3: Verify build passes**

Run: `cd app && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/src/components/input/flow-profiles-form.tsx app/src/components/input/coefficients-form.tsx
git commit -m "feat: add ARI column, debris blockage input, sensitivity toggle"
```

---

### Task 5: Freeboard Check Component

**Files:**
- Create: `app/src/engine/freeboard.ts`
- Create: `app/src/components/summary/freeboard-check.tsx`

**Can run in parallel with Tasks 4 and 6.**

- [ ] **Step 1: Create freeboard engine function**

Create `app/src/engine/freeboard.ts`:

```typescript
import { BridgeGeometry, FlowProfile, CalculationResults, FreeboardResult, FreeboardSummary } from './types';
import { interpolateLowChord } from './bridge-geometry';

/**
 * Computes freeboard for each flow profile using the Energy method upstream WSEL.
 * Freeboard = low chord at channel centerline - upstream WSEL.
 */
export function computeFreeboard(
  energyResults: CalculationResults['energy'],
  bridge: BridgeGeometry,
  profiles: FlowProfile[]
): FreeboardSummary {
  const centerStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, centerStation);

  const freeboardResults: FreeboardResult[] = energyResults.map((r, i) => {
    const profile = profiles[i];
    const freeboard = lowChord - r.upstreamWsel;

    let status: FreeboardResult['status'];
    if (r.upstreamWsel >= bridge.highChord) {
      status = 'overtopping';
    } else if (freeboard <= 0) {
      status = 'pressure';
    } else if (freeboard <= 1) {
      status = 'low';
    } else {
      status = 'clear';
    }

    return {
      profileName: r.profileName,
      ari: profile?.ari ?? '',
      discharge: profile?.discharge ?? 0,
      dsWsel: profile?.dsWsel ?? 0,
      usWsel: r.upstreamWsel,
      lowChord,
      freeboard,
      status,
    };
  });

  // Interpolate Q at zero freeboard
  let zeroFreeboardQ: number | null = null;
  for (let i = 0; i < freeboardResults.length - 1; i++) {
    const a = freeboardResults[i];
    const b = freeboardResults[i + 1];
    if ((a.freeboard > 0 && b.freeboard <= 0) || (a.freeboard <= 0 && b.freeboard > 0)) {
      const t = a.freeboard / (a.freeboard - b.freeboard);
      zeroFreeboardQ = a.discharge + t * (b.discharge - a.discharge);
      break;
    }
  }

  return { profiles: freeboardResults, zeroFreeboardQ };
}
```

- [ ] **Step 2: Create freeboard check UI component**

Create `app/src/components/summary/freeboard-check.tsx`:

```tsx
'use client';

import { useProjectStore } from '@/store/project-store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { computeFreeboard } from '@/engine/freeboard';
import { unitLabel, toDisplay } from '@/lib/units';
import { ShieldCheck } from 'lucide-react';

const STATUS_STYLE = {
  clear: { label: 'CLEAR', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  low: { label: 'LOW', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  pressure: { label: 'PRESSURE', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  overtopping: { label: 'OVERTOPPING', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

export function FreeboardCheck() {
  const results = useProjectStore((s) => s.results);
  const bridge = useProjectStore((s) => s.bridgeGeometry);
  const profiles = useProjectStore((s) => s.flowProfiles);
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);
  const qUnit = unitLabel('discharge', us);

  if (!results || results.energy.length === 0) return null;

  const freeboard = computeFreeboard(results.energy, bridge, profiles);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Freeboard Check</CardTitle>
        </div>
        <CardDescription>Low chord clearance using Energy method upstream WSEL</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs">Profile</TableHead>
              <TableHead className="text-xs">ARI</TableHead>
              <TableHead className="text-xs text-right">Q ({qUnit})</TableHead>
              <TableHead className="text-xs text-right">DS WSEL ({len})</TableHead>
              <TableHead className="text-xs text-right">US WSEL ({len})</TableHead>
              <TableHead className="text-xs text-right">Low Chord ({len})</TableHead>
              <TableHead className="text-xs text-right">Freeboard ({len})</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {freeboard.profiles.map((r, i) => {
              const style = STATUS_STYLE[r.status];
              return (
                <TableRow key={i} className="even:bg-muted/20">
                  <TableCell className="font-medium">{r.profileName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.ari || '—'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.discharge, 'discharge', us).toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.dsWsel, 'length', us).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.usWsel, 'length', us).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.lowChord, 'length', us).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.freeboard, 'length', us).toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`text-xs ${style.className}`}>{style.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="text-sm text-muted-foreground">
          {freeboard.zeroFreeboardQ !== null ? (
            <span>Estimated Q at zero freeboard: <span className="font-mono font-medium text-foreground">{toDisplay(freeboard.zeroFreeboardQ, 'discharge', us).toFixed(0)} {qUnit}</span> (interpolated)</span>
          ) : freeboard.profiles.every(p => p.freeboard > 0) ? (
            <span>All profiles have positive freeboard.</span>
          ) : (
            <span>All profiles exceed low chord.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Verify build passes**

Run: `cd app && npm run build`
Expected: PASS (component not yet wired into summary tab — that's Task 7)

- [ ] **Step 4: Commit**

```bash
git add app/src/engine/freeboard.ts app/src/components/summary/freeboard-check.tsx
git commit -m "feat: add freeboard check engine function and UI component"
```

---

### Task 6: Afflux Rating Curve Charts

**Files:**
- Create: `app/src/components/summary/afflux-charts.tsx`

**Can run in parallel with Tasks 4 and 5.**

- [ ] **Step 1: Create afflux charts component**

Create `app/src/components/summary/afflux-charts.tsx`:

```tsx
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { line as d3line, area as d3area } from 'd3-shape';
import { select } from 'd3-selection';
import { min, max } from 'd3-array';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';
import { unitLabel, toDisplay } from '@/lib/units';
import { Download } from 'lucide-react';

const METHOD_COLORS: Record<string, string> = {
  energy: '#3b82f6',
  momentum: '#10b981',
  yarnell: '#f59e0b',
  wspro: '#8b5cf6',
};

const METHOD_NAMES: Record<string, string> = {
  energy: 'Energy',
  momentum: 'Momentum',
  yarnell: 'Yarnell',
  wspro: 'WSPRO',
};

const THEME = {
  grid: 'oklch(0.26 0.02 230)',
  axis: 'oklch(0.50 0.01 260)',
  accent: 'oklch(0.55 0.12 230)',
  cardBg: 'oklch(0.17 0.01 230)',
  hecras: '#ef4444',
};

function useD3Chart(
  containerRef: React.RefObject<HTMLDivElement | null>,
  drawFn: (svg: d3.Selection<SVGGElement, unknown, null, undefined>, width: number, height: number, margin: { top: number; right: number; bottom: number; left: number }) => void,
  deps: unknown[]
) {
  const draw = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    select(container).select('svg').remove();
    const rect = container.getBoundingClientRect();
    const margin = { top: 16, right: 24, bottom: 68, left: 56 };
    const width = rect.width - margin.left - margin.right;
    const height = rect.height - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) return;

    const svg = select(container)
      .append('svg')
      .attr('width', rect.width)
      .attr('height', rect.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    drawFn(svg, width, height, margin);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    draw();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);
}

function drawAxes(
  svg: d3.Selection<SVGGElement, unknown, null, undefined>,
  x: d3.ScaleLinear<number, number>,
  y: d3.ScaleLinear<number, number>,
  width: number,
  height: number,
  xLabel: string,
  yLabel: string
) {
  // Grid
  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(axisBottom(x).tickSize(-height).tickFormat(() => ''))
    .call(g => { g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3'); g.select('.domain').remove(); });
  svg.append('g')
    .call(axisLeft(y).tickSize(-width).tickFormat(() => ''))
    .call(g => { g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3'); g.select('.domain').remove(); });

  // Axes
  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(axisBottom(x).ticks(Math.max(4, Math.floor(width / 80))))
    .call(g => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11); g.selectAll('line,path').attr('stroke', THEME.grid); });
  svg.append('g')
    .call(axisLeft(y).ticks(Math.max(4, Math.floor(height / 50))))
    .call(g => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11); g.selectAll('line,path').attr('stroke', THEME.grid); });

  // Labels
  svg.append('text').attr('x', width / 2).attr('y', height + 40).attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11).text(xLabel);
  svg.append('text').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -42).attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11).text(yLabel);
}

function drawLegend(
  svg: d3.Selection<SVGGElement, unknown, null, undefined>,
  items: { label: string; color: string; dashed: boolean }[],
  width: number,
  height: number
) {
  const legendG = svg.append('g').attr('transform', `translate(${width / 2}, ${height + 56})`);
  const itemWidth = 80;
  const totalWidth = items.length * itemWidth;
  const startX = -totalWidth / 2;

  items.forEach((item, i) => {
    const g = legendG.append('g').attr('transform', `translate(${startX + i * itemWidth}, 0)`);
    if (item.dashed) {
      g.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 14).attr('y2', 0)
        .attr('stroke', item.color).attr('stroke-width', 2).attr('stroke-dasharray', '3 2');
    } else {
      g.append('rect').attr('x', 0).attr('y', -1.5).attr('width', 14).attr('height', 3).attr('fill', item.color).attr('rx', 1);
    }
    g.append('text').attr('x', 18).attr('y', 0).attr('dy', '0.35em').attr('fill', THEME.axis).attr('font-size', 10).text(item.label);
  });
}

export function AffluxCharts() {
  const results = useProjectStore((s) => s.results);
  const sensitivityResults = useProjectStore((s) => s.sensitivityResults);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const us = useProjectStore((s) => s.unitSystem);
  const qUnit = unitLabel('discharge', us);
  const lenUnit = unitLabel('length', us);

  const affluxRef = useRef<HTMLDivElement>(null);
  const wselRef = useRef<HTMLDivElement>(null);

  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

  if (!results) return null;

  // Build data
  const data = flowProfiles.map((p, i) => {
    const row: Record<string, number | undefined> = { Q: p.discharge };
    for (const m of methods) {
      const r = results[m]?.[i];
      if (r && !r.error) {
        row[`${m}_afflux`] = r.totalHeadLoss;
        row[`${m}_wsel`] = r.upstreamWsel;
      }
      if (sensitivityResults) {
        const lo = sensitivityResults.low[m]?.[i];
        const hi = sensitivityResults.high[m]?.[i];
        if (lo && !lo.error) { row[`${m}_afflux_lo`] = lo.totalHeadLoss; row[`${m}_wsel_lo`] = lo.upstreamWsel; }
        if (hi && !hi.error) { row[`${m}_afflux_hi`] = hi.totalHeadLoss; row[`${m}_wsel_hi`] = hi.upstreamWsel; }
      }
    }
    return row;
  });

  function exportCsv() {
    const headers = ['Q', 'ARI', ...methods.flatMap(m => {
      const name = METHOD_NAMES[m];
      const cols = [`${name} Afflux`, `${name} US WSEL`];
      if (sensitivityResults) { cols.push(`${name} Afflux Lo`, `${name} Afflux Hi`); }
      return cols;
    })];

    const rows = flowProfiles.map((p, i) => {
      const vals: (string | number)[] = [p.discharge, p.ari];
      for (const m of methods) {
        const r = results[m]?.[i];
        vals.push(r && !r.error ? r.totalHeadLoss.toFixed(4) : '');
        vals.push(r && !r.error ? r.upstreamWsel.toFixed(4) : '');
        if (sensitivityResults) {
          const lo = sensitivityResults.low[m]?.[i];
          const hi = sensitivityResults.high[m]?.[i];
          vals.push(lo && !lo.error ? lo.totalHeadLoss.toFixed(4) : '');
          vals.push(hi && !hi.error ? hi.totalHeadLoss.toFixed(4) : '');
        }
      }
      return vals.join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'afflux-rating-curve.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Afflux chart
  useD3Chart(affluxRef, (svg, width, height) => {
    const allQ = data.map(d => d.Q!);
    const allAfflux = data.flatMap(d => methods.map(m => d[`${m}_afflux`]).filter((v): v is number => v !== undefined));
    if (allAfflux.length === 0) return;

    const x = scaleLinear().domain([min(allQ)! * 0.95, max(allQ)! * 1.05]).range([0, width]);
    const y = scaleLinear().domain([0, max(allAfflux)! * 1.2]).range([height, 0]);

    drawAxes(svg, x, y, width, height, `Discharge (${qUnit})`, `Afflux (${lenUnit})`);

    // Sensitivity bands
    if (sensitivityResults) {
      methods.forEach(m => {
        const bandData = data.filter(d => d[`${m}_afflux_lo`] !== undefined && d[`${m}_afflux_hi`] !== undefined);
        if (bandData.length < 2) return;
        const area = d3area<typeof bandData[0]>()
          .x(d => x(d.Q!))
          .y0(d => y(d[`${m}_afflux_lo`]!))
          .y1(d => y(d[`${m}_afflux_hi`]!));
        svg.append('path').datum(bandData).attr('d', area).attr('fill', METHOD_COLORS[m]).attr('fill-opacity', 0.1);
      });
    }

    // Method lines
    methods.forEach(m => {
      const lineData = data.filter(d => d[`${m}_afflux`] !== undefined);
      if (lineData.length < 1) return;
      const line = d3line<typeof lineData[0]>().x(d => x(d.Q!)).y(d => y(d[`${m}_afflux`]!));
      svg.append('path').datum(lineData).attr('d', line).attr('fill', 'none').attr('stroke', METHOD_COLORS[m]).attr('stroke-width', 2);
      // Dots
      lineData.forEach(d => {
        svg.append('circle').attr('cx', x(d.Q!)).attr('cy', y(d[`${m}_afflux`]!)).attr('r', 4).attr('fill', METHOD_COLORS[m]);
      });
    });

    // HEC-RAS dots
    comparison.forEach(c => {
      if (c.headLoss !== null) {
        const profile = flowProfiles.find(p => p.name === c.profileName);
        if (profile) {
          svg.append('circle').attr('cx', x(profile.discharge)).attr('cy', y(c.headLoss)).attr('r', 5)
            .attr('fill', 'none').attr('stroke', THEME.hecras).attr('stroke-width', 2);
        }
      }
    });

    const legendItems = methods.map(m => ({ label: METHOD_NAMES[m], color: METHOD_COLORS[m], dashed: false }));
    if (comparison.some(c => c.headLoss !== null)) legendItems.push({ label: 'HEC-RAS', color: THEME.hecras, dashed: false });
    drawLegend(svg, legendItems, width, height);
  }, [data, sensitivityResults, comparison, qUnit, lenUnit]);

  // WSEL chart
  useD3Chart(wselRef, (svg, width, height) => {
    const allQ = data.map(d => d.Q!);
    const allWsel = data.flatMap(d => methods.map(m => d[`${m}_wsel`]).filter((v): v is number => v !== undefined));
    if (allWsel.length === 0) return;

    const x = scaleLinear().domain([min(allQ)! * 0.95, max(allQ)! * 1.05]).range([0, width]);
    const y = scaleLinear().domain([min(allWsel)! - 1, max(allWsel)! + 1]).range([height, 0]);

    drawAxes(svg, x, y, width, height, `Discharge (${qUnit})`, `US WSEL (${lenUnit})`);

    // Sensitivity bands
    if (sensitivityResults) {
      methods.forEach(m => {
        const bandData = data.filter(d => d[`${m}_wsel_lo`] !== undefined && d[`${m}_wsel_hi`] !== undefined);
        if (bandData.length < 2) return;
        const area = d3area<typeof bandData[0]>()
          .x(d => x(d.Q!))
          .y0(d => y(d[`${m}_wsel_lo`]!))
          .y1(d => y(d[`${m}_wsel_hi`]!));
        svg.append('path').datum(bandData).attr('d', area).attr('fill', METHOD_COLORS[m]).attr('fill-opacity', 0.1);
      });
    }

    // Method lines
    methods.forEach(m => {
      const lineData = data.filter(d => d[`${m}_wsel`] !== undefined);
      if (lineData.length < 1) return;
      const line = d3line<typeof lineData[0]>().x(d => x(d.Q!)).y(d => y(d[`${m}_wsel`]!));
      svg.append('path').datum(lineData).attr('d', line).attr('fill', 'none').attr('stroke', METHOD_COLORS[m]).attr('stroke-width', 2);
      lineData.forEach(d => {
        svg.append('circle').attr('cx', x(d.Q!)).attr('cy', y(d[`${m}_wsel`]!)).attr('r', 4).attr('fill', METHOD_COLORS[m]);
      });
    });

    // HEC-RAS dots
    comparison.forEach(c => {
      if (c.upstreamWsel !== null) {
        const profile = flowProfiles.find(p => p.name === c.profileName);
        if (profile) {
          svg.append('circle').attr('cx', x(profile.discharge)).attr('cy', y(c.upstreamWsel)).attr('r', 5)
            .attr('fill', 'none').attr('stroke', THEME.hecras).attr('stroke-width', 2);
        }
      }
    });

    const legendItems = methods.map(m => ({ label: METHOD_NAMES[m], color: METHOD_COLORS[m], dashed: false }));
    if (comparison.some(c => c.upstreamWsel !== null)) legendItems.push({ label: 'HEC-RAS', color: THEME.hecras, dashed: false });
    drawLegend(svg, legendItems, width, height);
  }, [data, sensitivityResults, comparison, qUnit, lenUnit]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Afflux Rating Curve</CardTitle>
          <CardDescription>Head loss by method across discharge scenarios{sensitivityResults ? ' (shaded bands show Manning\'s n sensitivity)' : ''}</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              CSV
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div ref={affluxRef} className="h-[320px] w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upstream WSEL vs Discharge</CardTitle>
          <CardDescription>Water surface elevation trend across discharge scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div ref={wselRef} className="h-[320px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd app && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/components/summary/afflux-charts.tsx
git commit -m "feat: add D3 afflux rating curve and WSEL charts with CSV export"
```

---

### Task 7: Wire Everything Together (Store, Action Buttons, Summary Tab)

**Files:**
- Modify: `app/src/components/input/action-buttons.tsx`
- Modify: `app/src/components/main-tabs.tsx` (summary tab content)
- Remove old charts: `app/src/components/summary/charts.tsx`

- [ ] **Step 1: Update action buttons to run sensitivity**

In `app/src/components/input/action-buttons.tsx`, after the `setResults(calcResults)` line, add sensitivity logic:

```typescript
import { runAllMethods, runWithSensitivity } from '@/engine/index';
// ... in the component, get store actions:
const setSensitivityResults = useProjectStore((s) => s.setSensitivityResults);
const coefficients = useProjectStore((s) => s.coefficients);

// In handleRunAll, after setResults(calcResults):
if (coefficients.manningsNSensitivity) {
  const sensResults = runWithSensitivity(crossSection, bridgeGeometry, flowProfiles, coefficients);
  setSensitivityResults(sensResults);
} else {
  setSensitivityResults(null);
}
```

Also update `clearResults` to also clear sensitivity:
```typescript
onClick={() => { clearResults(); setSensitivityResults(null); setErrors([]); }}
```

- [ ] **Step 2: Update summary tab to include new components**

In `app/src/components/main-tabs.tsx`, add imports and update the summary tab content:

```tsx
import { FreeboardCheck } from '@/components/summary/freeboard-check';
import { AffluxCharts } from '@/components/summary/afflux-charts';
// Remove: import { SummaryCharts } from '@/components/summary/charts';

// In the summary TabsContent:
<TabsContent value="summary" className="flex-1 px-6 py-5 space-y-8">
  <FreeboardCheck />
  <ComparisonTables />
  <RegimeMatrix />
  <AffluxCharts />
</TabsContent>
```

- [ ] **Step 3: Delete old charts component**

Delete `app/src/components/summary/charts.tsx` — replaced by `afflux-charts.tsx`.

- [ ] **Step 4: Verify build passes**

Run: `cd app && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/components/input/action-buttons.tsx app/src/components/main-tabs.tsx
git rm app/src/components/summary/charts.tsx
git commit -m "feat: wire sensitivity results, freeboard check, and afflux charts into app"
```

---

### Task 8: PDF Report

**Files:**
- Modify: `app/src/components/top-bar.tsx`
- Create: `app/src/components/print-report.tsx`
- Modify: `app/src/app/globals.css`
- Modify: `app/src/app/page.tsx`

- [ ] **Step 1: Add PDF export button to top bar**

In `app/src/components/top-bar.tsx`, add:

```tsx
import { FileText } from 'lucide-react';
// ... add state:
const [printOpen, setPrintOpen] = useState(false);

// Add button after Export button:
<Button variant="outline" size="sm" onClick={() => {
  document.body.classList.add('printing');
  setTimeout(() => {
    window.print();
    document.body.classList.remove('printing');
  }, 100);
}}>
  <FileText className="h-4 w-4 mr-1.5" />
  PDF
</Button>
```

Also add `useState` import.

- [ ] **Step 2: Create print report component**

Create `app/src/components/print-report.tsx`:

```tsx
'use client';

import { useProjectStore } from '@/store/project-store';
import { computeFreeboard } from '@/engine/freeboard';

export function PrintReport() {
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridge = useProjectStore((s) => s.bridgeGeometry);
  const profiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const results = useProjectStore((s) => s.results);
  const projectName = useProjectStore((s) => s.projectName);

  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
  const freeboard = results?.energy ? computeFreeboard(results.energy, bridge, profiles) : null;

  return (
    <div className="print-report hidden print:block bg-white text-black p-8 text-sm">
      {/* Cover Page */}
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
        <h1 className="text-3xl font-bold text-gray-900">Bridge Hydraulic Loss Assessment</h1>
        {projectName && <h2 className="text-xl text-gray-600 mt-2">{projectName}</h2>}
        <div className="w-24 h-0.5 bg-blue-600 my-8" />
        <p className="text-gray-500">{new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p className="text-gray-400 text-xs mt-4">Generated by Bridge Loss Calculator</p>
      </div>

      {/* Input Summary */}
      <div className="break-before-page">
        <h2 className="text-lg font-bold border-b-2 border-blue-600 pb-1 mb-4">Input Summary</h2>

        <h3 className="text-sm font-bold mt-4 mb-2">Cross-Section ({crossSection.length} points)</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1 text-left">Station (ft)</th>
              <th className="border border-gray-300 px-2 py-1 text-left">Elevation (ft)</th>
              <th className="border border-gray-300 px-2 py-1 text-left">Manning's n</th>
              <th className="border border-gray-300 px-2 py-1 text-left">Bank</th>
            </tr>
          </thead>
          <tbody>
            {crossSection.map((p, i) => (
              <tr key={i}>
                <td className="border border-gray-300 px-2 py-0.5 font-mono">{p.station.toFixed(1)}</td>
                <td className="border border-gray-300 px-2 py-0.5 font-mono">{p.elevation.toFixed(2)}</td>
                <td className="border border-gray-300 px-2 py-0.5 font-mono">{p.manningsN}</td>
                <td className="border border-gray-300 px-2 py-0.5">{p.bankStation ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="text-sm font-bold mt-4 mb-2">Bridge Geometry</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
          <div>Low Chord Left: <span className="font-mono">{bridge.lowChordLeft} ft</span></div>
          <div>Low Chord Right: <span className="font-mono">{bridge.lowChordRight} ft</span></div>
          <div>High Chord: <span className="font-mono">{bridge.highChord} ft</span></div>
          <div>Skew Angle: <span className="font-mono">{bridge.skewAngle}°</span></div>
          <div>Left Abutment: <span className="font-mono">{bridge.leftAbutmentStation} ft</span></div>
          <div>Right Abutment: <span className="font-mono">{bridge.rightAbutmentStation} ft</span></div>
          <div>Piers: <span className="font-mono">{bridge.piers.length}</span></div>
          {coefficients.debrisBlockagePct > 0 && <div>Debris Blockage: <span className="font-mono">{coefficients.debrisBlockagePct}%</span></div>}
        </div>

        <h3 className="text-sm font-bold mt-4 mb-2">Flow Profiles</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1 text-left">Name</th>
              <th className="border border-gray-300 px-2 py-1 text-left">ARI</th>
              <th className="border border-gray-300 px-2 py-1 text-right">Q (cfs)</th>
              <th className="border border-gray-300 px-2 py-1 text-right">DS WSEL (ft)</th>
              <th className="border border-gray-300 px-2 py-1 text-right">Slope</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p, i) => (
              <tr key={i}>
                <td className="border border-gray-300 px-2 py-0.5">{p.name}</td>
                <td className="border border-gray-300 px-2 py-0.5">{p.ari || '—'}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right font-mono">{p.discharge}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right font-mono">{p.dsWsel}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right font-mono">{p.channelSlope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Freeboard Check */}
      {freeboard && (
        <div className="break-before-page">
          <h2 className="text-lg font-bold border-b-2 border-blue-600 pb-1 mb-4">Freeboard Check</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1 text-left">Profile</th>
                <th className="border border-gray-300 px-2 py-1 text-right">Q (cfs)</th>
                <th className="border border-gray-300 px-2 py-1 text-right">US WSEL (ft)</th>
                <th className="border border-gray-300 px-2 py-1 text-right">Low Chord (ft)</th>
                <th className="border border-gray-300 px-2 py-1 text-right">Freeboard (ft)</th>
                <th className="border border-gray-300 px-2 py-1 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {freeboard.profiles.map((r, i) => (
                <tr key={i}>
                  <td className="border border-gray-300 px-2 py-0.5">{r.profileName}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right font-mono">{r.discharge.toFixed(0)}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right font-mono">{r.usWsel.toFixed(2)}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right font-mono">{r.lowChord.toFixed(2)}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right font-mono">{r.freeboard.toFixed(2)}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-center font-bold">{r.status.toUpperCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {freeboard.zeroFreeboardQ !== null && (
            <p className="text-xs mt-2">Estimated Q at zero freeboard: <strong>{freeboard.zeroFreeboardQ.toFixed(0)} cfs</strong> (interpolated)</p>
          )}
        </div>
      )}

      {/* Method Results */}
      {results && (
        <div className="break-before-page">
          <h2 className="text-lg font-bold border-b-2 border-blue-600 pb-1 mb-4">Method Comparison</h2>
          {(['Upstream WSEL (ft)', 'Head Loss (ft)', 'Approach Velocity (ft/s)', 'Froude Number'] as const).map((title, si) => {
            const getValue = [
              (r: typeof results.energy[0]) => r.upstreamWsel.toFixed(2),
              (r: typeof results.energy[0]) => r.totalHeadLoss.toFixed(3),
              (r: typeof results.energy[0]) => r.approachVelocity.toFixed(2),
              (r: typeof results.energy[0]) => r.froudeApproach.toFixed(3),
            ][si];
            return (
              <div key={title} className="mb-4">
                <h3 className="text-xs font-bold uppercase text-gray-500 mb-1">{title}</h3>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1 text-left">Method</th>
                      {profiles.map(p => <th key={p.name} className="border border-gray-300 px-2 py-1 text-right">{p.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {methods.map(m => (
                      <tr key={m}>
                        <td className="border border-gray-300 px-2 py-0.5 capitalize">{m === 'wspro' ? 'WSPRO' : m}</td>
                        {results[m].map((r, i) => (
                          <td key={i} className="border border-gray-300 px-2 py-0.5 text-right font-mono">{r.error ? 'ERR' : getValue(r)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-4 left-0 right-0 text-center text-xs text-gray-400 print:block hidden">
        Generated by Bridge Loss Calculator
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add print stylesheet to globals.css**

Append to `app/src/app/globals.css`:

```css
@media print {
  body {
    background: white !important;
    background-image: none !important;
  }

  /* Hide the app, show the report */
  body > div > div > .flex.flex-col.min-h-screen > *:not(.print-report) {
    display: none !important;
  }

  .print-report {
    display: block !important;
  }

  @page {
    margin: 1.5cm;
    size: A4;
  }
}
```

- [ ] **Step 4: Include PrintReport in page.tsx**

In `app/src/app/page.tsx`:

```tsx
import { TopBar } from '@/components/top-bar';
import { MainTabs } from '@/components/main-tabs';
import { PrintReport } from '@/components/print-report';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar />
      <MainTabs />
      <PrintReport />
    </div>
  );
}
```

- [ ] **Step 5: Verify build passes**

Run: `cd app && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/src/components/top-bar.tsx app/src/components/print-report.tsx app/src/app/globals.css app/src/app/page.tsx
git commit -m "feat: add PDF report export via browser print"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] ARI/AEP labels — Task 1 (types) + Task 4 (UI) + Task 5 (freeboard displays it)
- [x] Debris blockage — Task 1 (types) + Task 2 (engine) + Task 4 (UI input)
- [x] Manning's n sensitivity — Task 1 (types) + Task 3 (engine) + Task 4 (UI toggle) + Task 7 (wiring) + Task 6 (chart bands)
- [x] Freeboard check — Task 1 (types) + Task 5 (engine + UI)
- [x] Afflux rating curve — Task 6 (charts + CSV export)
- [x] PDF report — Task 8 (print layout + button)

**Type consistency:** `FreeboardResult`, `FreeboardSummary`, `SensitivityResults` defined in Task 1, consumed in Tasks 5, 6, 7, 8. `debrisBlockagePct`, `manningsNSensitivity`, `manningsNSensitivityPct` in Coefficients — used in Tasks 2, 3, 4, 7, 8. `ari` in FlowProfile — used in Tasks 4, 5, 6, 8.

**Placeholder scan:** No TBD, TODO, or vague steps found.
