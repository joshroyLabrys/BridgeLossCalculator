# FlowSuite Hydrology Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Hydrology module (`/hydro`) — a six-step wizard that takes an engineer from catchment parameters through ARR2019 design flood estimation to final design flows, with handoff to BLC.

**Architecture:** Engine calculations in `@flowsuite/engine` (packages/engine/src/hydrology/), UI in `apps/web/src/app/hydro/`, independent Zustand store. Six-step wizard with progress bar. Clark unit hydrograph with ARR2019 ensemble temporal patterns. localStorage handoff to BLC.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand 5, D3 (hydrograph charts), Leaflet (map), Vitest, @flowsuite/ui, @flowsuite/engine, @flowsuite/data

**Spec:** `docs/superpowers/specs/2026-03-29-hydrology-module-design.md`

---

## Execution Order

### Phase 1 — Engine (parallel, no UI dependencies)
- **Task 1:** Hydrology types
- **Task 2:** ARR datahub file parser
- **Task 3:** Loss model
- **Task 4:** Clark unit hydrograph
- **Task 5:** Design storm runner (orchestrator)
- **Task 6:** Flood frequency analysis (Log Pearson III)

### Phase 2 — UI (sequential, depends on engine)
- **Task 7:** Hydro store + wizard scaffold + navigation
- **Task 8:** Step 1 — Catchment
- **Task 9:** Step 2 — ARR Data
- **Task 10:** Step 3 — Losses
- **Task 11:** Step 4 — Time of Concentration
- **Task 12:** Step 5 — Design Storms + hydrograph chart
- **Task 13:** Step 6 — Design Flows + export/send

### Phase 3 — Integration
- **Task 14:** BLC import banner + landing page update

---

### Task 1: Hydrology Types

**Files:**
- Create: `packages/engine/src/hydrology/types.ts`

- [ ] **Step 1: Create hydrology-specific types**

```typescript
// packages/engine/src/hydrology/types.ts

export interface ARRSiteDetails {
  lat: number;
  lng: number;
  name: string;
}

export interface ARRIFDData {
  durations: number[];     // minutes
  aeps: string[];          // '50%', '20%', '10%', '5%', '2%', '1%'
  depths: number[][];      // [durationIdx][aepIdx] in mm
}

export interface ARRTemporalPattern {
  group: 'frequent' | 'infrequent' | 'rare';
  durationMin: number;
  patterns: number[][];    // 10 arrays of fractions, each sums to ~1.0
}

export interface ARRArealReductionFactors {
  durations: number[];
  aeps: string[];
  factors: number[][];     // [durationIdx][aepIdx]
}

export interface ARRLosses {
  initialLoss: number;     // mm (median)
  continuingLoss: number;  // mm/hr
  preBurst: {
    aep: string;
    durationMin: number;
    depth: number;         // mm
  }[];
}

export interface ARRDataHubOutput {
  siteDetails: ARRSiteDetails;
  ifd: ARRIFDData;
  temporalPatterns: ARRTemporalPattern[];
  arf: ARRArealReductionFactors;
  losses: ARRLosses;
  warnings: string[];
}

export interface DesignStormConfig {
  ifd: ARRIFDData;
  temporalPatterns: ARRTemporalPattern[];
  arf: ARRArealReductionFactors;
  losses: {
    initialLoss: number;
    continuingLoss: number;
    preBurst: ARRLosses['preBurst'];
    imperviousFraction: number;
  };
  tc: number;              // hours
  r: number;               // hours (Clark storage coefficient)
  catchmentArea: number;   // km²
  aeps: string[];
  durationRange: number[]; // durations to test (minutes)
}

export interface StormRunResult {
  aep: string;
  durationMin: number;
  patternIndex: number;
  peakQ: number;           // m³/s
  timeToPeak: number;      // hours
  runoffVolume: number;    // ML (megalitres)
  runoffCoefficient: number;
  hydrograph: { time: number; q: number }[];
}

export interface DesignStormSummary {
  aep: string;
  criticalDurationMin: number;
  medianPeakQ: number;
  minPeakQ: number;
  maxPeakQ: number;
  medianHydrograph: { time: number; q: number }[];
}

export interface DesignStormResults {
  runs: StormRunResult[];
  summary: DesignStormSummary[];
}

export interface FFAResult {
  annualMaxima: { year: number; q: number }[];
  logPearsonIII: {
    mean: number;
    stdDev: number;
    skew: number;
  };
  quantiles: { aep: string; q: number; confidenceLow: number; confidenceHigh: number }[];
}

export interface HydroFlowExport {
  projectName: string;
  catchmentArea: number;
  location: { lat: number; lng: number } | null;
  timestamp: number;
  flows: {
    aep: string;
    ari: string;
    criticalDurationMin: number;
    designQ: number;
    ensembleMin: number;
    ensembleMax: number;
  }[];
}

/** Standard ARR durations in minutes */
export const ARR_STANDARD_DURATIONS = [
  10, 15, 20, 30, 45, 60, 90, 120, 180, 270, 360, 540, 720, 1080, 1440, 2160, 2880, 4320,
] as const;

/** AEP to ARI mapping */
export const AEP_TO_ARI: Record<string, string> = {
  '50%': '2yr',
  '20%': '5yr',
  '10%': '10yr',
  '5%': '20yr',
  '2%': '50yr',
  '1%': '100yr',
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/engine && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/hydrology/types.ts
git commit -m "feat(engine): add hydrology module types"
```

---

### Task 2: ARR Datahub File Parser

**Files:**
- Create: `packages/engine/src/hydrology/arr-parser.ts`
- Test: `apps/web/src/__tests__/engine/hydrology/arr-parser.test.ts`

- [ ] **Step 1: Write tests for the ARR parser**

```typescript
// apps/web/src/__tests__/engine/hydrology/arr-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseARRDataHub } from '@flowsuite/engine/hydrology/arr-parser';

const SAMPLE_ARR_FILE = `
[Site Details]
Latitude: -27.4698
Longitude: 153.0251
Location: Brisbane CBD

[IFD Depths]
Duration,50%,20%,10%,5%,2%,1%
10min,14.2,19.8,24.5,29.1,35.6,40.8
20min,20.1,28.0,34.7,41.2,50.3,57.7
30min,24.3,33.8,41.9,49.8,60.8,69.7
60min,31.5,43.9,54.4,64.6,78.9,90.5
120min,38.2,53.2,65.9,78.3,95.6,109.6
360min,48.5,67.5,83.7,99.4,121.4,139.2

[Temporal Patterns]
AEP Group: Frequent
Duration: 60 min
Pattern 1: 0.05,0.08,0.12,0.20,0.25,0.15,0.10,0.03,0.01,0.01
Pattern 2: 0.03,0.06,0.10,0.18,0.22,0.20,0.12,0.05,0.03,0.01

[Areal Reduction Factors]
Duration,50%,20%,10%,5%,2%,1%
60min,0.950,0.940,0.935,0.930,0.920,0.915
120min,0.960,0.955,0.950,0.945,0.935,0.930

