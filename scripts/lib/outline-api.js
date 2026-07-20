import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', '..', 'config.json');

/**
 * Multi-instance Outline client.
 *
 * Config shapes (both supported):
 *
 * 1) Multi:
 * {
 *   "defaultInstance": "work",
 *   "instances": {
 *     "work": { "baseUrl": "https://outline.example.com/api" },
 *     "personal": { "baseUrl": "https://other.example.com/api" }
 *   }
 * }
 *
 * 2) Legacy single:
 * { "baseUrl": "https://outline.example.com/api", "apiToken"?: "..." }
 *
 * Token resolution per instance (first hit wins):
 *   1. OUTLINE_API_TOKEN_<NAME>   e.g. OUTLINE_API_TOKEN_PERSONAL
 *   2. OUTLINE_API_TOKEN          only for the default instance (compat)
 *   3. instances[name].apiToken   legacy disk fallback
 *   4. config.apiToken            legacy top-level fallback (default only)
 *
 * Instance selection:
 *   1. explicit getClient(name) / makeRequest(..., { instance })
 *   2. --instance / -i CLI flag
 *   3. OUTLINE_INSTANCE env
 *   4. config.defaultInstance
 *   5. sole instance key, or "default" for legacy single-baseUrl config
 */

const clientCache = new Map();
let rawConfig = null;
let forcedInstance = null;

// Live bindings for legacy `import { apiToken, baseUrl, outlineOrigin }`.
export let apiToken;
export let baseUrl;
export let outlineOrigin;

function loadConfig() {
  if (rawConfig) return rawConfig;
  try {
    rawConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (err) {
    throw new Error(`Cannot read outline config.json at ${CONFIG_PATH}: ${err.message}`);
  }
  return rawConfig;
}

/** Normalize host-ish baseUrl to .../api without trailing slash. */
function normalizeBaseUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('instance baseUrl is required (e.g. "https://outline.example.com/api")');
  }
  let url = input.trim().replace(/\/$/, '');
  if (/example\.com|REPLACE_WITH/i.test(url)) {
    throw new Error(
      `baseUrl points at a placeholder (${url}). Set a real Outline URL in config.json.`
    );
  }
  // Allow bare origin: https://host → https://host/api
  if (!/\/api$/i.test(url)) {
    url = `${url}/api`;
  }
  return url;
}

function listInstanceNames(cfg) {
  if (cfg.instances && typeof cfg.instances === 'object') {
    return Object.keys(cfg.instances);
  }
  if (cfg.baseUrl) return ['default'];
  return [];
}

function resolveDefaultName(cfg) {
  if (cfg.defaultInstance) return String(cfg.defaultInstance);
  const names = listInstanceNames(cfg);
  if (names.length === 1) return names[0];
  if (cfg.baseUrl && !cfg.instances) return 'default';
  if (names.length > 1) {
    throw new Error(
      `Multiple Outline instances configured (${names.join(', ')}), but defaultInstance is missing. ` +
        `Set config.defaultInstance or pass --instance <name>.`
    );
  }
  throw new Error(
    'No Outline instances configured. Add instances{} or legacy baseUrl to config.json.'
  );
}

/**
 * Pull --instance / -i from argv without consuming other flags.
 * Returns null if not present.
 */
export function parseInstanceFlag(argv = process.argv.slice(2)) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--instance' || a === '-i') {
      const v = argv[i + 1];
      if (!v || v.startsWith('-')) {
        throw new Error(`${a} requires a value (instance name)`);
      }
      return v;
    }
    if (a.startsWith('--instance=')) return a.slice('--instance='.length);
    if (a.startsWith('-i=') && a.length > 3) return a.slice(3);
  }
  return null;
}

export function resolveInstanceName(explicit) {
  if (explicit) return String(explicit);
  if (forcedInstance) return forcedInstance;
  const fromFlag = parseInstanceFlag();
  if (fromFlag) return fromFlag;
  if (process.env.OUTLINE_INSTANCE) return process.env.OUTLINE_INSTANCE;
  return resolveDefaultName(loadConfig());
}

/** Pin instance for subsequent lazy calls in this process (optional). */
export function useInstance(name) {
  forcedInstance = name ? String(name) : null;
  clientCache.clear();
  return getClient(forcedInstance || undefined);
}

