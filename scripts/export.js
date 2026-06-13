#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';
import { writeFileSync } from 'fs';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--id')) {
  console.log(`Usage: export.js --id <uuid> [--output <path>] [--include-children] [--json]

Exports a document as markdown.

Options:
  --id <uuid>          Document ID (required)
  --output <path>      Save to file (default: stdout)
  --include-children   Include child documents
  --json               Output raw JSON response`);
  process.exit(has('--help') ? 0 : 1);
}

try {
  const body = { id: get('--id') };
  if (has('--include-children')) body.includeChildDocuments = true;

  const res = await makeRequest('documents.export', body);

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  const md = res.data || '';
  const output = get('--output');
  if (output) {
    writeFileSync(output, md, 'utf-8');
    console.error(`✅ Exported to ${output}`);
  } else {
    process.stdout.write(md);
  }
} catch (e) {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
}
