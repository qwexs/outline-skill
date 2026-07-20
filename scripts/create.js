#!/usr/bin/env node
import { makeRequest, uploadAttachment, getDocumentBreadcrumb } from './lib/outline-api.js';
import { readFileSync, existsSync } from 'fs';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
};
const has = (flag) => args.includes(flag);

const getMulti = (flag) => {
  const result = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === flag) result.push(args[i + 1]);
  }
  return result;
};

const VALID_FLAGS = [
  '--help',
  '--instance', '-i',
  '--title', '--text', '--file',
  '--collection', '--parent',
  '--template-id', '--templateId',
  '--publish',
  '--json',
  '--attach', '--attach-name',
];

if (has('--help')) {
  console.log(`Usage: create.js --title <text> [content source] [options]`);
  console.log(``);
  console.log(`Content source (one of, optional if --template-id provides body):`);
  console.log(`  --text <markdown>     Inline markdown body`);
  console.log(`  --file <path>         Read markdown body from file`);
  console.log(`  stdin                 Pipe markdown via stdin`);
  console.log(`  --template-id <uuid>  Prefill from template (body used unless --text/--file/stdin given)`);
  console.log(``);
  console.log(`Options:`);
  console.log(`  --collection <id>     Target collection UUID`);
  console.log(`  --parent <id>         Parent document UUID`);
  console.log(`  --publish             Publish immediately (otherwise draft)`);
  console.log(`  --json                Output raw API response as JSON`);
  console.log(`  --attach <file>        Attach a file to the document (repeatable)`);
  console.log(`  --attach-name <name>   Display name for the last --attach file`);
  console.log(``);
  console.log(`Source priority if multiple are provided: --file > --text > stdin > template body.`);
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
const templateId = get('--template-id') || get('--templateId');

if (!title && !templateId) {
  console.error(`Error: --title is required (or pass --template-id and let template supply the title).`);
  console.error(`Run with --help for usage.`);
  process.exit(1);
}

const filePath = get('--file');
if (filePath && !existsSync(filePath)) {
  console.error(`Error: --file path does not exist: ${filePath}`);
  process.exit(1);
}

try {
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

  // Template without override body is allowed — Outline fills from template.
  if (!text && !templateId) {
    console.error(`Error: document body is empty.`);
    console.error(`Provide one of: --text, --file, stdin, or --template-id.`);
    console.error(`Run with --help for usage.`);
    process.exit(1);
  }

  if (!text && templateId) {
    usedSource = `--template-id ${templateId}`;
  }

  const body = {};
  if (title) body.title = title;
  if (text) body.text = text;
  if (get('--collection')) body.collectionId = get('--collection');
  if (get('--parent')) body.parentDocumentId = get('--parent');
  if (templateId) body.templateId = templateId;
  if (has('--publish')) body.publish = true;

  const res = await makeRequest('documents.create', body);
  const doc = res.data;

  const attachFiles = getMulti('--attach');
  const attachName = get('--attach-name');
  const attachedLinks = [];

  if (attachFiles.length > 0) {
    for (let i = 0; i < attachFiles.length; i++) {
      const fp = attachFiles[i];
      if (!existsSync(fp)) {
        console.error(`Warning: file not found, skipping: ${fp}`);
        continue;
      }

      const ext = fp.toLowerCase().split('.').pop();
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
        name = fp.split(/[/\\]/).pop();
      }

      const { attachment } = await uploadAttachment({
        filePath: fp,
        name,
        contentType,
        documentId: doc.id,
      });

      const link = `[${attachment.name}](/api/attachments.redirect?id=${attachment.id})`;
      attachedLinks.push(link);
    }

    if (attachedLinks.length > 0) {
      const attachText = '\n\n---\n\n**Вложения:**\n' + attachedLinks.map(l => `- ${l}`).join('\n');
      await makeRequest('documents.update', {
        id: doc.id,
        text: attachText,
        editMode: 'append',
        done: true,
      });
    }
  }

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

  console.log(`✅ Document created\n`);
  console.log(`ID: ${doc.id}`);
  console.log(`Title: ${doc.title}`);
  console.log(`Status: ${doc.publishedAt ? 'published' : 'draft'}`);
  console.log(`Source: ${usedSource}`);
  if (templateId) console.log(`Template: ${templateId}`);
  if (breadcrumb?.path) console.log(`Path: ${breadcrumb.path}`);
  console.log(`URL: ${doc.url || 'N/A'}`);
  if (attachedLinks.length > 0) {
    console.log(`Attachments: ${attachedLinks.length} file(s) attached`);
    attachedLinks.forEach(l => console.log(`  - ${l}`));
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
