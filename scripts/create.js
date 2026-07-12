#!/usr/bin/env node
import { makeRequest, uploadAttachment } from './lib/outline-api.js';
import { readFileSync, existsSync } from 'fs';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
};
const has = (flag) => args.includes(flag);

// Collect all --attach values (can be specified multiple times)
const getMulti = (flag) => {
  const result = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === flag) result.push(args[i + 1]);
  }
  return result;
};

// Strict flag validation: anything starting with "-" that is not in this set
// is treated as a typo / unknown option and fails loudly. Catches accidental
// flags like --input/--path that the script does not implement.
const VALID_FLAGS = [
  '--help',
  '--title', '--text', '--file',
  '--collection', '--parent',
  '--publish',
  '--json',
  '--attach', '--attach-name',
];

if (has('--help')) {
  console.log(`Usage: create.js --title <text> [content source] [options]`);
  console.log(``);
  console.log(`Content source (exactly one of):`);
  console.log(`  --text <markdown>     Inline markdown body`);
  console.log(`  --file <path>         Read markdown body from file`);
  console.log(`  stdin                 Pipe markdown via stdin (e.g. cat doc.md | create.js ...)`);
  console.log(``);
  console.log(`Options:`);
  console.log(`  --collection <id>     Target collection UUID`);
  console.log(`  --parent <id>         Parent document UUID`);
  console.log(`  --publish             Publish immediately (otherwise draft)`);
  console.log(`  --json                Output raw API response as JSON`);
  console.log(`  --attach <file>        Attach a file to the document (repeatable)`);
  console.log(`  --attach-name <name>   Display name for the last --attach file`);
  console.log(``);
  console.log(`Source priority if multiple are provided: --file > --text > stdin.`);
  console.log(`If only one source resolves to non-empty content, that source is used.`);
  process.exit(0);
}

for (const arg of args) {
  if (arg.startsWith('-') && !VALID_FLAGS.includes(arg)) {
    console.error(`Error: unknown flag "${arg}".`);
    console.error(`Allowed flags: ${VALID_FLAGS.join(', ')}`);
    process.exit(1);
  }
}

const title = get('--title');
if (!title) {
  console.error(`Error: --title is required.`);
  console.error(`Run with --help for usage.`);
  process.exit(1);
}

const filePath = get('--file');
if (filePath && !existsSync(filePath)) {
  console.error(`Error: --file path does not exist: ${filePath}`);
  process.exit(1);
}

try {
  // Resolve content. Priority: --file > --text > stdin.
  // Each source contributes only if it actually carries content; this way
  // a stray empty --text="" or empty stdin does not silently empty the doc.
  let text = '';
  let usedSource = null;

  if (filePath) {
    const fromFile = readFileSync(filePath, 'utf-8');
    if (fromFile.length > 0) {
      text = fromFile;
      usedSource = `--file ${filePath}`;
    }
  }

  if (!text && get('--text')) {
    text = get('--text');
    usedSource = '--text';
  }

  if (!text && !process.stdin.isTTY) {
    const fromStdin = readFileSync(0, 'utf-8');
    if (fromStdin.length > 0) {
      text = fromStdin;
      usedSource = 'stdin';
    }
  }

  if (!text) {
    console.error(`Error: document body is empty.`);
    console.error(`Provide exactly one of: --text <markdown>, --file <path>, or pipe via stdin.`);
    console.error(`Run with --help for usage.`);
    process.exit(1);
  }

  const body = { title, text };
  if (get('--collection')) body.collectionId = get('--collection');
  if (get('--parent')) body.parentDocumentId = get('--parent');
  if (has('--publish')) body.publish = true;

  const res = await makeRequest('documents.create', body);
  const doc = res.data;

  // Process attachments if any
  const attachFiles = getMulti('--attach');
  const attachName = get('--attach-name');
  const attachedLinks = [];

  if (attachFiles.length > 0) {
    for (let i = 0; i < attachFiles.length; i++) {
      const filePath = attachFiles[i];
      if (!existsSync(filePath)) {
        console.error(`Warning: file not found, skipping: ${filePath}`);
        continue;
      }

      // Determine content type from extension
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

      // Use --attach-name for the last file if provided
      let name;
      if (i === attachFiles.length - 1 && attachName) {
        name = attachName;
      } else {
        name = filePath.split('/').pop();
      }

      const { attachment } = await uploadAttachment({
        filePath,
        name,
        contentType,
        documentId: doc.id,
      });

      const link = `[${attachment.name}](/api/attachments.redirect?id=${attachment.id})`;
      attachedLinks.push(link);
    }

    // Append attachment links to the document
    if (attachedLinks.length > 0) {
      const attachText = '\n\n---\n\n**Вложения:**\n' + attachedLinks.map(l => `- ${l}`).join('\n');
      await makeRequest('documents.update', {
        id: doc.id,
        text: attachText,
        append: true,
      });
    }
  }

  if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

  console.log(`✅ Document created\n`);
  console.log(`ID: ${doc.id}`);
  console.log(`Title: ${doc.title}`);
  console.log(`Status: ${doc.publishedAt ? 'published' : 'draft'}`);
  console.log(`Source: ${usedSource}`);
  console.log(`URL: ${doc.url || 'N/A'}`);
  if (attachedLinks.length > 0) {
    console.log(`Attachments: ${attachedLinks.length} file(s) attached`);
    attachedLinks.forEach(l => console.log(`  - ${l}`));
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}