// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/api/openai-auth');
vi.mock('openai');

import { resolveOpenAICredentials } from '@/lib/api/openai-auth';
import OpenAI from 'openai';
import { callOpenAI, CODEX_ALLOWED_KEYS, CODEX_REQUEST_BODY } from '@/lib/api/openai';

const mockResolveOpenAICredentials = vi.mocked(resolveOpenAICredentials);
const MockOpenAI = vi.mocked(OpenAI);

describe('callOpenAI', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws when no credentials found', async () => {
    mockResolveOpenAICredentials.mockResolvedValue(null);

    await expect(callOpenAI('system prompt', 'user prompt')).rejects.toThrow(
      'No OpenAI credentials configured. Set OPENAI_API_KEY, OPENAI_OAUTH_TOKEN, or run `codex login`.'
    );
  });

  it('uses Chat Completions API when credentials type is platform', async () => {
    mockResolveOpenAICredentials.mockResolvedValue({ type: 'platform', apiKey: 'sk-test123' });

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"result":"ok"}' } }],
    });
    MockOpenAI.mockImplementation(function () {
      return { chat: { completions: { create: mockCreate } } };
    } as unknown as typeof OpenAI);

    const result = await callOpenAI('sys', 'user');

    expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test123' });
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'gpt-5.4',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'user' },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    expect(result).toBe('{"result":"ok"}');
  });

  it('uses raw fetch to Responses API (streamed) when credentials type is codex', async () => {
    mockResolveOpenAICredentials.mockResolvedValue({
      type: 'codex',
      token: 'jwt-token-abc',
      accountId: 'acct-123',
    });

    // Simulate SSE stream with delta events and a done event
    const sseStream = [
      'data: {"type":"response.output_text.delta","delta":"{\\"summary\\""}',
      'data: {"type":"response.output_text.delta","delta":":\\"bridge\\"}"}',
      'data: {"type":"response.output_text.done","text":"{\\"summary\\":\\"bridge\\"}"}',
      'data: [DONE]',
    ].join('\n');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sseStream),
    });

    const result = await callOpenAI('sys', 'user');

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe('https://chatgpt.com/backend-api/codex/responses');
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].headers).toMatchObject({
      Authorization: 'Bearer jwt-token-abc',
      'chatgpt-account-id': 'acct-123',
    });
    const body = JSON.parse(callArgs[1].body);
    expect(body.input[0].role).toBe('user');
    expect(body.input[0].content).toContain('user');
    // json_object format requires "json" in input messages
    expect(body.input[0].content.toLowerCase()).toContain('json');
    expect(body.instructions).toBe('sys');
    expect(body.stream).toBe(true);
    expect(body.store).toBe(false);
    // Assert no extra keys snuck in (the API rejects unsupported params)
    for (const key of Object.keys(body)) {
      expect(CODEX_ALLOWED_KEYS.has(key), `Unexpected key "${key}" in Codex request body`).toBe(true);
    }
    expect(result).toBe('{"summary":"bridge"}');
  });

  it('collects delta chunks when no done event is present', async () => {
    mockResolveOpenAICredentials.mockResolvedValue({
      type: 'codex',
      token: 'jwt-token-abc',
      accountId: 'acct-123',
    });

    const sseStream = [
      'data: {"type":"response.output_text.delta","delta":"hello "}',
      'data: {"type":"response.output_text.delta","delta":"world"}',
      'data: [DONE]',
    ].join('\n');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sseStream),
    });

    const result = await callOpenAI('sys', 'user');
    expect(result).toBe('hello world');
  });

  it('sends ONLY allowed keys in the Codex request body — no unsupported parameters', () => {
    const body = CODEX_REQUEST_BODY('sys', 'user');
    const keys = Object.keys(body);

    // Every key we send must be in the allowed set
    for (const key of keys) {
      expect(
        CODEX_ALLOWED_KEYS.has(key),
        `"${key}" is not in CODEX_ALLOWED_KEYS — the Codex API will reject it with 400. ` +
        `Either remove it from CODEX_REQUEST_BODY or add it to CODEX_ALLOWED_KEYS after confirming the API accepts it.`
      ).toBe(true);
    }

    // Required keys must be present
    expect(keys).toContain('model');
    expect(keys).toContain('instructions');
    expect(keys).toContain('input');
    expect(keys).toContain('store');
    expect(keys).toContain('stream');

    // Specific values the API demands
    expect(body.store).toBe(false);
    expect(body.stream).toBe(true);

    // json_object format requires "json" in input messages — API rejects without it
    expect(
      body.input[0].content.toLowerCase(),
      'input message must contain "json" when text.format is json_object'
    ).toContain('json');
  });

  it('omits chatgpt-account-id header when accountId is undefined (codex path)', async () => {
    mockResolveOpenAICredentials.mockResolvedValue({
      type: 'codex',
      token: 'jwt-token-abc',
      accountId: undefined,
    });

    const sseStream = [
      'data: {"type":"response.output_text.done","text":"{}"}',
      'data: [DONE]',
    ].join('\n');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sseStream),
    });

    await callOpenAI('sys', 'user');

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers).not.toHaveProperty('chatgpt-account-id');
  });
});
