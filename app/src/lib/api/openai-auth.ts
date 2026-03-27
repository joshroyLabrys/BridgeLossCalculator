import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export type OpenAICredentials =
  | { type: 'platform'; apiKey: string }
  | { type: 'codex'; token: string; accountId: string | undefined }

export async function resolveOpenAICredentials(): Promise<OpenAICredentials | null> {
  // Priority 1: Platform API key
  if (process.env.OPENAI_API_KEY) {
    return { type: 'platform', apiKey: process.env.OPENAI_API_KEY };
  }

  // Priority 2: OAuth token from env
  if (process.env.OPENAI_OAUTH_TOKEN) {
    return { type: 'codex', token: process.env.OPENAI_OAUTH_TOKEN, accountId: undefined };
  }

  // Priority 3: Read from ~/.codex/auth.json
  try {
    const authPath = join(homedir(), '.codex', 'auth.json');
    const raw = await readFile(authPath, 'utf-8');
    const auth = JSON.parse(raw);
    const token = auth?.tokens?.access_token;
    if (token) {
      return { type: 'codex', token, accountId: auth.tokens.account_id };
    }
  } catch {
    // File not found or unreadable — fall through
  }

  return null;
}
