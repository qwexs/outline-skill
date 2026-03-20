#!/usr/bin/env node
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--collection')) {
  console.log(`Usage: tree.js --collection <id> [--json]

Shows hierarchical document structure of a collection.

Options:
  --collection <id>  Collection ID (required)
  --json             Output raw documentStructure as JSON`);
  process.exit(has('--help') ? 0 : 1);
}

function countNodes(nodes) {
  let c = 0;
  for (const n of nodes) { c++; if (n.children?.length) c += countNodes(n.children); }
  return c;
}

function printTree(nodes, indent = '') {
  for (const node of nodes) {
    const icon = node.children?.length > 0 ? '📁' : '📄';
    console.log(`${indent}${icon} ${node.title}`);
    if (node.children?.length > 0) printTree(node.children, indent + '  ');
  }
}

try {
  const res = await makeRequest('collections.documents', { id: get('--collection') });
  const structure = res.data || [];

  if (has('--json')) { console.log(JSON.stringify(structure, null, 2)); process.exit(0); }

  // Get collection info
  const colRes = await makeRequest('collections.info', { id: get('--collection') });
  const col = colRes.data || {};
  const total = countNodes(structure);
  console.log(`Collection: ${col.name || get('--collection')} (${total} documents)\n`);
  printTree(structure);
} catch (e) {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
}
