#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--id')) {
  console.log(`Usage: export.js --id <uuid> [--output-file <path>] [--as-file] [--include-children] [--json]

Exports a document as markdown.

Options:
  --id <uuid>              Document ID (required)
  --output-file <path>     Save to file (default: stdout)
  --as-file                Write to temp .md file (recommended for agents)
  --include-children       Include child documents
  --json                   Output raw JSON response`);
  process.exit(has('--help') ? 0 : 1);
}

try {
  const body = { id: get('--id') };
  if (has('--include-children')) body.includeChildDocuments = true;

  const res = await makeRequest('documents.export', body);

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  const md = res.data || '';
  // Priority: explicit path (--output-file, legacy --output) > --as-file (temp) > stdout.
  const outputPath = get('--output-file') || get('--output');
  if (has('--as-file') && outputPath) {
    console.error(`⚠️ Ignoring --as-file: explicit output path takes precedence`);
  }
  const finalPath = outputPath || (has('--as-file') ? `${tmpdir()}/outline-export-${Date.now()}.md` : null);
  if (finalPath) {
    writeFileSync(finalPath, md, 'utf-8');
    console.error(`✅ Exported to ${finalPath}`);
  } else {
    process.stdout.write(md);
  }
} catch (e) {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
}
