#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';
import { readFileSync } from 'fs';
import { basename } from 'path';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--title')) {
  console.log(`Usage: import.js --title <text> [--file <path>] [--collection <id>] [--parent <id>] [--publish] [--json]

Imports a markdown file as a new document.

Options:
  --title <text>       Document title (required)
  --file <path>        Markdown file to import (default: read from stdin)
  --collection <id>    Target collection ID
  --parent <id>        Parent document ID
  --publish            Publish immediately
  --json               Output JSON response`);
  process.exit(has('--help') ? 0 : 1);
}

try {
  const filePath = get('--file');
  let text;
  if (filePath) {
    text = readFileSync(filePath, 'utf-8');
  } else {
    text = readFileSync(0, 'utf-8'); // stdin
  }

  const body = { title: get('--title'), text };
  if (get('--collection')) body.collectionId = get('--collection');
  if (get('--parent')) body.parentDocumentId = get('--parent');
  if (has('--publish')) body.publish = true;

  const res = await makeRequest('documents.create', body);

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  const doc = res.data;
  console.log(`✅ Document imported\n`);
  console.log(`ID: ${doc.id}`);
  console.log(`Title: ${doc.title}`);
  if (filePath) console.log(`Source: ${basename(filePath)}`);
  if (doc.url) console.log(`URL: ${doc.url}`);
} catch (e) {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
}
