import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { applyMarkdownToHabrEditorPage, installReadOnlyNetworkGuard } from '../scripts/habr-article-sync.mjs';

const bundle = await build({
  stdin: { contents: `import {EditorState} from '@codemirror/state';
    import {EditorView} from '@codemirror/view';
    window.articleView = new EditorView({state: EditorState.create({doc: '# Title\\n\\nOld body.\\n',
      extensions: [EditorView.updateListener.of(update => {
        if (update.docChanged) fetch('/autosave', {method: 'POST', body: update.state.doc.toString()}).catch(() => {});
      })]}), parent: document.querySelector('#markdown')});`, resolveDir: process.cwd() },
  bundle: true, write: false, format: 'iife'
});

async function withServer(fn) {
  const writes = [];
  const server = createServer((request, response) => {
    if (request.method !== 'GET') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => { writes.push({ method: request.method, url: request.url, body }); response.end('saved'); });
      return;
    }
    response.setHeader('content-type', 'text/html; charset=utf-8');
    if (request.url === '/viewer') {
      response.end('<article><h1>Title</h1><div class="article-formatted-body"><p>Old body.</p></div></article>');
    } else {
      response.end(`<div id="markdown"></div><script>${bundle.outputFiles[0].text}</script>`);
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const directory = mkdtempSync(join(tmpdir(), 'habr-cli-'));
  try { await fn({ url: `http://127.0.0.1:${server.address().port}`, directory, writes }); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); rmSync(directory, { recursive: true, force: true }); }
}

function cli(args, directory) {
  return new Promise((resolve, reject) => {
    const executable = process.env.HABR_TEST_CHANNEL === 'chrome' ? '/usr/bin/google-chrome' : chromium.executablePath();
    const child = spawn(process.execPath, ['scripts/habr-article-sync.mjs', ...args,
      '--profile', join(directory, 'profile'), '--executable-path', executable, '--no-sandbox', '--json']);
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

test('CLI downloads viewer and editor, exports diff, and dry-runs sync without autosaves', { timeout: 60000 }, async () => {
  await withServer(async ({ url, directory, writes }) => {
    const viewer = join(directory, 'viewer.md'), editor = join(directory, 'editor.md');
    const source = join(directory, 'source.md'), diff = join(directory, 'editor.diff');
    writeFileSync(source, '# Title\n\nNew body.\n');
    let result = await cli(['download-readonly', '--url', url + '/viewer', '--output', viewer], directory);
    assert.equal(result.status, 0, result.stderr);
    result = await cli(['download-edit', '--url', url + '/editor', '--output', editor,
      '--source', source, '--diff-output', diff], directory);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(viewer, 'utf8'), readFileSync(editor, 'utf8'));
    assert.match(readFileSync(diff, 'utf8'), /-Old body\.\n\+New body\./);
    result = await cli(['sync', '--edit-url', url + '/editor', '--readonly-url', url + '/viewer',
      '--source', source, '--work-dir', join(directory, 'run')], directory);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, 'dry-run');
    assert.deepEqual(writes, []);
  });
});

test('prefill blocks autosave but explicit --write allows it and verifies the buffer', { timeout: 60000 }, async () => {
  await withServer(async ({ url, directory, writes }) => {
    const source = join(directory, 'source.md');
    writeFileSync(source, '# Title\n\nNew body.\n');
    let result = await cli(['prefill', '--url', url + '/editor', '--source', source,
      '--work-dir', join(directory, 'offline')], directory);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).postWriteComparison.exactEqual, true);
    assert.deepEqual(writes, []);
    result = await cli(['apply', '--url', url + '/editor', '--source', source, '--write',
      '--work-dir', join(directory, 'live')], directory);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).postWriteComparison.exactEqual, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].body, readFileSync(source, 'utf8'));
  });
});

test('network guard blocks POST, PUT, DELETE, beacon requests and WebSockets', { timeout: 30000 }, async () => {
  await withServer(async ({ url, writes }) => {
    const browser = await chromium.launch({ headless: true, channel: process.env.HABR_TEST_CHANNEL });
    try {
      const page = await browser.newPage();
      const guard = await installReadOnlyNetworkGuard(page);
      await page.goto(url + '/editor');
      await page.evaluate(async () => {
        await Promise.all(['POST', 'PUT', 'DELETE'].map(method => fetch('/autosave', { method }).catch(() => {})));
        navigator.sendBeacon('/beacon', 'blocked');
        window.socketClosed = false;
        new WebSocket('ws://' + location.host + '/socket')
          .addEventListener('close', () => { window.socketClosed = true; });
      });
      await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.endsWith('/beacon')));
      await page.waitForFunction(() => window.socketClosed);
      assert.deepEqual(writes, []);
      assert.equal(guard.blockedRequests, 5);
    } finally { await browser.close(); }
  });
});

test('WYSIWYG writes use the clipboard Markdown parser and verify its converted result', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.HABR_TEST_CHANNEL });
  try {
    const page = await browser.newPage();
    await page.setContent('<div class="ProseMirror" contenteditable="true"><h1 class="title">Old</h1><p>Old body.</p></div>');
    await page.evaluate(() => {
      document.querySelector('.ProseMirror').addEventListener('paste', event => {
        event.preventDefault();
        const [title, body] = event.clipboardData.getData('text/plain').trim().split('\n\n');
        const heading = document.createElement('h1'), paragraph = document.createElement('p');
        heading.className = 'title'; heading.textContent = title.slice(2); paragraph.textContent = body;
        event.currentTarget.replaceChildren(heading, paragraph);
      });
    });
    const source = '# New\n\nNew body.\n';
    await assert.rejects(applyMarkdownToHabrEditorPage(page, source, { dryRun: false }), /allow-wysiwyg-paste/);
    const result = await applyMarkdownToHabrEditorPage(page, source, { dryRun: false, allowWysiwygPaste: true });
    assert.equal(result.postWriteComparison.exactEqual, true);
  } finally { await browser.close(); }
});
