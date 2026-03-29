import type {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  CalculationResults,
} from '@flowsuite/engine/types';

export interface ChatContext {
  crossSectionStats: {
    pointCount: number;
    stationRange: [number, number];
    minElevation: number;
    maxElevation: number;
  };
  bridgeGeometry: {
    span: number;
    lowChordLeft: number;
    lowChordRight: number;
    highChord: number;
    pierCount: number;
    deckWidth: number;
  };
  coefficients: {
    contraction: number;
    expansion: number;
    debrisBlockagePct: number;
  };
  flowProfiles: Array<{
    name: string;
    ari: string;
    discharge: number;
    dsWsel: number;
  }>;
  results: Record<
    string,
    Array<{
      profileName: string;
      upstreamWsel: number;
      totalHeadLoss: number;
      approachVelocity: number;
      bridgeVelocity: number;
      froudeApproach: number;
      flowRegime: string;
      converged: boolean;
      error: string | null;
    }>
  >;
  whatIfActive: boolean;
  whatIfOverrides?: Record<string, number>;
}

export function buildChatContext(
  crossSection: CrossSectionPoint[],
  bridgeGeometry: BridgeGeometry,
  flowProfiles: FlowProfile[],
  coefficients: Coefficients,
  results: CalculationResults | null,
  whatIfOverrides?: Record<string, number>
): ChatContext {
  const stations = crossSection.map((p) => p.station);
  const elevations = crossSection.map((p) => p.elevation);

  const span =
    bridgeGeometry.rightAbutmentStation - bridgeGeometry.leftAbutmentStation;

  const compressedResults: ChatContext['results'] = {};
  if (results) {
    for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
      const methodResults = results[method];
      if (methodResults && methodResults.length > 0) {
        compressedResults[method] = methodResults.map((r) => ({
          profileName: r.profileName,
          upstreamWsel: r.upstreamWsel,
          totalHeadLoss: r.totalHeadLoss,
          approachVelocity: r.approachVelocity,
          bridgeVelocity: r.bridgeVelocity,
          froudeApproach: r.froudeApproach,
          flowRegime: r.flowRegime,
          converged: r.converged,
          error: r.error,
        }));
      }
    }
  }

  return {
    crossSectionStats: {
      pointCount: crossSection.length,
      stationRange: [
        stations.length > 0 ? Math.min(...stations) : 0,
        stations.length > 0 ? Math.max(...stations) : 0,
      ],
      minElevation: elevations.length > 0 ? Math.min(...elevations) : 0,
      maxElevation: elevations.length > 0 ? Math.max(...elevations) : 0,
    },
    bridgeGeometry: {
      span,
      lowChordLeft: bridgeGeometry.lowChordLeft,
      lowChordRight: bridgeGeometry.lowChordRight,
      highChord: bridgeGeometry.highChord,
      pierCount: bridgeGeometry.piers.length,
      deckWidth: bridgeGeometry.deckWidth,
    },
    coefficients: {
      contraction: coefficients.contractionCoeff,
      expansion: coefficients.expansionCoeff,
      debrisBlockagePct: coefficients.debrisBlockagePct,
    },
    flowProfiles: flowProfiles.map((fp) => ({
      name: fp.name,
      ari: fp.ari,
      discharge: fp.discharge,
      dsWsel: fp.dsWsel,
    })),
    results: compressedResults,
    whatIfActive: whatIfOverrides != null && Object.keys(whatIfOverrides).length > 0,
    ...(whatIfOverrides && Object.keys(whatIfOverrides).length > 0
      ? { whatIfOverrides }
      : {}),
  };
}

export const AI_CHAT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'adjust_mannings_n',
      description: "Adjust Manning's n multiplier. 1.0 = baseline, 1.2 = 20% increase.",
      parameters: {
        type: 'object',
        properties: { multiplier: { type: 'number', minimum: 0.5, maximum: 1.5 } },
        required: ['multiplier'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_discharge',
      description: 'Adjust discharge multiplier. 1.0 = baseline.',
      parameters: {
        type: 'object',
        properties: { multiplier: { type: 'number', minimum: 0.5, maximum: 2.0 } },
        required: ['multiplier'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_debris',
      description: 'Set debris blockage percentage.',
      parameters: {
        type: 'object',
        properties: { percentage: { type: 'number', minimum: 0, maximum: 50 } },
        required: ['percentage'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_contraction_coeff',
      description: 'Set contraction coefficient.',
      parameters: {
        type: 'object',
        properties: { value: { type: 'number', minimum: 0.1, maximum: 0.6 } },
        required: ['value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_expansion_coeff',
      description: 'Set expansion coefficient.',
      parameters: {
        type: 'object',
        properties: { value: { type: 'number', minimum: 0.1, maximum: 0.8 } },
        required: ['value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'reset_overrides',
      description: 'Reset all what-if overrides to baseline.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

export function buildChatSystemPrompt(context: ChatContext): string {
  return `You are a senior hydraulic engineer assistant embedded in a Bridge Loss Calculator tool.

CURRENT ANALYSIS CONTEXT:
${JSON.stringify(context, null, 2)}

GUIDELINES:
- Use proper hydraulic engineering terminology (WSEL, head loss, Froude number, Manning's n, etc.).
- Cite specific values from the context when answering questions (e.g. "the upstream WSEL for the Q100 event is X m").
- Keep responses concise: 2–4 sentences for simple questions, more only when detailed explanation is warranted.
- When the engineer asks to try a parameter change (e.g. "what if debris blockage was 30%"), use the appropriate tool function rather than just describing the change.
- Results with a non-null error field are invalid and should be treated as failed calculations — do not reference their numeric values as meaningful.
- If what-if overrides are active (whatIfActive: true), make clear when discussing results whether they reflect the baseline or the overridden scenario.`;
}
