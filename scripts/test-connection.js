import { makeRequest } from './lib/outline-api.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '..', 'config.json'), 'utf-8'));

const instanceUrl = new URL(config.baseUrl).origin;

// ⚠️ Guard: предупредить, если baseUrl указывает на placeholder/example.com.
// Это типичная ошибка, когда агент копирует шаблон из SKILL.md вместо config.json.
if (/example\.com|REPLACE_WITH/i.test(config.baseUrl)) {
  console.error(`❌ baseUrl указывает на placeholder: ${config.baseUrl}`);
  console.error(`   Откройте config.json и замените на реальный URL вашего Outline.`);
  console.error(`   Не публикуйте URL с placeholder-ом в чат или документы.`);
  process.exit(1);
}

try {
  const result = await makeRequest('collections.list', {});
  console.log(`✅ Connected to ${instanceUrl} — ${result.data.length} collections`);
} catch (err) {
  console.error(`❌ Connection failed: ${err.message}`);
  process.exit(1);
}
