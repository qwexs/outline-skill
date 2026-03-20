#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--id')) {
  console.log(`Usage: read.js --id <uuid> [--json]`);
  process.exit(get('--id') ? 0 : 1);
}

try {
  const res = await makeRequest('documents.info', { id: get('--id') });
  const doc = res.data;

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  console.log(`Title: ${doc.title}`);
  if (doc.collection) console.log(`Collection: ${doc.collection.name || 'N/A'}`);
  console.log(`Updated: ${doc.updatedAt?.slice(0, 10) || 'N/A'}`);
  console.log(`\n---\n`);
  console.log(doc.text || '(empty)');
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
