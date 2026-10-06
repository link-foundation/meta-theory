import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { installReadOnlyNetworkGuard } from '../../scripts/habr-editor.mjs';

// --baseline runs the exact guard from the previous PR head without changing
// working-tree files. This finite local probe never contacts Habr.
let install = installReadOnlyNetworkGuard;
if (process.argv.includes('--baseline')) {
  const source = execFileSync('git', ['show', 'b93a49b:scripts/habr-editor.mjs'], { encoding: 'utf8' });
  const guard = source.slice(source.indexOf('export async function installReadOnlyNetworkGuard')).replace('export ', '');
  install = Function(`return (${guard});`)();
}
const writes = [];
const server = createServer((request, response) => {
  if (request.method === 'POST') writes.push(request.url);
  response.end('<p>Guard probe</p>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const guard = await install(page, { verbose: true });
  const other = await context.newPage();
  await other.goto(`http://127.0.0.1:${server.address().port}`);
  await other.evaluate(() => fetch('/new-tab-save', { method: 'POST', body: 'probe' }).catch(() => {}));
  console.log(JSON.stringify({ baseline: process.argv.includes('--baseline'), writes, blockedRequests: guard.blockedRequests }, null, 2));
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
