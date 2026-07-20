#!/usr/bin/env node
import { makeRequest, getDocumentBreadcrumb } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--id')) {
  console.log(`Usage: read.js --id <uuid> [--instance <name>] [--json] [--no-breadcrumb]`);
  process.exit(get('--id') ? 0 : 1);
}

try {
  const res = await makeRequest('documents.info', { id: get('--id') });
  const doc = res.data;

  let breadcrumb = null;
  if (!has('--no-breadcrumb')) {
    try {
      breadcrumb = await getDocumentBreadcrumb(doc);
    } catch {
      /* non-fatal */
    }
  }

  if (has('--json')) {
    console.log(JSON.stringify({ ...res, breadcrumb }, null, 2));
    process.exit(0);
  }

  console.log(`Title: ${doc.title}`);
  if (breadcrumb?.path) {
    console.log(`Path: ${breadcrumb.path}`);
  } else if (doc.collection) {
    console.log(`Collection: ${doc.collection.name || 'N/A'}`);
  }
  console.log(`ID: ${doc.id}`);
  console.log(`Updated: ${doc.updatedAt?.slice(0, 10) || 'N/A'}`);
  if (doc.url) console.log(`URL: ${doc.url}`);
  console.log(`\n---\n`);
  console.log(doc.text || '(empty)');
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
