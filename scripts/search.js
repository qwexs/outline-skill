#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--query')) {
  console.log(`Usage: search.js --query <text> [--collection <id>] [--date-filter <day|week|month|year>] [--limit <N>] [--json]`);
  process.exit(get('--query') ? 0 : 1);
}

try {
  const body = { query: get('--query'), limit: parseInt(get('--limit') || '25') };
  if (get('--collection')) body.collectionId = get('--collection');
  if (get('--date-filter')) body.dateFilter = get('--date-filter');

  const res = await makeRequest('documents.search', body);
  const results = res.data || [];

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  console.log(`Found ${results.length} results:\n`);
  results.forEach((r, i) => {
    const doc = r.document;
    console.log(`[${i + 1}] ${doc.title}`);
    if (doc.collection) console.log(`    Collection: ${doc.collection.name || 'N/A'}`);
    console.log(`    Updated: ${doc.updatedAt?.slice(0, 10) || 'N/A'}`);
    if (r.context) console.log(`    Context: ${r.context}`);
    console.log(`    URL: ${doc.url || 'N/A'}\n`);
  });
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
