#!/usr/bin/env node
// Manage file attachments on Outline. Wraps the `attachments.*` API endpoints
// (list / create / delete / redirect). One script, action picked via --action
// so the file count stays small.
//
// Note: in some Outline versions, attachments are a global pool (`documentId`
// returns null). Pass --document-id when you want a filter, omit it for the
// global list.
//
// Modern Outline uses two-phase upload:
//   1) attachments.create { name, contentType, size, documentId? }
//      → { attachment, uploadUrl, form }
//   2) multipart POST file to uploadUrl (relative /api/files.create or S3)
//      with form fields + file field "file". Do NOT send base64 to create.

import {
  makeRequest,
  getClient,
  resolveOutlineUrl,
  isOutlineHost,
} from './lib/outline-api.js';
import { readFileSync, statSync } from 'fs';
import { basename, extname } from 'path';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
};
const has = (flag) => args.includes(flag);

/** Guess MIME from extension when --content-type is omitted. */
function guessContentType(name) {
  const ext = extname(name || '').toLowerCase().replace(/^\./, '');
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
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Phase 2 of Outline attachment upload.
 * - Local storage: uploadUrl is often `/api/files.create` (relative) → needs Bearer.
 * - Object storage: uploadUrl is a signed absolute URL → form fields only, no Bearer.
 */
async function uploadToSignedUrl(uploadUrl, form, filePath, contentType, name) {
  const absoluteUrl = resolveOutlineUrl(uploadUrl);
  const fd = new FormData();

  for (const [key, value] of Object.entries(form || {})) {
    fd.append(key, value == null ? '' : String(value));
  }

  const bytes = readFileSync(filePath);
  // Blob accepts Uint8Array in Bun/Node modern runtimes
  const blob = new Blob([bytes], { type: contentType || 'application/octet-stream' });
  fd.append('file', blob, name);

  const headers = {};
  // Same-origin Outline upload endpoints require the API token.
  // External signed URLs (S3 etc.) reject extra Authorization headers.
  if (isOutlineHost(uploadUrl)) {
    headers.Authorization = `Bearer ${getClient().apiToken}`;
  }

  const res = await fetch(absoluteUrl, {
    method: 'POST',
    headers,
    body: fd,
  });

  const text = await res.text().catch(() => '');
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }

  if (!res.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`Upload to ${absoluteUrl} failed ${res.status}: ${detail.slice(0, 500)}`);
  }

  return { status: res.status, ok: true, url: absoluteUrl, body };
}

if (has('--help')) {
  console.log(`Usage: attachments.js --action list [--document-id <id>] [--json]
       attachments.js --action create --file <path> [--name <n>] [--content-type <t>] [--document-id <id>]
       attachments.js --action delete --attachment-id <id>
       attachments.js --action redirect --attachment-id <id>

Actions:
  list      List attachments (optionally filtered by --document-id)
  create    Two-phase upload: attachments.create + multipart POST to uploadUrl
  delete    Permanently delete an attachment
  redirect  Get a temporary signed URL for downloading an attachment

Options:
  --instance|-i <name>  Outline instance (default: config.defaultInstance)
  --document-id <id>     Filter list / scope create to a document
  --attachment-id <id>   Attachment to delete or download
  --file <path>          Local file path (for create)
  --name <name>          Display name (for create; default: filename)
  --content-type <type>  MIME type (for create; auto-guessed from extension)
  --size <bytes>         File size in bytes (for create; auto-detected from --file)
  --json                 Output raw JSON

Content-type auto-guess: jpg/jpeg, png, webp, gif, pdf, md, txt, json, svg, csv, html

Examples:
  bun attachments.js --action list --document-id 9a2d1298-9ae7-4169-9082-a2aef835a2e0
  bun attachments.js --action list --json
  bun attachments.js --action create --file ./diagram.png --document-id 9a2d1298-...
  bun attachments.js --action create --file ./handoff.md \\
    --name handoff.md --content-type text/markdown --document-id 9a2d1298-...`);
  process.exit(0);
}

const action = get('--action') || 'list';