function envTokenKey(name) {
  // work → OUTLINE_API_TOKEN_WORK ; my-wiki → OUTLINE_API_TOKEN_MY_WIKI
  const suffix = String(name)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `OUTLINE_API_TOKEN_${suffix}`;
}

function resolveToken(name, instanceCfg, cfg, isDefault) {
  const perEnv = process.env[envTokenKey(name)];
  if (perEnv) return perEnv;

  // Default instance keeps plain OUTLINE_API_TOKEN for backward compatibility.
  if (isDefault && process.env.OUTLINE_API_TOKEN) {
    return process.env.OUTLINE_API_TOKEN;
  }

  if (instanceCfg?.apiToken) return instanceCfg.apiToken;
  if (isDefault && cfg.apiToken) return cfg.apiToken;

  const hints = [
    `${envTokenKey(name)}=ol_api_...`,
    isDefault ? 'OUTLINE_API_TOKEN=ol_api_... (default instance only)' : null,
    `instances.${name}.apiToken in config.json (discouraged)`,
  ].filter(Boolean);

  throw new Error(
    `Outline API token is not configured for instance "${name}". Set one of:\n  - ${hints.join(
      '\n  - '
    )}`
  );
}

function getInstanceConfig(name) {
  const cfg = loadConfig();
  let defaultName = null;
  try {
    defaultName = resolveDefaultName(cfg);
  } catch {
    /* ignore until we know shape */
  }

  if (cfg.instances && cfg.instances[name]) {
    return {
      name,
      baseUrl: normalizeBaseUrl(cfg.instances[name].baseUrl),
      apiToken: resolveToken(name, cfg.instances[name], cfg, name === defaultName),
      isDefault: name === defaultName,
      raw: cfg.instances[name],
    };
  }

  // Legacy single-instance: treat as name "default" (or whatever defaultName is).
  if (cfg.baseUrl && (name === 'default' || name === defaultName)) {
    const resolvedName = defaultName || 'default';
    return {
      name: resolvedName,
      baseUrl: normalizeBaseUrl(cfg.baseUrl),
      apiToken: resolveToken(resolvedName, null, cfg, true),
      isDefault: true,
      raw: cfg,
    };
  }

  const known = listInstanceNames(cfg);
  throw new Error(
    `Unknown Outline instance "${name}". Known: ${known.length ? known.join(', ') : '(none)'}.`
  );
}