[Losses]
Storm Initial Loss (median): 25.0 mm
Continuing Loss: 2.40 mm/hr
Pre-burst (50%, 60min): 8.5 mm
Pre-burst (1%, 60min): 15.2 mm
`.trim();

describe('parseARRDataHub', () => {
  it('parses site details', () => {
    const result = parseARRDataHub(SAMPLE_ARR_FILE);
    expect(result.siteDetails.lat).toBeCloseTo(-27.4698);
    expect(result.siteDetails.lng).toBeCloseTo(153.0251);
    expect(result.siteDetails.name).toBe('Brisbane CBD');
  });

  it('parses IFD table', () => {
    const result = parseARRDataHub(SAMPLE_ARR_FILE);
    expect(result.ifd.durations).toEqual([10, 20, 30, 60, 120, 360]);
    expect(result.ifd.aeps).toEqual(['50%', '20%', '10%', '5%', '2%', '1%']);
    expect(result.ifd.depths[0][0]).toBeCloseTo(14.2); // 10min, 50%
    expect(result.ifd.depths[3][5]).toBeCloseTo(90.5); // 60min, 1%
  });

  it('parses temporal patterns', () => {
    const result = parseARRDataHub(SAMPLE_ARR_FILE);
    expect(result.temporalPatterns.length).toBeGreaterThan(0);
    const first = result.temporalPatterns[0];
    expect(first.group).toBe('frequent');
    expect(first.durationMin).toBe(60);
    expect(first.patterns.length).toBe(2);
    // Fractions should sum to approximately 1
    const sum = first.patterns[0].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('parses ARF values', () => {
    const result = parseARRDataHub(SAMPLE_ARR_FILE);
    expect(result.arf.durations).toEqual([60, 120]);
    expect(result.arf.factors[0][0]).toBeCloseTo(0.95); // 60min, 50%
  });

  it('parses loss values', () => {
    const result = parseARRDataHub(SAMPLE_ARR_FILE);
    expect(result.losses.initialLoss).toBeCloseTo(25.0);
    expect(result.losses.continuingLoss).toBeCloseTo(2.4);
    expect(result.losses.preBurst.length).toBe(2);
  });

  it('handles empty input gracefully', () => {
    const result = parseARRDataHub('');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.ifd.durations).toEqual([]);
  });

  it('handles partial file with warnings', () => {
    const partial = `[Site Details]\nLatitude: -27.47\nLongitude: 153.03\n`;
    const result = parseARRDataHub(partial);
    expect(result.siteDetails.lat).toBeCloseTo(-27.47);
    expect(result.warnings.length).toBeGreaterThan(0); // missing IFD etc.
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/__tests__/engine/hydrology/arr-parser.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the ARR parser**

```typescript
// packages/engine/src/hydrology/arr-parser.ts
import type { ARRDataHubOutput, ARRSiteDetails, ARRIFDData, ARRTemporalPattern, ARRArealReductionFactors, ARRLosses } from './types';

export function parseARRDataHub(text: string): ARRDataHubOutput {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/);

  // Find section boundaries
  const sections = new Map<string, string[]>();
  let currentSection = '';
  for (const line of lines) {
    const sectionMatch = line.match(/^\[(.+)\]\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      sections.set(currentSection, []);
    } else if (currentSection && line.trim()) {
      sections.get(currentSection)!.push(line.trim());
    }
  }

  const siteDetails = parseSiteDetails(sections.get('Site Details') ?? [], warnings);
  const ifd = parseIFD(sections.get('IFD Depths') ?? [], warnings);
  const temporalPatterns = parseTemporalPatterns(sections.get('Temporal Patterns') ?? [], warnings);
  const arf = parseARF(sections.get('Areal Reduction Factors') ?? [], warnings);
  const losses = parseLosses(sections.get('Losses') ?? [], warnings);

  if (!sections.has('IFD Depths')) warnings.push('Missing [IFD Depths] section');
  if (!sections.has('Temporal Patterns')) warnings.push('Missing [Temporal Patterns] section');
  if (!sections.has('Losses')) warnings.push('Missing [Losses] section');

  return { siteDetails, ifd, temporalPatterns, arf, losses, warnings };
}

function parseSiteDetails(lines: string[], warnings: string[]): ARRSiteDetails {
  let lat = 0, lng = 0, name = '';
  for (const line of lines) {
    const kv = line.match(/^(.+?):\s*(.+)$/);
    if (!kv) continue;
    const [, key, val] = kv;
    if (/latitude/i.test(key)) lat = parseFloat(val) || 0;
    else if (/longitude/i.test(key)) lng = parseFloat(val) || 0;
    else if (/location|name/i.test(key)) name = val;
  }
  if (lat === 0 && lng === 0) warnings.push('Could not parse site coordinates');
  return { lat, lng, name };
}

function parseIFD(lines: string[], warnings: string[]): ARRIFDData {
  if (lines.length < 2) return { durations: [], aeps: [], depths: [] };

  // First line is header: Duration,50%,20%,...
  const headerParts = lines[0].split(',').map(s => s.trim());
  const aeps = headerParts.slice(1);
  const durations: number[] = [];
  const depths: number[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim());
    if (parts.length < 2) continue;
    const durMatch = parts[0].match(/([\d.]+)\s*(min|hr|hour)/i);
    if (!durMatch) continue;
    let durMin = parseFloat(durMatch[1]);
    if (/hr|hour/i.test(durMatch[2])) durMin *= 60;
    durations.push(durMin);
    depths.push(parts.slice(1).map(v => parseFloat(v) || 0));
  }

  return { durations, aeps, depths };
}

function parseTemporalPatterns(lines: string[], warnings: string[]): ARRTemporalPattern[] {
  const patterns: ARRTemporalPattern[] = [];
  let currentGroup: ARRTemporalPattern['group'] = 'frequent';
  let currentDuration = 0;
  let currentPatterns: number[][] = [];

  function flush() {
    if (currentPatterns.length > 0 && currentDuration > 0) {
      patterns.push({ group: currentGroup, durationMin: currentDuration, patterns: [...currentPatterns] });
      currentPatterns = [];
    }
  }

  for (const line of lines) {
    const groupMatch = line.match(/AEP\s+Group:\s*(\w+)/i);
    if (groupMatch) {
      flush();
      const g = groupMatch[1].toLowerCase();
      if (g === 'frequent') currentGroup = 'frequent';
      else if (g === 'infrequent') currentGroup = 'infrequent';
      else if (g === 'rare') currentGroup = 'rare';
      continue;
    }

    const durMatch = line.match(/Duration:\s*([\d.]+)\s*(min|hr|hour)/i);
    if (durMatch) {
      flush();
      currentDuration = parseFloat(durMatch[1]);
      if (/hr|hour/i.test(durMatch[2])) currentDuration *= 60;
      continue;
    }

    const patMatch = line.match(/Pattern\s+\d+:\s*(.+)/i);
    if (patMatch) {
      const fractions = patMatch[1].split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      if (fractions.length > 0) currentPatterns.push(fractions);
    }
  }
  flush();

  if (patterns.length === 0) warnings.push('No temporal patterns parsed');
  return patterns;
}

