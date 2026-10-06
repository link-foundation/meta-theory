import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Isolate the old CLI's profile handling and recovery-artifact ordering while
// retaining the current extraction helpers. Only a finite local fixture runs.
const baseline = execFileSync('git', ['show', 'b93a49b:scripts/habr-article-sync.mjs'], { encoding: 'utf8' })
  .replace(/'\.\/([^']+\.mjs)'/g, (_, file) => `'${pathToFileURL(resolve('scripts', file)).href}'`);
mkdirSync('.browser', { recursive: true });
const script = resolve('.browser/habr-sync-baseline.mjs');
writeFileSync(script, baseline);
const result = spawnSync(process.execPath, ['--test', '--test-name-pattern',
  'failed visual prefill|prefill blocks autosave', 'tests/habr-cli.test.mjs'], {
  env: { ...process.env, HABR_TEST_CLI_SCRIPT: script }, encoding: 'utf8'
});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.error) throw result.error;
if (result.status !== 1 || !result.stdout.includes('# fail 2')) {
  throw new Error(`Expected both baseline regressions to fail; status ${result.status}`);
}
