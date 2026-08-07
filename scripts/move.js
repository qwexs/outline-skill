#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--id')) {
  console.log(`Usage: move.js --id <uuid> [--instance <name>] [--collection <id>] [--parent <id|null>] [--expect-parent <id|null>] [--json]`);
  console.log(`  --id              Document to move (required)`);
  console.log(`  --instance <name> Outline instance (or use OUTLINE_INSTANCE env)`);
  console.log(`  --collection      Target collection id (optional, omit to keep current)`);
  console.log(`  --parent          Target parent document id, or 'null' to detach to top level (optional)`);
  console.log(`  --expect-parent   After move, verify documents.info.parentDocumentId matches this value.`);
  console.log(`                   Pass 'null' to assert document is now at top level.`);
  console.log(`                   Exits with code 2 and a warning if actual != expected.`);
  console.log(`  --json       Raw JSON output`);
  console.log(``);
  console.log(`Note: Outline API silently ignores unknown fields. Use --expect-parent to catch silent no-ops.`);
  process.exit(get('--id') ? 0 : 1);
}

// Parse --parent / --collection: accept 'null' literal explicitly so an agent
// can intentionally detach a document (otherwise empty string would mean "skip").
const parseNullable = (v) => {
  if (v === null || v === undefined) return undefined;
  if (v.toLowerCase() === 'null') return null;
  return v;
};

try {
  const body = { id: get('--id') };
  const collection = parseNullable(get('--collection'));
  const parent = parseNullable(get('--parent'));
  if (collection !== undefined) body.collectionId = collection;
  if (parent !== undefined) body.parentDocumentId = parent;

  const res = await makeRequest('documents.move', body);
  const doc = res.data;

  // Post-check via documents.info: Outline returns ok:true even when unknown
  // fields were ignored, so we verify the actual server-side state.
  let actualParent = doc.parentDocumentId ?? null;
  let actualCollection = doc.collectionId;
  try {
    const info = await makeRequest('documents.info', { id: get('--id') });
    if (info.data) {
      actualParent = info.data.parentDocumentId ?? null;
      actualCollection = info.data.collectionId;
    }
  } catch (_) {
    // Non-fatal: we still have what documents.move returned.
  }

  if (has('--json')) {
    console.log(JSON.stringify({ move: res, verified: { parentDocumentId: actualParent, collectionId: actualCollection } }, null, 2));
    process.exit(0);
  }

  console.log(`✅ Move request accepted\n`);
  console.log(`ID:          ${doc.id}`);
  console.log(`Title:       ${doc.title}`);
  console.log(`Collection:  ${actualCollection}`);
  console.log(`Parent:      ${actualParent ?? '(top level)'}`);
  console.log(`URL:         ${doc.url || 'N/A'}`);

  // Optional expectation check.
  if (has('--expect-parent')) {
    const expected = parseNullable(get('--expect-parent'));
    const matches = expected === null
      ? actualParent === null
      : actualParent === expected;
    if (!matches) {
      console.error(`\n❌ EXPECTATION FAILED: parentDocumentId is ${JSON.stringify(actualParent)}, expected ${JSON.stringify(expected)}`);
      console.error(`   This usually means Outline ignored a field (e.g. wrong parameter name).`);
      process.exit(2);
    }
    console.log(`\n✔ Verified: parentDocumentId matches expected (${expected ?? 'top level'}).`);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}