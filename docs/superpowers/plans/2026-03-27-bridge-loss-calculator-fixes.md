# Bridge Loss Calculator — Engine Corrections & Feature Completion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all hydraulic equation errors, add pressure/overtopping flow solvers, clean up dead inputs, strengthen validation, and polish outputs so the tool is verification-grade for free-surface flow and gives reasonable estimates for submerged conditions.

**Architecture:** Engine runs in US Customary (ft, cfs) internally. Four backwater methods (Energy, Momentum, Yarnell, WSPRO) handle free-surface flow. A shared regime dispatch layer routes to orifice or orifice+weir solvers when the bridge is submerged. UI forms, types, store, and serialisation updated to match.

**Tech Stack:** TypeScript, Next.js, Zustand, Vitest, D3 (charts), Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-27-bridge-loss-calculator-fixes-design.md`

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/engine/pressure-flow.ts` | Orifice equation solver for pressure flow regime |
| `src/engine/overtopping-flow.ts` | Combined orifice + weir solver for overtopping regime |
| `src/engine/deck-profile.ts` | Deck geometry utilities (effective weir length, crest elevation) |
| `tests/engine/pressure-flow.test.ts` | Tests for orifice solver |
| `tests/engine/overtopping-flow.test.ts` | Tests for orifice+weir solver |
| `tests/engine/deck-profile.test.ts` | Tests for deck geometry |

### Modified files
| File | Changes |
|------|---------|
| `src/engine/types.ts` | Add/remove fields on `BridgeGeometry`, `FlowProfile`, `Coefficients`, `MethodResult` |
| `src/engine/geometry.ts` | Add `calcAlpha()`, export subsection properties |
| `src/engine/methods/yarnell.ts` | Fix equation to use Froude-based formulation |
| `src/engine/methods/energy.ts` | Recompute bridge velocity during iteration, use alpha, add regime dispatch |
| `src/engine/methods/momentum.ts` | Use alpha, add regime dispatch |
| `src/engine/methods/wspro.ts` | Use alpha, add regime dispatch |
| `src/engine/flow-regime.ts` | No change needed (already correct) |
| `src/engine/tuflow-flc.ts` | Wire up superstructure FLC with real head loss |
| `src/engine/index.ts` | Pass new bridge geometry fields through |
| `src/engine/freeboard.ts` | Use envelope of all methods, configurable threshold |
| `src/lib/constants.ts` | No changes needed |
| `src/lib/validation.ts` | Add 8 new validation checks (errors + warnings) |
| `src/lib/json-io.ts` | Handle new/removed/migrated fields, backward compatibility |
| `src/lib/test-bridges.ts` | Update all test bridges for new type shape, add pressure flow scenario |
| `src/store/project-store.ts` | Update defaults and types |
| `src/components/input/bridge-geometry-form.tsx` | Remove abutment slopes, add pressure/overtopping fields, add reach lengths |
| `src/components/input/flow-profiles-form.tsx` | Remove contraction/expansion length columns |
| `src/components/input/coefficients-form.tsx` | Add alpha override, freeboard threshold |
| `src/components/input/action-buttons.tsx` | Update test bridge loading for new types |
| `src/components/summary/freeboard-check.tsx` | Use envelope, configurable threshold |
| `src/components/summary/comparison-tables.tsx` | Add ORF/ORF+WR annotations |
| `src/components/main-tabs.tsx` | Add internal units note |
| `tests/engine/methods/yarnell.test.ts` | Update tests for corrected equation |
| `tests/engine/methods/energy.test.ts` | Update tests for bridge velocity iteration + alpha |
| `tests/engine/methods/momentum.test.ts` | Update tests for alpha |
| `tests/engine/methods/wspro.test.ts` | Update tests for alpha |
| `tests/engine/geometry.test.ts` | Add tests for `calcAlpha()` |
| `tests/engine/tuflow-flc.test.ts` | Add tests for real superstructure FLC |
| `tests/engine/validation-benchmarks.test.ts` | Update expected values for corrected equations |
| `tests/lib/validation.test.ts` | Add tests for new validation checks |
| `tests/lib/json-io.test.ts` | Add backward compatibility migration tests |
| `tests/store/project-store.test.ts` | Update for new defaults |

---

## Task 1: Update Types

**Files:**
- Modify: `src/engine/types.ts`

- [ ] **Step 1: Update BridgeGeometry type**

In `src/engine/types.ts`, replace the `BridgeGeometry` interface:

```typescript
export interface BridgeGeometry {
  lowChordLeft: number;
  lowChordRight: number;
  highChord: number;
  leftAbutmentStation: number;
  rightAbutmentStation: number;
  skewAngle: number;
  contractionLength: number;
  expansionLength: number;
  orificeCd: number;
  weirCw: number;
  deckWidth: number;
  piers: Pier[];
  lowChordProfile: LowChordPoint[];
}
```

Key changes: removed `leftAbutmentSlope`, `rightAbutmentSlope`. Added `contractionLength`, `expansionLength` (moved from FlowProfile), `orificeCd`, `weirCw`, `deckWidth`.

- [ ] **Step 2: Update FlowProfile type**

Replace the `FlowProfile` interface:

```typescript
export interface FlowProfile {
  name: string;
  ari: string;
  discharge: number;
  dsWsel: number;
  channelSlope: number;
}
```

Removed `contractionLength` and `expansionLength` (moved to BridgeGeometry).

- [ ] **Step 3: Update Coefficients type**

Replace the `Coefficients` interface:

```typescript
export interface Coefficients {
  contractionCoeff: number;
  expansionCoeff: number;
  yarnellK: number | null;
  maxIterations: number;
  tolerance: number;
  initialGuessOffset: number;
  debrisBlockagePct: number;
  manningsNSensitivityPct: number | null;
  alphaOverride: number | null;
  freeboardThreshold: number;
  methodsToRun: {
    energy: boolean;
    momentum: boolean;
    yarnell: boolean;
    wspro: boolean;
  };
}
```

Added `alphaOverride` (null = auto-compute) and `freeboardThreshold` (in feet, default ~0.984 ft = 0.3 m).

- [ ] **Step 4: Update MethodResult type**

Add `flowCalculationType` field to the `MethodResult` interface:

```typescript
export interface MethodResult {
  profileName: string;
  upstreamWsel: number;
  totalHeadLoss: number;
  approachVelocity: number;
  bridgeVelocity: number;
  froudeApproach: number;
  froudeBridge: number;
  flowRegime: FlowRegime;
  flowCalculationType: 'free-surface' | 'orifice' | 'orifice+weir';
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
```

- [ ] **Step 5: Update ValidationError type for warnings**

Add a `severity` field to `ValidationError` in `src/lib/validation.ts`:

```typescript
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}
```

- [ ] **Step 6: Verify the project compiles (expect errors — downstream files not yet updated)**

Run: `cd app && npx tsc --noEmit 2>&1 | head -5`

Expected: Type errors in files that reference the old shapes. This confirms the type changes propagated. We'll fix each file in subsequent tasks.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/lib/validation.ts
git commit -m "refactor: update types for pressure flow, field migration, and warnings"
```

---

## Task 2: Update Store Defaults and Project Serialisation

**Files:**
- Modify: `src/store/project-store.ts`
- Modify: `src/lib/json-io.ts`
- Test: `tests/lib/json-io.test.ts`
- Test: `tests/store/project-store.test.ts`

- [ ] **Step 1: Write backward compatibility test for json-io**

Add to `tests/lib/json-io.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { serializeProject, parseProjectJson } from '@/lib/json-io';

