#!/usr/bin/env node
import { makeRequest, uploadAttachment } from './lib/outline-api.js';
import { readFileSync, existsSync } from 'fs';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

// Collect all --attach values (can be specified multiple times)
const getMulti = (flag) => {
  const result = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === flag) result.push(args[i + 1]);
  }
  return result;
};

if (has('--help') || !get('--id')) {
  console.log(`Usage: update.js --id <uuid> [--instance <name>] [--title <text>] [--text <markdown>] [--mode <replace|append|prepend>] [--json] [--attach <file> [--attach <file> ...]] [--attach-name <name>]`);
  console.log(`If --text is omitted, reads from stdin.`);
  console.log(`\n--attach <file>     Attach a file to the document. Can be repeated for multiple files.`);
  console.log(`--attach-name <n>   Display name for the last --attach file (optional).`);
  process.exit(get('--id') ? 0 : 1);
}

try {
  let text = get('--text');
  if (!text && !process.stdin.isTTY) {
    text = readFileSync(0, 'utf-8');
  }

  const mode = get('--mode') || 'replace';
  const attachFiles = getMulti('--attach');
  const attachName = get('--attach-name');

  // If there are attachments, we need to handle them
  if (attachFiles.length > 0) {
    // First, update the document text if provided
    if (text) {
      const body = { id: get('--id'), done: true };
      if (get('--title')) body.title = get('--title');
      if (mode === 'append') {
        body.text = text;
        body.append = true;
      } else if (mode === 'prepend') {
        const current = await makeRequest('documents.info', { id: get('--id') });
        body.text = text + '\n' + (current.data.text || '');
      } else {
        body.text = text;
      }
      await makeRequest('documents.update', body);
    } else if (get('--title')) {
      // Just update title
      await makeRequest('documents.update', { id: get('--id'), title: get('--title'), done: true });
    }

    // Upload and attach files
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
        name = filePath.split('/').pop();
      }

      const { attachment } = await uploadAttachment({
        filePath,
        name,
        contentType,
        documentId: get('--id'),
      });

      const link = `[${attachment.name}](/api/attachments.redirect?id=${attachment.id})`;
      attachedLinks.push(link);
    }

    // Append attachment links to the document
    if (attachedLinks.length > 0) {
      const attachText = '\n\n---\n\n**Вложения:**\n' + attachedLinks.map(l => `- ${l}`).join('\n');
      await makeRequest('documents.update', {
        id: get('--id'),
        text: attachText,
        append: true,
      });
    }

    // Fetch updated document for display
    const updated = await makeRequest('documents.info', { id: get('--id') });
    const doc = updated.data;

    if (has('--json')) { console.log(JSON.stringify(updated, null, 2)); process.exit(0); }

    console.log(`✅ Document updated\n`);
    console.log(`ID: ${doc.id}`);
    console.log(`Title: ${doc.title}`);
    console.log(`Mode: ${mode}`);
    console.log(`URL: ${doc.url || 'N/A'}`);
    if (attachedLinks.length > 0) {
      console.log(`Attachments: ${attachedLinks.length} file(s) attached`);
      attachedLinks.forEach(l => console.log(`  - ${l}`));
    }
  } else {
    // No attachments — original flow
    const body = { id: get('--id'), done: true };
    if (get('--title')) body.title = get('--title');
    if (text) {
      if (mode === 'append') {
        body.text = text;
        body.append = true;
      } else if (mode === 'prepend') {
        const current = await makeRequest('documents.info', { id: get('--id') });
        body.text = text + '\n' + (current.data.text || '');
      } else {
        body.text = text;
      }
    }

    const res = await makeRequest('documents.update', body);
    const doc = res.data;

    if (has('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }

    console.log(`✅ Document updated\n`);
    console.log(`ID: ${doc.id}`);
    console.log(`Title: ${doc.title}`);
    console.log(`Mode: ${mode}`);
    console.log(`URL: ${doc.url || 'N/A'}`);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}