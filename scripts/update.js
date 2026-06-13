#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--id')) {
  console.log(`Usage: update.js --id <uuid> [--title <text>] [--text <markdown>] [--mode <replace|append|prepend>] [--json]`);
  console.log(`If --text is omitted, reads from stdin.`);
  process.exit(get('--id') ? 0 : 1);
}

try {
  let text = get('--text');
  if (!text && !process.stdin.isTTY) {
    text = readFileSync(0, 'utf-8');
  }

  const mode = get('--mode') || 'replace';
  const body = { id: get('--id'), done: true };
  if (get('--title')) body.title = get('--title');
  if (text) {
    if (mode === 'append') {
      body.text = text;
      body.append = true;
    } else if (mode === 'prepend') {
      const current = await makeRequest('documents.info', { id: get('--id') });
      body.text = text + '\n' + (current.data.text || '');
    } else {
      body.text = text;
    }
  }

  const res = await makeRequest('documents.update', body);
  const doc = res.data;

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  console.log(`✅ Document updated\n`);
  console.log(`ID: ${doc.id}`);
  console.log(`Title: ${doc.title}`);
  console.log(`Mode: ${mode}`);
  console.log(`URL: ${doc.url || 'N/A'}`);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
