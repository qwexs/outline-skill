#!/usr/bin/env node
/**
 * Update an Outline collection.
 *
 *   bun scripts/update-collection.js --id <uuid> --name "New name"
 *   bun scripts/update-collection.js --id <uuid> --description "..."
 *   bun scripts/update-collection.js --id <uuid> --color "#FF0000"
 *   bun scripts/update-collection.js --id <uuid> --private
 *   bun scripts/update-collection.js --id <uuid> --public
 *   bun scripts/update-collection.js --id <uuid> --read-write
 */
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
};
const has = (flag) => args.includes(flag);

const VALID_FLAGS = [
  '--help',
  '--instance', '-i',
  '--id',
  '--name',
  '--description',
  '--color',
  '--icon',
  '--private',
  '--public',
  '--read-write',
  '--json',
];

if (has('--help') || !get('--id')) {
  console.log(`Usage: update-collection.js --id <uuid> [options]`);
  console.log(``);
  console.log(`Options:`);
  console.log(`  --name <text>          New collection name`);
  console.log(`  --description <text>   New description (pass empty string to clear)`);
  console.log(`  --color <#hex>         Color, e.g. #FF5C80`);
  console.log(`  --icon <name>          Icon name (Outline icon set)`);
  console.log(`  --private              Make collection private (permission empty)`);
  console.log(`  --public               Make collection read-for-workspace (permission=read)`);
  console.log(`  --read-write           Make collection editable by everyone (permission=read_write)`);
  console.log(`  --json                 Raw API JSON`);
  console.log(`  --instance / -i        Outline instance name`);
  process.exit(get('--id') ? 0 : 1);
}

for (const arg of args) {
  if (arg.startsWith('-') && !VALID_FLAGS.includes(arg)) {
    console.error(`Error: unknown flag "${arg}".`);
    console.error(`Allowed flags: ${VALID_FLAGS.join(', ')}`);
    process.exit(1);
  }
}

const permFlags = ['--private', '--public', '--read-write'].filter(f => has(f));
if (permFlags.length > 1) {
  console.error(`Error: ${permFlags.join(', ')} are mutually exclusive.`);
  process.exit(1);
}

try {
  const body = { id: get('--id') };
  let changes = 0;

  if (get('--name') != null) {
    body.name = get('--name');
    changes += 1;
  }
  // Allow explicit empty description to clear
  if (args.includes('--description')) {
    body.description = get('--description') ?? '';
    changes += 1;
  }
  if (get('--color') != null) {
    body.color = get('--color');
    changes += 1;
  }
  if (get('--icon') != null) {
    body.icon = get('--icon');
    changes += 1;
  }
  if (has('--private')) {
    // null = private (Outline 1.9+ rejects empty string)
    body.permission = null;
    changes += 1;
  }
  if (has('--public')) {
    body.permission = 'read';
    changes += 1;
  }
  if (has('--read-write')) {
    body.permission = 'read_write';
    changes += 1;
  }

  if (changes === 0) {
    console.error(`Error: nothing to update. Pass at least one of --name/--description/--color/--icon/--private/--public/--read-write.`);
    process.exit(1);
  }

  const res = await makeRequest('collections.update', body);
  const c = res.data;

  if (has('--json')) {
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  }

  console.log(`✅ Collection updated\n`);
  console.log(`ID: ${c.id}`);
  console.log(`Name: ${c.name}`);
  if (c.description) console.log(`Description: ${c.description}`);
  if (c.color) console.log(`Color: ${c.color}`);
  if (c.icon) console.log(`Icon: ${c.icon}`);
  if (c.permission === '' || c.permission == null) {
    console.log(`Permission: private`);
  } else {
    console.log(`Permission: ${c.permission}`);
  }
  console.log(`URL: ${c.url || 'N/A'}`);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
