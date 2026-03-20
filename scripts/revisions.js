#!/usr/bin/env node
/**
 * Outline Wiki - Document Revisions (History)
 * 
 * Usage:
 *   node revisions.js --id <document-uuid>                    # List all revisions
 *   node revisions.js --id <document-uuid> --rev <revision>   # Show specific revision content
 *   node revisions.js --id <document-uuid> --rev latest       # Show latest revision with content
 *   node revisions.js --id <document-uuid> --rev 1            # Show revision by index (1 = newest)
 *   node revisions.js --id <document-uuid> --json             # JSON output
 */
import { makeRequest } from './lib/outline-api.js';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

if (has('--help') || !get('--id')) {
  console.log(`Usage: revisions.js --id <document-uuid> [--rev <index|uuid|latest>] [--json]

List document revision history or show a specific revision's content.

Options:
  --id <uuid>       Document ID (required)
  --rev <value>     Show specific revision:
                      - "latest" or "1" = most recent
                      - number (1-N) = revision by index (1 = newest)
                      - UUID = specific revision ID
  --json            JSON output

Examples:
  node revisions.js --id abc123                    # List all revisions
  node revisions.js --id abc123 --rev 2            # Show 2nd most recent revision
  node revisions.js --id abc123 --rev latest       # Show latest revision content`);
  process.exit(get('--id') ? 0 : 1);
}

/**
 * Extract plain text from ProseMirror JSON (Outline's internal format)
 */
function prosemirrorToMarkdown(node, depth = 0) {
  if (!node) return '';
  let result = '';

  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level || 1;
      result += '\n' + '#'.repeat(level) + ' ';
      break;
    }
    case 'paragraph':
      break;
    case 'code_block':
      result += '\n```' + (node.attrs?.language || '') + '\n';
      break;
    case 'blockquote':
      result += '\n> ';
      break;
    case 'bullet_list':
    case 'ordered_list':
      break;
    case 'list_item':
      result += '- ';
      break;
    case 'table':
      break;
    case 'table_row':
      result += '| ';
      break;
    case 'table_cell':
    case 'table_header':
      break;
    case 'horizontal_rule':
      result += '\n---\n';
      break;
    case 'image':
      result += `![${node.attrs?.alt || ''}](${node.attrs?.src || ''})`;
      break;
  }

  // Process text nodes
  if (node.text) {
    let text = node.text;
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') text = `**${text}**`;
        else if (mark.type === 'italic') text = `*${text}*`;
        else if (mark.type === 'code_inline') text = `\`${text}\``;
        else if (mark.type === 'link') text = `[${text}](${mark.attrs?.href || ''})`;
      }
    }
    result += text;
  }

  // Process children
  if (node.content) {
    for (const child of node.content) {
      result += prosemirrorToMarkdown(child, depth + 1);
    }
  }

  // Closing
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      result += '\n';
      break;
    case 'code_block':
      result += '```\n';
      break;
    case 'list_item':
      result += '\n';
      break;
    case 'table_cell':
    case 'table_header':
      result += ' | ';
      break;
    case 'table_row':
      result += '\n';
      break;
  }

  return result;
}

try {
  const docId = get('--id');
  const revArg = get('--rev');
  const isJson = has('--json');

  // List revisions
  const res = await makeRequest('revisions.list', { documentId: docId });
  const revisions = res.data || [];

  if (revisions.length === 0) {
    console.log('No revisions found.');
    process.exit(0);
  }

  // If --rev specified, show specific revision content
  if (revArg) {
    let revisionId;

    if (revArg === 'latest' || revArg === '1') {
      revisionId = revisions[0].id;
    } else if (/^\d+$/.test(revArg)) {
      const idx = parseInt(revArg) - 1;
      if (idx < 0 || idx >= revisions.length) {
        console.error(`❌ Revision index ${revArg} out of range (1-${revisions.length})`);
        process.exit(1);
      }
      revisionId = revisions[idx].id;
    } else {
      revisionId = revArg; // Assume UUID
    }

    const revRes = await makeRequest('revisions.info', { id: revisionId });
    const rev = revRes.data;

    if (isJson) {
      console.log(JSON.stringify(rev, null, 2));
      process.exit(0);
    }

    console.log(`📄 Revision: ${rev.id}`);
    console.log(`📝 Title: ${rev.title}`);
    console.log(`👤 Author: ${rev.createdBy?.name || rev.createdById || 'unknown'}`);
    console.log(`📅 Date: ${rev.createdAt}`);
    console.log(`\n---\n`);

    // Convert ProseMirror JSON to readable text
    const data = typeof rev.data === 'string' ? JSON.parse(rev.data) : rev.data;
    if (data) {
      const markdown = prosemirrorToMarkdown(data).trim();
      console.log(markdown);
    } else {
      console.log('(no content)');
    }
  } else {
    // List mode
    if (isJson) {
      console.log(JSON.stringify(revisions.map((r, i) => ({
        index: i + 1,
        id: r.id,
        title: r.title,
        createdAt: r.createdAt,
        createdBy: r.createdBy?.name || r.createdById,
      })), null, 2));
      process.exit(0);
    }

    console.log(`📚 ${revisions.length} revision(s) for document ${docId}\n`);
    revisions.forEach((r, i) => {
      const date = r.createdAt?.slice(0, 19).replace('T', ' ');
      const author = r.createdBy?.name || r.createdById || '';
      console.log(`  ${i + 1}. [${date}] ${r.title} (by ${author})`);
      console.log(`     ID: ${r.id}`);
    });
    console.log(`\nUse --rev <index> to view a specific revision's content.`);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
