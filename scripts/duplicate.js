#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--id')) {
  console.log(`Usage: duplicate.js --id <uuid> [--title <text>] [--recursive] [--collection <id>] [--parent <id>] [--publish] [--json]

Duplicates a document.

Options:
  --id <uuid>          Document ID to duplicate (required)
  --title <text>       New title (default: "Copy of ...")
  --recursive          Also duplicate child documents
  --collection <id>    Target collection ID
  --parent <id>        Parent document ID
  --publish            Publish the copy
  --json               Output JSON response`);
  process.exit(has('--help') ? 0 : 1);
}

try {
  const body = { id: get('--id') };
  if (get('--title')) body.title = get('--title');
  if (has('--recursive')) body.recursive = true;
  if (has('--publish')) body.publish = true;
  if (get('--collection')) body.collectionId = get('--collection');
  if (get('--parent')) body.parentDocumentId = get('--parent');

  const res = await makeRequest('documents.duplicate', body);

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  const docs = Array.isArray(res.data) ? res.data : [res.data];
  const doc = docs[0];
  console.log(`✅ Document duplicated\n`);
  console.log(`Original ID: ${get('--id')}`);
  console.log(`New ID: ${doc.id}`);
  console.log(`Title: ${doc.title}`);
  if (doc.url) console.log(`URL: ${doc.url}`);
} catch (e) {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
}
