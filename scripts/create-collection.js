#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

const VALID_FLAGS = ['--help','--name','--description','--color','--icon','--private','--read-write','--json','--instance','-i'];

if (has('--help') || !get('--name')) {
  console.log(`Usage: create-collection.js --name "Name" [options]`);
  console.log(``);
  console.log(`Options:`);
  console.log(`  --description <text>   Collection description`);
  console.log(`  --color <#hex>         Color, e.g. #FF5C80`);
  console.log(`  --icon <name>           Icon name (Outline icon set)`);
  console.log(`  --private               Make collection private (permission=null)`);
  console.log(`  --read-write            Make collection editable by everyone (permission=read_write)`);
  console.log(`  --json                  Raw API JSON`);
  console.log(`  --instance / -i         Outline instance name`);
  process.exit(get('--name') ? 0 : 1);
}

for (const arg of args) {
  if (arg.startsWith('-') && !VALID_FLAGS.includes(arg)) {
    console.error(`Error: unknown flag "${arg}".`);
    console.error(`Allowed flags: ${VALID_FLAGS.join(', ')}`);
    process.exit(1);
  }
}

const permFlags = ['--private', '--read-write'].filter(f => has(f));
if (permFlags.length > 1) {
  console.error(`Error: ${permFlags.join(', ')} are mutually exclusive.`);
  process.exit(1);
}

try {
  const body = { name: get('--name') };
  if (get('--description')) body.description = get('--description');
  if (get('--color')) body.color = get('--color');
  if (get('--icon')) body.icon = get('--icon');
  // Outline 1.9+: permission must be read|read_write|admin or null (private).
  // Empty string is rejected with validation_error.
  if (has('--private')) body.permission = null;
  if (has('--read-write')) body.permission = 'read_write';

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
