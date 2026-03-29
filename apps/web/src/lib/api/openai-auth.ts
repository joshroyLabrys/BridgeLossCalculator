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

  // Try to read ~/.codex/auth.json for account_id (and optionally token)
  let fileToken: string | undefined;
  let fileAccountId: string | undefined;
  try {
    const authPath = join(homedir(), '.codex', 'auth.json');
    const raw = await readFile(authPath, 'utf-8');
    const auth = JSON.parse(raw);
    fileToken = auth?.tokens?.access_token;
    fileAccountId = auth?.tokens?.account_id;
  } catch {
    // File not found or unreadable
  }

  // Priority 2: OAuth token from env (supplement with account_id from file)
  if (process.env.OPENAI_OAUTH_TOKEN) {
    return { type: 'codex', token: process.env.OPENAI_OAUTH_TOKEN, accountId: fileAccountId };
  }

  // Priority 3: Token from ~/.codex/auth.json
  if (fileToken) {
    return { type: 'codex', token: fileToken, accountId: fileAccountId };
  }

  return null;
}
