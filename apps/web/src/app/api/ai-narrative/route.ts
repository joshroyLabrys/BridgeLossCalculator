import OpenAI from 'openai';
import { resolveOpenAICredentials } from '@/lib/api/openai-auth';
import { NARRATIVE_SECTIONS } from '@/lib/api/narrative-prompts';

async function callOpenAIText(systemPrompt: string, userPrompt: string): Promise<string> {
  const creds = await resolveOpenAICredentials();
  if (!creds) {
    throw new Error(
      'No OpenAI credentials configured. Set OPENAI_API_KEY, OPENAI_OAUTH_TOKEN, or run `codex login`.'
    );
  }

  if (creds.type === 'platform') {
    const client = new OpenAI({ apiKey: creds.apiKey });
    const response = await client.chat.completions.create({
      model: 'gpt-5.4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
    });
    return response.choices[0].message.content ?? '';
  }

  // Codex OAuth path — raw fetch to Responses API (text mode, no json_object)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${creds.token}`,
    version: '0.80.0',
    'x-codex-beta-features': 'unified_exec,shell_snapshot',
    originator: 'codex_exec',
  };
  if (creds.accountId) {
    headers['chatgpt-account-id'] = creds.accountId;
  }

  const res = await fetch('https://chatgpt.com/backend-api/codex/responses', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'gpt-5.4',
      instructions: systemPrompt,
      input: [{ role: 'user', content: userPrompt }],
      store: false,
      stream: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`);
  }

  const text = await res.text();
  let result = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const json = line.slice(6).trim();
    if (json === '[DONE]') break;
    try {
      const event = JSON.parse(json);
      if (event.type === 'response.output_text.delta') {
        result += event.delta ?? '';
      }
      if (event.type === 'response.output_text.done') {
        return event.text ?? result;
      }
    } catch {
      // Skip malformed lines
    }
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sectionId, tone, projectData } = body as {
      sectionId: string;
      tone: 'technical' | 'summary';
      projectData: Record<string, unknown>;
    };

    const sectionDef = NARRATIVE_SECTIONS.find((s) => s.id === sectionId);
    if (!sectionDef) {
      return Response.json({ error: `Unknown section: ${sectionId}` }, { status: 400 });
    }

    const systemPrompt = sectionDef.systemPrompt(tone);
    const userPrompt = `Here is the project data for context. Use the specific values from this data in your narrative.\n\n${JSON.stringify(projectData, null, 2)}`;

    const content = await callOpenAIText(systemPrompt, userPrompt);

    return Response.json({ content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message.includes('No OpenAI credentials')) {
      return Response.json({ error: message }, { status: 401 });
    }

    console.error('AI narrative error:', err);
    return Response.json(
      { error: `AI narrative generation failed: ${message}` },
      { status: 500 },
    );
  }
}