describe('parseProjectJson backward compatibility', () => {
  it('migrates contractionLength/expansionLength from flowProfiles to bridgeGeometry', () => {
    const oldJson = JSON.stringify({
      version: 1,
      crossSection: [],
      bridgeGeometry: {
        lowChordLeft: 9, lowChordRight: 9, highChord: 12,
        leftAbutmentStation: 5, rightAbutmentStation: 95,
        leftAbutmentSlope: 0, rightAbutmentSlope: 0,
        skewAngle: 0, piers: [], lowChordProfile: [],
      },
      flowProfiles: [
        { name: 'Q100', ari: '1% AEP', discharge: 100, dsWsel: 5, channelSlope: 0.001, contractionLength: 80, expansionLength: 120 },
      ],
      coefficients: {
        contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
        maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
        debrisBlockagePct: 0, manningsNSensitivityPct: null,
        methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
      },
      hecRasComparison: [],
    });

    const data = parseProjectJson(oldJson);

    // Reach lengths migrated to bridge geometry from first profile
    expect(data.bridgeGeometry.contractionLength).toBe(80);
    expect(data.bridgeGeometry.expansionLength).toBe(120);

    // Abutment slopes stripped (no longer in type)
    expect((data.bridgeGeometry as any).leftAbutmentSlope).toBeUndefined();
    expect((data.bridgeGeometry as any).rightAbutmentSlope).toBeUndefined();

    // New fields get defaults
    expect(data.bridgeGeometry.orificeCd).toBe(0.8);
    expect(data.bridgeGeometry.weirCw).toBe(1.4);
    expect(data.bridgeGeometry.deckWidth).toBe(0);

    // Flow profiles no longer have reach lengths
    expect((data.flowProfiles[0] as any).contractionLength).toBeUndefined();
    expect((data.flowProfiles[0] as any).expansionLength).toBeUndefined();

    // Coefficients get new defaults
    expect(data.coefficients.alphaOverride).toBeNull();
    expect(data.coefficients.freeboardThreshold).toBeCloseTo(0.984, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/json-io.test.ts --reporter=verbose 2>&1 | tail -10`

Expected: FAIL — `parseProjectJson` doesn't handle the new fields yet.

- [ ] **Step 3: Update json-io.ts**

Replace `src/lib/json-io.ts` with:

```typescript
import { ProjectState, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';
import { UnitSystem } from '@/lib/units';

interface ExportData {
  version: number;
  unitSystem?: UnitSystem;
  crossSection: ProjectState['crossSection'];
  bridgeGeometry: ProjectState['bridgeGeometry'];
  flowProfiles: ProjectState['flowProfiles'];
  coefficients: ProjectState['coefficients'];
  hecRasComparison: ProjectState['hecRasComparison'];
}

const BRIDGE_DEFAULTS: Pick<BridgeGeometry, 'contractionLength' | 'expansionLength' | 'orificeCd' | 'weirCw' | 'deckWidth'> = {
  contractionLength: 0,
  expansionLength: 0,
  orificeCd: 0.8,
  weirCw: 1.4,
  deckWidth: 0,
};

const COEFF_DEFAULTS: Pick<Coefficients, 'alphaOverride' | 'freeboardThreshold'> = {
  alphaOverride: null,
  freeboardThreshold: 0.984, // 0.3 m in feet
};

export function serializeProject(
  state: Omit<ProjectState, 'results'> & { unitSystem?: UnitSystem }
): string {
  const data: ExportData = {
    version: 2,
    unitSystem: state.unitSystem,
    crossSection: state.crossSection,
    bridgeGeometry: state.bridgeGeometry,
    flowProfiles: state.flowProfiles,
    coefficients: state.coefficients,
    hecRasComparison: state.hecRasComparison,
  };
  return JSON.stringify(data, null, 2);
}

export function parseProjectJson(json: string): Omit<ProjectState, 'results'> & { unitSystem: UnitSystem } {
  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }

  if (!raw.version || (raw.version !== 1 && raw.version !== 2)) {
    throw new Error('Invalid or missing version field');
  }

  // Migrate v1 → v2: move reach lengths from flowProfiles to bridgeGeometry
  const rawBridge = raw.bridgeGeometry ?? {};
  const rawProfiles: any[] = raw.flowProfiles ?? [];

  const contractionLength = rawBridge.contractionLength ?? rawProfiles[0]?.contractionLength ?? 0;
  const expansionLength = rawBridge.expansionLength ?? rawProfiles[0]?.expansionLength ?? 0;

  const bridgeGeometry: BridgeGeometry = {
    lowChordLeft: rawBridge.lowChordLeft ?? 0,
    lowChordRight: rawBridge.lowChordRight ?? 0,
    highChord: rawBridge.highChord ?? 0,
    leftAbutmentStation: rawBridge.leftAbutmentStation ?? 0,
    rightAbutmentStation: rawBridge.rightAbutmentStation ?? 0,
    skewAngle: rawBridge.skewAngle ?? 0,
    contractionLength,
    expansionLength,
    orificeCd: rawBridge.orificeCd ?? BRIDGE_DEFAULTS.orificeCd,
    weirCw: rawBridge.weirCw ?? BRIDGE_DEFAULTS.weirCw,
    deckWidth: rawBridge.deckWidth ?? BRIDGE_DEFAULTS.deckWidth,
    piers: rawBridge.piers ?? [],
    lowChordProfile: rawBridge.lowChordProfile ?? [],
  };

  // Strip reach lengths from flow profiles (v1 migration)
  const flowProfiles: FlowProfile[] = rawProfiles.map((p: any) => ({
    name: p.name ?? '',
    ari: p.ari ?? '',
    discharge: p.discharge ?? 0,
    dsWsel: p.dsWsel ?? 0,
    channelSlope: p.channelSlope ?? 0,
  }));

  const rawCoeffs = raw.coefficients ?? {};
  const coefficients: Coefficients = {
    contractionCoeff: rawCoeffs.contractionCoeff ?? 0.3,
    expansionCoeff: rawCoeffs.expansionCoeff ?? 0.5,
    yarnellK: rawCoeffs.yarnellK ?? null,
    maxIterations: rawCoeffs.maxIterations ?? 100,
    tolerance: rawCoeffs.tolerance ?? 0.01,
    initialGuessOffset: rawCoeffs.initialGuessOffset ?? 0.5,
    debrisBlockagePct: rawCoeffs.debrisBlockagePct ?? 0,
    manningsNSensitivityPct: rawCoeffs.manningsNSensitivityPct ?? null,
    alphaOverride: rawCoeffs.alphaOverride ?? COEFF_DEFAULTS.alphaOverride,
    freeboardThreshold: rawCoeffs.freeboardThreshold ?? COEFF_DEFAULTS.freeboardThreshold,
    methodsToRun: rawCoeffs.methodsToRun ?? { energy: true, momentum: true, yarnell: true, wspro: true },
  };

  return {
    crossSection: raw.crossSection ?? [],
    bridgeGeometry,
    flowProfiles,
    coefficients,
    hecRasComparison: raw.hecRasComparison ?? [],
    unitSystem: raw.unitSystem ?? 'imperial',
  };
}
```

- [ ] **Step 4: Update store defaults in project-store.ts**

In `src/store/project-store.ts`, update `defaultBridgeGeometry`:

```typescript
const defaultBridgeGeometry: BridgeGeometry = {
  lowChordLeft: 0,
  lowChordRight: 0,
  highChord: 0,
  leftAbutmentStation: 0,
  rightAbutmentStation: 0,
  skewAngle: 0,
  contractionLength: 0,
  expansionLength: 0,
  orificeCd: 0.8,
  weirCw: 1.4,
  deckWidth: 0,
  piers: [],
  lowChordProfile: [],
};
```

Update `defaultCoefficients`:

```typescript
const defaultCoefficients: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  debrisBlockagePct: 0,
  manningsNSensitivityPct: null,
  alphaOverride: null,
  freeboardThreshold: 0.984,
  methodsToRun: {
    energy: true,
    momentum: true,
    yarnell: true,
    wspro: true,
  },
};
```

- [ ] **Step 5: Run json-io tests**

Run: `cd app && npx vitest run tests/lib/json-io.test.ts --reporter=verbose 2>&1 | tail -10`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/store/project-store.ts src/lib/json-io.ts tests/lib/json-io.test.ts
git commit -m "refactor: update store defaults and json-io with v1→v2 migration"
```

---

## Task 3: Add calcAlpha to Geometry

**Files:**
- Modify: `src/engine/geometry.ts`
- Test: `tests/engine/geometry.test.ts`

- [ ] **Step 1: Write failing test for calcAlpha**

Add to `tests/engine/geometry.test.ts`:

```typescript
import { calcAlpha } from '@/engine/geometry';

describe('calcAlpha', () => {
  // Uniform channel (single subsection, no LOB/ROB): alpha = 1.0
  const uniformChannel: CrossSectionPoint[] = [
    { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
    { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
    { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
  ];

  it('returns 1.0 for a uniform V-channel with no overbanks', () => {
    const alpha = calcAlpha(uniformChannel, 5);
    expect(alpha).toBeCloseTo(1.0, 1);
  });

  // Compound channel with wide shallow overbanks: alpha > 1.0
  const compoundChannel: CrossSectionPoint[] = [
    { station: 0, elevation: 8, manningsN: 0.06, bankStation: null },
    { station: 100, elevation: 5, manningsN: 0.06, bankStation: 'left' },
    { station: 120, elevation: 0, manningsN: 0.03, bankStation: null },
    { station: 180, elevation: 0, manningsN: 0.03, bankStation: null },
    { station: 200, elevation: 5, manningsN: 0.06, bankStation: 'right' },
    { station: 300, elevation: 8, manningsN: 0.06, bankStation: null },
  ];

  it('returns alpha > 1.0 for compound channel with wide overbanks', () => {
    const alpha = calcAlpha(compoundChannel, 7);
    expect(alpha).toBeGreaterThan(1.0);
    expect(alpha).toBeLessThan(3.0); // reasonable upper bound
  });

  it('returns 1.0 when flow is within main channel only', () => {
    // WSEL=3 is below bank elevation of 5, so only channel contributes
    const alpha = calcAlpha(compoundChannel, 3);
    expect(alpha).toBeCloseTo(1.0, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/engine/geometry.test.ts -t "calcAlpha" --reporter=verbose 2>&1 | tail -10`

Expected: FAIL — `calcAlpha` doesn't exist yet.

- [ ] **Step 3: Implement calcAlpha**

In `src/engine/geometry.ts`, first refactor `calcConveyance` to expose subsection data, then add `calcAlpha`.

Export `calcSubsectionProperties` by making it a public function (it's currently private). Then add:

```typescript
interface SubsectionResult {
  area: number;
  conveyance: number;
}

/**
 * Computes subsection conveyances for LOB, channel, ROB.
 */
export function calcSubsectionConveyances(
  crossSection: CrossSectionPoint[],
  wsel: number
): SubsectionResult[] {
  const [leftIdx, rightIdx] = findBankIndices(crossSection);

  const subsections = [
    crossSection.slice(0, leftIdx + 1),
    crossSection.slice(leftIdx, rightIdx + 1),
    crossSection.slice(rightIdx),
  ];

  return subsections.map((sub) => {
    const props = calcSubsectionProperties(sub, wsel);
    if (!props) return { area: 0, conveyance: 0 };
    const r = props.area / props.perim;
    const k = (1.486 / props.avgN) * props.area * Math.pow(r, 2 / 3);
    return { area: props.area, conveyance: k };
  });
}

/**
 * Computes velocity distribution coefficient alpha.
 * α = Σ(Kᵢ³/Aᵢ²) / (K_total³/A_total²)
 */
export function calcAlpha(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  const subs = calcSubsectionConveyances(crossSection, wsel);
  const totalK = subs.reduce((sum, s) => sum + s.conveyance, 0);
  const totalA = subs.reduce((sum, s) => sum + s.area, 0);

  if (totalK <= 0 || totalA <= 0) return 1.0;

  let numerator = 0;
  for (const s of subs) {
    if (s.area > 0 && s.conveyance > 0) {
      numerator += (s.conveyance ** 3) / (s.area ** 2);
    }
  }

  const denominator = (totalK ** 3) / (totalA ** 2);
  if (denominator <= 0) return 1.0;

  return numerator / denominator;
}
```

Refactor `calcConveyance` to use `calcSubsectionConveyances`:

```typescript
export function calcConveyance(
  crossSection: CrossSectionPoint[],
  wsel: number
): number {
  return calcSubsectionConveyances(crossSection, wsel)
    .reduce((sum, s) => sum + s.conveyance, 0);
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && npx vitest run tests/engine/geometry.test.ts --reporter=verbose 2>&1 | tail -15`

Expected: All geometry tests PASS including the new calcAlpha tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/geometry.ts tests/engine/geometry.test.ts
git commit -m "feat: add calcAlpha for velocity distribution coefficient"
```

---

## Task 4: Fix Yarnell Equation

**Files:**
- Modify: `src/engine/methods/yarnell.ts`
- Test: `tests/engine/methods/yarnell.test.ts`

- [ ] **Step 1: Write test for corrected Yarnell equation**

Replace `tests/engine/methods/yarnell.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runYarnell } from '@/engine/methods/yarnell';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9, lowChordRight: 9, highChord: 12,
  leftAbutmentStation: 5, rightAbutmentStation: 95,
  skewAngle: 0, contractionLength: 90, expansionLength: 90,
  orificeCd: 0.8, weirCw: 1.4, deckWidth: 0,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

const profile: FlowProfile = {
  name: '10-yr', ari: '', discharge: 2500, dsWsel: 8, channelSlope: 0.001,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
  maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
  debrisBlockagePct: 0, manningsNSensitivityPct: null,
  alphaOverride: null, freeboardThreshold: 0.984,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runYarnell', () => {
  it('computes backwater using corrected Froude-based equation', () => {
    const result = runYarnell(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.flowRegime).toBe('free-surface');
    expect(result.flowCalculationType).toBe('free-surface');
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);

    // Verify the equation uses Froude number:
    // For this geometry at WSEL=8: A≈320 ft², T≈80 ft, y=A/T=4.0 ft
    // V = 2500/320 ≈ 7.81 ft/s, Fr = V/√(gD) = 7.81/√(32.174×4) ≈ 0.688
    // Δy = K × Fr² × (K + 5Fr² - 0.6) × (α + 15α⁴) × y
    // The result should be noticeably different from the old (buggy) equation
    expect(result.totalHeadLoss).toBeGreaterThan(0.01);
    expect(result.totalHeadLoss).toBeLessThan(5.0);
  });

  it('flags not-applicable for pressure flow', () => {
    const pressureProfile: FlowProfile = { ...profile, dsWsel: 10 };
    const result = runYarnell(crossSection, bridge, pressureProfile, coefficients);
    expect(result.error).toContain('Not Applicable');
    expect(result.flowCalculationType).toBe('free-surface');
  });

  it('allows manual K override', () => {
    const manualK = { ...coefficients, yarnellK: 1.25 };
    const result = runYarnell(crossSection, bridge, profile, manualK);
    const autoResult = runYarnell(crossSection, bridge, profile, coefficients);
    // Manual K=1.25 (square) should give higher afflux than auto K=0.9 (round-nose)
    expect(result.totalHeadLoss).toBeGreaterThan(autoResult.totalHeadLoss);
  });

  it('produces zero afflux with zero pier blockage', () => {
    const noPiers: BridgeGeometry = { ...bridge, piers: [] };
    const result = runYarnell(crossSection, noPiers, profile, coefficients);
    // α = 0 → (α + 15α⁴) = 0 → Δy = 0
    expect(result.totalHeadLoss).toBeCloseTo(0, 4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/engine/methods/yarnell.test.ts --reporter=verbose 2>&1 | tail -15`

Expected: FAIL — old equation gives different values, `flowCalculationType` doesn't exist yet in output.

- [ ] **Step 3: Fix the Yarnell equation**

Replace the equation computation in `src/engine/methods/yarnell.ts`. The key change is in Step 4 (the Yarnell backwater equation) and adding `flowCalculationType`:

In the main body after computing `dsVelocity`, add hydraulic depth and Froude:

```typescript
  const dsHydDepth = dsTopWidth > 0 ? dsArea / dsTopWidth : 0;
  const Fr3 = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);
```

Replace the Step 4 computation:

```typescript
  // Step 4: Apply corrected Yarnell equation (HEC-RAS / Austroads standard)
  // Δy = K × Fr₃² × (K + 5·Fr₃² - 0.6) × (α + 15α⁴) × y₃
  const Fr3sq = Fr3 * Fr3;
  const dy = K * Fr3sq * (K + 5 * Fr3sq - 0.6) * (alpha + 15 * Math.pow(alpha, 4)) * dsHydDepth;

  steps.push({
    stepNumber: 4,
    description: 'Yarnell backwater equation (Froude-based)',
    formula: 'Δy = K × Fr₃² × (K + 5·Fr₃² − 0.6) × (α + 15α⁴) × y₃',
    intermediateValues: {
      K,
      Fr3: Fr3,
      'Fr₃²': Fr3sq,
      'K+5Fr²−0.6': K + 5 * Fr3sq - 0.6,
      'α+15α⁴': alpha + 15 * Math.pow(alpha, 4),
      y3: dsHydDepth,
    },
    result: dy,
    unit: 'ft',
  });
```

Add `flowCalculationType: 'free-surface'` to both return paths (the regime==='free-surface' path and the not-applicable path).

- [ ] **Step 4: Run tests**

Run: `cd app && npx vitest run tests/engine/methods/yarnell.test.ts --reporter=verbose 2>&1 | tail -15`

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/methods/yarnell.ts tests/engine/methods/yarnell.test.ts
git commit -m "fix: correct Yarnell equation to use Froude-based formulation"
```

---

## Task 5: Create Pressure Flow Solver

**Files:**
- Create: `src/engine/pressure-flow.ts`
- Create: `src/engine/deck-profile.ts`
- Test: `tests/engine/pressure-flow.test.ts`
- Test: `tests/engine/deck-profile.test.ts`

- [ ] **Step 1: Write deck-profile tests**

Create `tests/engine/deck-profile.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calcEffectiveWeirLength } from '@/engine/deck-profile';

describe('calcEffectiveWeirLength', () => {
  it('returns deckWidth when skew is 0', () => {
    expect(calcEffectiveWeirLength(10, 0)).toBe(10);
  });

  it('reduces length by cos(skew) for skewed bridges', () => {
    // cos(30°) ≈ 0.866
    expect(calcEffectiveWeirLength(10, 30)).toBeCloseTo(8.66, 1);
  });

  it('returns 0 for deckWidth 0', () => {
    expect(calcEffectiveWeirLength(0, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/engine/deck-profile.test.ts --reporter=verbose 2>&1 | tail -10`

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement deck-profile.ts**

Create `src/engine/deck-profile.ts`:

```typescript
/**
 * Computes effective weir length for overtopping calculations.
 * Adjusts deck width for bridge skew angle.
 */
export function calcEffectiveWeirLength(
  deckWidth: number,
  skewAngle: number
): number {
  if (deckWidth <= 0) return 0;
  if (skewAngle === 0) return deckWidth;
  const skewRad = (skewAngle * Math.PI) / 180;
  return deckWidth * Math.cos(skewRad);
}
```

- [ ] **Step 4: Run deck-profile tests**

Run: `cd app && npx vitest run tests/engine/deck-profile.test.ts --reporter=verbose 2>&1 | tail -10`

Expected: PASS

- [ ] **Step 5: Write pressure-flow tests**

Create `tests/engine/pressure-flow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runPressureFlow } from '@/engine/pressure-flow';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9, lowChordRight: 9, highChord: 12,
  leftAbutmentStation: 5, rightAbutmentStation: 95,
  skewAngle: 0, contractionLength: 90, expansionLength: 90,
  orificeCd: 0.8, weirCw: 1.4, deckWidth: 10,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

// DS WSEL at 10 exceeds low chord of 9 → pressure flow
const profile: FlowProfile = {
  name: 'Pressure', ari: '', discharge: 2500, dsWsel: 10, channelSlope: 0.001,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
  maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
  debrisBlockagePct: 0, manningsNSensitivityPct: null,
  alphaOverride: null, freeboardThreshold: 0.984,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runPressureFlow', () => {
  it('computes upstream WSEL > ds WSEL for pressure flow', () => {
    const result = runPressureFlow(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.converged).toBe(true);
    expect(result.flowCalculationType).toBe('orifice');
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });

  it('produces higher upstream WSEL with lower Cd', () => {
    const lowCd: BridgeGeometry = { ...bridge, orificeCd: 0.5 };
    const resultLow = runPressureFlow(crossSection, lowCd, profile, coefficients);
    const resultHigh = runPressureFlow(crossSection, bridge, profile, coefficients);
    // Lower Cd = more resistance = higher upstream WSEL
    expect(resultLow.upstreamWsel).toBeGreaterThan(resultHigh.upstreamWsel);
  });

  it('returns calculation steps documenting the orifice equation', () => {
    const result = runPressureFlow(crossSection, bridge, profile, coefficients);
    expect(result.calculationSteps.length).toBeGreaterThan(0);
    expect(result.calculationSteps.some(s => s.description.toLowerCase().includes('orifice'))).toBe(true);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd app && npx vitest run tests/engine/pressure-flow.test.ts --reporter=verbose 2>&1 | tail -10`

Expected: FAIL — module doesn't exist.

- [ ] **Step 7: Implement pressure-flow.ts**

Create `src/engine/pressure-flow.ts`:

```typescript
import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  MethodResult,
  CalculationStep,
} from './types';
import { calcFlowArea, calcTopWidth, calcHydraulicRadius, calcAlpha } from './geometry';
import { calcNetBridgeArea, calcPierBlockage, interpolateLowChord } from './bridge-geometry';
import { calcVelocity, calcFroudeNumber } from './hydraulics';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from './tuflow-flc';
import { solve } from './iteration';

const G = 32.174;

/**
 * Orifice flow solver for pressure flow regime.
 * Q = Cd × A_net × √(2g × ΔH)
 * Iterates on upstream WSEL to find where orifice Q matches input Q.
 */
export function runPressureFlow(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const Q = profile.discharge;
  const dsWsel = profile.dsWsel;
  const Cd = bridge.orificeCd;

  const midStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, midStation);

  // Step 1: Net bridge opening area at low chord (fully submerged)
  const netArea = calcNetBridgeArea(bridge, crossSection, lowChord, coefficients.debrisBlockagePct);

  steps.push({
    stepNumber: 1,
    description: 'Net bridge opening area (at low chord, fully submerged)',
    formula: 'A_net = gross area − pier blockage − debris',
    intermediateValues: { lowChord, A_net: netArea, Cd },
    result: netArea,
    unit: 'ft²',
  });

  // Step 2: Solve for upstream WSEL
  // Q = Cd × A_net × √(2g × (US_EGL − lowChord))
  // Rearranged: ΔH = (Q / (Cd × A_net))² / (2g)
  // US WSEL ≈ lowChord + ΔH + V²/2g (energy grade correction)

  const solverResult = solve({
    lowerBound: dsWsel,
    upperBound: dsWsel + 20,
    objectiveFn: (trialWsel) => {
      const deltaH = trialWsel - lowChord;
      if (deltaH <= 0) return trialWsel + 1; // push solver upward
      const qOrifice = Cd * netArea * Math.sqrt(2 * G * deltaH);
      // Scale error: if qOrifice < Q, WSEL needs to be higher
      const ratio = Q / qOrifice;
      // ΔH_needed = ΔH × ratio²
      const deltaH_needed = deltaH * ratio * ratio;
      return lowChord + deltaH_needed;
    },
    tolerance: coefficients.tolerance,
    maxIterations: coefficients.maxIterations,
  });

  const usWsel = solverResult.solution;
  const deltaH = usWsel - lowChord;

  steps.push({
    stepNumber: 2,
    description: 'Orifice equation — upstream WSEL',
    formula: 'Q = Cd × A_net × √(2g × ΔH), solve for ΔH',
    intermediateValues: { Q, Cd, A_net: netArea, deltaH },
    result: usWsel,
    unit: 'ft',
  });

  const totalLoss = usWsel - dsWsel;
  const usArea = calcFlowArea(crossSection, usWsel);
  const usTopWidth = calcTopWidth(crossSection, usWsel);
  const usVelocity = calcVelocity(Q, usArea);
  const froudeUs = calcFroudeNumber(usVelocity, usArea, usTopWidth);

  const dsArea = calcFlowArea(crossSection, dsWsel);
  const dsTopWidth = calcTopWidth(crossSection, dsWsel);
  const dsVelocity = calcVelocity(Q, dsArea);
  const froudeDs = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);

  const bridgeVelocity = calcVelocity(Q, netArea);
  const pierBlockage = calcPierBlockage(bridge.piers, crossSection, dsWsel);

  return {
    profileName: profile.name,
    upstreamWsel: usWsel,
    totalHeadLoss: totalLoss,
    approachVelocity: usVelocity,
    bridgeVelocity,
    froudeApproach: froudeUs,
    froudeBridge: froudeDs,
    flowRegime: 'pressure',
    flowCalculationType: 'orifice',
    iterationLog: solverResult.log,
    converged: solverResult.converged,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(totalLoss, usVelocity),
    tuflowSuperFLC: calcTuflowSuperFLC(totalLoss, usVelocity, 'pressure'),
    inputEcho: {
      flowArea: dsArea,
      hydraulicRadius: calcHydraulicRadius(crossSection, dsWsel),
      bridgeOpeningArea: netArea,
      pierBlockage,
    },
    error: solverResult.converged ? null : 'Max iterations reached without convergence',
  };
}
```

- [ ] **Step 8: Run pressure-flow tests**

Run: `cd app && npx vitest run tests/engine/pressure-flow.test.ts --reporter=verbose 2>&1 | tail -15`

Expected: All PASS.

- [ ] **Step 9: Commit**

```bash
git add src/engine/pressure-flow.ts src/engine/deck-profile.ts tests/engine/pressure-flow.test.ts tests/engine/deck-profile.test.ts
git commit -m "feat: add orifice pressure flow solver and deck profile utilities"
```

---

## Task 6: Create Overtopping Flow Solver

**Files:**
- Create: `src/engine/overtopping-flow.ts`
- Test: `tests/engine/overtopping-flow.test.ts`

- [ ] **Step 1: Write overtopping tests**

Create `tests/engine/overtopping-flow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runOvertoppingFlow } from '@/engine/overtopping-flow';
import { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients } from '@/engine/types';

const crossSection: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const bridge: BridgeGeometry = {
  lowChordLeft: 9, lowChordRight: 9, highChord: 12,
  leftAbutmentStation: 5, rightAbutmentStation: 95,
  skewAngle: 0, contractionLength: 90, expansionLength: 90,
  orificeCd: 0.8, weirCw: 1.4, deckWidth: 10,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

// DS WSEL at 13 exceeds high chord of 12 → overtopping
const profile: FlowProfile = {
  name: 'Overtopping', ari: '', discharge: 5000, dsWsel: 13, channelSlope: 0.001,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
  maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
  debrisBlockagePct: 0, manningsNSensitivityPct: null,
  alphaOverride: null, freeboardThreshold: 0.984,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runOvertoppingFlow', () => {
  it('computes upstream WSEL > ds WSEL for overtopping flow', () => {
    const result = runOvertoppingFlow(crossSection, bridge, profile, coefficients);
    expect(result.error).toBeNull();
    expect(result.converged).toBe(true);
    expect(result.flowCalculationType).toBe('orifice+weir');
    expect(result.upstreamWsel).toBeGreaterThan(profile.dsWsel);
  });

  it('splits flow between orifice and weir', () => {
    const result = runOvertoppingFlow(crossSection, bridge, profile, coefficients);
    // Check that calculation steps mention both orifice and weir
    const stepDescs = result.calculationSteps.map(s => s.description.toLowerCase());
    expect(stepDescs.some(d => d.includes('orifice'))).toBe(true);
    expect(stepDescs.some(d => d.includes('weir'))).toBe(true);
  });

  it('produces higher WSEL with smaller deckWidth (less weir capacity)', () => {
    const narrowDeck: BridgeGeometry = { ...bridge, deckWidth: 3 };
    const resultNarrow = runOvertoppingFlow(crossSection, narrowDeck, profile, coefficients);
    const resultWide = runOvertoppingFlow(crossSection, bridge, profile, coefficients);
    expect(resultNarrow.upstreamWsel).toBeGreaterThan(resultWide.upstreamWsel);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/engine/overtopping-flow.test.ts --reporter=verbose 2>&1 | tail -10`

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement overtopping-flow.ts**

Create `src/engine/overtopping-flow.ts`:

```typescript
import {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  MethodResult,
  CalculationStep,
} from './types';
import { calcFlowArea, calcTopWidth, calcHydraulicRadius } from './geometry';
import { calcNetBridgeArea, calcPierBlockage, interpolateLowChord } from './bridge-geometry';
import { calcVelocity, calcFroudeNumber } from './hydraulics';
import { calcTuflowPierFLC, calcTuflowSuperFLC } from './tuflow-flc';
import { calcEffectiveWeirLength } from './deck-profile';
import { solve } from './iteration';

const G = 32.174;

/**
 * Combined orifice + weir solver for overtopping flow regime.
 * Q_total = Q_orifice + Q_weir
 * Orifice: Q = Cd × A_net × √(2g × ΔH)
 * Weir: Q = Cw × L_weir × H^1.5
 */
export function runOvertoppingFlow(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  coefficients: Coefficients
): MethodResult {
  const steps: CalculationStep[] = [];
  const Q = profile.discharge;
  const dsWsel = profile.dsWsel;
  const Cd = bridge.orificeCd;
  const Cw = bridge.weirCw;

  const midStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, midStation);
  const highChord = bridge.highChord;
  const weirLength = calcEffectiveWeirLength(bridge.deckWidth, bridge.skewAngle);

  // Net bridge opening area (fully submerged at low chord)
  const netArea = calcNetBridgeArea(bridge, crossSection, lowChord, coefficients.debrisBlockagePct);

  steps.push({
    stepNumber: 1,
    description: 'Bridge opening and weir parameters',
    formula: 'A_net at low chord, L_weir adjusted for skew',
    intermediateValues: { A_net: netArea, Cd, Cw, L_weir: weirLength, highChord },
    result: netArea,
    unit: 'ft²',
  });

  // Solve for upstream WSEL where Q_orifice + Q_weir = Q_total
  const solverResult = solve({
    lowerBound: dsWsel,
    upperBound: dsWsel + 20,
    objectiveFn: (trialWsel) => {
      // Orifice component
      const deltaH_orifice = trialWsel - lowChord;
      const qOrifice = deltaH_orifice > 0
        ? Cd * netArea * Math.sqrt(2 * G * deltaH_orifice)
        : 0;

      // Weir component
      const H_weir = trialWsel - highChord;
      const qWeir = H_weir > 0 && weirLength > 0
        ? Cw * weirLength * Math.pow(H_weir, 1.5)
        : 0;

      const qTotal = qOrifice + qWeir;
      if (qTotal <= 0) return trialWsel + 1;

      // Newton-like scaling: adjust trial based on Q deficit
      const ratio = Q / qTotal;
      // Approximate: WSEL scales roughly with Q^(2/3) for weir + Q^2 for orifice
      // Use geometric mean of adjustments
      const adjustment = Math.pow(ratio, 0.67);
      const deltaFromDs = trialWsel - dsWsel;
      return dsWsel + deltaFromDs * adjustment;
    },
    tolerance: coefficients.tolerance,
    maxIterations: coefficients.maxIterations,
  });

  const usWsel = solverResult.solution;
  const deltaH_orifice = usWsel - lowChord;
  const qOrifice = deltaH_orifice > 0 ? Cd * netArea * Math.sqrt(2 * G * deltaH_orifice) : 0;
  const H_weir = usWsel - highChord;
  const qWeir = H_weir > 0 && weirLength > 0 ? Cw * weirLength * Math.pow(H_weir, 1.5) : 0;

  steps.push({
    stepNumber: 2,
    description: 'Orifice flow component',
    formula: 'Q_orf = Cd × A_net × √(2g × ΔH)',
    intermediateValues: { deltaH: deltaH_orifice, Cd, A_net: netArea },
    result: qOrifice,
    unit: 'cfs',
  });

  steps.push({
    stepNumber: 3,
    description: 'Weir flow component',
    formula: 'Q_weir = Cw × L × H^1.5',
    intermediateValues: { H_weir: Math.max(0, H_weir), Cw, L: weirLength },
    result: qWeir,
    unit: 'cfs',
  });

  steps.push({
    stepNumber: 4,
    description: 'Upstream WSEL from combined orifice + weir',
    formula: 'Q_total = Q_orf + Q_weir, solve for US WSEL',
    intermediateValues: { Q_orifice: qOrifice, Q_weir: qWeir, Q_total: Q },
    result: usWsel,
    unit: 'ft',
  });

  const totalLoss = usWsel - dsWsel;
  const usArea = calcFlowArea(crossSection, usWsel);
  const usTopWidth = calcTopWidth(crossSection, usWsel);
  const usVelocity = calcVelocity(Q, usArea);
  const froudeUs = calcFroudeNumber(usVelocity, usArea, usTopWidth);

  const dsArea = calcFlowArea(crossSection, dsWsel);
  const dsTopWidth = calcTopWidth(crossSection, dsWsel);
  const dsVelocity = calcVelocity(Q, dsArea);
  const froudeDs = calcFroudeNumber(dsVelocity, dsArea, dsTopWidth);

  const bridgeVelocity = calcVelocity(Q, netArea);
  const pierBlockage = calcPierBlockage(bridge.piers, crossSection, dsWsel);

  return {
    profileName: profile.name,
    upstreamWsel: usWsel,
    totalHeadLoss: totalLoss,
    approachVelocity: usVelocity,
    bridgeVelocity,
    froudeApproach: froudeUs,
    froudeBridge: froudeDs,
    flowRegime: 'overtopping',
    flowCalculationType: 'orifice+weir',
    iterationLog: solverResult.log,
    converged: solverResult.converged,
    calculationSteps: steps,
    tuflowPierFLC: calcTuflowPierFLC(totalLoss, usVelocity),
    tuflowSuperFLC: calcTuflowSuperFLC(totalLoss, usVelocity, 'overtopping'),
    inputEcho: {
      flowArea: dsArea,
      hydraulicRadius: calcHydraulicRadius(crossSection, dsWsel),
      bridgeOpeningArea: netArea,
      pierBlockage,
    },
    error: solverResult.converged ? null : 'Max iterations reached without convergence',
  };
}
```

- [ ] **Step 4: Run overtopping tests**

Run: `cd app && npx vitest run tests/engine/overtopping-flow.test.ts --reporter=verbose 2>&1 | tail -15`

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/overtopping-flow.ts tests/engine/overtopping-flow.test.ts
git commit -m "feat: add combined orifice+weir overtopping flow solver"
```

---

## Task 7: Update Energy Method — Bridge Velocity Iteration, Alpha, Regime Dispatch

**Files:**
- Modify: `src/engine/methods/energy.ts`
- Modify: `tests/engine/methods/energy.test.ts`

- [ ] **Step 1: Write tests for the updated energy method**

Update `tests/engine/methods/energy.test.ts` to test alpha usage, bridge velocity iteration, and regime dispatch. Add these tests:

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
  lowChordLeft: 9, lowChordRight: 9, highChord: 12,
  leftAbutmentStation: 5, rightAbutmentStation: 95,
  skewAngle: 0, contractionLength: 90, expansionLength: 90,
  orificeCd: 0.8, weirCw: 1.4, deckWidth: 10,
  piers: [{ station: 50, width: 3, shape: 'round-nose' }],
  lowChordProfile: [],
};

const freeSurfaceProfile: FlowProfile = {
  name: 'Free', ari: '', discharge: 2500, dsWsel: 5, channelSlope: 0.001,
};

const pressureProfile: FlowProfile = {
  name: 'Pressure', ari: '', discharge: 2500, dsWsel: 10, channelSlope: 0.001,
};

const coefficients: Coefficients = {
  contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
  maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
  debrisBlockagePct: 0, manningsNSensitivityPct: null,
  alphaOverride: null, freeboardThreshold: 0.984,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

describe('runEnergy', () => {
  it('computes free-surface result with flowCalculationType', () => {
    const result = runEnergy(crossSection, bridge, freeSurfaceProfile, coefficients);
    expect(result.error).toBeNull();
    expect(result.flowCalculationType).toBe('free-surface');
    expect(result.upstreamWsel).toBeGreaterThan(freeSurfaceProfile.dsWsel);
  });

  it('dispatches to pressure flow when WSEL > low chord', () => {
    const result = runEnergy(crossSection, bridge, pressureProfile, coefficients);
    expect(result.flowCalculationType).toBe('orifice');
    expect(result.flowRegime).toBe('pressure');
  });

  it('respects alpha override', () => {
    const withAlpha = { ...coefficients, alphaOverride: 1.5 };
    const resultOverride = runEnergy(crossSection, bridge, freeSurfaceProfile, withAlpha);
    const resultAuto = runEnergy(crossSection, bridge, freeSurfaceProfile, coefficients);
    // Higher alpha → higher velocity heads → different afflux
    expect(resultOverride.upstreamWsel).not.toBeCloseTo(resultAuto.upstreamWsel, 3);
  });

  it('uses reach lengths from bridge geometry', () => {
    const shortReach: BridgeGeometry = { ...bridge, contractionLength: 10, expansionLength: 10 };
    const longReach: BridgeGeometry = { ...bridge, contractionLength: 500, expansionLength: 500 };
    const resultShort = runEnergy(crossSection, shortReach, freeSurfaceProfile, coefficients);
    const resultLong = runEnergy(crossSection, longReach, freeSurfaceProfile, coefficients);
    // Longer reach → more friction loss → higher upstream WSEL
    expect(resultLong.upstreamWsel).toBeGreaterThan(resultShort.upstreamWsel);
  });
});
```

- [ ] **Step 2: Run test to verify failures**

Run: `cd app && npx vitest run tests/engine/methods/energy.test.ts --reporter=verbose 2>&1 | tail -15`

Expected: FAIL — `flowCalculationType` not in output, no regime dispatch, etc.

- [ ] **Step 3: Update energy.ts**

Major changes to `src/engine/methods/energy.ts`:

1. Import `runPressureFlow` from `../pressure-flow` and `runOvertoppingFlow` from `../overtopping-flow`.
2. Import `calcAlpha` from `../geometry`.
3. At the top of `runEnergy`, after detecting flow regime, dispatch to shared solvers:
   ```typescript
   if (regime === 'pressure') {
     return runPressureFlow(crossSection, bridge, profile, coefficients);
   }
   if (regime === 'overtopping') {
     return runOvertoppingFlow(crossSection, bridge, profile, coefficients);
   }
   ```
4. Use `bridge.contractionLength` and `bridge.expansionLength` instead of `profile.contractionLength` and `profile.expansionLength`.
5. Compute alpha: `const alpha = coefficients.alphaOverride ?? calcAlpha(crossSection, dsWsel);`
6. Use alpha in `calcVelocityHead` calls: `calcVelocityHead(velocity, alpha)`.
7. Inside the solver's `objectiveFn`, recompute bridge area at the average of `trialWsel` and `dsWsel`:
   ```typescript
   const bridgeWsel = (trialWsel + dsWsel) / 2;
   const iterBridgeArea = calcNetBridgeArea(bridge, crossSection, bridgeWsel, coefficients.debrisBlockagePct);
   const iterBridgeVelocity = calcVelocity(Q, iterBridgeArea);
   const iterBridgeVh = calcVelocityHead(iterBridgeVelocity, alpha);
   ```
8. Add `flowCalculationType: 'free-surface'` to the return object.

- [ ] **Step 4: Run tests**

Run: `cd app && npx vitest run tests/engine/methods/energy.test.ts --reporter=verbose 2>&1 | tail -15`

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/methods/energy.ts tests/engine/methods/energy.test.ts
git commit -m "feat: energy method — alpha, bridge velocity iteration, regime dispatch"
```

---

## Task 8: Update Momentum and WSPRO Methods

**Files:**
- Modify: `src/engine/methods/momentum.ts`
- Modify: `src/engine/methods/wspro.ts`
- Modify: `tests/engine/methods/momentum.test.ts`
- Modify: `tests/engine/methods/wspro.test.ts`

- [ ] **Step 1: Update momentum.ts**

Apply the same pattern as energy:
1. Import `runPressureFlow`, `runOvertoppingFlow`, `calcAlpha`.
2. Dispatch to shared solvers for pressure/overtopping regimes at the top.
3. Use `bridge.contractionLength`/`bridge.expansionLength`.
4. Compute and use alpha in velocity head calculations.
5. Add `flowCalculationType: 'free-surface'` to the return.

- [ ] **Step 2: Update wspro.ts**

Apply the same pattern:
1. Import `runPressureFlow`, `runOvertoppingFlow`, `calcAlpha`.
2. Dispatch to shared solvers for pressure/overtopping.
3. Use `bridge.contractionLength`/`bridge.expansionLength` (WSPRO doesn't use reach lengths directly, but the pressure/overtopping dispatch does).
4. Use alpha in the backwater computation: `const dsVh = calcVelocityHead(dsVelocity, alpha);`
5. Add `flowCalculationType: 'free-surface'` to the return.

- [ ] **Step 3: Update momentum tests**

Update `tests/engine/methods/momentum.test.ts` to use the new type shapes (remove `contractionLength`/`expansionLength` from profile, add to bridge, add new fields to coefficients and bridge). Add a test for pressure dispatch:

```typescript
it('dispatches to orifice solver for pressure flow', () => {
  const pressureProfile: FlowProfile = { ...profile, dsWsel: 10 };
  const result = runMomentum(crossSection, bridge, pressureProfile, coefficients);
  expect(result.flowCalculationType).toBe('orifice');
});
```

- [ ] **Step 4: Update WSPRO tests**

Same pattern: update type shapes, add pressure dispatch test.

- [ ] **Step 5: Run all method tests**

Run: `cd app && npx vitest run tests/engine/methods/ --reporter=verbose 2>&1 | tail -20`

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/methods/momentum.ts src/engine/methods/wspro.ts tests/engine/methods/
git commit -m "feat: momentum and WSPRO — alpha, regime dispatch, type updates"
```

---

## Task 9: Update Engine Index and TUFLOW FLC

**Files:**
- Modify: `src/engine/index.ts`
- Modify: `src/engine/tuflow-flc.ts`
- Modify: `src/engine/freeboard.ts`
- Modify: `tests/engine/tuflow-flc.test.ts`

- [ ] **Step 1: Update engine/index.ts**

No functional changes needed — `runAllMethods` already passes the full `bridge` object and `coefficients` through. The `runWithSensitivity` function also works as-is since it only varies Manning's n.

Verify the imports are clean and the function signatures still align.

- [ ] **Step 2: Update TUFLOW superstructure FLC**

The `calcTuflowSuperFLC` function signature is already correct (takes `superHeadLoss`, `approachVelocity`, `regime`). The callers in the pressure/overtopping solvers now pass real `totalLoss` values instead of 0. No changes needed to `tuflow-flc.ts` itself.

Update `tests/engine/tuflow-flc.test.ts` to add a test for real superstructure FLC:

```typescript
it('computes non-zero superstructure FLC for pressure flow', () => {
  const result = calcTuflowSuperFLC(2.5, 6.0, 'pressure');
  // FLC = 2.5 / (6²/(2×32.174)) = 2.5 / 0.559 ≈ 4.47
  expect(result).toBeCloseTo(4.47, 1);
});

it('computes non-zero superstructure FLC for overtopping', () => {
  const result = calcTuflowSuperFLC(1.0, 4.0, 'overtopping');
  expect(result).not.toBeNull();
  expect(result).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Update freeboard.ts for envelope and configurable threshold**

Replace `src/engine/freeboard.ts`:

```typescript
import { BridgeGeometry, FlowProfile, CalculationResults, MethodResult, FreeboardResult, FreeboardSummary } from './types';
import { interpolateLowChord } from './bridge-geometry';

export function computeFreeboard(
  results: CalculationResults,
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  freeboardThreshold: number
): FreeboardSummary {
  const centerStation = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
  const lowChord = interpolateLowChord(bridge, centerStation);

  // Use envelope (worst-case US WSEL) across all enabled methods
  const freeboardResults: FreeboardResult[] = profiles.map((profile, i) => {
    let worstUsWsel = profile.dsWsel;

    for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
      const r = results[method][i];
      if (r && !r.error && r.upstreamWsel > worstUsWsel) {
        worstUsWsel = r.upstreamWsel;
      }
    }

    const freeboard = lowChord - worstUsWsel;

    let status: FreeboardResult['status'];
    if (worstUsWsel >= bridge.highChord) {
      status = 'overtopping';
    } else if (freeboard <= 0) {
      status = 'pressure';
    } else if (freeboard <= freeboardThreshold) {
      status = 'low';
    } else {
      status = 'clear';
    }

    return {
      profileName: profile.name,
      ari: profile.ari,
      discharge: profile.discharge,
      dsWsel: profile.dsWsel,
      usWsel: worstUsWsel,
      lowChord,
      freeboard,
      status,
    };
  });

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

Note the signature change: now takes full `CalculationResults` instead of just `energy` results, plus the `freeboardThreshold`.

- [ ] **Step 4: Run all engine tests**

Run: `cd app && npx vitest run tests/engine/ --reporter=verbose 2>&1 | tail -20`

Expected: All PASS (some tests may need type fixture updates — fix any remaining failures).

- [ ] **Step 5: Commit**

```bash
git add src/engine/index.ts src/engine/tuflow-flc.ts src/engine/freeboard.ts tests/engine/
git commit -m "feat: envelope freeboard, real superstructure FLC, engine index cleanup"
```

---

## Task 10: Update Validation

**Files:**
- Modify: `src/lib/validation.ts`
- Modify: `tests/lib/validation.test.ts`

- [ ] **Step 1: Write tests for new validation checks**

Add to `tests/lib/validation.test.ts`:

```typescript
describe('new validation checks', () => {
  it('errors when DS WSEL is below channel invert', () => {
    // Lowest elevation in validCrossSection is 0. WSEL of -1 is below invert.
    const lowProfiles: FlowProfile[] = [{ name: 'Low', ari: '', discharge: 100, dsWsel: -1, channelSlope: 0.001 }];
    const errors = validateInputs(validCrossSection, validBridge, lowProfiles);
    expect(errors.some(e => e.severity === 'error' && e.message.includes('below'))).toBe(true);
  });

  it('errors when pier station is outside abutments', () => {
    const badPiers: BridgeGeometry = { ...validBridge, piers: [{ station: 200, width: 3, shape: 'round-nose' }] };
    const errors = validateInputs(validCrossSection, badPiers, validProfiles);
    expect(errors.some(e => e.severity === 'error' && e.message.includes('outside'))).toBe(true);
  });

  it('errors when abutment stations are outside cross-section', () => {
    const badBridge: BridgeGeometry = { ...validBridge, leftAbutmentStation: -50 };
    const errors = validateInputs(validCrossSection, badBridge, validProfiles);
    expect(errors.some(e => e.severity === 'error' && e.message.includes('outside'))).toBe(true);
  });

  it('errors when reach lengths are zero', () => {
    const noReach: BridgeGeometry = { ...validBridge, contractionLength: 0, expansionLength: 0 };
    const errors = validateInputs(validCrossSection, noReach, validProfiles);
    expect(errors.some(e => e.severity === 'error' && e.message.includes('positive'))).toBe(true);
  });

  it('warns on unusual mannings n', () => {
    const highN = validCrossSection.map((p, i) => i === 1 ? { ...p, manningsN: 0.5 } : p);
    const errors = validateInputs(highN, validBridge, validProfiles);
    expect(errors.some(e => e.severity === 'warning' && e.message.includes('unusual'))).toBe(true);
  });
});
```

Note: Update `validBridge` and `validProfiles` test fixtures to match the new types (add `contractionLength`, `expansionLength`, `orificeCd`, `weirCw`, `deckWidth` to bridge; remove reach lengths from profiles).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/validation.test.ts --reporter=verbose 2>&1 | tail -15`

Expected: FAIL — new checks don't exist.

- [ ] **Step 3: Implement new validation checks**

Update `src/lib/validation.ts`:

```typescript
import { CrossSectionPoint, BridgeGeometry, FlowProfile } from '@/engine/types';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export function validateInputs(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (crossSection.length < 2) {
    errors.push({ field: 'crossSection', message: 'At least 2 cross-section points required', severity: 'error' });
  }

  const hasLeftBank = crossSection.some(p => p.bankStation === 'left');
  const hasRightBank = crossSection.some(p => p.bankStation === 'right');
  if (!hasLeftBank || !hasRightBank) {
    errors.push({ field: 'crossSection', message: 'Left and right bank stations must be defined', severity: 'error' });
  }

  for (let i = 0; i < crossSection.length; i++) {
    if (crossSection[i].manningsN <= 0) {
      errors.push({ field: `crossSection[${i}].manningsN`, message: "Manning's n must be positive", severity: 'error' });
    }
    if (crossSection[i].manningsN > 0 && (crossSection[i].manningsN < 0.01 || crossSection[i].manningsN > 0.3)) {
      errors.push({ field: `crossSection[${i}].manningsN`, message: `Manning's n of ${crossSection[i].manningsN} at station ${crossSection[i].station} is unusual — verify`, severity: 'warning' });
    }
  }

  if (bridge.leftAbutmentStation >= bridge.rightAbutmentStation) {
    errors.push({ field: 'bridge', message: 'Left abutment must be left of right abutment', severity: 'error' });
  }

  if (bridge.lowChordLeft >= bridge.highChord || bridge.lowChordRight >= bridge.highChord) {
    errors.push({ field: 'bridge', message: 'Low chord must be below high chord', severity: 'error' });
  }

  // Abutment stations within cross-section bounds
  if (crossSection.length >= 2) {
    const minSta = crossSection[0].station;
    const maxSta = crossSection[crossSection.length - 1].station;
    if (bridge.leftAbutmentStation < minSta || bridge.leftAbutmentStation > maxSta) {
      errors.push({ field: 'bridge', message: `Left abutment station is outside the cross-section extents (${minSta}–${maxSta})`, severity: 'error' });
    }
    if (bridge.rightAbutmentStation < minSta || bridge.rightAbutmentStation > maxSta) {
      errors.push({ field: 'bridge', message: `Right abutment station is outside the cross-section extents (${minSta}–${maxSta})`, severity: 'error' });
    }
  }

  // Pier stations within abutment range
  for (let i = 0; i < bridge.piers.length; i++) {
    const pier = bridge.piers[i];
    if (pier.station < bridge.leftAbutmentStation || pier.station > bridge.rightAbutmentStation) {
      errors.push({ field: `bridge.piers[${i}]`, message: `Pier ${i + 1} station (${pier.station}) is outside the bridge opening (${bridge.leftAbutmentStation}–${bridge.rightAbutmentStation})`, severity: 'error' });
    }
  }

  // Reach lengths
  if (bridge.contractionLength <= 0 || bridge.expansionLength <= 0) {
    errors.push({ field: 'bridge', message: 'Reach lengths must be positive', severity: 'error' });
  }

  if (profiles.length === 0) {
    errors.push({ field: 'profiles', message: 'At least one flow profile required', severity: 'error' });
  }

  // DS WSEL checks
  const minElev = crossSection.length > 0 ? Math.min(...crossSection.map(p => p.elevation)) : 0;
  for (let i = 0; i < profiles.length; i++) {
    if (profiles[i].discharge <= 0) {
      errors.push({ field: `profiles[${i}].discharge`, message: 'Discharge must be positive', severity: 'error' });
    }
    if (profiles[i].dsWsel < minElev) {
      errors.push({ field: `profiles[${i}].dsWsel`, message: `DS WSEL (${profiles[i].dsWsel.toFixed(2)}) is below the lowest cross-section elevation (${minElev.toFixed(2)})`, severity: 'error' });
    }
  }

  return errors;
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && npx vitest run tests/lib/validation.test.ts --reporter=verbose 2>&1 | tail -15`

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts tests/lib/validation.test.ts
git commit -m "feat: add validation checks for WSEL, pier/abutment bounds, reach lengths, Manning's n"
```

---

## Task 11: Update Test Bridges

**Files:**
- Modify: `src/lib/test-bridges.ts`

- [ ] **Step 1: Update all test bridge data**

For each bridge in `test-bridges.ts`:
1. Add `contractionLength` and `expansionLength` to `bridgeGeometry` (move from first flow profile).
2. Add `orificeCd: 0.8`, `weirCw: 1.4`, `deckWidth` (use a sensible value per bridge — e.g., 8 for Windsor, 6 for Breakfast Creek, etc.).
3. Remove `leftAbutmentSlope` and `rightAbutmentSlope`.
4. Remove `contractionLength` and `expansionLength` from every `flowProfiles` entry.
5. Add `alphaOverride: null` and `freeboardThreshold: 0.984` to coefficients.
6. Add `debrisBlockagePct: 0` where missing.

For the V-Channel Benchmark, update the `expectedResults` to remove the old Yarnell expected values (they'll be wrong with the corrected equation). Replace with a comment that these need recalculating after the equation fix. Or better: compute the correct expected values using the new formula and update them.

Add one flow profile to Breakfast Creek that triggers pressure flow (e.g., a PMF scenario with dsWsel above the low chord of 12):

```typescript
{
  name: 'PMF',
  ari: 'PMF',
  discharge: 21200,
  dsWsel: 13,
  channelSlope: 0.002,
},
```

- [ ] **Step 2: Run full test suite**

Run: `cd app && npx vitest run --reporter=verbose 2>&1 | tail -30`

Expected: Engine tests pass. Some validation/store tests may need fixture updates — fix any remaining failures.

- [ ] **Step 3: Commit**

```bash
git add src/lib/test-bridges.ts
git commit -m "refactor: update test bridges for new type shape, add pressure flow scenario"
```

---

## Task 12: Update UI — Bridge Geometry Form

**Files:**
- Modify: `src/components/input/bridge-geometry-form.tsx`

- [ ] **Step 1: Update the form**

1. Remove `leftAbutmentSlope` and `rightAbutmentSlope` fields from the `fields` array.
2. Add `contractionLength` and `expansionLength` to the `fields` array (after skewAngle).
3. Add these fields to the `lengthFields` set.
4. Add a new "Pressure / Overtopping" section after the main fields grid with three inputs: `orificeCd`, `weirCw`, `deckWidth`. Group under a sub-heading with description "Used when WSEL exceeds low chord".

The new section markup:

```tsx
<div className="h-px bg-border/50 my-4" />
<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Pressure / Overtopping</div>
<p className="text-xs text-muted-foreground mb-3">Used when WSEL exceeds low chord</p>
<div className="grid grid-cols-3 gap-4">
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">Orifice Cd</Label>
    <Input type="number" value={bridge.orificeCd} onChange={(e) => setField('orificeCd', e.target.value)} className="h-8 text-sm font-mono" step="0.1" min="0.1" max="1.0" />
  </div>
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">Weir Cw</Label>
    <Input type="number" value={bridge.weirCw} onChange={(e) => setField('weirCw', e.target.value)} className="h-8 text-sm font-mono" step="0.1" min="0.5" max="3.0" />
  </div>
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">Deck Width ({lenUnit})</Label>
    <Input type="number" value={toDisplay(bridge.deckWidth, 'length', us)} onChange={(e) => setField('deckWidth', e.target.value)} className="h-8 text-sm font-mono" />
  </div>
</div>
```

Add `'deckWidth'` to `lengthFields`. Do NOT add `orificeCd` or `weirCw` (they're dimensionless).

- [ ] **Step 2: Verify the form renders (manual check)**

Run: `cd app && npm run dev`

Open the app, navigate to Bridge Geometry tab. Verify:
- Abutment slope fields are gone
- Contraction/Expansion length fields appear
- Pressure / Overtopping section with Cd, Cw, Deck Width appears
- Values are editable

- [ ] **Step 3: Commit**

```bash
git add src/components/input/bridge-geometry-form.tsx
git commit -m "feat: update bridge geometry form — remove dead inputs, add pressure/overtopping fields"
```

---

## Task 13: Update UI — Flow Profiles and Coefficients Forms

**Files:**
- Modify: `src/components/input/flow-profiles-form.tsx`
- Modify: `src/components/input/coefficients-form.tsx`
- Modify: `src/components/input/action-buttons.tsx`

- [ ] **Step 1: Update flow profiles form**

Remove the `contractionLength` and `expansionLength` columns from the `columns` array and `fieldUnitType` map. The table should now have: Name, ARI/AEP, Q, DS WSEL, Channel Slope.

- [ ] **Step 2: Update coefficients form**

After the "Solver" section, add two new fields inside the solver grid (making it 6 columns or adding a new row):

```tsx
<div className="space-y-1.5">
  <Label className="text-xs text-muted-foreground">Alpha (α₁)</Label>
  <Input type="number" value={coefficients.alphaOverride ?? ''} onChange={(e) => update({ ...coefficients, alphaOverride: e.target.value ? Math.max(0.5, parseFloat(e.target.value)) : null })} className="h-8 text-sm font-mono" step="0.1" min="0.5" max="5" placeholder="Auto" />
</div>
<div className="space-y-1.5">
  <Label className="text-xs text-muted-foreground">Freeboard Threshold ({lenUnit})</Label>
  <Input type="number" value={toDisplay(coefficients.freeboardThreshold, 'length', us)} onChange={(e) => setField('freeboardThreshold', toImperial(parseFloat(e.target.value) || 0.3, 'length', us))} className="h-8 text-sm font-mono" step="0.1" />
</div>
```

- [ ] **Step 3: Update action-buttons.tsx**

The `handleLoadTestBridge` function currently converts fields that no longer exist on FlowProfile (`contractionLength`, `expansionLength`). Remove those conversions from the flow profiles mapping. Add them to the bridge geometry mapping instead. Also add the new bridge fields (`orificeCd`, `weirCw`, `deckWidth`) and coefficients fields (`alphaOverride`, `freeboardThreshold`).

Remove `leftAbutmentSlope`/`rightAbutmentSlope` from the bridge geometry conversion.

- [ ] **Step 4: Verify all forms render (manual check)**

Run dev server. Check:
- Flow Profiles table has 5 columns (no reach lengths)
- Coefficients form has Alpha and Freeboard Threshold fields
- "Load Test Bridge" button populates all forms correctly

- [ ] **Step 5: Commit**

```bash
git add src/components/input/flow-profiles-form.tsx src/components/input/coefficients-form.tsx src/components/input/action-buttons.tsx
git commit -m "feat: update flow profiles, coefficients forms, and test bridge loader"
```

---

## Task 14: Update UI — Summary Tab

**Files:**
- Modify: `src/components/summary/freeboard-check.tsx`
- Modify: `src/components/summary/comparison-tables.tsx`
- Modify: `src/components/main-tabs.tsx`

- [ ] **Step 1: Update freeboard-check.tsx**

Change the `computeFreeboard` call to pass full results and the threshold:

```typescript
const coefficients = useProjectStore((s) => s.coefficients);
// ...
if (!results) return null;

const freeboard = computeFreeboard(results, bridge, profiles, coefficients.freeboardThreshold);
```

Add the threshold display in the footer:

```tsx
<span className="text-muted-foreground ml-4">Low threshold: <span className="font-mono font-medium text-foreground">{toDisplay(coefficients.freeboardThreshold, 'length', us).toFixed(2)} {len}</span></span>
```

Remove the `results.energy.length === 0` guard — now checks `!results` only since we use the envelope of all methods.

- [ ] **Step 2: Update comparison-tables.tsx — add ORF/ORF+WR annotations**

In the `MethodRows` component, after the value display, add a regime annotation:

```tsx
{r.error ? (
  <span className="text-destructive">ERR</span>
) : (
  <>
    {getValue(r)}
    {r.flowCalculationType !== 'free-surface' && (
      <span className="ml-1 text-[10px] text-purple-400">
        {r.flowCalculationType === 'orifice' ? 'ORF' : 'ORF+WR'}
      </span>
    )}
  </>
)}
```

- [ ] **Step 3: Update main-tabs.tsx — add internal units note**

Next to the Metric/Imperial toggle, add a subtle note:

```tsx
<span className="text-[11px] text-muted-foreground/60 italic ml-2">Engine: US Customary internally</span>
```

- [ ] **Step 4: Verify summary tab renders (manual check)**

Load a test bridge, run calculations, check:
- Freeboard check uses envelope and shows threshold
- Comparison table annotates pressure results
- Internal units note appears

- [ ] **Step 5: Commit**

```bash
git add src/components/summary/freeboard-check.tsx src/components/summary/comparison-tables.tsx src/components/main-tabs.tsx
git commit -m "feat: update summary — envelope freeboard, regime annotations, units note"
```

---

## Task 15: Final Integration Test and Cleanup

**Files:**
- Modify: `tests/engine/validation-benchmarks.test.ts`
- Modify: `tests/store/project-store.test.ts`

- [ ] **Step 1: Update validation benchmark tests**

The V-Channel benchmark expected values for Yarnell will have changed due to the equation fix. Update the expected values to match the corrected Froude-based equation. Run the Yarnell method on the V-Channel and capture the new output to use as the expected values.

Also update all test fixtures in `validation-benchmarks.test.ts` to use the new type shapes.

- [ ] **Step 2: Update store tests**

Update `tests/store/project-store.test.ts` fixtures to match the new default shapes (no abutment slopes, has reach lengths in bridge, has new coefficient fields).

- [ ] **Step 3: Run the full test suite**

Run: `cd app && npx vitest run --reporter=verbose 2>&1 | tail -40`

Expected: All tests PASS.

- [ ] **Step 4: Run the dev server and end-to-end manual check**

Run: `cd app && npm run dev`

Manual checklist:
- [ ] Load V-Channel Benchmark → verify all forms populate correctly
- [ ] Run All Methods → verify results appear on summary tab
- [ ] Check freeboard shows configurable threshold
- [ ] Check method comparison shows ORF annotations for pressure profiles
- [ ] Load Breakfast Creek (has PMF pressure profile) → verify orifice result appears
- [ ] Toggle Metric/Imperial → verify all values convert
- [ ] Export JSON → reimport → verify round-trip
- [ ] Print PDF → verify report renders

- [ ] **Step 5: Build check**

Run: `cd app && npm run build 2>&1 | tail -10`

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: update benchmarks and store tests for corrected engine"
```

---

## Task 16: Final Commit — All Clean

- [ ] **Step 1: Run the full test suite one more time**

Run: `cd app && npx vitest run 2>&1 | tail -5`

Expected: All tests pass.

- [ ] **Step 2: Final commit if any stragglers**

```bash
git status
# If anything unstaged:
git add -A
git commit -m "chore: final cleanup after engine corrections"
```
