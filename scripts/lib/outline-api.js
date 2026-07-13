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
 * Ensure this Outline host bypasses corporate HTTP(S)_PROXY.
 * Bun and Node fetch honor HTTP_PROXY/HTTPS_PROXY; without NO_PROXY, requests
 * to a private/internal Outline often hang or route incorrectly through the proxy.
 *
 * Merges into process.env.NO_PROXY / no_proxy for this process only.
 * Hosts are derived from config.baseUrl — no hard-coded private domains.
 */
function ensureNoProxyForOutline() {
  const required = ['localhost', '127.0.0.1', '::1', '.internal'];

  try {
    const host = new URL(config.baseUrl).hostname;
    if (host) {
      required.push(host);
      const labels = host.split('.').filter(Boolean);
      // parent domain forms: example.com and .example.com
      if (labels.length >= 2) {
        const parent = labels.slice(-2).join('.');
        required.push(parent);
        required.push(`.${parent}`);
      }
      // full parent for multi-label hosts: a.b.example.com → .b.example.com too
      if (labels.length >= 3) {
        required.push(`.${labels.slice(1).join('.')}`);
      }
    }
  } catch {
    // ignore invalid baseUrl here; request will fail later with a clearer error
  }

  const current = process.env.NO_PROXY || process.env.no_proxy || '';
  const parts = current
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let changed = false;
  for (const host of required) {
    if (!parts.some((p) => p.toLowerCase() === host.toLowerCase())) {
      parts.push(host);
      changed = true;
    }
  }

  if (changed || !process.env.NO_PROXY) {
    const value = parts.join(',');
    process.env.NO_PROXY = value;
    process.env.no_proxy = value;
  }
}

ensureNoProxyForOutline();

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
