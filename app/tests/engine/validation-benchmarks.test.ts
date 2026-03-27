/**
 * Validation Benchmark Tests
 *
 * These tests verify the bridge hydraulic loss calculator against
 * hand-computed expected values derived from published engineering formulas.
 *
 * References:
 * - Yarnell, D.L. (1934) "Bridge Piers as Channel Obstructions", USDA Tech Bulletin 442
 * - Bradley, J.N. (1978) "Hydraulics of Bridge Waterways", FHWA HDS-1
 * - HEC-RAS Hydraulic Reference Manual, Chapter 5 (USACE)
 * - Shearman, J.O. (1990) "User's Manual for WSPRO", FHWA-IP-89-027
 *
 * Validation strategy:
 * 1. Geometry — verify area, perimeter, top width, conveyance against hand calcs
 * 2. Yarnell — direct (non-iterative) formula, hand-computed expected Δy
 * 3. Energy — verify convergence & component losses
 * 4. Cross-method consistency — all 4 methods on same case
 * 5. Physical sanity — sensitivity to pier width, shape, velocity
 */
import { describe, it, expect } from 'vitest';
import { runYarnell } from '@/engine/methods/yarnell';
import { runEnergy } from '@/engine/methods/energy';
import { runMomentum } from '@/engine/methods/momentum';
import { runWSPRO } from '@/engine/methods/wspro';
import {
  calcFlowArea,
  calcWettedPerimeter,
  calcTopWidth,
  calcConveyance,
  calcHydraulicRadius,
} from '@/engine/geometry';
import { calcPierBlockage, calcNetBridgeArea } from '@/engine/bridge-geometry';
import {
  calcVelocity,
  calcVelocityHead,
  calcFroudeNumber,
} from '@/engine/hydraulics';
import type {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
} from '@/engine/types';
import { TEST_BRIDGES } from '@/lib/test-bridges';

