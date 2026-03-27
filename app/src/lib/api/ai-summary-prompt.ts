export interface AiSummaryResponse {
  overall: string;
  callouts: {
    regime: string | null;
    freeboard: string | null;
    comparison: string | null;
    afflux: string | null;
    hecras: string | null;
  };
}

export const AI_SYSTEM_PROMPT = `You are a senior hydraulic engineer reviewing independent bridge loss calculations for QA verification of a HEC-RAS model.

Your audience is another hydraulic engineer. Use proper terminology: afflux, Froude number, freeboard, WSEL, pressure flow, overtopping. Be direct and specific — cite actual values from the data.

You will receive JSON containing bridge geometry, flow profiles, and results from four independent calculation methods (Energy, Momentum, Yarnell, WSPRO).

Respond with JSON matching this exact schema:
{
  "overall": "2-4 sentence executive summary of the most important findings",
  "callouts": {
    "regime": "1-2 sentence insight about flow regime classification, or null if unremarkable",
    "freeboard": "1-2 sentence insight about freeboard/clearance, or null if unremarkable",
    "comparison": "1-2 sentence insight about method agreement/divergence, or null if unremarkable",
    "afflux": "1-2 sentence insight about afflux trends across profiles, or null if unremarkable",
    "hecras": "1-2 sentence insight about HEC-RAS comparison, or null if no HEC-RAS data provided"
  }
}

Rules:
- Return null for any callout where there is nothing noteworthy. Do NOT manufacture concerns.
- Reference specific profile names, discharge values, and numeric results.
- Flag convergence failures, regime transitions, method divergence >10%, low/negative freeboard.
- Note if Yarnell results should be disregarded (only valid for free-surface flow).
- Keep each callout to 1-2 sentences. The overall summary should be 2-4 sentences.
- Return ONLY valid JSON. No markdown, no code fences.`;

export interface AiSummaryPayload {
  bridgeGeometry: {
    lowChordLeft: number;
    lowChordRight: number;
    highChord: number;
    span: number;
    pierCount: number;
    debrisBlockagePct: number;
  };
  flowProfiles: {
    name: string;
    ari: string;
    discharge: number;
    dsWsel: number;
  }[];
  methods: {
    [method: string]: {
      profileName: string;
      upstreamWsel: number;
      totalHeadLoss: number;
      approachVelocity: number;
      froudeApproach: number;
      flowRegime: string;
      converged: boolean;
      bridgeOpeningArea: number;
      tuflowPierFLC: number;
      tuflowSuperFLC: number | null;
      error: string | null;
    }[];
  };
  freeboard: {
    profileName: string;
    freeboard: number;
    status: string;
  }[] | null;
  hecRasComparison: {
    profileName: string;
    upstreamWsel: number | null;
    headLoss: number | null;
  }[] | null;
  sensitivityEnabled: boolean;
}

export function buildUserPrompt(payload: AiSummaryPayload): string {
  return JSON.stringify(payload);
}