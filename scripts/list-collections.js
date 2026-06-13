#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);

if (has('--help')) {
  console.log(`Usage: list-collections.js [--json]`);
  process.exit(0);
}

try {
  const res = await makeRequest('collections.list', {});
  const collections = res.data || [];

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  console.log(`Collections (${collections.length}):\n`);
  collections.forEach((c, i) => {
    console.log(`[${i + 1}] ${c.name}`);
    console.log(`    ID: ${c.id}`);
    console.log(`    Documents: ${c.documentCount ?? 'N/A'}\n`);
  });
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
