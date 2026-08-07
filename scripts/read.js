#!/usr/bin/env node
import { makeRequest, getDocumentBreadcrumb } from './lib/outline-api.js';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--id')) {
  console.log(`Usage: read.js --id <uuid-or-slug> [--instance <name>] [--json] [--no-breadcrumb] [--lines <start>[-[end]]] [--from-line <n>] [--to-line <n>] [--line-numbers] [--output-file <path>] [--as-file]`);
  process.exit(get('--id') ? 0 : 1);
}

const id = get('--id');
// Outline API accepts either a UUID or a URL slug. Validate locally so the
// agent gets a clear hint instead of a raw 400 from the server.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[A-Za-z0-9]{8,10}$/;
if (!UUID_RE.test(id) && !SLUG_RE.test(id)) {
  console.error(`Error: '${id}' is not a valid UUID or Outline URL slug.`);
  console.error(`Hint: copy the slug from the document URL (/doc/...-<slug>), or the UUID from search.js output.`);
  process.exit(1);
}

try {
  const res = await makeRequest('documents.info', { id });
  const doc = res.data;

  let breadcrumb = null;
  if (!has('--no-breadcrumb')) {
    try {
      breadcrumb = await getDocumentBreadcrumb(doc);
    } catch {
      /* non-fatal */
    }
  }

  // ── Line selection (1-based, inclusive) ─────────────────────────────
  // Forms: --lines 10-20 | --lines 10- | --lines 10
  // or --from-line / --to-line (either one may be omitted).
  // Printed numbers are ABSOLUTE document line numbers so the agent can
  // map them back to further --lines reads.
  const allLines = (doc.text || '').split('\n');
  let startLine = 1;
  let endLine = allLines.length;
  let selected = false;

  const parseLineNumber = (value, flag) => {
    if (!/^\d+$/.test(value || '')) {
      throw new Error(`${flag} expects a positive integer, got '${value}'`);
    }
    return Math.max(1, parseInt(value, 10));
  };

  const linesArg = get('--lines');
  if (linesArg) {
    const m = linesArg.match(/^(\d+)(?:-(\d*))?$/);
    if (!m) throw new Error(`--lines expects N, N-M or N-, got '${linesArg}'`);
    startLine = Math.max(1, parseInt(m[1], 10));
    if (m[2] === undefined) {
      endLine = startLine; // --lines N → single line
    } else if (m[2] === '') {
      endLine = allLines.length; // --lines N- → until end
    } else {
      endLine = parseInt(m[2], 10); // --lines N-M
    }
    selected = true;
  } else if (get('--from-line') || get('--to-line')) {
    if (get('--from-line')) startLine = parseLineNumber(get('--from-line'), '--from-line');
    if (get('--to-line')) endLine = parseLineNumber(get('--to-line'), '--to-line');
    selected = true;
  }

  if (selected) {
    if (startLine > allLines.length) {
      throw new Error(`line range starts at ${startLine}, but the document has only ${allLines.length} line(s)`);
    }
    if (endLine < startLine) {
      throw new Error(`line range end (${endLine}) is before start (${startLine})`);
    }
    endLine = Math.min(endLine, allLines.length);
  }

  const selectedLines = allLines.slice(startLine - 1, endLine);
  const selectedText = selectedLines.join('\n');

  if (has('--json')) {
    const output = { ...res, breadcrumb };
    if (selected) {
      output.selectedLines = `${startLine}-${endLine}`;
      // Keep only the selected slice in data.text to save the agent's context.
      output.data = { ...doc, text: selectedText };
    }
    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  }

  // ── File output mode (agent treats the doc like a local .md file) ────
  // --output-file <path> writes to path (respected as-is);
  // --as-file writes to a temp .md and prints its path.
  let outputFilePath = get('--output-file');
  if (!outputFilePath && has('--as-file')) {
    outputFilePath = `${tmpdir()}/outline-doc-${doc.id}-${Date.now()}.md`;
  }
  if (outputFilePath) {
    writeFileSync(outputFilePath, selectedText, 'utf-8');
  }

  console.log(`Title: ${doc.title}`);
  if (breadcrumb?.path) {
    console.log(`Path: ${breadcrumb.path}`);
  } else if (doc.collection) {
    console.log(`Collection: ${doc.collection.name || 'N/A'}`);
  }
  console.log(`ID: ${doc.id}`);
  if (selected) {
    console.log(`Selected lines: ${startLine}-${endLine} of ${allLines.length}`);
  }
  console.log(`Updated: ${doc.updatedAt?.slice(0, 10) || 'N/A'}`);
  if (doc.url) console.log(`URL: ${doc.url}`);

  if (outputFilePath) {
    console.log(`📄 File: ${outputFilePath}`);
  } else {
    console.log(`\n---\n`);
    if ((selected || has('--line-numbers')) && selectedText) {
      const width = String(endLine).length;
      for (let i = 0; i < selectedLines.length; i++) {
        console.log(`${String(startLine + i).padStart(width)}: ${selectedLines[i]}`);
      }
    } else {
      console.log(selectedText || '(empty)');
    }
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
