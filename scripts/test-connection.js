#!/usr/bin/env node
import {
  getClient,
  listInstances,
  getDefaultInstanceName,
  parseInstanceFlag,
} from './lib/outline-api.js';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const wantAll = has('--all');

if (has('--help')) {
  console.log(`Usage: test-connection.js [--instance <name>|-i <name>] [--all] [--json]
  --instance / -i   Test one instance (default: config.defaultInstance)
  --all             Test every configured instance
  --json            Machine-readable output`);
  process.exit(0);
}

async function testOne(name) {
  const client = getClient(name);
  const result = await client.makeRequest('collections.list', {});
  return {
    ok: true,
    instance: client.name,
    origin: client.outlineOrigin,
    baseUrl: client.baseUrl,
    collections: result.data?.length ?? 0,
    isDefault: client.isDefault,
  };
}

try {
  const names = wantAll
    ? listInstances()
    : [parseInstanceFlag() || getDefaultInstanceName()];

  if (!names.length) {
    console.error('No Outline instances configured in config.json');
    process.exit(1);
  }

  const results = [];
  let failed = 0;

  for (const name of names) {
    try {
      const r = await testOne(name);
      results.push(r);
      if (!has('--json')) {
        const mark = r.isDefault ? ' (default)' : '';
        console.log(
          `✅ [${r.instance}]${mark} ${r.origin} — ${r.collections} collections`
        );
      }
    } catch (err) {
      failed++;
      results.push({ ok: false, instance: name, error: err.message });
      if (!has('--json')) {
        console.error(`❌ [${name}] ${err.message}`);
      }
    }
  }

  if (has('--json')) {
    console.log(JSON.stringify({ results }, null, 2));
  } else if (wantAll) {
    console.log(
      `\n${results.filter((r) => r.ok).length}/${results.length} instances OK`
    );
  }

  process.exit(failed ? 1 : 0);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
