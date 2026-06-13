#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--name')) {
  console.log(`Usage: create-collection.js --name "Name" [--description "..."] [--color "#hex"] [--private] [--json]`);
  process.exit(0);
}

try {
  const body = { name: get('--name') };
  if (get('--description')) body.description = get('--description');
  if (get('--color')) body.color = get('--color');
  if (has('--private')) body.permission = '';

  const res = await makeRequest('collections.create', body);
  const c = res.data;

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  console.log(`✅ Collection created\n`);
  console.log(`ID: ${c.id}`);
  console.log(`Name: ${c.name}`);
  if (c.description) console.log(`Description: ${c.description}`);
  console.log(`URL: ${c.url}`);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