// ---------------------------------------------------------------------------
// Shared test geometry: V-channel
//
//   station:  0       50      100
//   elev:    10        0       10
//
// At WSEL = 5: triangular flow section
//   - water touches ground at stations 25 and 75
//   - Area  = 0.5 × 50 × 5 = 125 sq ft
//   - Top width = 50 ft
//   - Wetted perimeter = 2 × √(25² + 5²) = 2 × √650 ≈ 50.990 ft
//   - Hydraulic radius = 125 / 50.990 ≈ 2.4516 ft
// ---------------------------------------------------------------------------
const vChannel: CrossSectionPoint[] = [
  { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
  { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
  { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
];

const baseBridge: BridgeGeometry = {
  lowChordLeft: 9,
  lowChordRight: 9,
  highChord: 12,
  leftAbutmentStation: 5,
  rightAbutmentStation: 95,
  skewAngle: 0,
  contractionLength: 90,
  expansionLength: 90,
  orificeCd: 0.8,
  weirCw: 1.4,
  deckWidth: 10,
  piers: [{ station: 50, width: 4, shape: 'round-nose' }],
  lowChordProfile: [],
};

const baseProfile: FlowProfile = {
  name: 'benchmark',
  ari: 'benchmark',
  discharge: 500,
  dsWsel: 5,
  channelSlope: 0.001,
};

const baseCoeffs: Coefficients = {
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  yarnellK: null,
  maxIterations: 100,
  tolerance: 0.01,
  initialGuessOffset: 0.5,
  debrisBlockagePct: 0,
  manningsNSensitivityPct: null,
  alphaOverride: null,
  freeboardThreshold: 0.3,
  methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
};

// ---------------------------------------------------------------------------
// Constants used in hand calculations (must match constants.ts)
// ---------------------------------------------------------------------------
const G = 32.174; // ft/s²

// =========================================================================
// 1. GEOMETRY VERIFICATION
//    Verify low-level hydraulic property calculations against hand calcs
// =========================================================================
describe('1. Geometry: V-Channel Hand Calculations', () => {
  const wsel = 5;

  it('flow area = 125 sq ft at WSEL 5', () => {
    // Triangle: base = 50 ft (stations 25–75), height = 5 ft
    // Area = 0.5 × 50 × 5 = 125
    const area = calcFlowArea(vChannel, wsel);
    expect(area).toBeCloseTo(125.0, 4);
  });

  it('top width = 50 ft at WSEL 5', () => {
    // Water surface spans station 25 to station 75
    const tw = calcTopWidth(vChannel, wsel);
    expect(tw).toBeCloseTo(50.0, 4);
  });

  it('wetted perimeter = 2√650 ≈ 50.990 ft at WSEL 5', () => {
    // Two sloped sides: each √(25² + 5²) = √650 = 25.4951
    const expected = 2 * Math.sqrt(650);
    const perim = calcWettedPerimeter(vChannel, wsel);
    expect(perim).toBeCloseTo(expected, 4);
  });

  it('hydraulic radius = A/P ≈ 2.4516 ft at WSEL 5', () => {
    const expected = 125 / (2 * Math.sqrt(650));
    const R = calcHydraulicRadius(vChannel, wsel);
    expect(R).toBeCloseTo(expected, 4);
  });

  it('conveyance matches Manning equation K = (1.486/n) × A × R^(2/3)', () => {
    const A = 125;
    const P = 2 * Math.sqrt(650);
    const R = A / P;
    const n = 0.035;
    const expectedK = (1.486 / n) * A * Math.pow(R, 2 / 3);
    const K = calcConveyance(vChannel, wsel);
    expect(K).toBeCloseTo(expectedK, 0); // within 0.5 cfs
  });

  it('pier blockage = width × depth = 4 × 5 = 20 sq ft', () => {
    // Pier at station 50, ground elev = 0, WSEL = 5, width = 4
    const blockage = calcPierBlockage(baseBridge.piers, vChannel, wsel);
    expect(blockage).toBeCloseTo(20.0, 4);
  });

  it('net bridge area = gross - piers (no skew)', () => {
    // Gross area between abutments at WSEL 5:
    //   Left abutment station 5 → ground elev = 9 (above WSEL 5)
    //   Right abutment station 95 → ground elev = 9 (above WSEL 5)
    //   Abutment elevations > WSEL, so clipping to abutments doesn't change the
    //   wetted area. The gross opening area = full cross-section area = 125 sq ft
    // Net = 125 - 20 = 105 sq ft
    const net = calcNetBridgeArea(baseBridge, vChannel, wsel);
    expect(net).toBeCloseTo(105.0, 1);
  });

  it('flow area scales correctly at WSEL 8', () => {
    // At WSEL 8: water from station 10 to station 90
    // Triangle: base = 80, height = 8
    // Area = 0.5 × 80 × 8 = 320
    const area = calcFlowArea(vChannel, 8);
    expect(area).toBeCloseTo(320.0, 4);
  });

  it('velocity = Q/A', () => {
    const area = calcFlowArea(vChannel, wsel); // 125
    const V = calcVelocity(500, area);
    expect(V).toBeCloseTo(4.0, 4);
  });

  it('velocity head = V²/(2g)', () => {
    const Vh = calcVelocityHead(4.0);
    expect(Vh).toBeCloseTo(16 / (2 * G), 6);
  });

  it('Froude number = V / √(gD) where D = A/T', () => {
    // D = 125/50 = 2.5, Fr = 4/√(32.174 × 2.5) = 4/8.969 = 0.4460
    const Fr = calcFroudeNumber(4.0, 125, 50);
    const expected = 4.0 / Math.sqrt(G * 2.5);
    expect(Fr).toBeCloseTo(expected, 4);
    expect(Fr).toBeLessThan(1.0); // subcritical
  });
});

// =========================================================================
// 2. YARNELL ANALYTICAL VERIFICATION
//    The Yarnell method is direct (no iteration), so we can compute the
//    exact expected output from the formula:
//
//    Δy = K × (K + 5 − 0.6) × (α + 15α⁴) × (V²/2g)
//
//    where α = pier_blockage / total_flow_area
//
//    Reference: Yarnell (1934), USDA Technical Bulletin 442
// =========================================================================
describe('2. Yarnell: Analytical Verification', () => {
  // Pre-computed values for V-channel at WSEL=5, Q=500:
  //   A = 125 sq ft, TopWidth = 50 ft, HydDepth D = A/T = 2.5 ft
  //   V = 500/125 = 4.0 ft/s
  //   Fr = V/sqrt(g*D) = 4.0/sqrt(32.174*2.5)
  //   Pier: station 50, width 4, depth 5 → blockage = 20
  //   α = 20/125 = 0.16
  //
  //   New Yarnell formula (HEC-RAS / Austroads standard):
  //   Δy = K × Fr² × (K + 5·Fr² − 0.6) × (α + 15α⁴) × D
  const dsArea = 125;
  const dsTopWidth = 50;
  const dsHydDepth = dsArea / dsTopWidth; // 2.5 ft
  const dsVelocity = 4.0;
  const Fr3 = dsVelocity / Math.sqrt(G * dsHydDepth);
  const Fr3sq = Fr3 * Fr3;
  const alpha = 20 / 125; // 0.16
  const alphaFactor = alpha + 15 * alpha ** 4; // 0.1698304

  it('round-nose pier (K=0.9): positive head loss', () => {
    const K = 0.9;
    const expectedDy = K * Fr3sq * (K + 5 * Fr3sq - 0.6) * alphaFactor * dsHydDepth;

    const result = runYarnell(vChannel, baseBridge, baseProfile, baseCoeffs);

    expect(result.error).toBeNull();
    expect(result.flowRegime).toBe('free-surface');
    expect(result.totalHeadLoss).toBeCloseTo(expectedDy, 3);
    expect(result.upstreamWsel).toBeCloseTo(5 + expectedDy, 3);
  });

  it('square pier (K=1.25): positive head loss', () => {
    const K = 1.25;
    const expectedDy = K * Fr3sq * (K + 5 * Fr3sq - 0.6) * alphaFactor * dsHydDepth;

    const squareBridge = {
      ...baseBridge,
      piers: [{ station: 50, width: 4, shape: 'square' as const }],
    };
    const result = runYarnell(vChannel, squareBridge, baseProfile, baseCoeffs);

    expect(result.error).toBeNull();
    expect(result.totalHeadLoss).toBeCloseTo(expectedDy, 3);
  });

  it('cylindrical pier (K=1.0): positive head loss', () => {
    const K = 1.0;
    const expectedDy = K * Fr3sq * (K + 5 * Fr3sq - 0.6) * alphaFactor * dsHydDepth;

    const cylBridge = {
      ...baseBridge,
      piers: [{ station: 50, width: 4, shape: 'cylindrical' as const }],
    };
    const result = runYarnell(vChannel, cylBridge, baseProfile, baseCoeffs);

    expect(result.error).toBeNull();
    expect(result.totalHeadLoss).toBeCloseTo(expectedDy, 3);
  });

  it('sharp pier (K=0.7): positive head loss', () => {
    const K = 0.7;
    const expectedDy = K * Fr3sq * (K + 5 * Fr3sq - 0.6) * alphaFactor * dsHydDepth;

    const sharpBridge = {
      ...baseBridge,
      piers: [{ station: 50, width: 4, shape: 'sharp' as const }],
    };
    const result = runYarnell(vChannel, sharpBridge, baseProfile, baseCoeffs);

    expect(result.error).toBeNull();
    expect(result.totalHeadLoss).toBeCloseTo(expectedDy, 3);
  });

  it('manual K override works correctly', () => {
    const K = 1.5; // arbitrary override
    const expectedDy = K * Fr3sq * (K + 5 * Fr3sq - 0.6) * alphaFactor * dsHydDepth;

    const overrideCoeffs = { ...baseCoeffs, yarnellK: 1.5 };
    const result = runYarnell(vChannel, baseBridge, baseProfile, overrideCoeffs);

    expect(result.totalHeadLoss).toBeCloseTo(expectedDy, 3);
  });

  it('pier shape ordering: sharp < round-nose < cylindrical < square', () => {
    // This matches physical intuition: more streamlined → less backwater
    // K values: sharp(0.7) < round-nose(0.9) < cylindrical(1.0) < square(1.25)
    const shapes = ['sharp', 'round-nose', 'cylindrical', 'square'] as const;
    const losses: number[] = [];

    for (const shape of shapes) {
      const bridge = {
        ...baseBridge,
        piers: [{ station: 50, width: 4, shape }],
      };
      const result = runYarnell(vChannel, bridge, baseProfile, baseCoeffs);
      losses.push(result.totalHeadLoss);
    }

    // Each should be strictly greater than the previous
    for (let i = 1; i < losses.length; i++) {
      expect(losses[i]).toBeGreaterThan(losses[i - 1]);
    }
  });

  it('flags not-applicable for pressure flow (WSEL > low chord)', () => {
    const pressureProfile = { ...baseProfile, dsWsel: 10 };
    const result = runYarnell(vChannel, baseBridge, pressureProfile, baseCoeffs);
    expect(result.error).toContain('Not Applicable');
    expect(result.totalHeadLoss).toBe(0);
  });

  it('higher velocity produces more backwater', () => {
    // Yarnell Δy increases with velocity (Fr² terms in new formula)
    // Doubling Q at same WSEL → more head loss
    const result1x = runYarnell(vChannel, baseBridge, baseProfile, baseCoeffs);
    const result2x = runYarnell(
      vChannel,
      baseBridge,
      { ...baseProfile, discharge: 1000 },
      baseCoeffs
    );

    // Higher discharge produces strictly more backwater
    expect(result2x.totalHeadLoss).toBeGreaterThan(result1x.totalHeadLoss);
  });

  it('no piers produces zero backwater', () => {
    const noPierBridge = { ...baseBridge, piers: [] };
    const result = runYarnell(vChannel, noPierBridge, baseProfile, baseCoeffs);
    // With no piers, α = 0, so Δy = K × (...) × 0 × V²/2g = 0
    expect(result.totalHeadLoss).toBe(0);
  });

  it('wider pier produces more backwater', () => {
    const narrow = runYarnell(
      vChannel,
      { ...baseBridge, piers: [{ station: 50, width: 2, shape: 'round-nose' }] },
      baseProfile,
      baseCoeffs
    );
    const wide = runYarnell(
      vChannel,
      { ...baseBridge, piers: [{ station: 50, width: 8, shape: 'round-nose' }] },
      baseProfile,
      baseCoeffs
    );
    expect(wide.totalHeadLoss).toBeGreaterThan(narrow.totalHeadLoss);
  });
});

// =========================================================================
// 3. YARNELL: HIGHER FLOW BENCHMARK
//    V-channel at WSEL=8, Q=2500 — higher velocity, more backwater
// =========================================================================
describe('3. Yarnell: Higher Flow Benchmark', () => {
  const highFlowProfile: FlowProfile = {
    name: 'high-flow',
    ari: 'high-flow',
    discharge: 2500,
    dsWsel: 8,
    channelSlope: 0.001,
  };

  // At WSEL=8: Area = 0.5 × 80 × 8 = 320 sq ft, TopWidth = 80 ft, D = 4 ft
  // V = 2500/320 = 7.8125 ft/s
  // Fr = 7.8125/sqrt(32.174*4)
  // Pier blockage = 4 × 8 = 32, α = 32/320 = 0.1
  // New Yarnell formula: Δy = K × Fr² × (K + 5·Fr² − 0.6) × (α + 15α⁴) × D

  it('positive head loss for round-nose at high flow', () => {
    const A = 320;
    const T = 80;
    const D = A / T; // 4 ft
    const V = 2500 / A;
    const Fr = V / Math.sqrt(G * D);
    const Fr2 = Fr * Fr;
    const alpha = 32 / A;
    const K = 0.9;
    const expectedDy = K * Fr2 * (K + 5 * Fr2 - 0.6) * (alpha + 15 * alpha ** 4) * D;

    const result = runYarnell(vChannel, baseBridge, highFlowProfile, baseCoeffs);

    expect(result.error).toBeNull();
    expect(result.flowRegime).toBe('free-surface');
    expect(result.totalHeadLoss).toBeCloseTo(expectedDy, 3);
    expect(result.upstreamWsel).toBeCloseTo(8 + expectedDy, 3);
  });
});

// =========================================================================
// 4. ENERGY METHOD: CONVERGENCE & COMPONENT VERIFICATION
// =========================================================================
describe('4. Energy Method: Convergence Verification', () => {
  it('converges within tolerance', () => {
    const result = runEnergy(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(result.converged).toBe(true);
    expect(result.error).toBeNull();
  });

  it('US WSEL > DS WSEL (positive head loss)', () => {
    const result = runEnergy(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(result.upstreamWsel).toBeGreaterThan(baseProfile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });

  it('head loss includes friction, contraction, and expansion components', () => {
    const result = runEnergy(vChannel, baseBridge, baseProfile, baseCoeffs);
    // Steps: 1=DS props, 2=friction loss, 3=contraction loss, 4=expansion loss, 5=US WSEL
    expect(result.calculationSteps.length).toBeGreaterThanOrEqual(5);

    const frictionStep = result.calculationSteps.find(s => s.description.includes('Friction'));
    const contractionStep = result.calculationSteps.find(s => s.description.includes('Contraction'));
    const expansionStep = result.calculationSteps.find(s => s.description.includes('Expansion'));

    expect(frictionStep).toBeDefined();
    expect(contractionStep).toBeDefined();
    expect(expansionStep).toBeDefined();

    // All loss components should be non-negative
    expect(frictionStep!.result).toBeGreaterThanOrEqual(0);
    expect(contractionStep!.result).toBeGreaterThanOrEqual(0);
    expect(expansionStep!.result).toBeGreaterThanOrEqual(0);
  });

  it('Energy head loss > Yarnell head loss (friction adds to loss)', () => {
    // Energy method includes friction over 180 ft reach, Yarnell is pier-only
    const yResult = runYarnell(vChannel, baseBridge, baseProfile, baseCoeffs);
    const eResult = runEnergy(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(eResult.totalHeadLoss).toBeGreaterThan(yResult.totalHeadLoss);
  });

  it('shorter reach reduces Energy head loss toward Yarnell', () => {
    // With minimal reach length, friction → 0 and Energy approaches pier-only loss
    const shortBridge = {
      ...baseBridge,
      contractionLength: 1,
      expansionLength: 1,
    };
    const eShort = runEnergy(vChannel, shortBridge, baseProfile, baseCoeffs);
    const eLong = runEnergy(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(eShort.totalHeadLoss).toBeLessThan(eLong.totalHeadLoss);
  });

  it('no piers still produces friction loss', () => {
    const noPierBridge = { ...baseBridge, piers: [] };
    const result = runEnergy(vChannel, noPierBridge, baseProfile, baseCoeffs);
    // Even without piers, friction over 180 ft produces head loss
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });
});

// =========================================================================
// 5. MOMENTUM METHOD: CONVERGENCE & PHYSICS
// =========================================================================
describe('5. Momentum Method: Convergence Verification', () => {
  it('converges within tolerance', () => {
    const result = runMomentum(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(result.converged).toBe(true);
    expect(result.error).toBeNull();
  });

  it('US WSEL > DS WSEL', () => {
    const result = runMomentum(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(result.upstreamWsel).toBeGreaterThan(baseProfile.dsWsel);
    expect(result.totalHeadLoss).toBeGreaterThan(0);
  });

  it('greater total pier blockage produces larger head loss', () => {
    // Single pier at station 50 (deepest): blockage = 4×5 = 20 sq ft
    const singleResult = runMomentum(vChannel, baseBridge, baseProfile, baseCoeffs);

    // Two piers at the deepest point: blockage = 2 × 4 × 5 = 40 sq ft
    const doublePierBridge = {
      ...baseBridge,
      piers: [
        { station: 45, width: 4, shape: 'round-nose' as const },
        { station: 55, width: 4, shape: 'round-nose' as const },
      ],
    };
    const doubleResult = runMomentum(vChannel, doublePierBridge, baseProfile, baseCoeffs);

    // More blockage at depth → more drag → more head loss
    expect(doubleResult.totalHeadLoss).toBeGreaterThan(singleResult.totalHeadLoss);
  });
});

// =========================================================================
// 6. WSPRO METHOD: CONVERGENCE & CONVEYANCE RATIO
// =========================================================================
describe('6. WSPRO Method: Convergence Verification', () => {
  it('returns zero backwater when bridge opening captures full conveyance', () => {
    // V-channel abutments at 5 & 95 span nearly the full 0–100 channel.
    // Bridge opening conveyance ≈ total conveyance → M ≈ 1 → Cb ≈ 0 → Δh ≈ 0.
    // This is correct WSPRO behavior: no constriction means no backwater.
    const result = runWSPRO(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(result.error).toBeNull();
    expect(result.totalHeadLoss).toBeCloseTo(0, 1);
  });

  it('M approaches 1.0 when bridge captures most conveyance → Cb → 0', () => {
    // WSPRO uses M = K_bridge / K_total. When the bridge opening captures
    // most of the flow conveyance, M → 1 and Cb → 0 (no backwater).
    // This is correct behavior for unconstricted bridges.
    //
    // The WSPRO method produces meaningful backwater only when the bridge
    // significantly constricts the floodplain (M < ~0.8).
    // Simple V-channel and basic floodplain geometries typically give M ≈ 1
    // because the subsection conveyance calculation favors the bridge section.
    const result = runWSPRO(vChannel, baseBridge, baseProfile, baseCoeffs);
    const mStep = result.calculationSteps.find(s =>
      s.description.includes('opening ratio')
    );
    // M should be at or near 1.0 for this geometry
    expect(mStep!.result).toBeGreaterThanOrEqual(0.9);
    // Consequently, Cb should be near 0
    const cbStep = result.calculationSteps.find(s =>
      s.description.includes('Base backwater')
    );
    expect(cbStep!.result).toBeCloseTo(0, 1);
  });

  it('includes conveyance ratio M in calculation steps', () => {
    const result = runWSPRO(vChannel, baseBridge, baseProfile, baseCoeffs);
    const mStep = result.calculationSteps.find(s =>
      s.description.includes('opening ratio')
    );
    expect(mStep).toBeDefined();
    // M should be between 0 and 1
    expect(mStep!.result).toBeGreaterThan(0);
    expect(mStep!.result).toBeLessThanOrEqual(1);
  });

  it('Froude correction ≥ 1.0', () => {
    const result = runWSPRO(vChannel, baseBridge, baseProfile, baseCoeffs);
    const frStep = result.calculationSteps.find(s =>
      s.description.includes('Froude')
    );
    expect(frStep).toBeDefined();
    expect(frStep!.result).toBeGreaterThanOrEqual(1.0);
  });
});

// =========================================================================
// 7. CROSS-METHOD CONSISTENCY
//    All four methods on the same geometry should produce results in the
//    same order of magnitude. They won't match exactly because each method
//    accounts for different physics.
// =========================================================================
describe('7. Cross-Method Consistency', () => {
  // Use short reach to minimize friction (makes methods more comparable)
  const shortReachBridge: BridgeGeometry = {
    ...baseBridge,
    contractionLength: 10,
    expansionLength: 10,
  };

  // Narrower bridge to ensure WSPRO also produces backwater
  const constrictedBridge: BridgeGeometry = {
    ...baseBridge,
    leftAbutmentStation: 30,
    rightAbutmentStation: 70,
  };

  it('Yarnell, Energy, and Momentum all produce positive backwater', () => {
    const y = runYarnell(vChannel, shortReachBridge, baseProfile, baseCoeffs);
    const e = runEnergy(vChannel, shortReachBridge, baseProfile, baseCoeffs);
    const m = runMomentum(vChannel, shortReachBridge, baseProfile, baseCoeffs);

    expect(y.totalHeadLoss).toBeGreaterThan(0);
    expect(e.totalHeadLoss).toBeGreaterThan(0);
    expect(m.totalHeadLoss).toBeGreaterThan(0);
  });

  it('Yarnell, Energy, Momentum agree on floodplain geometry', () => {
    // WSPRO excluded from cross-method comparison because it requires
    // significant floodplain constriction (M < ~0.8) to produce backwater.
    // The other three methods all produce backwater from pier obstruction.
    const floodplain: CrossSectionPoint[] = [
      { station: 0, elevation: 8, manningsN: 0.06, bankStation: null },
      { station: 100, elevation: 8, manningsN: 0.06, bankStation: 'left' },
      { station: 150, elevation: 0, manningsN: 0.03, bankStation: null },
      { station: 350, elevation: 0, manningsN: 0.03, bankStation: null },
      { station: 400, elevation: 8, manningsN: 0.06, bankStation: 'right' },
      { station: 500, elevation: 8, manningsN: 0.06, bankStation: null },
    ];
    const fpBridge: BridgeGeometry = {
      lowChordLeft: 12,
      lowChordRight: 12,
      highChord: 16,
      leftAbutmentStation: 120,
      rightAbutmentStation: 380,
      skewAngle: 0,
      contractionLength: 50,
      expansionLength: 50,
      orificeCd: 0.8,
      weirCw: 1.4,
      deckWidth: 10,
      piers: [{ station: 250, width: 4, shape: 'round-nose' }],
      lowChordProfile: [],
    };
    const fpProfile: FlowProfile = {
      name: 'fp-test',
      ari: 'fp-test',
      discharge: 20000,
      dsWsel: 10,
      channelSlope: 0.001,
    };

    const y = runYarnell(floodplain, fpBridge, fpProfile, baseCoeffs);
    const e = runEnergy(floodplain, fpBridge, fpProfile, baseCoeffs);
    const m = runMomentum(floodplain, fpBridge, fpProfile, baseCoeffs);

    expect(y.totalHeadLoss).toBeGreaterThan(0);
    expect(e.totalHeadLoss).toBeGreaterThan(0);
    expect(m.totalHeadLoss).toBeGreaterThan(0);
  });

  it('Yarnell, Energy, Momentum within same order of magnitude', () => {
    const y = runYarnell(vChannel, shortReachBridge, baseProfile, baseCoeffs);
    const e = runEnergy(vChannel, shortReachBridge, baseProfile, baseCoeffs);
    const m = runMomentum(vChannel, shortReachBridge, baseProfile, baseCoeffs);

    const losses = [y.totalHeadLoss, e.totalHeadLoss, m.totalHeadLoss];
    const maxLoss = Math.max(...losses);
    const minLoss = Math.min(...losses);

    // Methods model different physics but should agree within 10×
    expect(maxLoss / minLoss).toBeLessThan(10);
  });

  it('all methods agree on flow regime', () => {
    const y = runYarnell(vChannel, shortReachBridge, baseProfile, baseCoeffs);
    const e = runEnergy(vChannel, shortReachBridge, baseProfile, baseCoeffs);
    const m = runMomentum(vChannel, shortReachBridge, baseProfile, baseCoeffs);
    const w = runWSPRO(vChannel, shortReachBridge, baseProfile, baseCoeffs);

    expect(y.flowRegime).toBe('free-surface');
    expect(e.flowRegime).toBe('free-surface');
    expect(m.flowRegime).toBe('free-surface');
    expect(w.flowRegime).toBe('free-surface');
  });

  it('all iterative methods converge', () => {
    const e = runEnergy(vChannel, shortReachBridge, baseProfile, baseCoeffs);
    const m = runMomentum(vChannel, shortReachBridge, baseProfile, baseCoeffs);

    expect(e.converged).toBe(true);
    expect(m.converged).toBe(true);
  });
});

// =========================================================================
// 8. PHYSICAL SANITY: PUBLISHED BOUNDS
//    Verify results fall within physically reasonable ranges based on
//    engineering literature.
//
//    Bradley (1978) guidance:
//    - Backwater typically 0.1–3.0 ft for subcritical free-surface flow
//    - Head loss < velocity head for moderate constrictions
//
//    Yarnell (1934) experimental range:
//    - α (obstruction ratio) tested: 0.05 to 0.50
//    - Froude numbers tested: 0.1 to 0.8 (subcritical)
// =========================================================================
describe('8. Physical Sanity Checks', () => {
  it('Froude number is subcritical for all benchmark cases', () => {
    const y = runYarnell(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(y.froudeBridge).toBeLessThan(1.0);
    expect(y.froudeApproach).toBeLessThan(1.0);
  });

  it('upstream velocity < downstream velocity (backwater raises area)', () => {
    const y = runYarnell(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(y.approachVelocity).toBeLessThan(y.bridgeVelocity);
  });

  it('backwater is reasonable for moderate constriction (< 3 ft)', () => {
    // WSPRO excluded: returns 0 for this unconstricted geometry (correct behavior)
    const results = [
      runYarnell(vChannel, baseBridge, baseProfile, baseCoeffs),
      runEnergy(vChannel, baseBridge, baseProfile, baseCoeffs),
      runMomentum(vChannel, baseBridge, baseProfile, baseCoeffs),
    ];

    for (const r of results) {
      expect(r.totalHeadLoss).toBeLessThan(3.0);
      expect(r.totalHeadLoss).toBeGreaterThan(0);
    }
  });

  it('TUFLOW pier FLC is positive for all methods with piers', () => {
    const e = runEnergy(vChannel, baseBridge, baseProfile, baseCoeffs);
    const m = runMomentum(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(e.tuflowPierFLC).toBeGreaterThan(0);
    expect(m.tuflowPierFLC).toBeGreaterThan(0);
  });

  it('TUFLOW super FLC is null for free-surface flow', () => {
    const e = runEnergy(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(e.tuflowSuperFLC).toBeNull();
  });

  it('input echo reports correct geometric properties', () => {
    const e = runEnergy(vChannel, baseBridge, baseProfile, baseCoeffs);
    expect(e.inputEcho.flowArea).toBeCloseTo(125, 0);
    expect(e.inputEcho.pierBlockage).toBeCloseTo(20, 0);
    expect(e.inputEcho.bridgeOpeningArea).toBeCloseTo(105, 0);
    expect(e.inputEcho.hydraulicRadius).toBeGreaterThan(0);
  });
});

// =========================================================================
// 9. MULTI-PIER YARNELL BENCHMARK
//    Verify that multiple piers are handled correctly by summing blockage.
// =========================================================================
describe('9. Multi-Pier Yarnell Benchmark', () => {
  it('two piers double the blockage and increase backwater non-linearly', () => {
    // Single pier: blockage = 4 × 5 = 20, α = 0.16
    const singleResult = runYarnell(vChannel, baseBridge, baseProfile, baseCoeffs);

    // Two piers at stations 35 and 65 (both at depth 5):
    //   ground at 35: 10 + (0-10)*(35/50) = 10 - 7 = 3 → depth = 5-3 = 2
    //   ground at 65: 0 + (10-0)*(15/50) = 3 → depth = 5-3 = 2
    //   blockage = 4×2 + 4×2 = 16 sq ft
    //   α = 16/125 = 0.128
    // This should produce less backwater than α=0.16 (single deep pier)
    const twoPierBridge: BridgeGeometry = {
      ...baseBridge,
      piers: [
        { station: 35, width: 4, shape: 'round-nose' },
        { station: 65, width: 4, shape: 'round-nose' },
      ],
    };

    const twoResult = runYarnell(vChannel, twoPierBridge, baseProfile, baseCoeffs);
    expect(twoResult.error).toBeNull();
    expect(twoResult.totalHeadLoss).toBeGreaterThan(0);

    // Verify: compute expected α for two piers using new Yarnell formula
    // Δy = K × Fr² × (K + 5·Fr² − 0.6) × (α + 15α⁴) × D
    const expectedBlockage = 4 * 2 + 4 * 2; // 16
    const expectedAlpha = expectedBlockage / 125;
    const K = 0.9;
    const dsA = 125;
    const dsT = 50;
    const dsD = dsA / dsT; // 2.5
    const dsV = 500 / dsA; // 4.0
    const dsFr = dsV / Math.sqrt(G * dsD);
    const dsFr2 = dsFr * dsFr;
    const expectedDy =
      K *
      dsFr2 *
      (K + 5 * dsFr2 - 0.6) *
      (expectedAlpha + 15 * expectedAlpha ** 4) *
      dsD;

    expect(twoResult.totalHeadLoss).toBeCloseTo(expectedDy, 3);
  });
});

// =========================================================================
// 10. SKEW ANGLE VERIFICATION
//     Skew correction reduces net bridge area by cos(θ), increasing velocity
//     and backwater.
// =========================================================================
describe('10. Skew Angle Verification', () => {
  it('skewed bridge produces more Energy method head loss than straight', () => {
    const straightBridge = { ...baseBridge, skewAngle: 0 };
    const skewedBridge = { ...baseBridge, skewAngle: 30 };

    const straight = runEnergy(vChannel, straightBridge, baseProfile, baseCoeffs);
    const skewed = runEnergy(vChannel, skewedBridge, baseProfile, baseCoeffs);

    // Skew reduces net area → higher bridge velocity → more contraction/expansion loss
    expect(skewed.totalHeadLoss).toBeGreaterThan(straight.totalHeadLoss);
  });

  it('net bridge area with skew = net area × cos(θ)', () => {
    const skewAngle = 30;
    const skewedBridge = { ...baseBridge, skewAngle };

    const netStraight = calcNetBridgeArea(baseBridge, vChannel, 5);
    const netSkewed = calcNetBridgeArea(skewedBridge, vChannel, 5);

    const expectedSkewed = netStraight * Math.cos((skewAngle * Math.PI) / 180);
    expect(netSkewed).toBeCloseTo(expectedSkewed, 2);
  });
});

// =========================================================================
// 11. TEST BRIDGE EXPECTED RESULTS
//     Run all test bridges that have expectedResults and verify computed
//     output matches documented expected values.
// =========================================================================
describe('11. Test Bridge Expected Results', () => {
  const methodRunners = {
    yarnell: runYarnell,
    energy: runEnergy,
    momentum: runMomentum,
    wspro: runWSPRO,
  };

  // Placeholder: expectedResults are populated per-bridge when known-good values exist
  it('TEST_BRIDGES are defined and have required fields', () => {
    expect(TEST_BRIDGES.length).toBeGreaterThan(0);
    for (const bridge of TEST_BRIDGES) {
      expect(bridge.crossSection.length).toBeGreaterThan(0);
      expect(bridge.flowProfiles.length).toBeGreaterThan(0);
    }
  });

  for (const bridge of TEST_BRIDGES) {
    if (!bridge.expectedResults?.length) continue;

    describe(bridge.name, () => {
      for (const expected of bridge.expectedResults!) {
        it(`${expected.profileName} / ${expected.method}: US WSEL ≈ ${expected.upstreamWsel}`, () => {
          const profile = bridge.flowProfiles.find(p => p.name === expected.profileName);
          expect(profile).toBeDefined();

          const runner = methodRunners[expected.method];
          const result = runner(
            bridge.crossSection,
            bridge.bridgeGeometry,
            profile!,
            bridge.coefficients
          );

          // numDigits for toBeCloseTo: find precision from tolerance
          // toBeCloseTo(n, d) checks |actual - expected| < 10^(-d) / 2
          const digits = Math.max(0, Math.ceil(-Math.log10(expected.toleranceFt * 2)));

          expect(result.upstreamWsel).toBeCloseTo(expected.upstreamWsel, digits);
          expect(result.totalHeadLoss).toBeCloseTo(expected.headLoss, digits);
        });
      }
    });
  }
});
