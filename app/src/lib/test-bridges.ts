import type {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
} from '@/engine/types';

export interface ExpectedResult {
  profileName: string;
  method: 'energy' | 'momentum' | 'yarnell' | 'wspro';
  upstreamWsel: number;
  headLoss: number;
  /** Source of the expected value (e.g. "Hand calculation", "HEC-RAS 6.4.1") */
  source: string;
  /** Acceptable tolerance in feet for comparing computed vs expected */
  toleranceFt: number;
}

export interface TestBridge {
  id: string;
  name: string;
  location: string;
  description: string;
  imageUrl: string;
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  flowProfiles: FlowProfile[];
  coefficients: Coefficients;
  /** Known-correct results for validation. If present, UI can compare computed vs expected. */
  expectedResults?: ExpectedResult[];
}

// ---------------------------------------------------------------------------
// 1. Beaver Creek Bridge — Kentwood, Louisiana
//
// HEC-RAS Applications Guide, Example 2 (Single Bridge).
// Well-documented USACE benchmark with calibrated Manning's n and three
// flow events. Cross-section reconstructed from published bridge geometry
// and known water-surface elevations.
//
// References:
//   HEC-RAS Applications Guide, Chapter 3
//   https://www.hec.usace.army.mil/confluence/rasdocs/rasappguide/latest/beaver-creek-single-bridge-example-2
// ---------------------------------------------------------------------------
const beaverCreekBridge: TestBridge = {
  id: 'beaver-creek',
  name: 'Beaver Creek Bridge',
  location: 'Kentwood, Louisiana',
  description:
    'USACE HEC-RAS benchmark (Example 2). Calibrated to 0.24 ft MAE against observed flood levels. 9 square piers, 40 ft deck, 3 flow events.',
  imageUrl: '',
  crossSection: [
    // Left overbank — wooded floodplain rising to road embankment
    { station: 0, elevation: 217, manningsN: 0.069, bankStation: null },
    { station: 100, elevation: 215.5, manningsN: 0.069, bankStation: null },
    { station: 200, elevation: 214, manningsN: 0.069, bankStation: null },
    { station: 300, elevation: 213, manningsN: 0.069, bankStation: null },
    { station: 380, elevation: 212, manningsN: 0.069, bankStation: null },
    // Left bank
    { station: 420, elevation: 210, manningsN: 0.055, bankStation: 'left' },
    // Main channel — Beaver Creek
    { station: 450, elevation: 206, manningsN: 0.04, bankStation: null },
    { station: 500, elevation: 203, manningsN: 0.04, bankStation: null },
    { station: 540, elevation: 201, manningsN: 0.04, bankStation: null },
    { station: 570, elevation: 200, manningsN: 0.04, bankStation: null },
    { station: 600, elevation: 201, manningsN: 0.04, bankStation: null },
    { station: 630, elevation: 203.5, manningsN: 0.04, bankStation: null },
    { station: 650, elevation: 206, manningsN: 0.04, bankStation: null },
    // Right bank
    { station: 680, elevation: 210, manningsN: 0.055, bankStation: 'right' },
    // Right overbank
    { station: 720, elevation: 212, manningsN: 0.069, bankStation: null },
    { station: 820, elevation: 213, manningsN: 0.069, bankStation: null },
    { station: 920, elevation: 214.5, manningsN: 0.069, bankStation: null },
    { station: 1000, elevation: 217, manningsN: 0.069, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 215.7,
    lowChordRight: 215.7,
    highChord: 216.93,
    leftAbutmentStation: 450,
    rightAbutmentStation: 647,
    contractionLength: 478,
    expansionLength: 778,
    orificeCd: 0.8,
    weirCw: 2.6,
    deckWidth: 40,
    skewAngle: 0,
    piers: [
      { station: 470, width: 1.25, shape: 'square' },
      { station: 490, width: 1.25, shape: 'square' },
      { station: 510, width: 1.25, shape: 'square' },
      { station: 530, width: 1.25, shape: 'square' },
      { station: 550, width: 1.25, shape: 'square' },
      { station: 570, width: 1.25, shape: 'square' },
      { station: 590, width: 1.25, shape: 'square' },
      { station: 610, width: 1.25, shape: 'square' },
      { station: 630, width: 1.25, shape: 'square' },
    ],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '25-yr ARI',
      ari: '4% AEP',
      discharge: 5000,
      dsWsel: 209.5,
      channelSlope: 0.0005,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 10000,
      dsWsel: 210.5,
      channelSlope: 0.0005,
    },
    {
      name: 'May 1974 Flood',
      ari: 'Historic',
      discharge: 14000,
      dsWsel: 211.8,
      channelSlope: 0.0005,
    },
  ],
  coefficients: {
    contractionCoeff: 0.3,
    expansionCoeff: 0.5,
    yarnellK: 1.25,
    maxIterations: 100,
    tolerance: 0.01,
    initialGuessOffset: 0.5,
    debrisBlockagePct: 0,
    manningsNSensitivityPct: null,
    alphaOverride: null,
    freeboardThreshold: 0.984,
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
};

// ---------------------------------------------------------------------------
// 2. Bogue Chitto Bridge — Mississippi
//
// HEC-RAS Applications Guide, Example 13 (Single Bridge — WSPRO).
// Wide floodplain with 17 narrow piers. Classic WSPRO validation case.
// Cross-section reconstructed from published opening geometry, floodplain
// width, and calibrated Manning's n values.
//
// References:
//   HEC-RAS Applications Guide, Example 13
//   https://www.hec.usace.army.mil/confluence/rasdocs/rasappguide/latest/single-bridge-wspro-example-13
// ---------------------------------------------------------------------------
const bogueChittoBridge: TestBridge = {
  id: 'bogue-chitto',
  name: 'Bogue Chitto Bridge',
  location: 'Pike County, Mississippi',
  description:
    'USACE HEC-RAS WSPRO benchmark (Example 13). Wide floodplain with 17 narrow piers. Slope 3.7 ft/mi.',
  imageUrl: '',
  crossSection: [
    // Wide left floodplain — dense forest
    { station: 0, elevation: 340, manningsN: 0.13, bankStation: null },
    { station: 500, elevation: 336, manningsN: 0.13, bankStation: null },
    { station: 1000, elevation: 333, manningsN: 0.13, bankStation: null },
    { station: 1500, elevation: 330, manningsN: 0.13, bankStation: null },
    { station: 2000, elevation: 328, manningsN: 0.13, bankStation: null },
    // Left bank
    { station: 2400, elevation: 326, manningsN: 0.08, bankStation: 'left' },
    // Main channel — Bogue Chitto River
    { station: 2444, elevation: 322, manningsN: 0.05, bankStation: null },
    { station: 2530, elevation: 318, manningsN: 0.05, bankStation: null },
    { station: 2600, elevation: 316, manningsN: 0.05, bankStation: null },
    { station: 2650, elevation: 315, manningsN: 0.05, bankStation: null },
    { station: 2700, elevation: 316, manningsN: 0.05, bankStation: null },
    { station: 2780, elevation: 318, manningsN: 0.05, bankStation: null },
    { station: 2864, elevation: 322, manningsN: 0.05, bankStation: null },
    // Right bank
    { station: 2920, elevation: 326, manningsN: 0.08, bankStation: 'right' },
    // Right floodplain
    { station: 3400, elevation: 328, manningsN: 0.13, bankStation: null },
    { station: 3900, elevation: 330, manningsN: 0.13, bankStation: null },
    { station: 4400, elevation: 334, manningsN: 0.13, bankStation: null },
    { station: 5000, elevation: 340, manningsN: 0.13, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 341,
    lowChordRight: 340.2,
    highChord: 341,
    leftAbutmentStation: 2444,
    rightAbutmentStation: 2864,
    contractionLength: 380,
    expansionLength: 1956,
    orificeCd: 0.8,
    weirCw: 2.6,
    deckWidth: 31,
    skewAngle: 0,
    piers: Array.from({ length: 17 }, (_, i) => ({
      station: 2466 + i * 24,
      width: 1 as number,
      shape: 'square' as const,
    })),
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '50-yr ARI',
      ari: '2% AEP',
      discharge: 25000,
      dsWsel: 325.7,
      channelSlope: 0.0007,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 31500,
      dsWsel: 326,
      channelSlope: 0.0007,
    },
  ],
  coefficients: {
    contractionCoeff: 0.3,
    expansionCoeff: 0.5,
    yarnellK: 1.25,
    maxIterations: 100,
    tolerance: 0.01,
    initialGuessOffset: 0.5,
    debrisBlockagePct: 0,
    manningsNSensitivityPct: null,
    alphaOverride: null,
    freeboardThreshold: 0.984,
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
};

// ---------------------------------------------------------------------------
// 3. Windsor Bridge — Hawkesbury River, NSW, Australia
//
// Approximation of the new Windsor Bridge (opened 2020) over the
// Hawkesbury-Nepean River. Cross-section approximated from published flood
// study data: deep tidal channel with broad floodplain. The real bridge has
// 5 spans with 4 round-nose concrete piers.
//
// Flood levels from Hawkesbury-Nepean Flood Study (2024) at Windsor gauge.
// Discharges estimated from published ARR regional data for the 21,400 km²
// catchment.
//
// All values converted to imperial (feet, cfs). Datum: 0 ft ≈ AHD 0.
//
// References:
//   Hawkesbury-Nepean River Flood Study 2024
//   NSW SES Flood Data Portal
//   Infrastructure NSW — Resilience Strategy
// ---------------------------------------------------------------------------
const windsorBridge: TestBridge = {
  id: 'windsor',
  name: 'Windsor Bridge',
  location: 'Hawkesbury River, NSW, Australia',
  description:
    'Major flood-prone crossing on the Hawkesbury-Nepean River. Deep tidal channel, broad floodplain, 4 round-nose piers. Flood levels from the 2024 HN Flood Study.',
  imageUrl: '',
  crossSection: [
    // Left floodplain — low-lying farmland (Windsor township side)
    { station: 0, elevation: 72, manningsN: 0.06, bankStation: null },
    { station: 150, elevation: 62, manningsN: 0.05, bankStation: null },
    { station: 300, elevation: 55, manningsN: 0.045, bankStation: null },
    // Left bank
    { station: 400, elevation: 48, manningsN: 0.04, bankStation: 'left' },
    // Main channel — deep tidal river
    { station: 450, elevation: 35, manningsN: 0.03, bankStation: null },
    { station: 520, elevation: 20, manningsN: 0.028, bankStation: null },
    { station: 580, elevation: 10, manningsN: 0.025, bankStation: null },
    { station: 640, elevation: 5, manningsN: 0.025, bankStation: null },
    { station: 700, elevation: 8, manningsN: 0.025, bankStation: null },
    { station: 760, elevation: 15, manningsN: 0.028, bankStation: null },
    { station: 830, elevation: 28, manningsN: 0.03, bankStation: null },
    { station: 880, elevation: 38, manningsN: 0.035, bankStation: null },
    // Right bank
    { station: 920, elevation: 50, manningsN: 0.04, bankStation: 'right' },
    // Right floodplain
    { station: 1000, elevation: 58, manningsN: 0.05, bankStation: null },
    { station: 1150, elevation: 65, manningsN: 0.055, bankStation: null },
    { station: 1300, elevation: 72, manningsN: 0.06, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 55,
    lowChordRight: 55,
    highChord: 65,
    leftAbutmentStation: 430,
    rightAbutmentStation: 900,
    contractionLength: 400,
    expansionLength: 400,
    orificeCd: 0.8,
    weirCw: 1.4,
    deckWidth: 22,
    skewAngle: 10,
    piers: [
      { station: 540, width: 5, shape: 'round-nose' },
      { station: 650, width: 5, shape: 'round-nose' },
      { station: 750, width: 5, shape: 'round-nose' },
      { station: 850, width: 5, shape: 'round-nose' },
    ],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '5-yr ARI',
      ari: '20% AEP',
      discharge: 88400,
      dsWsel: 28,
      channelSlope: 0.00015,
    },
    {
      name: '20-yr ARI',
      ari: '5% AEP',
      discharge: 176800,
      dsWsel: 38,
      channelSlope: 0.00018,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 353100,
      dsWsel: 48,
      channelSlope: 0.0002,
    },
  ],
  coefficients: {
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
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
};

// ---------------------------------------------------------------------------
// 4. Breakfast Creek Bridge — Brisbane, QLD, Australia
//
// Small urban tidal creek crossing. Based on the heritage Albert Street
// bridge over Breakfast Creek (pre-2024 green bridge). Narrow channel with
// two square heritage piers. Compact geometry suitable for testing
// small-bridge behaviour with moderate urban flooding.
//
// Flood levels and flows estimated from Brisbane City Council Breakfast
// Creek Flood Study (TUFLOW model).
//
// References:
//   Breakfast Creek Flood Study, Brisbane City Council
//   https://data.brisbane.qld.gov.au/explore/dataset/flood-study-breakfast-creek/
// ---------------------------------------------------------------------------
const breakfastCreekBridge: TestBridge = {
  id: 'breakfast-creek',
  name: 'Breakfast Creek Bridge',
  location: 'Breakfast Creek, Brisbane, QLD, Australia',
  description:
    'Small urban tidal creek crossing. Square heritage piers, compact geometry. Flood data from BCC Breakfast Creek Flood Study.',
  imageUrl: '',
  crossSection: [
    // Left bank — urban parkland
    { station: 0, elevation: 18, manningsN: 0.05, bankStation: null },
    { station: 20, elevation: 15, manningsN: 0.045, bankStation: null },
    { station: 40, elevation: 12, manningsN: 0.04, bankStation: null },
    // Left bank station
    { station: 55, elevation: 9, manningsN: 0.035, bankStation: 'left' },
    // Main channel — tidal creek
    { station: 70, elevation: 5, manningsN: 0.03, bankStation: null },
    { station: 90, elevation: 2, manningsN: 0.028, bankStation: null },
    { station: 110, elevation: 0, manningsN: 0.025, bankStation: null },
    { station: 130, elevation: 1, manningsN: 0.025, bankStation: null },
    { station: 150, elevation: 3, manningsN: 0.028, bankStation: null },
    { station: 170, elevation: 6, manningsN: 0.03, bankStation: null },
    // Right bank station
    { station: 185, elevation: 9, manningsN: 0.035, bankStation: 'right' },
    // Right bank — urban
    { station: 200, elevation: 12, manningsN: 0.04, bankStation: null },
    { station: 220, elevation: 15, manningsN: 0.045, bankStation: null },
    { station: 240, elevation: 18, manningsN: 0.05, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 13,
    lowChordRight: 13,
    highChord: 18,
    leftAbutmentStation: 50,
    rightAbutmentStation: 190,
    contractionLength: 100,
    expansionLength: 100,
    orificeCd: 0.8,
    weirCw: 1.4,
    deckWidth: 20,
    skewAngle: 0,
    piers: [
      { station: 100, width: 3, shape: 'square' },
      { station: 140, width: 3, shape: 'square' },
    ],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '10-yr ARI',
      ari: '10% AEP',
      discharge: 1060,
      dsWsel: 5,
      channelSlope: 0.001,
    },
    {
      name: '50-yr ARI',
      ari: '2% AEP',
      discharge: 2120,
      dsWsel: 7,
      channelSlope: 0.0012,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 2830,
      dsWsel: 8,
      channelSlope: 0.0015,
    },
  ],
  coefficients: {
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
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
};

// ---------------------------------------------------------------------------
// 5. Validation Benchmark: V-Channel
//
// PURPOSE: Hand-computable reference case for verifying all calculation methods.
// Symmetric trapezoidal channel with a single round-nose pier. Geometry is
// simple enough to verify every intermediate value by hand.
//
// Improved from original: 11 XS points instead of 3, adequate survey density
// through the bridge opening, and discharge scaled for subcritical flow.
//
// Analytical derivation (Yarnell, Low Flow):
//   Area at WSEL 5 = 125 sq ft, V = 500/125 = 4.0 ft/s
//   V²/2g = 0.2487 ft, pier blockage α = 20/125 = 0.16
//   K(round-nose) = 0.9
//   Δy = K(5α + 10α⁴ + 3)(Fr⁴ + Fr²)(V²/2g)
//
// References:
//   Yarnell, D.L. (1934) USDA Tech Bulletin 442
//   HEC-RAS Hydraulic Reference Manual, Ch. 5
// ---------------------------------------------------------------------------
const vChannelBenchmark: TestBridge = {
  id: 'v-channel-benchmark',
  name: 'V-Channel Benchmark',
  location: 'Validation Reference',
  description:
    'Simple symmetric channel with known analytical results. 11 survey points, single pier. Use to verify all calculations match expected values.',
  imageUrl: '',
  crossSection: [
    { station: 0, elevation: 10, manningsN: 0.05, bankStation: null },
    { station: 10, elevation: 8, manningsN: 0.04, bankStation: 'left' },
    { station: 20, elevation: 6, manningsN: 0.035, bankStation: null },
    { station: 30, elevation: 4, manningsN: 0.035, bankStation: null },
    { station: 40, elevation: 2, manningsN: 0.035, bankStation: null },
    { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
    { station: 60, elevation: 2, manningsN: 0.035, bankStation: null },
    { station: 70, elevation: 4, manningsN: 0.035, bankStation: null },
    { station: 80, elevation: 6, manningsN: 0.035, bankStation: null },
    { station: 90, elevation: 8, manningsN: 0.04, bankStation: 'right' },
    { station: 100, elevation: 10, manningsN: 0.05, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 9,
    lowChordRight: 9,
    highChord: 12,
    leftAbutmentStation: 5,
    rightAbutmentStation: 95,
    contractionLength: 90,
    expansionLength: 90,
    orificeCd: 0.8,
    weirCw: 1.4,
    deckWidth: 6,
    skewAngle: 0,
    piers: [{ station: 50, width: 4, shape: 'round-nose' }],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: 'Low Flow',
      ari: 'Benchmark',
      discharge: 500,
      dsWsel: 5,
      channelSlope: 0.001,
    },
    {
      name: 'High Flow',
      ari: 'Benchmark',
      discharge: 1200,
      dsWsel: 7,
      channelSlope: 0.001,
    },
  ],
  coefficients: {
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
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
};

export const TEST_BRIDGES: TestBridge[] = [
  vChannelBenchmark,
  beaverCreekBridge,
  bogueChittoBridge,
  windsorBridge,
  breakfastCreekBridge,
];
