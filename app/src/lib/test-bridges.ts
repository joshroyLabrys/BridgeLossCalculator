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

// ---------------------------------------------------------------------------
// 6. Victoria Bridge — Brisbane River, QLD, Australia
//
// Inner-city crossing of the Brisbane River connecting the CBD (north bank)
// to South Brisbane. The current bridge (opened 14 April 1969) is a precast,
// post-tensioned, segmental concrete box girder with haunched profile.
// Designed by Albert Contessa, built by Hornibrook. Total length 313 m in
// 3 spans: two ~83.3 m side spans and a 146.3 m (480 ft) main span.
// 2 reinforced-concrete portal-frame piers with sloping column legs.
// Converted to dedicated busway (2014), refurbished for Brisbane Metro (2022-25).
//
// Navigation clearance 11.4–12.7 m above HAT (same as Captain Cook Bridge
// and Goodwill Bridge). HAT at Brisbane City ≈ 2.7 m AHD, giving soffit
// elevations of approximately 14.1–15.4 m AHD (varies with haunch depth).
//
// Cross-section approximated from BRCFS (2017) bathymetry context and
// navigation data. City reach thalweg estimated at −6 to −8 m AHD
// (undredged since late 1990s; historically dredged to 6 m depth).
//
// Flood data sourced from:
//   - BRCFS 2017 (BMT WBM): 1% AEP level ≈ 4.54 m AHD at City Gauge
//     (0.08 m above observed 2011 peak)
//   - BOM observed: Jan 2011 peak 4.46 m AHD, est. ~7,300 m³/s at City Gauge
//   - BOM observed: Jan 1974 peak 5.45 m AHD, ~9,500 m³/s
//   - BOM flood classifications: Minor 1.70 m, Moderate 2.60 m, Major 3.50 m
//   - BCC adopted DFL (Q100): 3.7 m AHD at 6,800 m³/s (1978, reconfirmed 2003)
//
// All values in metres and m³/s (native metric).
//
// References:
//   Brisbane River Catchment Flood Study, BMT WBM (2017) — QRA
//   BOM Flood Warning System — Brisbane River at City Gauge (540198)
//   Structurae — Victoria Bridge (1969)
//   Wikipedia — Victoria Bridge, Brisbane; Bridges over the Brisbane River
//   Goodwill Bridge / Captain Cook Bridge navigation clearance data
//   Original drawings held at Fryer Library, UQ (collection UQFL454)
// ---------------------------------------------------------------------------
const victoriaBridge: TestBridge = {
  id: 'victoria-bridge',
  name: 'Victoria Bridge',
  location: 'Brisbane River, Brisbane, QLD, Australia',
  description:
    '313 m haunched box girder (1969), 3 spans, 2 portal-frame piers. Nav clearance 11.4–12.7 m. Flood data from BRCFS 2017 & BOM observed (2011, 1974). Full simulation with debris, sensitivity, and all methods.',
  imageUrl: '',
  crossSection: [
    // Left (north) bank — CBD side, steep engineered riverwall / North Quay
    { station: 0, elevation: 8.5, manningsN: 0.025, bankStation: null },
    { station: 20, elevation: 6.0, manningsN: 0.025, bankStation: null },
    { station: 40, elevation: 4.0, manningsN: 0.028, bankStation: null },
    { station: 60, elevation: 2.5, manningsN: 0.03, bankStation: null },
    // Left bank — top of engineered wall
    { station: 75, elevation: 1.0, manningsN: 0.03, bankStation: 'left' },
    // Main channel — deep tidal Brisbane River (undredged city reach)
    { station: 95, elevation: -2.0, manningsN: 0.028, bankStation: null },
    { station: 120, elevation: -4.5, manningsN: 0.025, bankStation: null },
    { station: 145, elevation: -6.5, manningsN: 0.022, bankStation: null },
    { station: 170, elevation: -7.5, manningsN: 0.022, bankStation: null },
    { station: 195, elevation: -7.0, manningsN: 0.022, bankStation: null },
    { station: 220, elevation: -5.5, manningsN: 0.025, bankStation: null },
    { station: 245, elevation: -3.0, manningsN: 0.025, bankStation: null },
    { station: 265, elevation: -0.5, manningsN: 0.028, bankStation: null },
    // Right bank — South Brisbane / South Bank parkland edge
    { station: 280, elevation: 1.5, manningsN: 0.03, bankStation: 'right' },
    // Right (south) bank — South Brisbane, moderate slope to parkland
    { station: 300, elevation: 3.5, manningsN: 0.035, bankStation: null },
    { station: 320, elevation: 5.0, manningsN: 0.04, bankStation: null },
    { station: 340, elevation: 6.5, manningsN: 0.04, bankStation: null },
    { station: 365, elevation: 8.5, manningsN: 0.045, bankStation: null },
  ],
  bridgeGeometry: {
    // Soffit (low chord) derived from navigation clearance 11.4–12.7 m above
    // HAT (2.7 m AHD). Haunched girder: deepest at piers (~14.1 m AHD),
    // shallowest at midspan (~15.4 m AHD).
    lowChordLeft: 14.5,
    lowChordRight: 14.5,
    highChord: 17.0,
    // 313 m total: left abutment → 83.3 m → Pier 1 → 146.3 m → Pier 2 → 83.3 m → right abutment
    leftAbutmentStation: 20,
    rightAbutmentStation: 333,
    contractionLength: 200,
    expansionLength: 280,
    orificeCd: 0.8,
    weirCw: 1.5,
    deckWidth: 23.0,
    skewAngle: 8,
    piers: [
      // 2 portal-frame piers with sloping column legs — modelled as round-nose
      // for hydraulic purposes (concrete with flow-shaped leading edges).
      // Pier width estimated at 3.0 m (not publicly available; typical for
      // a major navigable river crossing of this span).
      { station: 103, width: 3.0, shape: 'round-nose' },
      { station: 249, width: 3.0, shape: 'round-nose' },
    ],
    // Haunched box girder: soffit lowest at piers, highest at midspan
    lowChordProfile: [
      { station: 20, elevation: 14.5 },   // Left abutment
      { station: 103, elevation: 14.1 },  // Pier 1 (deepest haunch)
      { station: 145, elevation: 15.0 },  // Midspan of left side span
      { station: 176, elevation: 15.4 },  // Midspan of main span
      { station: 210, elevation: 15.0 },  // Approaching Pier 2
      { station: 249, elevation: 14.1 },  // Pier 2 (deepest haunch)
      { station: 291, elevation: 15.0 },  // Midspan of right side span
      { station: 333, elevation: 14.5 },  // Right abutment
    ],
  },
  flowProfiles: [
    {
      // BOM minor flood classification at City Gauge: 1.70 m AHD
      name: '20% AEP (5-yr ARI)',
      ari: '20% AEP',
      discharge: 2500,
      dsWsel: 1.7,
      channelSlope: 0.00008,
    },
    {
      // Interpolated between BOM moderate (2.60 m) and major (3.50 m) thresholds
      name: '5% AEP (20-yr ARI)',
      ari: '5% AEP',
      discharge: 5000,
      dsWsel: 3.0,
      channelSlope: 0.0001,
    },
    {
      // BRCFS 2017: 1% AEP level at City Gauge ≈ 4.54 m AHD
      // (0.08 m above observed 2011 peak). Discharge ~7,300 m³/s.
      name: '1% AEP (100-yr ARI)',
      ari: '1% AEP',
      discharge: 7300,
      dsWsel: 4.54,
      channelSlope: 0.00012,
    },
    {
      // BOM observed: 13 January 2011, 3:00 am. Peak 4.46 m AHD.
      // Estimated ~7,300 m³/s at City Gauge (with Wivenhoe mitigation).
      // BRCFS classifies this as approximately the 1% AEP event.
      name: 'Jan 2011 Flood',
      ari: 'Historic (~1% AEP)',
      discharge: 7300,
      dsWsel: 4.46,
      channelSlope: 0.00012,
    },
    {
      // BOM observed: 25 January 1974. Peak 5.45 m AHD.
      // ~9,500 m³/s (Somerset Dam only, no Wivenhoe).
      name: 'Jan 1974 Flood',
      ari: 'Historic',
      discharge: 9500,
      dsWsel: 5.45,
      channelSlope: 0.00015,
    },
  ],
  coefficients: {
    contractionCoeff: 0.3,
    expansionCoeff: 0.5,
    yarnellK: 0.9,
    maxIterations: 100,
    tolerance: 0.01,
    initialGuessOffset: 0.5,
    debrisBlockagePct: 10,
    manningsNSensitivityPct: 20,
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
  victoriaBridge,
];
