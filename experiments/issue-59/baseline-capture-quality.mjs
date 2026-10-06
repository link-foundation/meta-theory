// Check captured output with the unchanged pre-issue test, without recapturing.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const [output, ref = '087f4515d0652925eecc54bcade724445c3978f1'] = process.argv.slice(2);
if (!output) throw new Error('Usage: node experiments/issue-59/baseline-capture-quality.mjs CAPTURE_OUTPUT [COMMIT]');
const source = execFileSync('git', ['show', `${ref}:scripts/test-capture-quality.mjs`], { cwd: root, encoding: 'utf8' });
// Keep the temporary module under the repository for dependency resolution.
const temporary = await mkdtemp(join(directory, 'baseline-'));
try {
  const script = join(temporary, 'test-capture-quality.mjs');
  await writeFile(script, source);
  const result = spawnSync(process.execPath, [script, '--skip-capture', '--output', resolve(output)], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { await rm(temporary, { recursive: true, force: true }); }
