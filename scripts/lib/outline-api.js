import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '..', '..', 'config.json'), 'utf-8'));

// Token resolution order:
//   1. OUTLINE_API_TOKEN env var (preferred — never on disk)
//   2. config.apiToken (legacy fallback; treat the same way)
const apiToken = process.env.OUTLINE_API_TOKEN || config.apiToken;

if (!apiToken) {
  throw new Error(
    'Outline API token is not configured. Set OUTLINE_API_TOKEN in your shell environment ' +
      '(e.g. add `export OUTLINE_API_TOKEN="ol_api_..."` to ~/.zshenv) or put `apiToken` in ' +
      'config.json. Do not commit config.json if it contains a token — it is git-ignored.'
  );
}

export async function makeRequest(endpoint, body = {}) {
  const url = `${config.baseUrl}/${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return await res.json();
}
