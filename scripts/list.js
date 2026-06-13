#!/usr/bin/env node
// List documents in a collection, or child documents of a parent document.
// Wraps the `documents.list` Outline API endpoint.

import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || (!get('--collection') && !get('--parent'))) {
  console.log(`Usage: list.js --collection <id> [--limit N] [--json]
       list.js --parent <id> [--limit N] [--json]

Lists documents in a collection, or child documents of a parent document.
Exactly one of --collection or --parent is required.

Options:
  --collection <id>  Collection ID (lists all docs in collection)
  --parent <id>      Parent document ID (returns direct children)
  --limit <N>        Max results (default 100)
  --json             Output raw JSON

Examples:
  bun list.js --collection e40e1777-77fd-4d58-bf27-046a9ea093d2 --limit 50
  bun list.js --parent 9a2d1298-9ae7-4169-9082-a2aef835a2e0 --json`);
  process.exit(has('--help') ? 0 : 1);
}

try {
  const body = { limit: parseInt(get('--limit') || '100') };
  if (get('--collection')) body.collectionId = get('--collection');
  if (get('--parent')) body.parentDocumentId = get('--parent');
  const res = await makeRequest('documents.list', body);
  const docs = res.data || [];

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  console.log(`Documents: ${docs.length}\n`);
  docs.forEach((d, i) => {
    console.log(`[${i + 1}] ${d.title}`);
    console.log(`    ID: ${d.id}`);
    if (d.parentDocumentId) console.log(`    Parent: ${d.parentDocumentId}`);
    console.log(`    Updated: ${d.updatedAt?.slice(0, 10) || 'N/A'}`);
    if (d.url) console.log(`    URL: ${d.url}\n`);
    else console.log();
  });
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
