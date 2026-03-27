// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs/promises', () => ({
  default: {},
  readFile: vi.fn(),
}));

import { readFile } from 'fs/promises';
import { resolveOpenAICredentials } from '@/lib/api/openai-auth';

const mockReadFile = vi.mocked(readFile);

describe('resolveOpenAICredentials', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_OAUTH_TOKEN;
    mockReadFile.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns platform key when OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test123';
    const creds = await resolveOpenAICredentials();
    expect(creds).toEqual({ type: 'platform', apiKey: 'sk-test123' });
  });

  it('returns oauth token when OPENAI_OAUTH_TOKEN is set', async () => {
    process.env.OPENAI_OAUTH_TOKEN = 'jwt-token-abc';
    const creds = await resolveOpenAICredentials();
    expect(creds).toEqual({ type: 'codex', token: 'jwt-token-abc', accountId: undefined });
  });

  it('prefers OPENAI_API_KEY over OPENAI_OAUTH_TOKEN', async () => {
    process.env.OPENAI_API_KEY = 'sk-test123';
    process.env.OPENAI_OAUTH_TOKEN = 'jwt-token-abc';
    const creds = await resolveOpenAICredentials();
    expect(creds.type).toBe('platform');
  });

  it('reads ~/.codex/auth.json when no env vars set', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      auth_mode: 'oauth',
      tokens: {
        access_token: 'jwt-from-file',
        refresh_token: 'refresh',
        account_id: 'acct-123',
      },
    }));
    const creds = await resolveOpenAICredentials();
    expect(creds).toEqual({ type: 'codex', token: 'jwt-from-file', accountId: 'acct-123' });
  });

  it('returns null when no credentials found', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const creds = await resolveOpenAICredentials();
    expect(creds).toBeNull();
  });
});
