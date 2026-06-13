#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--title')) {
  console.log(`Usage: create.js --title <text> [--text <markdown>] [--collection <id>] [--parent <id>] [--publish] [--json]`);
  console.log(`If --text is omitted, reads from stdin.`);
  process.exit(get('--title') ? 0 : 1);
}

try {
  let text = get('--text');
  if (!text && !process.stdin.isTTY) {
    text = readFileSync(0, 'utf-8');
  }

  const body = { title: get('--title'), text: text || '' };
  if (get('--collection')) body.collectionId = get('--collection');
  if (get('--parent')) body.parentDocumentId = get('--parent');
  if (has('--publish')) body.publish = true;

  const res = await makeRequest('documents.create', body);
  const doc = res.data;

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  console.log(`✅ Document created\n`);
  console.log(`ID: ${doc.id}`);
  console.log(`Title: ${doc.title}`);
  console.log(`Status: ${doc.publishedAt ? 'published' : 'draft'}`);
  console.log(`URL: ${doc.url || 'N/A'}`);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
