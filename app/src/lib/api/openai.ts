import OpenAI from 'openai';
import { resolveOpenAICredentials } from './openai-auth';

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

  // Codex OAuth path — uses Responses API
  const client = new OpenAI({
    apiKey: creds.token,
    baseURL: 'https://chatgpt.com/backend-api/codex',
    defaultHeaders: {
      version: '0.80.0',
      'x-codex-beta-features': 'unified_exec,shell_snapshot',
      originator: 'codex_exec',
      ...(creds.accountId ? { 'chatgpt-account-id': creds.accountId } : {}),
    },
  });

  const response = await (client as any).responses.create({
    model: 'gpt-5.4',
    instructions: systemPrompt,
    input: userPrompt,
    text: { format: { type: 'json_object' } },
    temperature: 0.3,
  });

  const outputMessage = response.output.find((o: any) => o.type === 'message');
  const textBlock = outputMessage?.content?.find((c: any) => c.type === 'output_text');
  return textBlock?.text ?? '';
}
