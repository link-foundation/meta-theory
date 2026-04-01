#!/usr/bin/env node

/**
 * File size limit verification script.
 *
 * Checks that all Rocq (.v), Lean (.lean), and Markdown (.md) files
 * in the drafts/ directory do not exceed the maximum line count.
 *
 * Usage:
 *   node scripts/check-file-size.mjs
 *
 * Exit code:
 *   0 - all files are within the limit
 *   1 - one or more files exceed the limit
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const MAX_LINES = 1500;
const CHECKED_EXTENSIONS = ['.v', '.lean', '.md'];
const SEARCH_DIR = join(ROOT_DIR, 'drafts');

/**
 * Recursively find all files with given extensions
 */
function findFiles(dir, extensions) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...findFiles(fullPath, extensions));
      } else if (extensions.includes(extname(entry).toLowerCase())) {
        results.push(fullPath);
      }
    } catch {
      // skip inaccessible files
    }
  }
  return results;
}

function main() {
  console.log(`Checking file size limits (max ${MAX_LINES} lines)...`);
  console.log(`Extensions: ${CHECKED_EXTENSIONS.join(', ')}`);
  console.log(`Directory: ${SEARCH_DIR}\n`);

  const files = findFiles(SEARCH_DIR, CHECKED_EXTENSIONS);
  let hasErrors = false;
  let checkedCount = 0;

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    const lineCount = content.split('\n').length;
    const relativePath = filePath.replace(ROOT_DIR + '/', '');
    checkedCount++;

    if (lineCount > MAX_LINES) {
      console.log(`  FAIL  ${relativePath}: ${lineCount} lines (max ${MAX_LINES})`);
      hasErrors = true;
    } else {
      console.log(`  OK    ${relativePath}: ${lineCount} lines`);
    }
  }

  console.log(`\nChecked ${checkedCount} files.`);

  if (hasErrors) {
    console.log('\nFAIL: Some files exceed the maximum line count.');
    process.exit(1);
  } else {
    console.log('\nAll files are within the limit.');
    process.exit(0);
  }
}

main();
