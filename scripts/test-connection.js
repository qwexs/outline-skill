import { makeRequest } from './lib/outline-api.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '..', 'config.json'), 'utf-8'));

try {
  const result = await makeRequest('collections.list', {});
  const instanceUrl = new URL(config.baseUrl).origin;
  console.log(`✅ Connected to ${instanceUrl} — ${result.data.length} collections`);
} catch (err) {
  console.error(`❌ Connection failed: ${err.message}`);
  process.exit(1);
}
