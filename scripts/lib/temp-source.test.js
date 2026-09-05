import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { isTempSourcePath, unlinkTempSources } from './temp-source.js';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sandboxes = [];

function sandbox() {
  const root = mkdtempSync(join(skillRoot, '.test-'));
  sandboxes.push(root);
  return root;
}

afterEach(() => {
  while (sandboxes.length) {
    rmSync(sandboxes.pop(), { recursive: true, force: true });
  }
});

describe('isTempSourcePath', () => {
  test('matches tmp/temp/.tmp as a directory segment', () => {
    expect(isTempSourcePath('/Users/qwexs/Work/lomon/infoboard/tmp/infoboard-roadmap.md')).toBe(true);
    expect(isTempSourcePath('/var/tmp/body.md')).toBe(true);
    expect(isTempSourcePath('/tmp/body.md')).toBe(true);
    expect(isTempSourcePath('/proj/.tmp/patch.md')).toBe(true);
    expect(isTempSourcePath('/proj/temp/patch.md')).toBe(true);
    expect(isTempSourcePath('/Proj/TMP/Body.md')).toBe(true);
  });

  test('does not match ordinary project files', () => {
    expect(isTempSourcePath('/Users/qwexs/Work/lomon/infoboard/docs/readme.md')).toBe(false);
    expect(isTempSourcePath('/Users/qwexs/Work/lomon/infoboard/tmp.md')).toBe(false);
    expect(isTempSourcePath('/Users/qwexs/Work/lomon/infoboard/templates/note.md')).toBe(false);
  });

  test('resolve() drops a tmp prefix that is only a .. hop', () => {
    const root = sandbox();
    const decoy = join(root, 'tmp', '..', 'docs', 'keep.md');
    expect(isTempSourcePath(decoy)).toBe(false);
  });

  test('ignores empty values', () => {
    expect(isTempSourcePath('')).toBe(false);
    expect(isTempSourcePath(null)).toBe(false);
    expect(isTempSourcePath(undefined)).toBe(false);
  });
});

describe('unlinkTempSources', () => {
  test('deletes files under tmp after success, leaves others', () => {
    const root = sandbox();
    const tmpFile = join(root, 'tmp', 'body.md');
    const docsFile = join(root, 'docs', 'keep.md');
    mkdirSync(dirname(tmpFile), { recursive: true });
    mkdirSync(dirname(docsFile), { recursive: true });
    writeFileSync(tmpFile, '# body\n');
    writeFileSync(docsFile, '# keep\n');

    const cleaned = unlinkTempSources([tmpFile, docsFile, tmpFile, null]);
    expect(cleaned).toEqual([tmpFile]);
    expect(existsSync(tmpFile)).toBe(false);
    expect(existsSync(docsFile)).toBe(true);
  });

  test('--keep skips deletion', () => {
    const root = sandbox();
    const tmpFile = join(root, 'tmp', 'body.md');
    mkdirSync(dirname(tmpFile), { recursive: true });
    writeFileSync(tmpFile, '# body\n');

    const cleaned = unlinkTempSources([tmpFile], { keep: true });
    expect(cleaned).toEqual([]);
    expect(existsSync(tmpFile)).toBe(true);
  });

  test('missing temp files are ignored', () => {
    const root = sandbox();
    const missing = join(root, 'tmp', 'gone.md');
    mkdirSync(dirname(missing), { recursive: true });
    expect(unlinkTempSources([missing])).toEqual([]);
  });
});
