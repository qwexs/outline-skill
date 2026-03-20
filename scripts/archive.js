#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--id')) {
  console.log(`Usage: archive.js --id <uuid> [--restore] [--json]

Archives or restores a document.

Options:
  --id <uuid>    Document ID (required)
  --restore      Restore from archive instead of archiving
  --json         Output JSON response`);
  process.exit(has('--help') ? 0 : 1);
}

try {
  const restore = has('--restore');
  const endpoint = restore ? 'documents.restore' : 'documents.archive';
  const res = await makeRequest(endpoint, { id: get('--id') });

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  const action = restore ? 'restored' : 'archived';
  console.log(`✅ Document ${action}`);
  console.log(`ID: ${get('--id')}`);
} catch (e) {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
}
