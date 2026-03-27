// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/openai-auth');
vi.mock('openai');

import { resolveOpenAICredentials } from '@/lib/api/openai-auth';
import OpenAI from 'openai';
import { callOpenAI } from '@/lib/api/openai';

const mockResolveOpenAICredentials = vi.mocked(resolveOpenAICredentials);
const MockOpenAI = vi.mocked(OpenAI);

describe('callOpenAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('uses Responses API when credentials type is codex', async () => {
    mockResolveOpenAICredentials.mockResolvedValue({
      type: 'codex',
      token: 'jwt-token-abc',
      accountId: 'acct-123',
    });

    const mockResponsesCreate = vi.fn().mockResolvedValue({
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: '{"summary":"bridge"}' }],
        },
      ],
    });
    MockOpenAI.mockImplementation(function () {
      return { responses: { create: mockResponsesCreate } };
    } as unknown as typeof OpenAI);

    const result = await callOpenAI('sys', 'user');

    expect(MockOpenAI).toHaveBeenCalledWith({
      apiKey: 'jwt-token-abc',
      baseURL: 'https://chatgpt.com/backend-api/codex',
      defaultHeaders: {
        version: '0.80.0',
        'x-codex-beta-features': 'unified_exec,shell_snapshot',
        originator: 'codex_exec',
        'chatgpt-account-id': 'acct-123',
      },
    });
    expect(mockResponsesCreate).toHaveBeenCalledWith({
      model: 'gpt-5.4',
      instructions: 'sys',
      input: 'user',
      text: { format: { type: 'json_object' } },
      temperature: 0.3,
    });
    expect(result).toBe('{"summary":"bridge"}');
  });

  it('omits chatgpt-account-id header when accountId is undefined (codex path)', async () => {
    mockResolveOpenAICredentials.mockResolvedValue({
      type: 'codex',
      token: 'jwt-token-abc',
      accountId: undefined,
    });

    const mockResponsesCreate = vi.fn().mockResolvedValue({
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: '' }],
        },
      ],
    });
    MockOpenAI.mockImplementation(function () {
      return { responses: { create: mockResponsesCreate } };
    } as unknown as typeof OpenAI);

    await callOpenAI('sys', 'user');

    expect(MockOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultHeaders: expect.not.objectContaining({ 'chatgpt-account-id': expect.anything() }),
      })
    );
  });
});