function createClient(resolved) {
  const clientBaseUrl = resolved.baseUrl;
  const clientToken = resolved.apiToken;
  const clientOrigin = new URL(clientBaseUrl).origin;
  const name = resolved.name;

  function resolveOutlineUrl(urlOrPath) {
    if (!urlOrPath) throw new Error('resolveOutlineUrl: empty url');
    if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
    return new URL(urlOrPath, clientOrigin).href;
  }

  function isOutlineHost(urlOrPath) {
    try {
      const abs = resolveOutlineUrl(urlOrPath);
      return new URL(abs).origin === clientOrigin;
    } catch {
      return false;
    }
  }

  async function makeRequest(endpoint, body = {}) {
    const url = `${clientBaseUrl}/${String(endpoint).replace(/^\//, '')}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`[${name}] API error ${res.status}: ${text}`);
    }

    return await res.json();
  }

  function guessContentType(fileName) {
    const ext = extname(fileName || '')
      .toLowerCase()
      .replace(/^\./, '');
    const map = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      pdf: 'application/pdf',
      md: 'text/markdown',
      markdown: 'text/markdown',
      txt: 'text/plain',
      json: 'application/json',
      svg: 'image/svg+xml',
      csv: 'text/csv',
      html: 'text/html',
      htm: 'text/html',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      zip: 'application/zip',
    };
    return map[ext] || 'application/octet-stream';
  }

  async function uploadToSignedUrl(uploadUrl, form, filePath, contentType, fileName) {
    const absoluteUrl = resolveOutlineUrl(uploadUrl);
    const fd = new FormData();

    for (const [key, value] of Object.entries(form || {})) {
      fd.append(key, value == null ? '' : String(value));
    }

    const bytes = readFileSync(filePath);
    const blob = new Blob([bytes], { type: contentType || 'application/octet-stream' });
    fd.append('file', blob, fileName);

    const headers = {};
    if (isOutlineHost(uploadUrl)) {
      headers.Authorization = `Bearer ${clientToken}`;
    }

    const res = await fetch(absoluteUrl, {
      method: 'POST',
      headers,
      body: fd,
    });

    const text = await res.text().catch(() => '');
    let parsed = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw */
    }

    if (!res.ok) {
      const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      throw new Error(
        `[${name}] Upload to ${absoluteUrl} failed ${res.status}: ${String(detail).slice(0, 500)}`
      );
    }

    return { status: res.status, ok: true, url: absoluteUrl, body: parsed };
  }

  /**
   * Two-phase attachment upload used by create.js / update.js --attach.
   * Returns { attachment, uploadStatus, redirectPath, markdown }.
   */
  async function uploadAttachment({
    filePath,
    name: displayName,
    contentType,
    documentId,
  } = {}) {
    if (!filePath) throw new Error('uploadAttachment: filePath is required');
    if (!existsSync(filePath)) throw new Error(`uploadAttachment: file not found: ${filePath}`);

    const fileName = displayName || basename(filePath);
    const type = contentType || guessContentType(fileName);
    const size = statSync(filePath).size;

    const body = { name: fileName, contentType: type, size };
    if (documentId) body.documentId = documentId;

    const res = await makeRequest('attachments.create', body);
    const data = res.data || {};
    const attachment = data.attachment || data;
    const uploadUrl = data.uploadUrl;
    const form = data.form;

    let uploadStatus = null;
    if (uploadUrl) {
      uploadStatus = await uploadToSignedUrl(uploadUrl, form, filePath, type, fileName);
    }

    const redirectPath =
      attachment?.url ||
      (attachment?.id ? `/api/attachments.redirect?id=${attachment.id}` : null);
    const markdown = redirectPath ? `![${fileName}](${redirectPath})` : null;

    return { attachment, uploadStatus, redirectPath, markdown, raw: res };
  }

  return {
    name,
    baseUrl: clientBaseUrl,
    apiToken: clientToken,
    outlineOrigin: clientOrigin,
    isDefault: resolved.isDefault,
    makeRequest,
    resolveOutlineUrl,
    isOutlineHost,
    uploadAttachment,
    uploadToSignedUrl,
    guessContentType,
  };
}

function syncLegacyExports(client) {
  apiToken = client.apiToken;
  baseUrl = client.baseUrl;
  outlineOrigin = client.outlineOrigin;
}

/**
 * Get (cached) client for an instance.
 * @param {string} [instanceName] explicit name; otherwise CLI/env/default
 */
export function getClient(instanceName) {
  const name = resolveInstanceName(instanceName);
  if (!clientCache.has(name)) {
    clientCache.set(name, createClient(getInstanceConfig(name)));
  }
  const client = clientCache.get(name);
  syncLegacyExports(client);
  return client;
}

/** List configured instance names (does not validate tokens). */
export function listInstances() {
  return listInstanceNames(loadConfig());
}

export function getDefaultInstanceName() {
  return resolveDefaultName(loadConfig());
}

export function getApiToken() {
  return getClient().apiToken;
}

export function getBaseUrl() {
  return getClient().baseUrl;
}

export function getOutlineOrigin() {
  return getClient().outlineOrigin;
}

// ── Backward-compatible module-level API ──────────────────────────────────
// Scripts that `import { makeRequest, uploadAttachment, ... }` keep working.
// Values resolve lazily against --instance / OUTLINE_INSTANCE / default.

export async function makeRequest(endpoint, body = {}, opts = {}) {
  const client = opts.instance ? getClient(opts.instance) : getClient();
  return client.makeRequest(endpoint, body);
}

export function resolveOutlineUrl(urlOrPath) {
  return getClient().resolveOutlineUrl(urlOrPath);
}

export function isOutlineHost(urlOrPath) {
  return getClient().isOutlineHost(urlOrPath);
}

export async function uploadAttachment(args) {
  return getClient().uploadAttachment(args);
}

/**
 * Build breadcrumb path for a document: Collection / Parent / ... / Title
 * Walks parentDocumentId chain (max 20) and resolves collection name.
 * Returns { path, parts, collectionId, collectionName, parentIds }.
 */
export async function getDocumentBreadcrumb(docOrId, opts = {}) {
  const client = opts.instance ? getClient(opts.instance) : getClient();
  const maxDepth = opts.maxDepth ?? 20;

  let doc = docOrId;
  if (typeof docOrId === 'string') {
    const res = await client.makeRequest('documents.info', { id: docOrId });
    doc = res.data;
  }
  if (!doc?.id) throw new Error('getDocumentBreadcrumb: document is required');

  const titles = [];
  const parentIds = [];
  let cursor = doc;
  let depth = 0;

  // Walk parents first (excluding current), then reverse.
  while (cursor?.parentDocumentId && depth < maxDepth) {
    parentIds.push(cursor.parentDocumentId);
    const parentRes = await client.makeRequest('documents.info', {
      id: cursor.parentDocumentId,
    });
    cursor = parentRes.data;
    if (!cursor) break;
    titles.unshift(cursor.title || cursor.id);
    depth += 1;
  }

  let collectionName = doc.collection?.name || null;
  const collectionId = doc.collectionId || doc.collection?.id || null;
  if (!collectionName && collectionId) {
    try {
      const colRes = await client.makeRequest('collections.info', { id: collectionId });
      collectionName = colRes.data?.name || null;
    } catch {
      /* ignore */
    }
  }

  const parts = [];
  if (collectionName) parts.push(collectionName);
  parts.push(...titles);
  parts.push(doc.title || doc.id);

  return {
    path: parts.join(' / '),
    parts,
    collectionId,
    collectionName,
    parentIds,
    documentId: doc.id,
    title: doc.title || null,
  };
}

/**
 * Batch breadcrumbs for many docs. Dedupes parent/collection lookups in-process.
 * docs: array of document objects (must have id; parentDocumentId/collectionId help).
 */
export async function getBreadcrumbsForDocuments(docs, opts = {}) {
  const client = opts.instance ? getClient(opts.instance) : getClient();
  const list = Array.isArray(docs) ? docs.filter(Boolean) : [];
  const cache = new Map(); // docId -> { id, title, parentDocumentId, collectionId }
  const colCache = new Map(); // collectionId -> name

  async function loadDoc(id) {
    if (!id) return null;
    if (cache.has(id)) return cache.get(id);
    try {
      const res = await client.makeRequest('documents.info', { id });
      const d = res.data;
      const slim = {
        id: d.id,
        title: d.title || d.id,
        parentDocumentId: d.parentDocumentId || null,
        collectionId: d.collectionId || d.collection?.id || null,
        collectionName: d.collection?.name || null,
      };
      cache.set(id, slim);
      return slim;
    } catch {
      cache.set(id, null);
      return null;
    }
  }

  async function loadCollectionName(id) {
    if (!id) return null;
    if (colCache.has(id)) return colCache.get(id);
    try {
      const res = await client.makeRequest('collections.info', { id });
      const name = res.data?.name || null;
      colCache.set(id, name);
      return name;
    } catch {
      colCache.set(id, null);
      return null;
    }
  }

  // Seed cache from provided docs
  for (const d of list) {
    if (!d?.id) continue;
    cache.set(d.id, {
      id: d.id,
      title: d.title || d.id,
      parentDocumentId: d.parentDocumentId || null,
      collectionId: d.collectionId || d.collection?.id || null,
      collectionName: d.collection?.name || null,
    });
  }

  const out = new Map();
  for (const d of list) {
    if (!d?.id) continue;
    const titles = [];
    const parentIds = [];
    let cursor = await loadDoc(d.id);
    let depth = 0;
    const selfTitle = cursor?.title || d.title || d.id;

    while (cursor?.parentDocumentId && depth < 20) {
      parentIds.push(cursor.parentDocumentId);
      cursor = await loadDoc(cursor.parentDocumentId);
      if (!cursor) break;
      titles.unshift(cursor.title || cursor.id);
      depth += 1;
    }

    const seed = cache.get(d.id);
    let collectionName = seed?.collectionName || d.collection?.name || null;
    const collectionId = seed?.collectionId || d.collectionId || d.collection?.id || null;
    if (!collectionName && collectionId) {
      collectionName = await loadCollectionName(collectionId);
    }

    const parts = [];
    if (collectionName) parts.push(collectionName);
    parts.push(...titles);
    parts.push(selfTitle);

    out.set(d.id, {
      path: parts.join(' / '),
      parts,
      collectionId,
      collectionName,
      parentIds,
      documentId: d.id,
      title: selfTitle,
    });
  }

  return out;
}