try {
  if (action === 'list') {
    const body = { limit: parseInt(get('--limit') || '25', 10) };
    if (get('--document-id')) body.documentId = get('--document-id');
    const res = await makeRequest('attachments.list', body);
    const atts = res.data || [];
    if (has('--json')) {
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }
    console.log(`Attachments: ${res.pagination?.total ?? atts.length} (showing ${atts.length})\n`);
    atts.forEach((a, i) => {
      console.log(`[${i + 1}] ${a.name}`);
      console.log(`    ID:   ${a.id}`);
      console.log(`    Type: ${a.contentType || 'unknown'}`);
      console.log(`    Size: ${a.size != null ? `${a.size} bytes` : 'N/A'}`);
      if (a.documentId) console.log(`    Doc:  ${a.documentId}`);
      if (a.url) console.log(`    URL:  ${a.url}`);
      console.log();
    });
  } else if (action === 'create') {
    const file = get('--file');
    if (!file) {
      console.error('Error: --file is required for create.');
      process.exit(1);
    }

    const filePath = file;
    const name = get('--name') || basename(filePath);
    const contentType = get('--content-type') || guessContentType(name);
    const size = parseInt(get('--size') || `${statSync(filePath).size}`, 10);

    // Phase 1: reserve attachment slot — never send base64 content here.
    const body = { name, contentType, size };
    if (get('--document-id')) body.documentId = get('--document-id');

    const res = await makeRequest('attachments.create', body);
    const data = res.data || {};
    const a = data.attachment || data;
    const uploadUrl = data.uploadUrl;
    const form = data.form;

    let uploadStatus = null;
    if (uploadUrl) {
      uploadStatus = await uploadToSignedUrl(uploadUrl, form, filePath, contentType, name);
    } else {
      console.error(
        'Warning: attachments.create did not return uploadUrl — file bytes were not uploaded. ' +
          'Attachment metadata may exist but content will be empty.'
      );
    }

    const redirectPath = a?.url || (a?.id ? `/api/attachments.redirect?id=${a.id}` : null);
    const markdown = redirectPath ? `![${name}](${redirectPath})` : null;

    if (has('--json')) {
      console.log(
        JSON.stringify(
          {
            ...res,
            uploadStatus,
            redirectPath,
            markdown,
          },
          null,
          2
        )
      );
      process.exit(0);
    }

    console.log(`✅ Attachment created${uploadUrl ? ' + uploaded' : ' (no uploadUrl)'}\n`);
    console.log(`ID:   ${a.id}`);
    console.log(`Name: ${a.name || name}`);
    console.log(`Type: ${a.contentType || contentType}`);
    console.log(`Size: ${a.size != null ? `${a.size} bytes` : `${size} bytes`}`);
    if (a.documentId) console.log(`Doc:  ${a.documentId}`);
    if (redirectPath) console.log(`Path: ${redirectPath}`);
    if (a.url) console.log(`URL:  ${a.url}`);
    if (markdown) console.log(`MD:   ${markdown}`);
    if (uploadStatus) console.log(`Upload: HTTP ${uploadStatus.status} → ${uploadStatus.url}`);
  } else if (action === 'delete') {
    const id = get('--attachment-id');
    if (!id) {
      console.error('Error: --attachment-id is required for delete.');
      process.exit(1);
    }
    await makeRequest('attachments.delete', { id });
    if (has('--json')) {
      console.log(JSON.stringify({ ok: true, id }, null, 2));
      process.exit(0);
    }
    console.log(`✅ Attachment ${id} deleted`);
  } else if (action === 'redirect') {
    const id = get('--attachment-id');
    if (!id) {
      console.error('Error: --attachment-id is required for redirect.');
      process.exit(1);
    }
    const res = await makeRequest('attachments.redirect', { id });
    const url = res.data?.url || res.data;
    if (has('--json')) {
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }
    console.log(`Redirect URL: ${url}`);
  } else {
    console.error(`Error: unknown action "${action}". Use list, create, delete, or redirect.`);
    process.exit(1);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
