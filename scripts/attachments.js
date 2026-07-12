#!/usr/bin/env node
// Manage file attachments on Outline. Wraps the `attachments.*` API endpoints
// (list / create / delete / redirect). One script, action picked via --action.
//
// Upload uses the two-phase flow:
//   Phase 1: attachments.create → get metadata + presigned upload info
//   Phase 2: POST file as multipart/form-data to the upload URL (files.create)
//
// Note: in some Outline versions, attachments are a global pool (`documentId`
// returns null). Pass --document-id when you want a filter, omit it for the
// global list.

import { makeRequest, uploadAttachment } from './lib/outline-api.js';
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help')) {
  console.log(`Usage: attachments.js --action list [--document-id <id>] [--json]
       attachments.js --action create --file <path> [--name <n>] [--content-type <t>] [--document-id <id>] [--preset <p>] [--json]
       attachments.js --action delete --attachment-id <id>
       attachments.js --action redirect --attachment-id <id>

Actions:
  list      List attachments (optionally filtered by --document-id)
  create    Upload a file (two-phase: metadata + file upload).
  delete    Permanently delete an attachment
  redirect  Get a temporary signed URL for downloading an attachment

Options:
  --document-id <id>     Filter list / scope create to a document
  --attachment-id <id>   Attachment to delete or download
  --file <path>          Local file path (for create)
  --name <name>          Display name (for create; default: filename)
  --content-type <type>  MIME type (for create; default: application/octet-stream)
  --preset <preset>      Attachment preset (for create; e.g. document-attachment, avatar, emoji)
  --json                 Output raw JSON

Examples:
  bun attachments.js --action list --document-id 9a2d1298-9ae7-4169-9082-a2aef835a2e0
  bun attachments.js --action list --json                          # global pool
  bun attachments.js --action create --file ./handoff.md \\
    --name handoff.md --content-type text/markdown --document-id 9a2d1298-...
  bun attachments.js --action create --file ./report.pdf \\
    --content-type application/pdf --document-id 9a2d1298-...`);
  process.exit(0);
}

const action = get('--action') || 'list';

try {
  if (action === 'list') {
    const body = { limit: parseInt(get('--limit') || '25') };
    if (get('--document-id')) body.documentId = get('--document-id');
    const res = await makeRequest('attachments.list', body);
    const atts = res.data || [];
    if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }
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
    if (!file) { console.error('Error: --file is required for create.'); process.exit(1); }
    const contentType = get('--content-type') || 'application/octet-stream';
    const opts = {
      filePath: file,
      name: get('--name') || file.split('/').pop(),
      contentType,
    };
    if (get('--document-id')) opts.documentId = get('--document-id');
    if (get('--preset')) opts.preset = get('--preset');

    const { attachment, uploadResult } = await uploadAttachment(opts);

    if (has('--json')) {
      console.log(JSON.stringify({ attachment, uploadResult }, null, 2));
      process.exit(0);
    }
    console.log(`✅ Attachment uploaded\n`);
    console.log(`ID:   ${attachment.id}`);
    console.log(`Name: ${attachment.name}`);
    console.log(`Type: ${attachment.contentType || contentType}`);
    console.log(`Size: ${attachment.size != null ? `${attachment.size} bytes` : 'N/A'}`);
    if (attachment.documentId) console.log(`Doc:  ${attachment.documentId}`);
    if (attachment.url) console.log(`URL:  ${attachment.url}`);
  } else if (action === 'delete') {
    const id = get('--attachment-id');
    if (!id) { console.error('Error: --attachment-id is required for delete.'); process.exit(1); }
    await makeRequest('attachments.delete', { id });
    if (has('--json')) { console.log(JSON.stringify({ ok: true, id }, null, 2)); process.exit(0); }
    console.log(`✅ Attachment ${id} deleted`);
  } else if (action === 'redirect') {
    const id = get('--attachment-id');
    if (!id) { console.error('Error: --attachment-id is required for redirect.'); process.exit(1); }
    const res = await makeRequest('attachments.redirect', { id });
    const url = res.data?.url || res.data;
    if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }
    console.log(`Redirect URL: ${url}`);
  } else {
    console.error(`Error: unknown action "${action}". Use list, create, delete, or redirect.`);
    process.exit(1);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}