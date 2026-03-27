// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/api/openai-auth');
vi.mock('openai');

import { resolveOpenAICredentials } from '@/lib/api/openai-auth';
import OpenAI from 'openai';
import { callOpenAI } from '@/lib/api/openai';

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

  it('uses raw fetch to Responses API when credentials type is codex', async () => {
    mockResolveOpenAICredentials.mockResolvedValue({
      type: 'codex',
      token: 'jwt-token-abc',
      accountId: 'acct-123',
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: '{"summary":"bridge"}' }],
          },
        ],
      }),
    });

    const result = await callOpenAI('sys', 'user');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://chatgpt.com/backend-api/codex/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-token-abc',
          'chatgpt-account-id': 'acct-123',
        }),
      })
    );
    expect(result).toBe('{"summary":"bridge"}');
  });

  it('omits chatgpt-account-id header when accountId is undefined (codex path)', async () => {
    mockResolveOpenAICredentials.mockResolvedValue({
      type: 'codex',
      token: 'jwt-token-abc',
      accountId: undefined,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: '{}' }],
          },
        ],
      }),
    });

    await callOpenAI('sys', 'user');

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers).not.toHaveProperty('chatgpt-account-id');
  });
});
