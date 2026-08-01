#!/usr/bin/env node
import { makeRequest, uploadAttachment, getDocumentBreadcrumb } from './lib/outline-api.js';
import { readFileSync, existsSync } from 'fs';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

const getMulti = (flag) => {
  const result = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === flag) result.push(args[i + 1]);
  }
  return result;
};

const VALID_MODES = ['replace', 'append', 'prepend', 'patch'];

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

if (has('--help') || !get('--id')) {
  console.log(`Usage: update.js --id <uuid> [--instance <name>] [--title <text>] [--text <markdown>] [--mode <replace|append|prepend|patch>] [--find <markdown>] [--json] [--attach <file> ...] [--attach-name <name>]`);
  console.log(`If --text is omitted, reads from stdin.`);
  console.log(``);
  console.log(`Modes:`);
  console.log(`  replace   Replace entire document body (must be explicit)`);
  console.log(`  append    Append text to end (uses editMode=append)`);
  console.log(`  prepend   Prepend text to beginning (uses editMode=prepend)`);
  console.log(`  patch     Surgical replace: find exact --find markdown, replace with --text`);
  console.log(`            Preserves rich formatting outside the matched region (MCP-style).`);
  console.log(``);
  console.log(`--find <md>         Required for --mode patch. Exact markdown substring from the doc.`);
  console.log(`                    Supplying --find without --mode safely infers patch mode.`);
  console.log(`--attach <file>     Attach a file to the document. Can be repeated.`);
  console.log(`--attach-name <n>   Display name for the last --attach file (optional).`);
  process.exit(has('--help') ? 0 : 1);
}

function buildUpdateBody({ id, title, text, mode, findText }) {
  const body = { id, done: true };
  if (title) body.title = title;

  if (text != null && text !== undefined) {
    if (mode === 'append') {
      body.text = text;
      body.editMode = 'append';
    } else if (mode === 'prepend') {
      body.text = text;
      body.editMode = 'prepend';
    } else if (mode === 'patch') {
      body.text = text;
      body.editMode = 'patch';
      body.findText = findText;
    } else {
      // replace
      body.text = text;
      body.editMode = 'replace';
    }
  }

  return body;
}

