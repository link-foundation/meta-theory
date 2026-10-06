// Local-only probe for editor update events and browser-commander autosaves.
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { createBrowserSession, applyMarkdownToHabrEditorPage } from '../scripts/habr-article-sync.mjs';

const bundle = await build({ stdin: { contents: `import {EditorView} from '@codemirror/view';
  import {EditorState} from '@codemirror/state';
  window.updateEvents = [];
  window.view = new EditorView({state: EditorState.create({doc: '# Old\\n',
    extensions: EditorView.updateListener.of(update => {
      console.log('doc changed', update.docChanged);
      window.updateEvents.push(update.docChanged);
      if (update.docChanged) fetch('/autosave', {method: 'POST', body: update.state.doc.toString()})
        .then(response => console.log('autosave response', response.status))
        .catch(error => console.error('autosave failed', error.message));
    })}), parent: document.body});`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife' });
const requests = [];
const server = createServer((request, response) => {
  console.log('server', request.method, request.url);
  requests.push({ method: request.method, url: request.url });
  if (request.method === 'POST') { request.resume(); response.end('saved'); }
  else { response.setHeader('content-type', 'text/html'); response.end(`<body><script>${bundle.outputFiles[0].text}</script></body>`); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = mkdtempSync(join(tmpdir(), 'habr-probe-'));
let session;
try {
  session = await createBrowserSession({ profileDir: profile, executablePath: process.env.HABR_PROBE_EXECUTABLE,
    noSandbox: process.env.HABR_PROBE_NO_SANDBOX === '1',
    allowRemoteWrites: true, verbose: true });
  session.page.on('console', message => console.log('page', message.type(), message.text()));
  session.page.on('pageerror', error => console.error('page error', error.message));
  session.page.on('requestfailed', request => console.error('request failed', request.method(), request.url(), request.failure()));
  await session.commander.goto({ url: `http://127.0.0.1:${server.address().port}/`, waitUntil: 'domcontentloaded', verify: false });
  await session.page.waitForSelector('.cm-content', { timeout: 5000 });
  console.log(await applyMarkdownToHabrEditorPage(session.page, '# New\n', { dryRun: false }));
  console.log('listener events', await session.page.evaluate(() => window.updateEvents));
  await session.page.waitForTimeout(3000);
  console.log('requests', requests);
} finally {
  if (session) await session.close();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  rmSync(profile, { recursive: true, force: true });
}
