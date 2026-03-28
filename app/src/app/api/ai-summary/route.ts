import { callOpenAI } from '@/lib/api/openai';
import { AI_SYSTEM_PROMPT, buildUserPrompt, type AiSummaryPayload, type AiSummaryResponse } from '@/lib/api/ai-summary-prompt';

export async function POST(request: Request) {
  try {
    const payload: AiSummaryPayload = await request.json();
    const userPrompt = buildUserPrompt(payload);
    const raw = await callOpenAI(AI_SYSTEM_PROMPT, userPrompt);

    const parsed: AiSummaryResponse = JSON.parse(raw);

    // Validate shape — overall and recommendations must be arrays, callouts must be an object
    if (!Array.isArray(parsed.overall) || typeof parsed.callouts !== 'object') {
      return Response.json(
        { error: 'Invalid response structure from AI' },
        { status: 502 }
      );
    }

    // Ensure recommendations is always an array (graceful fallback)
    if (!Array.isArray(parsed.recommendations)) {
      parsed.recommendations = [];
    }

    return Response.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message.includes('No OpenAI credentials')) {
      return Response.json({ error: message }, { status: 401 });
    }

    console.error('AI summary error:', err);
    return Response.json(
      { error: `AI analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
