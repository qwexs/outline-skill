import { unlinkSync } from 'fs';
import { resolve } from 'path';

const TEMP_DIR_NAMES = new Set(['tmp', 'temp', '.tmp']);

/** True when any resolved path segment is a temp directory name. */
export function isTempSourcePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  return resolve(filePath)
    .split(/[/\\]/)
    .filter(Boolean)
    .some((part) => TEMP_DIR_NAMES.has(part.toLowerCase()));
}

/**
 * Unlink input files that live under tmp/temp/.tmp after a successful upload.
 * Paths outside those directories are never deleted. `--keep` skips all unlinks.
 */
export function unlinkTempSources(filePaths, { keep = false } = {}) {
  if (keep) return [];
  const cleaned = [];
  const seen = new Set();
  for (const filePath of filePaths || []) {
    if (!filePath || seen.has(filePath)) continue;
    seen.add(filePath);
    if (!isTempSourcePath(filePath)) continue;
    try {
      unlinkSync(filePath);
      cleaned.push(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Warning: could not remove temp source ${filePath}: ${err.message}`);
      }
    }
  }
  return cleaned;
}

export function printCleaned(cleaned) {
  if (!cleaned.length) return;
  console.log(`Cleaned: ${cleaned.join(', ')}`);
}
