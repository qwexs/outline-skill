#!/usr/bin/env node
/**
 * List / read Outline document templates.
 *
 *   bun scripts/templates.js
 *   bun scripts/templates.js --collection <id>
 *   bun scripts/templates.js --id <template-uuid>
 *   bun scripts/templates.js --json
 */
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
};
const has = (flag) => args.includes(flag);

if (has('--help')) {
  console.log(`Usage: templates.js [--instance <name>] [--collection <id>] [--id <template-uuid>] [--limit <N>] [--json]`);
  console.log(``);
  console.log(`  (no args)              List accessible templates`);
  console.log(`  --collection <id>      Filter templates by collection`);
  console.log(`  --id <uuid>            Fetch one template (includes body markdown)`);
  console.log(`  --limit <N>            Max results for list (default 25)`);
  console.log(`  --json                 Raw API JSON`);
  console.log(``);
  console.log(`Create a doc from a template:`);
  console.log(`  bun scripts/create.js --title "..." --template-id <uuid> --collection <id> --publish`);
  console.log(`  (omit --text/--file to use template body as-is; pass --text to override)`);
  process.exit(0);
}

try {
  const id = get('--id');

  if (id) {
    const res = await makeRequest('templates.info', { id });
    const t = res.data;

    if (has('--json')) {
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }

    console.log(`Title: ${t.title || 'N/A'}`);
    console.log(`ID: ${t.id}`);
    if (t.collectionId) console.log(`Collection: ${t.collectionId}`);
    console.log(`Updated: ${t.updatedAt?.slice(0, 10) || 'N/A'}`);
    console.log(`\n---\n`);
    // templates.info may return content as ProseMirror JSON; prefer text/markdown if present
    const body = t.text || t.markdown || (typeof t.content === 'string' ? t.content : null);
    if (body) {
      console.log(body);
    } else if (t.content) {
      console.log('(template body is structured content; use --json or create.js --template-id)');
      console.log(JSON.stringify(t.content, null, 2).slice(0, 2000));
    } else {
      console.log('(empty template)');
    }
    process.exit(0);
  }

  const body = {
    limit: parseInt(get('--limit') || '25', 10),
    offset: 0,
  };
  if (get('--collection')) body.collectionId = get('--collection');

  const res = await makeRequest('templates.list', body);
  const templates = res.data || [];

  if (has('--json')) {
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  }

  console.log(`Templates (${templates.length}):\n`);
  templates.forEach((t, i) => {
    console.log(`[${i + 1}] ${t.title || '(untitled)'}`);
    console.log(`    ID: ${t.id}`);
    if (t.collectionId) console.log(`    Collection: ${t.collectionId}`);
    if (t.updatedAt) console.log(`    Updated: ${t.updatedAt.slice(0, 10)}`);
    // Show short body preview if markdown text is present
    const preview = t.text || t.markdown || null;
    if (preview) {
      const oneLine = String(preview).replace(/\s+/g, ' ').trim().slice(0, 100);
      if (oneLine) console.log(`    Preview: ${oneLine}${preview.length > 100 ? '…' : ''}`);
    }
    console.log('');
  });

  if (templates.length === 0) {
    console.log('(no templates found)');
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
