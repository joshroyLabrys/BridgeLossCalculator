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
// 1. Windsor Bridge — Hawkesbury River, NSW
// Classic flood-prone crossing on a wide floodplain west of Sydney.
// Multiple spans with round-nose piers over a broad, flat channel.
// ---------------------------------------------------------------------------
const windsorBridge: TestBridge = {
  id: 'windsor',
  name: 'Windsor Bridge',
  location: 'Hawkesbury River, NSW',
  description:
    'Wide floodplain crossing, multiple round-nose piers, low gradient. Typical inland flood study bridge.',
  imageUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBQFoPPz97AYPj18cIDGDP0Q19oIUCkGfDR2TRGe7Ifx6qDKqiTokYqZohbvb6H0uIasdY-CkLZOyUr3g-R031CREX6BzqPinPqM7wdwnPnjkdQEZIqj526SF4eXypXn1AuUkKbfsElEwY4GHiEhuqfE0OIIp4XonbVWsMXS79P_RuQ90RicXvQyo2rZBtcDzWRC3B63gMu6l2x8Nil8sNslXDNCF3a2HQ6Q_x5_dn14Mg82vUt9y3MdHl0DU2UD0IObP_k-0FN-A',
  crossSection: [
    { station: 0, elevation: 36, manningsN: 0.06, bankStation: null },
    { station: 80, elevation: 28, manningsN: 0.05, bankStation: null },
    { station: 200, elevation: 18, manningsN: 0.045, bankStation: 'left' },
    { station: 350, elevation: 8, manningsN: 0.035, bankStation: null },
    { station: 500, elevation: 2, manningsN: 0.03, bankStation: null },
    { station: 650, elevation: 0, manningsN: 0.03, bankStation: null },
    { station: 800, elevation: 3, manningsN: 0.03, bankStation: null },
    { station: 950, elevation: 10, manningsN: 0.035, bankStation: null },
    { station: 1100, elevation: 18, manningsN: 0.045, bankStation: 'right' },
    { station: 1220, elevation: 28, manningsN: 0.05, bankStation: null },
    { station: 1300, elevation: 36, manningsN: 0.06, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 26,
    lowChordRight: 26,
    highChord: 34,
    leftAbutmentStation: 160,
    rightAbutmentStation: 1140,
    leftAbutmentSlope: 2,
    rightAbutmentSlope: 2,
    skewAngle: 10,
    piers: [
      { station: 340, width: 5, shape: 'round-nose' },
      { station: 500, width: 5, shape: 'round-nose' },
      { station: 650, width: 5, shape: 'round-nose' },
      { station: 800, width: 5, shape: 'round-nose' },
      { station: 960, width: 5, shape: 'round-nose' },
    ],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '20-yr ARI',
      ari: '5% AEP',
      discharge: 176600,
      dsWsel: 16,
      channelSlope: 0.00015,
      contractionLength: 300,
      expansionLength: 300,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 353100,
      dsWsel: 22,
      channelSlope: 0.0002,
      contractionLength: 300,
      expansionLength: 300,
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
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
};

// ---------------------------------------------------------------------------
// 2. Breakfast Creek Bridge — Brisbane, QLD
// Small urban tidal creek bridge. Narrow channel, square heritage piers,
// tight geometry. Good for testing small-bridge behaviour.
// ---------------------------------------------------------------------------
const breakfastCreekBridge: TestBridge = {
  id: 'breakfast-creek',
  name: 'Breakfast Creek Bridge',
  location: 'Breakfast Creek, Brisbane, QLD',
  description:
    'Narrow urban creek crossing with square heritage piers. Compact geometry for small-bridge testing.',
  imageUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBsRqpMuuguhCGkw-uVM3pD4xz_tW1QLK_mvaOY838w4j8kW66ZC5nmTQoUBGGLR4JpH-fSeMCnHgw98_Chfr-Jc8uTOL2GdJAalMRzmh51uIsedvnXJ6lVbFA5mY1lM0waSCpPuK479k0iTP2hwGbvRS7zX0h2NOb5S7Dhjd01e5Nl7d2XuZTV5ggBVkuLsjNapOu0HkwrMUvBYk4vu93UvzJcIGD62IXJp2tuV_lh8unkfh95G6QMevRid31uh9W2C1QPVYdnEg',
  crossSection: [
    { station: 0, elevation: 16, manningsN: 0.05, bankStation: null },
    { station: 30, elevation: 10, manningsN: 0.04, bankStation: 'left' },
    { station: 55, elevation: 4, manningsN: 0.03, bankStation: null },
    { station: 80, elevation: 1, manningsN: 0.025, bankStation: null },
    { station: 110, elevation: 0, manningsN: 0.025, bankStation: null },
    { station: 140, elevation: 2, manningsN: 0.025, bankStation: null },
    { station: 165, elevation: 5, manningsN: 0.03, bankStation: null },
    { station: 190, elevation: 10, manningsN: 0.04, bankStation: 'right' },
    { station: 220, elevation: 16, manningsN: 0.05, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 12,
    lowChordRight: 12,
    highChord: 18,
    leftAbutmentStation: 25,
    rightAbutmentStation: 195,
    leftAbutmentSlope: 1.5,
    rightAbutmentSlope: 1.5,
    skewAngle: 0,
    piers: [
      { station: 75, width: 4, shape: 'square' },
      { station: 145, width: 4, shape: 'square' },
    ],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '10-yr ARI',
      ari: '10% AEP',
      discharge: 5300,
      dsWsel: 6,
      channelSlope: 0.001,
      contractionLength: 80,
      expansionLength: 80,
    },
    {
      name: '50-yr ARI',
      ari: '2% AEP',
      discharge: 10600,
      dsWsel: 8,
      channelSlope: 0.0012,
      contractionLength: 80,
      expansionLength: 80,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 14100,
      dsWsel: 9.5,
      channelSlope: 0.0015,
      contractionLength: 80,
      expansionLength: 80,
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
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
};

// ---------------------------------------------------------------------------
// 3. Echuca-Moama Bridge — Murray River, VIC/NSW border
// Major inland river with wide channel and floodplain.
// Cylindrical piers on a gentle gradient.
// ---------------------------------------------------------------------------
const echucaBridge: TestBridge = {
  id: 'echuca',
  name: 'Echuca-Moama Bridge',
  location: 'Murray River, VIC/NSW',
  description:
    'Major inland river crossing with cylindrical piers on a low-gradient floodplain. Classic Murray River flood scenario.',
  imageUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBYD8J20Atreww31PevBB-Svv6aIxYGoZK8V63Qt0YQjynmpQ5Cxdvz_GsaS2iVEgPMkW34ukSzBJMoeMgMhDE6zVs_wLJORYsdE9dFPlvFTZ6FyLGkl-yxmzhRLAddIWqbEfaki7aUbC6dBJiXOSafhXy1Oi4gGy1eBYq9AMcIlUh5RihzTgfZJGjdy7cckAyyxD9nY4SvvUMiA0MaYPPdc1aOTjd-BvnVGw_udQkz29ATYQ-TLZIL0XAS3CKK5ao-tU0rkMzxpg',
  crossSection: [
    { station: 0, elevation: 30, manningsN: 0.055, bankStation: null },
    { station: 120, elevation: 22, manningsN: 0.05, bankStation: null },
    { station: 250, elevation: 16, manningsN: 0.04, bankStation: 'left' },
    { station: 400, elevation: 8, manningsN: 0.035, bankStation: null },
    { station: 530, elevation: 4, manningsN: 0.03, bankStation: null },
    { station: 620, elevation: 2, manningsN: 0.028, bankStation: null },
    { station: 710, elevation: 4, manningsN: 0.03, bankStation: null },
    { station: 850, elevation: 10, manningsN: 0.035, bankStation: null },
    { station: 970, elevation: 16, manningsN: 0.04, bankStation: 'right' },
    { station: 1100, elevation: 22, manningsN: 0.05, bankStation: null },
    { station: 1200, elevation: 30, manningsN: 0.055, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 22,
    lowChordRight: 22,
    highChord: 30,
    leftAbutmentStation: 200,
    rightAbutmentStation: 1000,
    leftAbutmentSlope: 2,
    rightAbutmentSlope: 2,
    skewAngle: 5,
    piers: [
      { station: 380, width: 4, shape: 'cylindrical' },
      { station: 530, width: 4, shape: 'cylindrical' },
      { station: 680, width: 4, shape: 'cylindrical' },
      { station: 830, width: 4, shape: 'cylindrical' },
    ],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '10-yr ARI',
      ari: '10% AEP',
      discharge: 70600,
      dsWsel: 12,
      channelSlope: 0.00008,
      contractionLength: 250,
      expansionLength: 250,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 176600,
      dsWsel: 17,
      channelSlope: 0.0001,
      contractionLength: 250,
      expansionLength: 250,
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
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
};

// ---------------------------------------------------------------------------
// 4. Johnstone River Bridge — Innisfail, QLD
// Tropical north Queensland. Steep catchment with high-intensity rainfall
// produces fast, deep flows in a V-shaped channel. Sharp-nosed piers.
// ---------------------------------------------------------------------------
const johnstoneBridge: TestBridge = {
  id: 'johnstone',
  name: 'Johnstone River Bridge',
  location: 'Innisfail, QLD',
  description:
    'Steep tropical river with V-shaped channel and sharp-nosed piers. High velocity, deep flow test case.',
  imageUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA6LJxayoqVdUSpeX6QyY61Ka-GWswsjcKoYLE1KyE23cvJenvA9VkwtQ_poKhqHoED2QS0eelcUVSGTyMfTjXOC5qXeujUYSu2LcdPcFq8FXiFGhXv5px0Dzz9V8d768E3SvMEwcyVBPEADQfWptcWDCQuaaUNr9uJHE3Ro1mxrsZt-0taB_JauHK9OwRuoHumn7O7yJiYOJ1bXr7J6BOSA7XtqnZbWQtqGy1fjQWhIrxWxytkolVKbhqjvTzE2i0V8FbkYpXqEw',
  crossSection: [
    { station: 0, elevation: 32, manningsN: 0.06, bankStation: null },
    { station: 50, elevation: 24, manningsN: 0.05, bankStation: null },
    { station: 100, elevation: 16, manningsN: 0.045, bankStation: 'left' },
    { station: 160, elevation: 8, manningsN: 0.035, bankStation: null },
    { station: 220, elevation: 2, manningsN: 0.03, bankStation: null },
    { station: 270, elevation: 0, manningsN: 0.028, bankStation: null },
    { station: 320, elevation: 3, manningsN: 0.03, bankStation: null },
    { station: 380, elevation: 10, manningsN: 0.035, bankStation: null },
    { station: 440, elevation: 16, manningsN: 0.045, bankStation: 'right' },
    { station: 490, elevation: 24, manningsN: 0.05, bankStation: null },
    { station: 540, elevation: 32, manningsN: 0.06, bankStation: null },
  ],
  bridgeGeometry: {
    lowChordLeft: 20,
    lowChordRight: 20,
    highChord: 28,
    leftAbutmentStation: 85,
    rightAbutmentStation: 455,
    leftAbutmentSlope: 1.5,
    rightAbutmentSlope: 1.5,
    skewAngle: 15,
    piers: [
      { station: 180, width: 3.5, shape: 'sharp' },
      { station: 270, width: 3.5, shape: 'sharp' },
      { station: 360, width: 3.5, shape: 'sharp' },
    ],
    lowChordProfile: [],
  },
  flowProfiles: [
    {
      name: '20-yr ARI',
      ari: '5% AEP',
      discharge: 88300,
      dsWsel: 10,
      channelSlope: 0.002,
      contractionLength: 150,
      expansionLength: 150,
    },
    {
      name: '50-yr ARI',
      ari: '2% AEP',
      discharge: 141300,
      dsWsel: 14,
      channelSlope: 0.0025,
      contractionLength: 150,
      expansionLength: 150,
    },
    {
      name: '100-yr ARI',
      ari: '1% AEP',
      discharge: 194500,
      dsWsel: 17,
      channelSlope: 0.003,
      contractionLength: 150,
      expansionLength: 150,
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
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
};

// ---------------------------------------------------------------------------
// 5. Validation Benchmark: V-Channel
//
// PURPOSE: Hand-computable reference case for verifying all calculation methods.
// Simple symmetric V-channel with a single round-nose pier. Geometry is trivial
// enough to verify every intermediate value by hand.
//
// Analytical derivation (Yarnell, Low Flow):
//   Area = 0.5 × 50 × 5 = 125 sq ft
//   V = 500/125 = 4.0 ft/s
//   V²/2g = 16/64.348 = 0.2487 ft
//   Pier blockage = 4 × 5 = 20 sq ft
//   α = 20/125 = 0.16
//   K(round-nose) = 0.9
//   Δy = 0.9 × 5.3 × 0.1698 × 0.2487 = 0.2014 ft
//
// References:
//   Yarnell, D.L. (1934) USDA Tech Bulletin 442
//   HEC-RAS Hydraulic Reference Manual, Ch. 5
// ---------------------------------------------------------------------------
const vChannelBenchmark: TestBridge = {
  id: 'v-channel-benchmark',
  name: 'V-Channel Benchmark',
  location: 'Analytical — Hand Calculation',
  description:
    'Symmetric V-channel with a single round-nose pier. Every intermediate value can be verified by hand. ' +
    'Yarnell results are exact analytical solutions; Energy and Momentum are iterative. ' +
    'WSPRO returns zero because the bridge opening captures all conveyance (M ≈ 1).',
  imageUrl: '',
  crossSection: [
    { station: 0, elevation: 10, manningsN: 0.035, bankStation: 'left' },
    { station: 50, elevation: 0, manningsN: 0.035, bankStation: null },
    { station: 100, elevation: 10, manningsN: 0.035, bankStation: 'right' },
  ],
  bridgeGeometry: {
    lowChordLeft: 9,
    lowChordRight: 9,
    highChord: 12,
    leftAbutmentStation: 5,
    rightAbutmentStation: 95,
    leftAbutmentSlope: 0,
    rightAbutmentSlope: 0,
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
      contractionLength: 90,
      expansionLength: 90,
    },
    {
      name: 'High Flow',
      ari: 'Benchmark',
      discharge: 2500,
      dsWsel: 8,
      channelSlope: 0.001,
      contractionLength: 90,
      expansionLength: 90,
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
    methodsToRun: { energy: true, momentum: true, yarnell: true, wspro: true },
  },
  expectedResults: [
    // ---- Low Flow (Q=500, DS WSEL=5) ----
    {
      profileName: 'Low Flow',
      method: 'yarnell',
      upstreamWsel: 5.2014,
      headLoss: 0.2014,
      source: 'Yarnell (1934) equation: Δy = K(K+5−0.6)(α+15α⁴)(V²/2g)',
      toleranceFt: 0.001,
    },
    {
      profileName: 'Low Flow',
      method: 'energy',
      upstreamWsel: 5.5088,
      headLoss: 0.5088,
      source: 'Standard step energy equation (iterative, tol=0.01 ft)',
      toleranceFt: 0.02,
    },
    {
      profileName: 'Low Flow',
      method: 'momentum',
      upstreamWsel: 5.0496,
      headLoss: 0.0496,
      source: 'Momentum balance with pier drag (iterative, tol=0.01 ft)',
      toleranceFt: 0.02,
    },
    {
      profileName: 'Low Flow',
      method: 'wspro',
      upstreamWsel: 5.0,
      headLoss: 0.0,
      source: 'WSPRO: M ≈ 1.0, Cb = 0 — no constriction backwater (expected)',
      toleranceFt: 0.01,
    },
    // ---- High Flow (Q=2500, DS WSEL=8) ----
    {
      profileName: 'High Flow',
      method: 'yarnell',
      upstreamWsel: 8.4592,
      headLoss: 0.4592,
      source: 'Yarnell (1934) equation: Δy = K(K+5−0.6)(α+15α⁴)(V²/2g)',
      toleranceFt: 0.001,
    },
    {
      profileName: 'High Flow',
      method: 'energy',
      upstreamWsel: 9.1092,
      headLoss: 1.1092,
      source: 'Standard step energy equation (iterative, tol=0.01 ft)',
      toleranceFt: 0.02,
    },
    {
      profileName: 'High Flow',
      method: 'momentum',
      upstreamWsel: 8.0936,
      headLoss: 0.0936,
      source: 'Momentum balance with pier drag (iterative, tol=0.01 ft)',
      toleranceFt: 0.02,
    },
    {
      profileName: 'High Flow',
      method: 'wspro',
      upstreamWsel: 8.0,
      headLoss: 0.0,
      source: 'WSPRO: M ≈ 1.0, Cb = 0 — no constriction backwater (expected)',
      toleranceFt: 0.01,
    },
  ],
};

export const TEST_BRIDGES: TestBridge[] = [
  vChannelBenchmark,
  windsorBridge,
  breakfastCreekBridge,
  echucaBridge,
  johnstoneBridge,
];
