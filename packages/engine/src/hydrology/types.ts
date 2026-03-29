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
