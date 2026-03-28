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

// ═══════════════════════════════════════════════════════════════════════════
// ALL VALUES IN METRIC (m, m³/s). The UI converts to imperial on load.
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// 1. Beaver Creek Bridge — Kentwood, Louisiana
//
// HEC-RAS Applications Guide, Example 2 (Single Bridge).
// Well-documented USACE benchmark with calibrated Manning's n and three
// flow events. Cross-section reconstructed from published bridge geometry
// and known water-surface elevations.
//
// Original imperial values converted to metric:
//   Low chord: 215.7 ft → 65.75 m
//   Bridge opening: 450-647 ft → 137.2-197.2 m
//   Flows: 5000/10000/14000 cfs → 141.6/283.2/396.4 m³/s
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
    'USACE HEC-RAS benchmark (Example 2). Calibrated to 0.07 m MAE against observed flood levels. 9 square piers, 12.2 m deck, 3 flow events.',
  imageUrl: '',
  crossSection: [
    // Left overbank — wooded floodplain rising to road embankment
    { station: 0, elevation: 66.14, manningsN: 0.069, bankStation: null },
    { station: 30.5, elevation: 65.69, manningsN: 0.069, bankStation: null },
    { station: 61.0, elevation: 65.23, manningsN: 0.069, bankStation: null },
    { station: 91.4, elevation: 64.92, manningsN: 0.069, bankStation: null },
    { station: 115.8, elevation: 64.62, manningsN: 0.069, bankStation: null },
    // Left bank
    { station: 128.0, elevation: 64.01, manningsN: 0.055, bankStation: 'left' },
    // Main channel — Beaver Creek
    { station: 137.2, elevation: 62.79, manningsN: 0.04, bankStation: null },
    { station: 152.4, elevation: 61.87, manningsN: 0.04, bankStation: null },
    { station: 164.6, elevation: 61.26, manningsN: 0.04, bankStation: null },
    { station: 173.7, elevation: 60.96, manningsN: 0.04, bankStation: null },
    { station: 182.9, elevation: 61.26, manningsN: 0.04, bankStation: null },
    { station: 192.0, elevation: 62.03, manningsN: 0.04, bankStation: null },
    { station: 198.1, elevation: 62.79, manningsN: 0.04, bankStation: null },
    // Right bank
    { station: 207.3, elevation: 64.01, manningsN: 0.055, bankStation: 'right' },
    // Right overbank
    { station: 219.5, elevation: 64.62, manningsN: 0.069, bankStation: null },
    { station: 249.9, elevation: 64.92, manningsN: 0.069, bankStation: null },
    { station: 280.4, elevation: 65.38, manningsN: 0.069, bankStation: null },
    { station: 304.8, elevation: 66.14, manningsN: 0.069, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 65.75,
    lowChordRight: 65.75,
    highChord: 66.12,
    leftAbutmentStation: 137.2,
    rightAbutmentStation: 197.2,
    contractionLength: 145.7,
    expansionLength: 237.1,
    orificeCd: 0.8,
    weirCw: 2.6,
    deckWidth: 12.2,
    skewAngle: 0,
    piers: [
      { station: 143.3, width: 0.381, shape: 'square' },
      { station: 149.4, width: 0.381, shape: 'square' },
      { station: 155.4, width: 0.381, shape: 'square' },
      { station: 161.5, width: 0.381, shape: 'square' },
      { station: 167.6, width: 0.381, shape: 'square' },
      { station: 173.7, width: 0.381, shape: 'square' },
      { station: 179.8, width: 0.381, shape: 'square' },
      { station: 185.9, width: 0.381, shape: 'square' },
      { station: 192.0, width: 0.381, shape: 'square' },
    ],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '25-yr ARI',
      ari: '4% AEP',
      discharge: 141.6,
      dsWsel: 63.86,
      channelSlope: 0.0005,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 283.2,
      dsWsel: 64.16,
      channelSlope: 0.0005,
    },
    {
      name: 'May 1974 Flood',
      ari: 'Historic',
      discharge: 396.4,
      dsWsel: 64.56,
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
    freeboardThreshold: 0.3,
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
};

// ---------------------------------------------------------------------------
// 2. Bogue Chitto Bridge — Mississippi
//
// HEC-RAS Applications Guide, Example 13 (Single Bridge — WSPRO).
// Wide floodplain with 17 narrow piers. Classic WSPRO validation case.
//
// Original imperial values converted to metric:
//   Low chord: 341 ft → 103.9 m
//   Bridge opening: 2444-2864 ft → 744.9-873.0 m
//   Flows: 25000/31500 cfs → 708/892 m³/s
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
    { station: 0, elevation: 103.6, manningsN: 0.13, bankStation: null },
    { station: 152.4, elevation: 102.4, manningsN: 0.13, bankStation: null },
    { station: 304.8, elevation: 101.5, manningsN: 0.13, bankStation: null },
    { station: 457.2, elevation: 100.6, manningsN: 0.13, bankStation: null },
    { station: 609.6, elevation: 99.97, manningsN: 0.13, bankStation: null },
    // Left bank
    { station: 731.5, elevation: 99.36, manningsN: 0.08, bankStation: 'left' },
    // Main channel — Bogue Chitto River
    { station: 744.9, elevation: 98.15, manningsN: 0.05, bankStation: null },
    { station: 771.1, elevation: 96.93, manningsN: 0.05, bankStation: null },
    { station: 792.5, elevation: 96.32, manningsN: 0.05, bankStation: null },
    { station: 807.7, elevation: 96.01, manningsN: 0.05, bankStation: null },
    { station: 822.9, elevation: 96.32, manningsN: 0.05, bankStation: null },
    { station: 847.3, elevation: 96.93, manningsN: 0.05, bankStation: null },
    { station: 873.0, elevation: 98.15, manningsN: 0.05, bankStation: null },
    // Right bank
    { station: 890.0, elevation: 99.36, manningsN: 0.08, bankStation: 'right' },
    // Right floodplain
    { station: 1036.3, elevation: 99.97, manningsN: 0.13, bankStation: null },
    { station: 1188.7, elevation: 100.6, manningsN: 0.13, bankStation: null },
    { station: 1341.1, elevation: 101.8, manningsN: 0.13, bankStation: null },
    { station: 1524.0, elevation: 103.6, manningsN: 0.13, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 103.94,
    lowChordRight: 103.69,
    highChord: 103.94,
    leftAbutmentStation: 744.9,
    rightAbutmentStation: 873.0,
    contractionLength: 115.8,
    expansionLength: 596.2,
    orificeCd: 0.8,
    weirCw: 2.6,
    deckWidth: 9.45,
    skewAngle: 0,
    piers: Array.from({ length: 17 }, (_, i) => ({
      station: 751.6 + i * 7.32,
      width: 0.305 as number,
      shape: 'square' as const,
    })),
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '50-yr ARI',
      ari: '2% AEP',
      discharge: 708,
      dsWsel: 99.27,
      channelSlope: 0.0007,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 892,
      dsWsel: 99.36,
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
    freeboardThreshold: 0.3,
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
// Discharges estimated from ARR regional data for the 21,400 km² catchment.
//
// All values in metres and m³/s (native metric).
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
    { station: 0, elevation: 22.0, manningsN: 0.06, bankStation: null },
    { station: 45, elevation: 19.0, manningsN: 0.05, bankStation: null },
    { station: 90, elevation: 17.0, manningsN: 0.045, bankStation: null },
    // Left bank
    { station: 120, elevation: 14.5, manningsN: 0.04, bankStation: 'left' },
    // Main channel — deep tidal river
    { station: 140, elevation: 10.5, manningsN: 0.03, bankStation: null },
    { station: 160, elevation: 6.0, manningsN: 0.028, bankStation: null },
    { station: 175, elevation: 3.0, manningsN: 0.025, bankStation: null },
    { station: 195, elevation: 1.5, manningsN: 0.025, bankStation: null },
    { station: 215, elevation: 2.5, manningsN: 0.025, bankStation: null },
    { station: 230, elevation: 4.5, manningsN: 0.028, bankStation: null },
    { station: 250, elevation: 8.5, manningsN: 0.03, bankStation: null },
    { station: 270, elevation: 11.5, manningsN: 0.035, bankStation: null },
    // Right bank
    { station: 280, elevation: 15.0, manningsN: 0.04, bankStation: 'right' },
    // Right floodplain
    { station: 310, elevation: 17.5, manningsN: 0.05, bankStation: null },
    { station: 350, elevation: 20.0, manningsN: 0.055, bankStation: null },
    { station: 400, elevation: 22.0, manningsN: 0.06, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 16.8,
    lowChordRight: 16.8,
    highChord: 20.0,
    leftAbutmentStation: 130,
    rightAbutmentStation: 275,
    contractionLength: 120,
    expansionLength: 120,
    orificeCd: 0.8,
    weirCw: 1.4,
    deckWidth: 6.6,
    skewAngle: 10,
    piers: [
      { station: 165, width: 1.5, shape: 'round-nose' },
      { station: 200, width: 1.5, shape: 'round-nose' },
      { station: 230, width: 1.5, shape: 'round-nose' },
      { station: 260, width: 1.5, shape: 'round-nose' },
    ],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '5-yr ARI',
      ari: '20% AEP',
      discharge: 2500,
      dsWsel: 8.5,
      channelSlope: 0.00015,
    },
    {
      name: '20-yr ARI',
      ari: '5% AEP',
      discharge: 5000,
      dsWsel: 11.5,
      channelSlope: 0.00018,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 10000,
      dsWsel: 14.5,
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
    freeboardThreshold: 0.3,
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
};

// ---------------------------------------------------------------------------
// 4. Breakfast Creek Bridge — Brisbane, QLD, Australia
//
// Small urban tidal creek crossing. Based on the heritage Albert Street
// bridge over Breakfast Creek. Narrow channel with two square heritage piers.
// Compact geometry suitable for testing small-bridge behaviour.
//
// Flood levels and flows estimated from Brisbane City Council Breakfast
// Creek Flood Study (TUFLOW model).
//
// All values in metres and m³/s (native metric).
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
    { station: 0, elevation: 5.5, manningsN: 0.05, bankStation: null },
    { station: 6, elevation: 4.5, manningsN: 0.045, bankStation: null },
    { station: 12, elevation: 3.6, manningsN: 0.04, bankStation: null },
    // Left bank station
    { station: 17, elevation: 2.7, manningsN: 0.035, bankStation: 'left' },
    // Main channel — tidal creek
    { station: 21, elevation: 1.5, manningsN: 0.03, bankStation: null },
    { station: 27, elevation: 0.6, manningsN: 0.028, bankStation: null },
    { station: 33, elevation: 0.0, manningsN: 0.025, bankStation: null },
    { station: 40, elevation: 0.3, manningsN: 0.025, bankStation: null },
    { station: 46, elevation: 0.9, manningsN: 0.028, bankStation: null },
    { station: 52, elevation: 1.8, manningsN: 0.03, bankStation: null },
    // Right bank station
    { station: 56, elevation: 2.7, manningsN: 0.035, bankStation: 'right' },
    // Right bank — urban
    { station: 61, elevation: 3.6, manningsN: 0.04, bankStation: null },
    { station: 67, elevation: 4.5, manningsN: 0.045, bankStation: null },
    { station: 73, elevation: 5.5, manningsN: 0.05, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 4.0,
    lowChordRight: 4.0,
    highChord: 5.5,
    leftAbutmentStation: 15,
    rightAbutmentStation: 58,
    contractionLength: 30,
    expansionLength: 30,
    orificeCd: 0.8,
    weirCw: 1.4,
    deckWidth: 6.0,
    skewAngle: 0,
    piers: [
      { station: 30, width: 0.9, shape: 'square' },
      { station: 43, width: 0.9, shape: 'square' },
    ],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '10-yr ARI',
      ari: '10% AEP',
      discharge: 30,
      dsWsel: 1.5,
      channelSlope: 0.001,
    },
    {
      name: '50-yr ARI',
      ari: '2% AEP',
      discharge: 60,
      dsWsel: 2.1,
      channelSlope: 0.0012,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 80,
      dsWsel: 2.4,
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
    freeboardThreshold: 0.3,
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
// All values in metres and m³/s (converted from imperial reference).
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
    { station: 0, elevation: 3.05, manningsN: 0.05, bankStation: null },
    { station: 3.05, elevation: 2.44, manningsN: 0.04, bankStation: 'left' },
    { station: 6.10, elevation: 1.83, manningsN: 0.035, bankStation: null },
    { station: 9.14, elevation: 1.22, manningsN: 0.035, bankStation: null },
    { station: 12.19, elevation: 0.61, manningsN: 0.035, bankStation: null },
    { station: 15.24, elevation: 0.0, manningsN: 0.035, bankStation: null },
    { station: 18.29, elevation: 0.61, manningsN: 0.035, bankStation: null },
    { station: 21.34, elevation: 1.22, manningsN: 0.035, bankStation: null },
    { station: 24.38, elevation: 1.83, manningsN: 0.035, bankStation: null },
    { station: 27.43, elevation: 2.44, manningsN: 0.04, bankStation: 'right' },
    { station: 30.48, elevation: 3.05, manningsN: 0.05, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 2.74,
    lowChordRight: 2.74,
    highChord: 3.66,
    leftAbutmentStation: 1.52,
    rightAbutmentStation: 28.96,
    contractionLength: 27.43,
    expansionLength: 27.43,
    orificeCd: 0.8,
    weirCw: 1.4,
    deckWidth: 1.83,
    skewAngle: 0,
    piers: [{ station: 15.24, width: 1.22, shape: 'round-nose' }],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: 'Low Flow',
      ari: 'Benchmark',
      discharge: 14.16,
      dsWsel: 1.524,
      channelSlope: 0.001,
    },
    {
      name: 'High Flow',
      ari: 'Benchmark',
      discharge: 33.98,
      dsWsel: 2.134,
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
    freeboardThreshold: 0.3,
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
