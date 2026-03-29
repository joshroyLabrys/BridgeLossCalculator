import OpenAI from 'openai';
import { resolveOpenAICredentials } from './openai-auth';

/**
 * Allowed top-level keys for the Codex Responses API.
 * The API rejects any parameter not in this set with a 400 error.
 * Keep this in sync with the Codex API docs / observed behaviour.
 */
export const CODEX_ALLOWED_KEYS = new Set([
  'model',
  'instructions',
  'input',
  'text',
  'store',
  'stream',
]);

/** Build the request body for the Codex Responses API. */
export function CODEX_REQUEST_BODY(systemPrompt: string, userPrompt: string) {
  return {
    model: 'gpt-5.4',
    instructions: systemPrompt,
    // The Responses API requires the word "json" in input messages when
    // text.format is json_object. Prefix the data with a short instruction.
    input: [{ role: 'user', content: `Respond with json.\n${userPrompt}` }],
    text: { format: { type: 'json_object' } },
    store: false,
    stream: true,
  };
}

export async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
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
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    return response.choices[0].message.content ?? '';
  }

  // Codex OAuth path — raw fetch to Responses API
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
    body: JSON.stringify(CODEX_REQUEST_BODY(systemPrompt, userPrompt)),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`);
  }

  // The Codex API streams SSE events. Collect output_text delta content.
  const text = await res.text();
  let result = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const json = line.slice(6).trim();
    if (json === '[DONE]') break;
    try {
      const event = JSON.parse(json);
      // response.output_text.delta events carry text chunks
      if (event.type === 'response.output_text.delta') {
        result += event.delta ?? '';
      }
      // Fallback: completed event carries the full text
      if (event.type === 'response.output_text.done') {
        return event.text ?? result;
      }
    } catch {
      // Skip malformed lines
    }
  }
  return result;
}
