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

if (!config.baseUrl) {
  throw new Error('config.json is missing baseUrl (e.g. "https://outline.example.com/api").');
}

/** Origin of the Outline instance, e.g. https://outline.example.com */
export const outlineOrigin = new URL(config.baseUrl).origin;
/** API base, e.g. https://outline.example.com/api */
export const baseUrl = String(config.baseUrl).replace(/\/$/, '');
export { apiToken };

/**
 * Resolve relative Outline paths (e.g. /api/files.create) against the instance origin.
 * Absolute http(s) URLs (S3 signed URLs) are returned unchanged.
 */
export function resolveOutlineUrl(urlOrPath) {
  if (!urlOrPath) throw new Error('resolveOutlineUrl: empty url');
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  return new URL(urlOrPath, outlineOrigin).href;
}

/**
 * True when the URL targets this Outline instance (needs Bearer auth for file upload).
 * External signed URLs (S3/MinIO/GCS) must not get the Outline token.
 */
export function isOutlineHost(urlOrPath) {
  try {
    const abs = resolveOutlineUrl(urlOrPath);
    return new URL(abs).origin === outlineOrigin;
  } catch {
    return false;
  }
}

export async function makeRequest(endpoint, body = {}) {
  const url = `${baseUrl}/${String(endpoint).replace(/^\//, '')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
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
