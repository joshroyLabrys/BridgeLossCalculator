// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the OpenAI call so the test doesn't hit a real API
vi.mock('@/lib/api/openai');

import { callOpenAI } from '@/lib/api/openai';
import { runAllMethods } from '@/engine/index';
import { TEST_BRIDGES } from '@/lib/test-bridges';
import type { AiSummaryPayload, AiSummaryResponse } from '@/lib/api/ai-summary-prompt';
import type { MethodResult } from '@/engine/types';

const mockCallOpenAI = vi.mocked(callOpenAI);

/**
 * Build an AiSummaryPayload from a test bridge + engine results,
 * mirroring exactly what project-store.ts does in fetchAiSummary.
 */
function buildPayloadFromBridge(bridgeIndex: number): AiSummaryPayload {
  const tb = TEST_BRIDGES[bridgeIndex];
  const results = runAllMethods(
    tb.crossSection,
    tb.bridgeGeometry,
    tb.flowProfiles,
    tb.coefficients
  );

  const bridge = tb.bridgeGeometry;

  const mapResult = (r: MethodResult) => ({
    profileName: r.profileName,
    upstreamWsel: r.upstreamWsel,
    totalHeadLoss: r.totalHeadLoss,
    approachVelocity: r.approachVelocity,
    froudeApproach: r.froudeApproach,
    flowRegime: r.flowRegime,
    converged: r.converged,
    bridgeOpeningArea: r.inputEcho.bridgeOpeningArea,
    tuflowPierFLC: r.tuflowPierFLC,
    tuflowSuperFLC: r.tuflowSuperFLC,
    error: r.error,
  });

  const freeboard =
    results.energy.length > 0
      ? results.energy.map((r) => {
          const lowChord = Math.min(bridge.lowChordLeft, bridge.lowChordRight);
          const fb = lowChord - r.upstreamWsel;
          return {
            profileName: r.profileName,
            freeboard: fb,
            status:
              fb > 1
                ? 'clear'
                : fb > 0
                  ? 'low'
                  : r.flowRegime === 'overtopping'
                    ? 'overtopping'
                    : 'pressure',
          };
        })
      : null;

  return {
    bridgeGeometry: {
      lowChordLeft: bridge.lowChordLeft,
      lowChordRight: bridge.lowChordRight,
      highChord: bridge.highChord,
      span: bridge.rightAbutmentStation - bridge.leftAbutmentStation,
      pierCount: bridge.piers.length,
      debrisBlockagePct: tb.coefficients.debrisBlockagePct,
    },
    flowProfiles: tb.flowProfiles.map((p) => ({
      name: p.name,
      ari: p.ari,
      discharge: p.discharge,
      dsWsel: p.dsWsel,
    })),
    methods: Object.fromEntries(
      (['energy', 'momentum', 'yarnell', 'wspro'] as const).map((m) => [
        m,
        results[m].map(mapResult),
      ])
    ),
    freeboard,
    hecRasComparison: null,
    sensitivityEnabled: false,
  };
}

/** A valid AI response fixture */
const VALID_AI_RESPONSE: AiSummaryResponse = {
  overall: [
    'Consistent free-surface flow across both profiles with good method agreement.',
    'Energy and Momentum methods converge within 0.05 ft for the Low Flow case.',
  ],
  callouts: {
    regime: ['Both profiles remain in free-surface flow regime with Froude numbers well below 1.0.'],
    freeboard: [
      'Low Flow profile maintains adequate freeboard of approximately 4 ft above the upstream WSEL.',
    ],
    comparison: [
      'All four methods agree within 5% for the Low Flow case.',
      'High Flow shows slightly larger divergence between Yarnell and the other methods.',
    ],
    afflux: null,
    hecras: null,
  },
};