function parseARF(lines: string[], warnings: string[]): ARRArealReductionFactors {
  if (lines.length < 2) return { durations: [], aeps: [], factors: [] };
  const headerParts = lines[0].split(',').map(s => s.trim());
  const aeps = headerParts.slice(1);
  const durations: number[] = [];
  const factors: number[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim());
    if (parts.length < 2) continue;
    const durMatch = parts[0].match(/([\d.]+)\s*(min|hr|hour)/i);
    if (!durMatch) continue;
    let durMin = parseFloat(durMatch[1]);
    if (/hr|hour/i.test(durMatch[2])) durMin *= 60;
    durations.push(durMin);
    factors.push(parts.slice(1).map(v => parseFloat(v) || 1.0));
  }

  return { durations, aeps, factors };
}

function parseLosses(lines: string[], warnings: string[]): ARRLosses {
  let initialLoss = 0;
  let continuingLoss = 0;
  const preBurst: ARRLosses['preBurst'] = [];

  for (const line of lines) {
    const ilMatch = line.match(/Initial\s+Loss.*?:\s*([\d.]+)/i);
    if (ilMatch) { initialLoss = parseFloat(ilMatch[1]); continue; }

    const clMatch = line.match(/Continuing\s+Loss.*?:\s*([\d.]+)/i);
    if (clMatch) { continuingLoss = parseFloat(clMatch[1]); continue; }

    const pbMatch = line.match(/Pre-burst\s*\((\d+%?),?\s*([\d.]+)\s*(min|hr|hour)\):\s*([\d.]+)/i);
    if (pbMatch) {
      let dur = parseFloat(pbMatch[2]);
      if (/hr|hour/i.test(pbMatch[3])) dur *= 60;
      preBurst.push({ aep: pbMatch[1], durationMin: dur, depth: parseFloat(pbMatch[4]) });
    }
  }

  if (initialLoss === 0 && continuingLoss === 0) warnings.push('Could not parse loss values');
  return { initialLoss, continuingLoss, preBurst };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/__tests__/engine/hydrology/arr-parser.test.ts`
Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/hydrology/arr-parser.ts packages/engine/src/hydrology/types.ts apps/web/src/__tests__/engine/hydrology/arr-parser.test.ts
git commit -m "feat(engine): ARR datahub file parser with tests"
```

---

### Task 3: Loss Model

**Files:**
- Create: `packages/engine/src/hydrology/loss-model.ts`
- Test: `apps/web/src/__tests__/engine/hydrology/loss-model.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// apps/web/src/__tests__/engine/hydrology/loss-model.test.ts
import { describe, it, expect } from 'vitest';
import { applyLosses } from '@flowsuite/engine/hydrology/loss-model';

describe('applyLosses', () => {
  it('applies initial loss correctly', () => {
    // 5mm IL, rainfall = [3, 4, 6, 2] mm per timestep
    // IL absorbs first 3mm, then 2mm of the 4mm timestep = 5mm total
    // Excess: [0, 2, 6, 2]
    const rainfall = [3, 4, 6, 2];
    const result = applyLosses(rainfall, 5, 0, 0, 0, 15);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(2);
    expect(result[2]).toBeCloseTo(6);
    expect(result[3]).toBeCloseTo(2);
  });

  it('applies continuing loss after IL exhausted', () => {
    // IL=2, CL=12mm/hr (=3mm per 15min timestep), rainfall=[5, 5, 5, 5]
    // Step 0: 5mm, IL absorbs 2mm, remaining 3mm, CL absorbs 3mm → excess 0
    // Step 1: 5mm, CL absorbs 3mm → excess 2
    const rainfall = [5, 5, 5, 5];
    const result = applyLosses(rainfall, 2, 12, 0, 0, 15);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(2);
    expect(result[2]).toBeCloseTo(2);
  });

  it('subtracts pre-burst from total before IL', () => {
    // preBurst=3mm subtracted from budget, effectively reduces IL capacity
    // With IL=5 and preBurst=3, effective IL remaining = 5-3 = 2
    const rainfall = [3, 4, 6, 2];
    const result = applyLosses(rainfall, 5, 0, 3, 0, 15);
    expect(result[0]).toBeCloseTo(1); // 3mm rain, 2mm effective IL remaining → 1mm excess
    expect(result[1]).toBeCloseTo(4); // IL exhausted
  });

  it('handles impervious fraction', () => {
    // 50% impervious, IL=100 (never exhausted for pervious part)
    // Pervious excess = 0, impervious contributes 50% of rainfall
    const rainfall = [10, 10];
    const result = applyLosses(rainfall, 100, 0, 0, 0.5, 15);
    expect(result[0]).toBeCloseTo(5); // 50% of 10
    expect(result[1]).toBeCloseTo(5);
  });

  it('returns zeros when all rain absorbed by losses', () => {
    const rainfall = [2, 2, 2];
    const result = applyLosses(rainfall, 100, 0, 0, 0, 15);
    expect(result.every(v => v === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement loss model**

```typescript
// packages/engine/src/hydrology/loss-model.ts

/**
 * Apply ARR2019 loss model to a rainfall hyetograph.
 *
 * @param rainfall - rainfall per timestep (mm)
 * @param initialLoss - storm initial loss (mm)
 * @param continuingLoss - continuing loss rate (mm/hr)
 * @param preBurst - pre-burst rainfall depth (mm), subtracted from IL budget
 * @param imperviousFraction - fraction of catchment that is impervious (0-1)
 * @param dtMinutes - timestep duration in minutes
 * @returns excess rainfall per timestep (mm)
 */
export function applyLosses(
  rainfall: number[],
  initialLoss: number,
  continuingLoss: number,
  preBurst: number,
  imperviousFraction: number,
  dtMinutes: number,
): number[] {
  const clPerStep = continuingLoss * (dtMinutes / 60); // mm per timestep
  let ilRemaining = Math.max(0, initialLoss - preBurst);
  const perviousFraction = 1 - imperviousFraction;

  return rainfall.map((rain) => {
    // Impervious portion: all rainfall becomes runoff
    const impExcess = rain * imperviousFraction;

    // Pervious portion: apply IL then CL
    let pervRain = rain * perviousFraction;
    let pervExcess = 0;

    if (ilRemaining > 0) {
      const ilAbsorbed = Math.min(pervRain, ilRemaining);
      pervRain -= ilAbsorbed;
      ilRemaining -= ilAbsorbed;
    }

    if (pervRain > 0) {
      pervExcess = Math.max(0, pervRain - clPerStep * perviousFraction);
    }

    return impExcess + pervExcess;
  });
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run src/__tests__/engine/hydrology/loss-model.test.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/hydrology/loss-model.ts apps/web/src/__tests__/engine/hydrology/loss-model.test.ts
git commit -m "feat(engine): ARR2019 loss model (IL/CL/pre-burst/impervious)"
```

---

### Task 4: Clark Unit Hydrograph

**Files:**
- Create: `packages/engine/src/hydrology/clark-uh.ts`
- Test: `apps/web/src/__tests__/engine/hydrology/clark-uh.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// apps/web/src/__tests__/engine/hydrology/clark-uh.test.ts
import { describe, it, expect } from 'vitest';
import { clarkUnitHydrograph, routeLinearReservoir } from '@flowsuite/engine/hydrology/clark-uh';

describe('routeLinearReservoir', () => {
  it('attenuates a pulse inflow', () => {
    // Single pulse of 10 m³/s, R=1hr, dt=0.25hr
    const inflow = [10, 0, 0, 0, 0, 0, 0, 0];
    const result = routeLinearReservoir(inflow, 1.0, 0.25);
    // Peak should be less than input (attenuated)
    expect(Math.max(...result)).toBeLessThan(10);
    // Flow should decay
    expect(result[0]).toBeGreaterThan(result[1]);
    // Total volume conserved (sum * dt)
    const inVol = inflow.reduce((a, b) => a + b, 0);
    const outVol = result.reduce((a, b) => a + b, 0);
    expect(outVol).toBeCloseTo(inVol, 0);
  });

  it('returns zeros for zero inflow', () => {
    const result = routeLinearReservoir([0, 0, 0], 1.0, 0.25);
    expect(result.every(v => Math.abs(v) < 0.001)).toBe(true);
  });
});

describe('clarkUnitHydrograph', () => {
  it('produces a hydrograph with peak less than input peak', () => {
    // Simple excess rainfall: 10mm in one timestep
    const excess = [10, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const tc = 1.0; // 1 hour
    const r = 1.5;  // 1.5 hours
    const dt = 0.1; // 6 min
    const area = 10; // 10 km²
    const result = clarkUnitHydrograph(excess, tc, r, dt, area);
    expect(result.length).toBeGreaterThan(0);
    // Peak should exist
    const peak = Math.max(...result);
    expect(peak).toBeGreaterThan(0);
  });

  it('conserves volume approximately', () => {
    const excess = [5, 10, 8, 3, 1]; // mm per timestep
    const tc = 0.5;
    const r = 0.75;
    const dt = 0.1;
    const area = 25; // km²
    const result = clarkUnitHydrograph(excess, tc, r, dt, area);
    // Total excess in mm → volume in m³ = sum(mm) * area(km²) * 1000
    const totalExcessMM = excess.reduce((a, b) => a + b, 0);
    const expectedVolM3 = totalExcessMM * area * 1000;
    // Hydrograph volume = sum(Q * dt_seconds)
    const hydroVolM3 = result.reduce((a, b) => a + b, 0) * dt * 3600;
    // Should be within 10% (discretisation error)
    expect(Math.abs(hydroVolM3 - expectedVolM3) / expectedVolM3).toBeLessThan(0.1);
  });
});
```

- [ ] **Step 2: Implement Clark UH**

```typescript
// packages/engine/src/hydrology/clark-uh.ts

/**
 * Route inflow through a linear reservoir.
 * S = R * Q, Muskingum routing with K=R, x=0.
 *
 * @param inflow - inflow time series (m³/s)
 * @param r - storage coefficient (hours)
 * @param dt - timestep (hours)
 * @returns outflow time series (m³/s)
 */
export function routeLinearReservoir(inflow: number[], r: number, dt: number): number[] {
  if (r <= 0 || dt <= 0 || inflow.length === 0) return inflow.map(() => 0);

  const c1 = dt / (2 * r + dt);
  const c2 = c1;
  const c3 = (2 * r - dt) / (2 * r + dt);

  const outflow = new Array(inflow.length).fill(0);
  outflow[0] = c1 * inflow[0]; // Initial: Q[0] = C1 * I[0]

  for (let i = 1; i < inflow.length; i++) {
    outflow[i] = c1 * inflow[i] + c2 * inflow[i - 1] + c3 * outflow[i - 1];
    if (outflow[i] < 0) outflow[i] = 0;
  }

  return outflow;
}

/**
 * Clark unit hydrograph convolution.
 * 1. Translate excess rainfall using linear time-area curve
 * 2. Route through linear reservoir (S = R * Q)
 *
 * @param excessRainfall - excess rainfall per timestep (mm)
 * @param tc - time of concentration (hours)
 * @param r - storage coefficient (hours)
 * @param dt - timestep (hours)
 * @param area - catchment area (km²)
 * @returns discharge hydrograph (m³/s)
 */
export function clarkUnitHydrograph(
  excessRainfall: number[],
  tc: number,
  r: number,
  dt: number,
  area: number,
): number[] {
  if (excessRainfall.length === 0 || tc <= 0 || dt <= 0 || area <= 0) return [];

  const nTc = Math.ceil(tc / dt); // number of timesteps for Tc
  const nTotal = excessRainfall.length + nTc + Math.ceil(3 * r / dt); // extend for recession

  // Step 1: Time-area translation
  // Linear time-area: A(t) = t/Tc for t <= Tc
  // Incremental area fraction per timestep
  const translation = new Array(nTotal).fill(0);

  for (let i = 0; i < excessRainfall.length; i++) {
    const depthMM = excessRainfall[i];
    if (depthMM <= 0) continue;

    // Convert mm over catchment to m³/s instantaneous inflow
    // Q = depth(m) * area(m²) / dt(s)
    const depthM = depthMM / 1000;
    const areaM2 = area * 1e6;
    const dtSec = dt * 3600;
    const totalVolumeM3 = depthM * areaM2;

    // Distribute over Tc using linear time-area curve
    for (let j = 0; j <= nTc; j++) {
      const t1 = j * dt;
      const t2 = (j + 1) * dt;
      // Fraction of area contributing between t1 and t2
      const f1 = Math.min(t1 / tc, 1);
      const f2 = Math.min(t2 / tc, 1);
      const dA = f2 - f1;
      if (dA > 0 && (i + j) < nTotal) {
        translation[i + j] += (totalVolumeM3 * dA) / dtSec;
      }
    }
  }

  // Step 2: Route through linear reservoir
  const outflow = routeLinearReservoir(translation, r, dt);

  // Trim trailing near-zero values
  let lastNonZero = outflow.length - 1;
  while (lastNonZero > 0 && outflow[lastNonZero] < 0.001) lastNonZero--;

  return outflow.slice(0, lastNonZero + 1);
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run src/__tests__/engine/hydrology/clark-uh.test.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/hydrology/clark-uh.ts apps/web/src/__tests__/engine/hydrology/clark-uh.test.ts
git commit -m "feat(engine): Clark unit hydrograph with linear reservoir routing"
```

---

### Task 5: Design Storm Runner

**Files:**
- Create: `packages/engine/src/hydrology/design-storm-runner.ts`
- Test: `apps/web/src/__tests__/engine/hydrology/design-storm-runner.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// apps/web/src/__tests__/engine/hydrology/design-storm-runner.test.ts
import { describe, it, expect } from 'vitest';
import { runDesignStorms, runSingleStorm } from '@flowsuite/engine/hydrology/design-storm-runner';
import type { DesignStormConfig } from '@flowsuite/engine/hydrology/types';

describe('runSingleStorm', () => {
  it('produces a hydrograph with positive peak', () => {
    const result = runSingleStorm({
      rainfallDepthMM: 50,
      pattern: [0.1, 0.15, 0.25, 0.25, 0.15, 0.1],
      arf: 0.95,
      initialLoss: 10,
      continuingLoss: 2.5,
      preBurst: 5,
      imperviousFraction: 0,
      tc: 1.0,
      r: 1.5,
      catchmentArea: 20,
      durationMin: 60,
    });
    expect(result.peakQ).toBeGreaterThan(0);
    expect(result.hydrograph.length).toBeGreaterThan(0);
    expect(result.timeToPeak).toBeGreaterThan(0);
  });

  it('returns zero peak when all rainfall absorbed by losses', () => {
    const result = runSingleStorm({
      rainfallDepthMM: 5,
      pattern: [0.5, 0.5],
      arf: 1.0,
      initialLoss: 100,
      continuingLoss: 0,
      preBurst: 0,
      imperviousFraction: 0,
      tc: 1.0,
      r: 1.5,
      catchmentArea: 20,
      durationMin: 30,
    });
    expect(result.peakQ).toBeCloseTo(0, 1);
  });
});

describe('runDesignStorms', () => {
  it('finds critical duration and returns summary per AEP', () => {
    const config: DesignStormConfig = {
      ifd: {
        durations: [30, 60, 120],
        aeps: ['1%'],
        depths: [[40], [60], [80]],
      },
      temporalPatterns: [
        { group: 'rare', durationMin: 30, patterns: [[0.3, 0.4, 0.3]] },
        { group: 'rare', durationMin: 60, patterns: [[0.1, 0.2, 0.3, 0.2, 0.1, 0.1]] },
        { group: 'rare', durationMin: 120, patterns: [[0.05, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.05]] },
      ],
      arf: { durations: [30, 60, 120], aeps: ['1%'], factors: [[0.98], [0.95], [0.92]] },
      losses: {
        initialLoss: 15,
        continuingLoss: 2.5,
        preBurst: [{ aep: '1%', durationMin: 60, depth: 10 }],
        imperviousFraction: 0,
      },
      tc: 0.75,
      r: 1.125,
      catchmentArea: 15,
      aeps: ['1%'],
      durationRange: [30, 60, 120],
    };

    const results = runDesignStorms(config);
    expect(results.summary.length).toBe(1);
    expect(results.summary[0].aep).toBe('1%');
    expect(results.summary[0].medianPeakQ).toBeGreaterThan(0);
    expect(results.summary[0].criticalDurationMin).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement design storm runner**

```typescript
// packages/engine/src/hydrology/design-storm-runner.ts
import type { DesignStormConfig, DesignStormResults, DesignStormSummary, StormRunResult, ARRTemporalPattern } from './types';
import { applyLosses } from './loss-model';
import { clarkUnitHydrograph } from './clark-uh';

interface SingleStormInput {
  rainfallDepthMM: number;
  pattern: number[];
  arf: number;
  initialLoss: number;
  continuingLoss: number;
  preBurst: number;
  imperviousFraction: number;
  tc: number;
  r: number;
  catchmentArea: number;
  durationMin: number;
}

export function runSingleStorm(input: SingleStormInput): Omit<StormRunResult, 'aep' | 'durationMin' | 'patternIndex'> {
  const { rainfallDepthMM, pattern, arf, initialLoss, continuingLoss, preBurst, imperviousFraction, tc, r, catchmentArea, durationMin } = input;

  // Timestep: duration / number of pattern intervals
  const nIntervals = pattern.length;
  const dtMinutes = durationMin / nIntervals;
  const dtHours = dtMinutes / 60;

  // Build rainfall hyetograph: depth × ARF × pattern fractions
  const arealDepth = rainfallDepthMM * arf;
  const rainfall = pattern.map(f => arealDepth * f);

  // Apply losses
  const excess = applyLosses(rainfall, initialLoss, continuingLoss, preBurst, imperviousFraction, dtMinutes);

  // Route through Clark UH
  const hydrographQ = clarkUnitHydrograph(excess, tc, r, dtHours, catchmentArea);

  // Extract results
  let peakQ = 0;
  let timeToPeak = 0;
  const hydrograph: { time: number; q: number }[] = [];

  for (let i = 0; i < hydrographQ.length; i++) {
    const t = i * dtHours;
    const q = hydrographQ[i];
    hydrograph.push({ time: t, q });
    if (q > peakQ) {
      peakQ = q;
      timeToPeak = t;
    }
  }

  // Volume = sum(Q × dt) in m³, convert to ML
  const volumeM3 = hydrographQ.reduce((sum, q) => sum + q * dtHours * 3600, 0);
  const volumeML = volumeM3 / 1e6;

  // Runoff coefficient = volume out / volume in
  const totalRainM3 = (arealDepth / 1000) * catchmentArea * 1e6;
  const runoffCoefficient = totalRainM3 > 0 ? volumeM3 / totalRainM3 : 0;

  return { peakQ, timeToPeak, runoffVolume: volumeML, runoffCoefficient, hydrograph };
}

export function runDesignStorms(config: DesignStormConfig): DesignStormResults {
  const runs: StormRunResult[] = [];

  for (const aep of config.aeps) {
    const aepIdx = config.ifd.aeps.indexOf(aep);
    if (aepIdx === -1) continue;

    // Determine which temporal pattern group to use
    const patternGroup = getPatternGroup(aep);

    for (const durationMin of config.durationRange) {
      // Get rainfall depth from IFD
      const durIdx = config.ifd.durations.indexOf(durationMin);
      if (durIdx === -1) continue;
      const rainfallDepthMM = config.ifd.depths[durIdx][aepIdx];

      // Get ARF
      const arf = lookupARF(config.arf, durationMin, aep);

      // Get pre-burst for this AEP/duration
      const preBurst = lookupPreBurst(config.losses.preBurst, aep, durationMin);

      // Get temporal patterns for this duration and group
      const patterns = findPatterns(config.temporalPatterns, patternGroup, durationMin);
      if (patterns.length === 0) continue;

      for (let pi = 0; pi < patterns.length; pi++) {
        const result = runSingleStorm({
          rainfallDepthMM,
          pattern: patterns[pi],
          arf,
          initialLoss: config.losses.initialLoss,
          continuingLoss: config.losses.continuingLoss,
          preBurst,
          imperviousFraction: config.losses.imperviousFraction,
          tc: config.tc,
          r: config.r,
          catchmentArea: config.catchmentArea,
          durationMin,
        });

        runs.push({
          aep,
          durationMin,
          patternIndex: pi,
          ...result,
        });
      }
    }
  }

  // Build summary: for each AEP, find critical duration
  const summary: DesignStormSummary[] = [];

  for (const aep of config.aeps) {
    const aepRuns = runs.filter(r => r.aep === aep);
    if (aepRuns.length === 0) continue;

    // Group by duration, compute median peak Q per duration
    const byDuration = new Map<number, StormRunResult[]>();
    for (const run of aepRuns) {
      const arr = byDuration.get(run.durationMin) ?? [];
      arr.push(run);
      byDuration.set(run.durationMin, arr);
    }

    let criticalDur = 0;
    let maxMedianQ = 0;

    for (const [dur, durRuns] of byDuration) {
      const peaks = durRuns.map(r => r.peakQ).sort((a, b) => a - b);
      const median = peaks[Math.floor(peaks.length / 2)];
      if (median > maxMedianQ) {
        maxMedianQ = median;
        criticalDur = dur;
      }
    }

    // Get all runs at critical duration
    const critRuns = byDuration.get(criticalDur) ?? [];
    const peaks = critRuns.map(r => r.peakQ).sort((a, b) => a - b);
    const medianIdx = Math.floor(peaks.length / 2);

    // Find the median hydrograph (the run closest to median peak)
    const medianRun = critRuns.reduce((best, r) =>
      Math.abs(r.peakQ - peaks[medianIdx]) < Math.abs(best.peakQ - peaks[medianIdx]) ? r : best
    , critRuns[0]);

    summary.push({
      aep,
      criticalDurationMin: criticalDur,
      medianPeakQ: peaks[medianIdx],
      minPeakQ: peaks[0],
      maxPeakQ: peaks[peaks.length - 1],
      medianHydrograph: medianRun?.hydrograph ?? [],
    });
  }

  return { runs, summary };
}

function getPatternGroup(aep: string): ARRTemporalPattern['group'] {
  if (aep === '50%' || aep === '20%') return 'frequent';
  if (aep === '10%' || aep === '5%') return 'infrequent';
  return 'rare';
}

function lookupARF(arf: DesignStormConfig['arf'], durationMin: number, aep: string): number {
  const durIdx = arf.durations.indexOf(durationMin);
  const aepIdx = arf.aeps.indexOf(aep);
  if (durIdx === -1 || aepIdx === -1) return 1.0;
  return arf.factors[durIdx][aepIdx];
}

function lookupPreBurst(preBurst: DesignStormConfig['losses']['preBurst'], aep: string, durationMin: number): number {
  // Find exact match first
  const exact = preBurst.find(p => p.aep === aep && p.durationMin === durationMin);
  if (exact) return exact.depth;
  // Fall back to same AEP any duration
  const sameAEP = preBurst.find(p => p.aep === aep);
  if (sameAEP) return sameAEP.depth;
  // Fall back to first available
  return preBurst[0]?.depth ?? 0;
}

function findPatterns(allPatterns: ARRTemporalPattern[], group: ARRTemporalPattern['group'], durationMin: number): number[][] {
  // Exact match
  const exact = allPatterns.find(p => p.group === group && p.durationMin === durationMin);
  if (exact) return exact.patterns;
  // Same group, closest duration
  const sameGroup = allPatterns.filter(p => p.group === group);
  if (sameGroup.length > 0) {
    sameGroup.sort((a, b) => Math.abs(a.durationMin - durationMin) - Math.abs(b.durationMin - durationMin));
    return sameGroup[0].patterns;
  }
  // Any group, closest duration
  if (allPatterns.length > 0) {
    const sorted = [...allPatterns].sort((a, b) => Math.abs(a.durationMin - durationMin) - Math.abs(b.durationMin - durationMin));
    return sorted[0].patterns;
  }
  return [];
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run src/__tests__/engine/hydrology/design-storm-runner.test.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/hydrology/design-storm-runner.ts apps/web/src/__tests__/engine/hydrology/design-storm-runner.test.ts
git commit -m "feat(engine): design storm runner with critical duration search"
```

---

### Task 6: Flood Frequency Analysis

**Files:**
- Create: `packages/engine/src/hydrology/flood-frequency.ts`
- Test: `apps/web/src/__tests__/engine/hydrology/flood-frequency.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// apps/web/src/__tests__/engine/hydrology/flood-frequency.test.ts
import { describe, it, expect } from 'vitest';
import { fitLogPearsonIII } from '@flowsuite/engine/hydrology/flood-frequency';

describe('fitLogPearsonIII', () => {
  it('fits a distribution to annual maxima', () => {
    const data = [
      { year: 2010, q: 45 },
      { year: 2011, q: 120 },
      { year: 2012, q: 65 },
      { year: 2013, q: 88 },
      { year: 2014, q: 200 },
      { year: 2015, q: 52 },
      { year: 2016, q: 78 },
      { year: 2017, q: 155 },
      { year: 2018, q: 42 },
      { year: 2019, q: 95 },
    ];
    const result = fitLogPearsonIII(data);
    expect(result.logPearsonIII.mean).toBeGreaterThan(0);
    expect(result.logPearsonIII.stdDev).toBeGreaterThan(0);
    expect(result.quantiles.length).toBeGreaterThan(0);
    // 1% AEP Q should be larger than 50% AEP Q
    const q1 = result.quantiles.find(q => q.aep === '1%');
    const q50 = result.quantiles.find(q => q.aep === '50%');
    expect(q1).toBeDefined();
    expect(q50).toBeDefined();
    if (q1 && q50) expect(q1.q).toBeGreaterThan(q50.q);
  });

  it('handles small sample sizes', () => {
    const data = [{ year: 2020, q: 50 }, { year: 2021, q: 80 }];
    const result = fitLogPearsonIII(data);
    expect(result.quantiles.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement Log Pearson III**

```typescript
// packages/engine/src/hydrology/flood-frequency.ts
import type { FFAResult } from './types';
import { STANDARD_AEPS } from '../hydrology/rational-method';

/** AEP string to exceedance probability */
const AEP_PROB: Record<string, number> = {
  '50%': 0.5, '20%': 0.2, '10%': 0.1, '5%': 0.05, '2%': 0.02, '1%': 0.01,
};

/**
 * Fit Log Pearson Type III distribution to annual maximum flood series.
 * Returns quantile estimates for standard AEPs.
 */
export function fitLogPearsonIII(annualMaxima: { year: number; q: number }[]): FFAResult {
  const n = annualMaxima.length;
  if (n < 2) {
    return {
      annualMaxima,
      logPearsonIII: { mean: 0, stdDev: 0, skew: 0 },
      quantiles: STANDARD_AEPS.map(aep => ({ aep, q: 0, confidenceLow: 0, confidenceHigh: 0 })),
    };
  }

  // Log-transform
  const logQ = annualMaxima.map(d => Math.log10(Math.max(d.q, 0.001)));

  // Statistics
  const mean = logQ.reduce((a, b) => a + b, 0) / n;
  const variance = logQ.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const skew = n > 2
    ? (n / ((n - 1) * (n - 2))) * logQ.reduce((sum, x) => sum + ((x - mean) / stdDev) ** 3, 0)
    : 0;

  // Quantile estimates using frequency factor K
  const quantiles = STANDARD_AEPS.map(aep => {
    const p = AEP_PROB[aep] ?? 0.01;
    const k = frequencyFactor(p, skew);
    const logQp = mean + k * stdDev;
    const qp = Math.pow(10, logQp);

    // Approximate confidence intervals (±1 SE)
    const se = stdDev * Math.sqrt((1 + k * k / 2) / n);
    const logLow = logQp - 1.96 * se;
    const logHigh = logQp + 1.96 * se;

    return {
      aep,
      q: qp,
      confidenceLow: Math.pow(10, logLow),
      confidenceHigh: Math.pow(10, logHigh),
    };
  });

  return {
    annualMaxima,
    logPearsonIII: { mean, stdDev, skew },
    quantiles,
  };
}

/**
 * Frequency factor K for Log Pearson III.
 * Uses Wilson-Hilferty approximation for skewed distributions.
 */
function frequencyFactor(exceedanceProbability: number, skew: number): number {
  // Standard normal variate for the given probability
  const z = standardNormalQuantile(1 - exceedanceProbability);

  if (Math.abs(skew) < 0.001) return z;

  // Wilson-Hilferty approximation
  const k = skew / 6;
  const w = z;
  return (2 / skew) * (Math.pow(1 + k * w - k * k / 3, 3) - 1);
}

/**
 * Approximation of the standard normal quantile (inverse CDF).
 * Abramowitz & Stegun rational approximation.
 */
function standardNormalQuantile(p: number): number {
  if (p <= 0) return -4;
  if (p >= 1) return 4;

  const sign = p < 0.5 ? -1 : 1;
  const pp = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(pp));

  // Rational approximation coefficients
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  return sign * (t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t));
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run src/__tests__/engine/hydrology/flood-frequency.test.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/hydrology/flood-frequency.ts apps/web/src/__tests__/engine/hydrology/flood-frequency.test.ts
git commit -m "feat(engine): Log Pearson III flood frequency analysis"
```

---

### Task 7: Hydro Store + Wizard Scaffold

**Files:**
- Create: `apps/web/src/app/hydro/store.ts`
- Create: `apps/web/src/app/hydro/page.tsx`
- Create: `apps/web/src/app/hydro/components/wizard-nav.tsx`

- [ ] **Step 1: Create the Zustand store**

```typescript
// apps/web/src/app/hydro/store.ts
import { create } from 'zustand';
import type { ARRDataHubOutput, DesignStormResults, FFAResult } from '@flowsuite/engine/hydrology/types';

interface HydroStore {
  // Step 1: Catchment
  projectName: string;
  location: { lat: number; lng: number } | null;
  catchmentArea: number;
  streamLength: number;
  equalAreaSlope: number;

  // Step 2: ARR Data
  arrData: ARRDataHubOutput | null;

  // Step 3: Losses (adopted values, may differ from ARR defaults)
  adoptedInitialLoss: number;
  adoptedContinuingLoss: number;
  adoptedPreBurst: { aep: string; durationMin: number; depth: number }[];
  adoptedImperviousFraction: number;

  // Step 4: Tc
  tcMethod: 'bransby-williams' | 'friends' | 'manual';
  tcManual: number;
  rCoefficient: number;
  durationRange: number[];

  // Step 5: Results
  results: DesignStormResults | null;
  isRunning: boolean;

  // Step 6: FFA
  ffaData: { year: number; q: number }[] | null;
  ffaResults: FFAResult | null;

  // Navigation
  currentStep: number;

  // Actions
  setStep: (step: number) => void;
  setProjectName: (name: string) => void;
  setLocation: (loc: { lat: number; lng: number } | null) => void;
  setCatchmentArea: (area: number) => void;
  setStreamLength: (length: number) => void;
  setEqualAreaSlope: (slope: number) => void;
  setArrData: (data: ARRDataHubOutput) => void;
  setAdoptedInitialLoss: (val: number) => void;
  setAdoptedContinuingLoss: (val: number) => void;
  setAdoptedPreBurst: (val: HydroStore['adoptedPreBurst']) => void;
  setAdoptedImperviousFraction: (val: number) => void;
  setTcMethod: (method: HydroStore['tcMethod']) => void;
  setTcManual: (val: number) => void;
  setRCoefficient: (val: number) => void;
  setDurationRange: (durations: number[]) => void;
  setResults: (results: DesignStormResults) => void;
  setIsRunning: (running: boolean) => void;
  setFFAData: (data: { year: number; q: number }[]) => void;
  setFFAResults: (results: FFAResult) => void;
  reset: () => void;
}

const initialState = {
  projectName: '',
  location: null as { lat: number; lng: number } | null,
  catchmentArea: 0,
  streamLength: 0,
  equalAreaSlope: 0,
  arrData: null as ARRDataHubOutput | null,
  adoptedInitialLoss: 0,
  adoptedContinuingLoss: 0,
  adoptedPreBurst: [] as HydroStore['adoptedPreBurst'],
  adoptedImperviousFraction: 0,
  tcMethod: 'bransby-williams' as const,
  tcManual: 0,
  rCoefficient: 0,
  durationRange: [] as number[],
  results: null as DesignStormResults | null,
  isRunning: false,
  ffaData: null as { year: number; q: number }[] | null,
  ffaResults: null as FFAResult | null,
  currentStep: 0,
};

export const useHydroStore = create<HydroStore>((set) => ({
  ...initialState,
  setStep: (step) => set({ currentStep: step }),
  setProjectName: (name) => set({ projectName: name }),
  setLocation: (loc) => set({ location: loc }),
  setCatchmentArea: (area) => set({ catchmentArea: area }),
  setStreamLength: (length) => set({ streamLength: length }),
  setEqualAreaSlope: (slope) => set({ equalAreaSlope: slope }),
  setArrData: (data) => set({
    arrData: data,
    adoptedInitialLoss: data.losses.initialLoss,
    adoptedContinuingLoss: data.losses.continuingLoss,
    adoptedPreBurst: data.losses.preBurst,
  }),
  setAdoptedInitialLoss: (val) => set({ adoptedInitialLoss: val }),
  setAdoptedContinuingLoss: (val) => set({ adoptedContinuingLoss: val }),
  setAdoptedPreBurst: (val) => set({ adoptedPreBurst: val }),
  setAdoptedImperviousFraction: (val) => set({ adoptedImperviousFraction: val }),
  setTcMethod: (method) => set({ tcMethod: method }),
  setTcManual: (val) => set({ tcManual: val }),
  setRCoefficient: (val) => set({ rCoefficient: val }),
  setDurationRange: (durations) => set({ durationRange: durations }),
  setResults: (results) => set({ results }),
  setIsRunning: (running) => set({ isRunning: running }),
  setFFAData: (data) => set({ ffaData: data }),
  setFFAResults: (results) => set({ ffaResults: results }),
  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Create wizard navigation component**

```typescript
// apps/web/src/app/hydro/components/wizard-nav.tsx
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
```

- [ ] **Step 3: Create wizard page**

```typescript
// apps/web/src/app/hydro/page.tsx
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
```

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/hydro/
git commit -m "feat(hydro): wizard scaffold with store, navigation, and step placeholders"
```

---

### Task 8: Step 1 — Catchment

**Files:**
- Create: `apps/web/src/app/hydro/components/step-catchment.tsx`
- Modify: `apps/web/src/app/hydro/page.tsx` — replace placeholder

This step has: project name, lat/lng + Leaflet map, catchment area, stream length, equal-area slope. Guidance panel on the right. Uses `@flowsuite/ui` Input, Label, Card. Reuses LeafletMap component from BLC (import from `@/components/hydrology/leaflet-map` if it exists in the BLC route, or recreate a minimal version).

- [ ] **Step 1: Build step component**
- [ ] **Step 2: Wire into page.tsx (replace placeholder for step 0)**
- [ ] **Step 3: Verify build**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(hydro): Step 1 — Catchment input with map"
```

---

### Task 9: Step 2 — ARR Data

**Files:**
- Create: `apps/web/src/app/hydro/components/step-arr-data.tsx`
- Create: `apps/web/src/app/hydro/components/ifd-table.tsx`
- Modify: `apps/web/src/app/hydro/page.tsx`

Drag-and-drop file upload zone. Parses uploaded file using `parseARRDataHub` from `@flowsuite/engine`. Displays parsed IFD table, temporal pattern count, loss summary, ARF values. Green checkmarks per section. Warning badges for parsing issues.

- [ ] **Step 1: Build IFD table display component**
- [ ] **Step 2: Build step component with file upload and parsed data display**
- [ ] **Step 3: Wire into page.tsx**
- [ ] **Step 4: Verify build**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(hydro): Step 2 — ARR datahub file upload and parsing"
```

---

### Task 10: Step 3 — Losses

**Files:**
- Create: `apps/web/src/app/hydro/components/step-losses.tsx`
- Modify: `apps/web/src/app/hydro/page.tsx`

Pre-populated from parsed ARR data. All fields editable. Shows ARR-recommended vs user values side by side. Warning badge if user deviates >50%. Fields: IL (mm), CL (mm/hr), pre-burst (mm), impervious fraction (%).

- [ ] **Step 1: Build step component**
- [ ] **Step 2: Wire into page.tsx**
- [ ] **Step 3: Verify build**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(hydro): Step 3 — Loss parameters with ARR defaults"
```

---

### Task 11: Step 4 — Time of Concentration

**Files:**
- Create: `apps/web/src/app/hydro/components/step-tc.tsx`
- Modify: `apps/web/src/app/hydro/page.tsx`

Three Tc methods auto-calculated. Radio selector. R coefficient (default 1.5 × Tc, editable). Duration range display with standard ARR durations filtered to 0.5×Tc–2.0×Tc. Uses existing `bransbyWilliams` and `friends` from `@flowsuite/engine/hydrology/time-of-concentration`.

- [ ] **Step 1: Build step component**
- [ ] **Step 2: Wire into page.tsx**
- [ ] **Step 3: Verify build**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(hydro): Step 4 — Time of concentration with duration range"
```

---

### Task 12: Step 5 — Design Storms + Hydrograph Chart

**Files:**
- Create: `apps/web/src/app/hydro/components/step-design-storms.tsx`
- Create: `apps/web/src/app/hydro/components/hydrograph-chart.tsx`
- Create: `apps/web/src/app/hydro/components/results-matrix.tsx`
- Modify: `apps/web/src/app/hydro/page.tsx`

"Run Analysis" button calls `runDesignStorms` from the engine. Displays: summary card (critical duration + median Q per AEP), D3 hydrograph chart with ensemble spread, expandable duration × AEP results matrix. AEP selector dropdown for the chart.

The hydrograph chart uses D3 (same patterns as BLC's afflux charts). Shows 10 ensemble lines with median highlighted, min/max band shaded.

- [ ] **Step 1: Build hydrograph chart (D3)**
- [ ] **Step 2: Build results matrix component**
- [ ] **Step 3: Build step component with run button and results display**
- [ ] **Step 4: Wire into page.tsx**
- [ ] **Step 5: Verify build**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(hydro): Step 5 — Design storm runner with ensemble hydrograph chart"
```

---

### Task 13: Step 6 — Design Flows + Export

**Files:**
- Create: `apps/web/src/app/hydro/components/step-design-flows.tsx`
- Create: `apps/web/src/app/hydro/components/ffa-panel.tsx`
- Modify: `apps/web/src/app/hydro/page.tsx`

Summary table (AEP, ARI, critical duration, design Q, ensemble range). "Send to BLC" button writes `HydroFlowExport` to localStorage via `setStorage` from `@flowsuite/data`, then navigates to `/blc`. Export JSON and CSV buttons. Copy to clipboard. Optional FFA collapsible section.

- [ ] **Step 1: Build FFA panel (collapsible, paste/upload annual maxima, calls fitLogPearsonIII)**
- [ ] **Step 2: Build step component with summary table and all action buttons**
- [ ] **Step 3: Wire into page.tsx**
- [ ] **Step 4: Verify build**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(hydro): Step 6 — Design flows summary with BLC handoff and FFA"
```

---

### Task 14: BLC Import Banner + Landing Page Update

**Files:**
- Modify: `apps/web/src/app/page.tsx` — change Hydrology card to available
- Modify: `apps/web/src/app/blc/page.tsx` (or the main-tabs component) — add import banner

- [ ] **Step 1: Update landing page — set Hydrology available: true**

In `apps/web/src/app/page.tsx`, change:
```typescript
{ name: 'Hydrology', ..., available: false }
```
to:
```typescript
{ name: 'Hydrology', ..., available: true }
```

- [ ] **Step 2: Add BLC import banner**

In the BLC main component (likely `main-tabs.tsx` or `blc/page.tsx`), add at the top of the Data tab content:

```tsx
// Check for hydro data
const hydroFlows = getStorage<HydroFlowExport>('hydro:latest-flows');

{hydroFlows && (
  <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
    <div className="text-sm">
      <span className="font-medium">Design flows from Hydrology</span>
      <span className="text-muted-foreground ml-1">— {hydroFlows.flows.length} profiles ready to import</span>
    </div>
    <div className="flex gap-2 shrink-0">
      <Button size="sm" variant="outline" onClick={() => {
        removeStorage('hydro:latest-flows');
        // force re-render
      }}>Dismiss</Button>
      <Button size="sm" onClick={() => {
        // Create flow profiles from hydro data
        const profiles = hydroFlows.flows.map(f => ({
          name: `${f.aep} (Hydro)`,
          ari: f.ari,
          discharge: toImperial(f.designQ, 'discharge', 'metric'),
          dsWsel: 0,
          channelSlope: 0,
        }));
        updateFlowProfiles(profiles);
        removeStorage('hydro:latest-flows');
        toast.success('Imported design flows', { description: `${profiles.length} profiles from Hydrology module` });
      }}>Import</Button>
    </div>
  </div>
)}
```

Import `getStorage`, `removeStorage` from `@flowsuite/data`.

- [ ] **Step 3: Verify build**

Run: `cd apps/web && pnpm run build`

- [ ] **Step 4: Run all tests**

Run: `cd apps/web && pnpm run test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: connect Hydrology to BLC — import banner and landing page update"
```
