#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--id')) {
  console.log(`Usage: delete.js --id <uuid> [--permanent] [--json]

Deletes a document (moves to trash or permanently).

Options:
  --id <uuid>    Document ID (required)
  --permanent    Delete permanently instead of moving to trash
  --json         Output JSON response`);
  process.exit(has('--help') ? 0 : 1);
}

try {
  const permanent = has('--permanent');
  const res = await makeRequest('documents.delete', { id: get('--id'), permanent });

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  const action = permanent ? 'permanently deleted' : 'deleted (moved to trash)';
  console.log(`✅ Document ${action}`);
  console.log(`ID: ${get('--id')}`);
} catch (e) {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
}
