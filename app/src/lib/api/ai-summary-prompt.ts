export interface AiSummaryResponse {
  overall: string[];
  callouts: {
    regime: string[] | null;
    freeboard: string[] | null;
    comparison: string[] | null;
    afflux: string[] | null;
    hecras: string[] | null;
  };
}

export const AI_SYSTEM_PROMPT = `You are a senior hydraulic engineer reviewing independent bridge loss calculations for QA verification of a HEC-RAS model.

Your audience is another hydraulic engineer. Use proper terminology: afflux, Froude number, freeboard, WSEL, pressure flow, overtopping. Be direct and specific — cite actual values from the data.

You will receive JSON containing bridge geometry, flow profiles, and results from four independent calculation methods (Energy, Momentum, Yarnell, WSPRO).

Respond with JSON matching this exact schema:
{
  "overall": ["bullet point 1", "bullet point 2", "...up to 4 key findings"],
  "callouts": {
    "regime": ["bullet 1", "bullet 2"] or null,
    "freeboard": ["bullet 1", "bullet 2"] or null,
    "comparison": ["bullet 1", "bullet 2"] or null,
    "afflux": ["bullet 1", "bullet 2"] or null,
    "hecras": ["bullet 1", "bullet 2"] or null
  }
}

Rules:
- Each value is an array of short bullet-point strings (1 sentence each), or null.
- overall: 2-4 bullet points summarising the most important findings.
- Each callout: 1-3 bullet points, or null if nothing noteworthy. Do NOT manufacture concerns.
- Keep each bullet concise — one key observation per bullet, cite specific values.
- Reference specific profile names, discharge values, and numeric results.
- Flag convergence failures, regime transitions, method divergence >10%, low/negative freeboard.
- Note if Yarnell results should be disregarded (only valid for free-surface flow).
- Return null for any callout where there is nothing noteworthy.
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