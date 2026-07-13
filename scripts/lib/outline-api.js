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

// Base origin (without /api) for constructing full URLs from relative paths
const baseOrigin = config.baseUrl.replace(/\/api\/?$/, '');
const outlineOrigin = new URL(config.baseUrl).origin;

export { config, baseOrigin, outlineOrigin, apiToken };

/**
 * Ensure this Outline host bypasses corporate HTTP(S)_PROXY.
 * Bun/Node fetch honor HTTP_PROXY/HTTPS_PROXY; without NO_PROXY, requests to an
 * internal Outline often hang. Hosts are derived from config.baseUrl only.
 */
function ensureNoProxyForOutline() {
  const required = ['localhost', '127.0.0.1', '::1', '.internal'];
  try {
    const host = new URL(config.baseUrl).hostname;
    if (host) {
      required.push(host);
      const labels = host.split('.').filter(Boolean);
      if (labels.length >= 2) {
        const parent = labels.slice(-2).join('.');
        required.push(parent, `.${parent}`);
      }
      if (labels.length >= 3) {
        required.push(`.${labels.slice(1).join('.')}`);
      }
    }
  } catch {
    // invalid baseUrl fails later on request
  }

  const current = process.env.NO_PROXY || process.env.no_proxy || '';
  const parts = current.split(',').map((s) => s.trim()).filter(Boolean);
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

/** Resolve relative Outline paths against the instance origin. */
export function resolveOutlineUrl(urlOrPath) {
  if (!urlOrPath) throw new Error('resolveOutlineUrl: empty url');
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  return new URL(urlOrPath, outlineOrigin).href;
}

/** True when URL targets this Outline instance (needs Bearer; S3 signed URLs do not). */
export function isOutlineHost(urlOrPath) {
  try {
    return new URL(resolveOutlineUrl(urlOrPath)).origin === outlineOrigin;
  } catch {
    return false;
  }
}

export async function makeRequest(endpoint, body = {}) {
  const url = `${String(config.baseUrl).replace(/\/$/, '')}/${String(endpoint).replace(/^\//, '')}`;
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

/**
 * Upload a file to Outline using the two-phase attachment upload flow.
 *
 * Phase 1: Call attachments.create to get metadata + presigned upload info.
 * Phase 2: POST the file as multipart/form-data to the upload URL.
 *
 * @param {object} opts
 * @param {string} opts.filePath     - Local path to the file
 * @param {Buffer} opts.fileBuffer   - Pre-loaded file buffer (alternative to filePath)
 * @param {string} opts.name         - File name
 * @param {string} [opts.contentType] - MIME type (default: application/octet-stream)
 * @param {string} [opts.documentId] - Document UUID to attach to
 * @param {string} [opts.preset]     - Attachment preset (default: document-attachment)
 * @returns {Promise<object>} - { attachment, uploadResult }
 */
export async function uploadAttachment(opts) {
  const { filePath, fileBuffer, name, contentType = 'application/octet-stream', documentId, preset } = opts;

  let buf;
  if (fileBuffer) {
    buf = fileBuffer;
  } else if (filePath) {
    buf = readFileSync(filePath);
  } else {
    throw new Error('Either filePath or fileBuffer is required');
  }

  const fname = name || (filePath ? filePath.split('/').pop() : 'file');

  // Phase 1: create attachment metadata
  const body = {
    name: fname,
    contentType,
    size: buf.length,
  };
  if (documentId) body.documentId = documentId;
  if (preset) body.preset = preset;

  const meta = await makeRequest('attachments.create', body);
  const data = meta.data;

  if (!data || !data.attachment) {
    throw new Error(`attachments.create returned unexpected response: ${JSON.stringify(meta)}`);
  }

  const attachment = data.attachment;

  // Check if file data was already inlined (some Outline versions accept base64 content directly)
  if (meta.ok && attachment.size == buf.length && !data.uploadUrl) {
    return { attachment, uploadResult: { inline: true } };
  }

  // Phase 2: upload file to the upload URL
  if (!data.uploadUrl || !data.form) {
    // No upload URL means the file might have been stored inline (or PUT mode)
    if (data.mode === 'put' && data.url) {
      // PUT mode: upload via PUT request
      const putUrl = data.url;
      const headers = data.headers || {};
      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          ...headers,
        },
        body: buf,
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => '');
        throw new Error(`PUT upload failed (${putRes.status}): ${text}`);
      }
      return { attachment, uploadResult: { mode: 'put', ok: true } };
    }
    // Fallback: assume inline upload was enough
    return { attachment, uploadResult: { inline: true } };
  }

  // POST mode: multipart form upload
  const uploadUrl = resolveOutlineUrl(data.uploadUrl);

  const formData = new FormData();
  for (const [key, val] of Object.entries(data.form)) {
    formData.append(key, String(val));
  }
  formData.append('file', new Blob([buf], { type: contentType }), fname);

  // Bearer only for same-origin Outline upload endpoints.
  // Signed S3/MinIO/GCS URLs reject extra Authorization headers.
  const headers = {};
  if (isOutlineHost(uploadUrl)) {
    headers.Authorization = `Bearer ${apiToken}`;
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    throw new Error(`File upload failed (${uploadRes.status}): ${text}`);
  }

  const uploadResult = await uploadRes.json().catch(() => ({ ok: uploadRes.ok }));
  return { attachment, uploadResult };
}