describe('AI Summary Integration — /api/ai-summary route with test bridge data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a valid payload from V-Channel benchmark and gets a successful response', async () => {
    // Arrange: mock OpenAI to return a valid JSON response
    mockCallOpenAI.mockResolvedValue(JSON.stringify(VALID_AI_RESPONSE));

    const payload = buildPayloadFromBridge(0); // V-Channel Benchmark

    // Sanity-check the payload shape before hitting the route
    expect(payload.bridgeGeometry.pierCount).toBe(1);
    expect(payload.flowProfiles).toHaveLength(2);
    expect(payload.methods.energy).toHaveLength(2);
    expect(payload.methods.momentum).toHaveLength(2);
    expect(payload.methods.yarnell).toHaveLength(2);
    expect(payload.methods.wspro).toHaveLength(2);

    // Act: call the route handler directly
    const { POST } = await import('@/app/api/ai-summary/route');
    const request = new Request('http://localhost/api/ai-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const response = await POST(request);
    const data = await response.json();

    // Assert: route returns 200 with correct shape
    expect(response.status).toBe(200);
    expect(data.overall).toEqual(VALID_AI_RESPONSE.overall);
    expect(data.callouts).toEqual(VALID_AI_RESPONSE.callouts);

    // Verify callOpenAI was called with the system prompt and the serialised payload
    expect(mockCallOpenAI).toHaveBeenCalledTimes(1);
    const [systemPrompt, userPrompt] = mockCallOpenAI.mock.calls[0];
    expect(systemPrompt).toContain('senior hydraulic engineer');
    // The user prompt should be the JSON-serialised payload
    const parsedUserPrompt = JSON.parse(userPrompt);
    expect(parsedUserPrompt.bridgeGeometry.pierCount).toBe(1);
    expect(parsedUserPrompt.flowProfiles).toHaveLength(2);
  });

  it('builds valid payloads from all test bridges without errors', async () => {
    mockCallOpenAI.mockResolvedValue(JSON.stringify(VALID_AI_RESPONSE));

    for (let i = 0; i < TEST_BRIDGES.length; i++) {
      const payload = buildPayloadFromBridge(i);
      const tb = TEST_BRIDGES[i];

      // Payload shape checks
      expect(payload.bridgeGeometry.span).toBeGreaterThan(0);
      expect(payload.flowProfiles.length).toBeGreaterThan(0);
      expect(payload.methods.energy.length).toBe(tb.flowProfiles.length);

      // Verify all method results have the required fields (some may legitimately
      // not converge or return errors like Yarnell "Not Applicable" for pressure flow)
      for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
        for (const result of payload.methods[method]) {
          expect(result).toHaveProperty('profileName');
          expect(result).toHaveProperty('upstreamWsel');
          expect(result).toHaveProperty('totalHeadLoss');
          expect(result).toHaveProperty('flowRegime');
          expect(result).toHaveProperty('converged');
          expect(typeof result.bridgeOpeningArea).toBe('number');
        }
      }

      // Route should return 200
      const { POST } = await import('@/app/api/ai-summary/route');
      const request = new Request('http://localhost/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const response = await POST(request);
      expect(response.status).toBe(200);
    }
  });

  it('returns 502 when AI returns invalid JSON structure', async () => {
    mockCallOpenAI.mockResolvedValue(JSON.stringify({ wrong: 'shape' }));

    const payload = buildPayloadFromBridge(0);
    const { POST } = await import('@/app/api/ai-summary/route');
    const request = new Request('http://localhost/api/ai-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const response = await POST(request);

    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain('Invalid response structure');
  });

  it('returns 401 when no OpenAI credentials are configured', async () => {
    mockCallOpenAI.mockRejectedValue(
      new Error('No OpenAI credentials configured. Set OPENAI_API_KEY, OPENAI_OAUTH_TOKEN, or run `codex login`.')
    );

    const payload = buildPayloadFromBridge(0);
    const { POST } = await import('@/app/api/ai-summary/route');
    const request = new Request('http://localhost/api/ai-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('No OpenAI credentials');
  });

  it('returns 500 when OpenAI returns an API error (e.g. store must be false)', async () => {
    mockCallOpenAI.mockRejectedValue(
      new Error('400 Bad Request: {"detail":"Store must be set to false"}')
    );

    const payload = buildPayloadFromBridge(0);
    const { POST } = await import('@/app/api/ai-summary/route');
    const request = new Request('http://localhost/api/ai-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Store must be set to false');
  });

  it('returns 500 when AI returns unparseable text', async () => {
    mockCallOpenAI.mockResolvedValue('This is not JSON at all');

    const payload = buildPayloadFromBridge(0);
    const { POST } = await import('@/app/api/ai-summary/route');
    const request = new Request('http://localhost/api/ai-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});
