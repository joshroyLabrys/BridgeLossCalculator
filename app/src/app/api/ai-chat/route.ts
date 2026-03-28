import OpenAI from 'openai';
import { resolveOpenAICredentials } from '@/lib/api/openai-auth';
import { buildChatSystemPrompt, AI_CHAT_TOOLS, type ChatContext } from '@/lib/api/ai-chat-prompt';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  context: ChatContext;
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { messages, context } = body;

    const creds = await resolveOpenAICredentials();
    if (!creds) {
      return Response.json(
        { error: 'No OpenAI credentials configured. Set OPENAI_API_KEY, OPENAI_OAUTH_TOKEN, or run `codex login`.' },
        { status: 401 }
      );
    }

    const systemPrompt = buildChatSystemPrompt(context);

    // Platform path — streaming SSE with function calling
    if (creds.type === 'platform') {
      const client = new OpenAI({ apiKey: creds.apiKey });

      const stream = await client.chat.completions.create({
        model: 'gpt-5.4',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        tools: AI_CHAT_TOOLS,
        temperature: 0.4,
        stream: true,
      });

      const readable = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          // Accumulate tool call deltas
          const toolCallAccumulator: Record<
            number,
            { id: string; name: string; argumentsRaw: string }
          > = {};

          const send = (data: string) => {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          };

          try {
            for await (const chunk of stream) {
              const choice = chunk.choices[0];
              if (!choice) continue;

              const delta = choice.delta;

              // Text content delta
              if (delta.content) {
                send(JSON.stringify({ type: 'text', content: delta.content }));
              }

              // Tool call deltas — accumulate across chunks
              if (delta.tool_calls) {
                for (const tcDelta of delta.tool_calls) {
                  const idx = tcDelta.index;
                  if (!toolCallAccumulator[idx]) {
                    toolCallAccumulator[idx] = {
                      id: tcDelta.id ?? '',
                      name: tcDelta.function?.name ?? '',
                      argumentsRaw: '',
                    };
                  }
                  if (tcDelta.id) {
                    toolCallAccumulator[idx].id = tcDelta.id;
                  }
                  if (tcDelta.function?.name) {
                    toolCallAccumulator[idx].name = tcDelta.function.name;
                  }
                  if (tcDelta.function?.arguments) {
                    toolCallAccumulator[idx].argumentsRaw +=
                      tcDelta.function.arguments;
                  }
                }
              }

              // When the stream is done, flush accumulated tool calls
              if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
                for (const tc of Object.values(toolCallAccumulator)) {
                  let args: Record<string, unknown> = {};
                  try {
                    args = JSON.parse(tc.argumentsRaw || '{}');
                  } catch {
                    // Malformed arguments — send empty
                  }
                  send(
                    JSON.stringify({
                      type: 'tool_call',
                      name: tc.name,
                      arguments: args,
                    })
                  );
                }
              }
            }

            send('[DONE]');
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Stream error';
            send(JSON.stringify({ type: 'error', message }));
            send('[DONE]');
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Codex OAuth path — non-streaming fallback
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

    const codexMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const res = await fetch('https://chatgpt.com/backend-api/codex/responses', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gpt-5.4',
        instructions: systemPrompt,
        input: codexMessages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role, content: m.content })),
        store: false,
        stream: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return Response.json(
        { error: `Upstream error: ${res.status} ${res.statusText}${body ? `: ${body}` : ''}` },
        { status: 502 }
      );
    }

    const data = await res.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
    const text =
      data?.output?.[0]?.content?.[0]?.text ?? '';

    return Response.json({ type: 'complete', content: text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('AI chat error:', err);
    return Response.json({ error: `AI chat failed: ${message}` }, { status: 500 });
  }
}