try {
  let text = get('--text');
  if (text == null && !process.stdin.isTTY) {
    text = readFileSync(0, 'utf-8');
  }

  const findText = get('--find');
  // Never silently turn a text update into a destructive whole-document replace.
  // `--find` is unambiguous, so preserve a convenient safe shorthand for patches.
  const mode = get('--mode') || (findText ? 'patch' : null);
  if (mode && !VALID_MODES.includes(mode)) {
    console.error(`Error: invalid --mode "${mode}". Allowed: ${VALID_MODES.join(', ')}`);
    process.exit(1);
  }
  if (text != null && !mode) {
    console.error(`Error: --mode is required when changing document text.`);
    console.error(`Use --mode patch --find "..." for a surgical edit, or --mode replace to overwrite the entire document.`);
    process.exit(1);
  }

  if (mode === 'patch') {
    if (!findText) {
      console.error(`Error: --find is required when --mode patch.`);
      console.error(`Copy the exact markdown substring from the document to replace.`);
      process.exit(1);
    }
    if (text == null) {
      console.error(`Error: --text (or stdin) is required when --mode patch.`);
      process.exit(1);
    }
  }

  const attachFiles = getMulti('--attach');
  const attachName = get('--attach-name');
  const id = get('--id');

  if (mode === 'patch') {
    const current = await makeRequest('documents.info', { id });
    const matches = countOccurrences(current.data?.text || '', findText);
    if (matches !== 1) {
      console.error(`Error: --find must match exactly once in the current document; found ${matches} matches.`);
      console.error(`Read the document again and provide a larger, unique markdown fragment.`);
      process.exit(1);
    }
  }

  // If there are attachments, update text first (if any), then attach.
  if (attachFiles.length > 0) {
    if (text != null || get('--title')) {
      if (text != null || mode === 'patch') {
        const body = buildUpdateBody({
          id,
          title: get('--title'),
          text: text != null ? text : undefined,
          mode,
          findText,
        });
        // Title-only without text
        if (text == null) {
          delete body.text;
          delete body.editMode;
          delete body.findText;
        }
        await makeRequest('documents.update', body);
      } else if (get('--title')) {
        await makeRequest('documents.update', { id, title: get('--title'), done: true });
      }
    }

    const attachedLinks = [];
    for (let i = 0; i < attachFiles.length; i++) {
      const filePath = attachFiles[i];
      if (!existsSync(filePath)) {
        console.error(`Warning: file not found, skipping: ${filePath}`);
        continue;
      }

      const ext = filePath.toLowerCase().split('.').pop();
      const mimeMap = {
        pdf: 'application/pdf',
        md: 'text/markdown',
        txt: 'text/plain',
        json: 'application/json',
        csv: 'text/csv',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        zip: 'application/zip',
      };
      const contentType = mimeMap[ext] || 'application/octet-stream';

      let name;
      if (i === attachFiles.length - 1 && attachName) {
        name = attachName;
      } else {
        name = filePath.split(/[/\\]/).pop();
      }

      const { attachment } = await uploadAttachment({
        filePath,
        name,
        contentType,
        documentId: id,
      });

      const link = `[${attachment.name}](/api/attachments.redirect?id=${attachment.id})`;
      attachedLinks.push(link);
    }

    if (attachedLinks.length > 0) {
      const attachText = '\n\n---\n\n**Вложения:**\n' + attachedLinks.map(l => `- ${l}`).join('\n');
      await makeRequest('documents.update', {
        id,
        text: attachText,
        editMode: 'append',
        done: true,
      });
    }

    const updated = await makeRequest('documents.info', { id });
    const doc = updated.data;
    let breadcrumb = null;
    try {
      breadcrumb = await getDocumentBreadcrumb(doc);
    } catch {
      /* non-fatal */
    }

    if (has('--json')) {
      console.log(JSON.stringify({ ...updated, breadcrumb }, null, 2));
      process.exit(0);
    }

    console.log(`✅ Document updated\n`);
    console.log(`ID: ${doc.id}`);
    console.log(`Title: ${doc.title}`);
    console.log(`Mode: ${mode}`);
    if (breadcrumb?.path) console.log(`Path: ${breadcrumb.path}`);
    console.log(`URL: ${doc.url || 'N/A'}`);
    if (attachedLinks.length > 0) {
      console.log(`Attachments: ${attachedLinks.length} file(s) attached`);
      attachedLinks.forEach(l => console.log(`  - ${l}`));
    }
  } else {
    // No attachments — main flow
    if (text == null && !get('--title')) {
      console.error(`Error: nothing to update. Provide --text/--title or stdin.`);
      process.exit(1);
    }

    const body = buildUpdateBody({
      id,
      title: get('--title'),
      text: text != null ? text : undefined,
      mode,
      findText,
    });
    if (text == null) {
      delete body.text;
      delete body.editMode;
      delete body.findText;
    }

    const res = await makeRequest('documents.update', body);
    const doc = res.data;
    let breadcrumb = null;
    try {
      breadcrumb = await getDocumentBreadcrumb(doc);
    } catch {
      /* non-fatal */
    }

    if (has('--json')) {
      console.log(JSON.stringify({ ...res, breadcrumb }, null, 2));
      process.exit(0);
    }

    console.log(`✅ Document updated\n`);
    console.log(`ID: ${doc.id}`);
    console.log(`Title: ${doc.title}`);
    console.log(`Mode: ${mode}`);
    if (mode === 'patch' && findText) {
      const preview = findText.length > 60 ? findText.slice(0, 60) + '…' : findText;
      console.log(`Find: ${preview.replace(/\n/g, '\\n')}`);
    }
    if (breadcrumb?.path) console.log(`Path: ${breadcrumb.path}`);
    console.log(`URL: ${doc.url || 'N/A'}`);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
