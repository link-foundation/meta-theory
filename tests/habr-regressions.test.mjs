import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { build } from 'esbuild';
import * as sync from '../scripts/habr-article-sync.mjs';

const fixture = await build({
  stdin: {
    contents: `import {EditorState} from '@codemirror/state';
      import {EditorView} from '@codemirror/view';
      window.mountEditor = (text) => {
        window.articleView = new EditorView({state: EditorState.create({doc: text}),
          parent: document.querySelector('#markdown')});
      };`,
    resolveDir: process.cwd()
  },
  bundle: true, write: false, format: 'iife'
});

async function withPage(fn) {
  const browser = await chromium.launch({ headless: true, channel: process.env.HABR_TEST_CHANNEL });
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  try { await fn(page); } finally { await browser.close(); }
}

test('extracts the complete virtualized CodeMirror document without trimming whitespace', { timeout: 30000 }, async () => {
  await withPage(async page => {
    const source = Array.from({ length: 300 }, (_, i) => `Line ${i}`).join('\n') + '\n\n  ';
    await page.setContent('<div id="markdown" style="height:100px;overflow:auto"></div>');
    await page.addScriptTag({ content: fixture.outputFiles[0].text });
    await page.evaluate(text => window.mountEditor(text), source);
    assert.ok(await page.locator('.cm-line').count() < 300);
    const state = await sync.extractHabrEditorStateFromPage(page);
    assert.equal(state.markdown, source);
  });
});

test('recognizes empty and short article buffers as Markdown editors', { timeout: 30000 }, async () => {
  await withPage(async page => {
    await page.setContent('<div id="markdown"></div>');
    await page.addScriptTag({ content: fixture.outputFiles[0].text });
    await page.evaluate(() => window.mountEditor(''));
    const state = await sync.extractHabrEditorStateFromPage(page);
    assert.equal(state.mode, 'markdown');
    assert.equal(state.markdown, '');
    const result = await sync.applyMarkdownToHabrEditorPage(page, '# Short\n\nBody', { dryRun: false });
    assert.equal(result.postWriteComparison.exactEqual, true);
  });
});

test('ignores embedded CodeMirror and preserves non-editable content in captured Habr editor', { timeout: 30000 }, async () => {
  await withPage(async page => {
    await page.route('**/*', route => route.abort());
    await page.setContent(readFileSync('docs/case-studies/issue-57/data/habr-article-editor-page.html', 'utf8'));
    const state = await sync.extractHabrEditorStateFromPage(page);
    assert.equal(state.mode, 'wysiwyg');
    assert.match(state.markdown, /^# Мета-теория связей 0\.0\.3/m);
    assert.match(state.markdown, /habrastorage\.org/);
    assert.match(state.markdown, /```/);
    assert.doesNotMatch(state.markdown, /Загрузить новую|Удалить|Параграф/);
    const formulaCount = await page.locator('mjx-container, .katex').count();
    assert.ok(formulaCount > 0);
    assert.equal(state.opaqueFormulaCount, formulaCount);
    assert.equal((state.markdown.match(/<mjx-container/g) || []).length, formulaCount);
    assert.match(state.warnings[0], /Formula source unavailable/);
  });
});

test('does not select long embedded code blocks as the article', { timeout: 30000 }, async () => {
  await withPage(async page => {
    await page.setContent(`<div class="ProseMirror" contenteditable="true"><h1 class="title">Article</h1>
      <div class="code" contenteditable="false"><div class="cm-content" contenteditable="true">
      <div class="cm-line">${'embedded code '.repeat(100)}</div></div></div><p>Body.</p></div>`);
    const state = await sync.extractHabrEditorStateFromPage(page);
    assert.equal(state.mode, 'wysiwyg');
    assert.match(state.markdown, /Body\./);
  });
});

test('compare prints a unified diff and exports identical patch text', () => {
  const directory = mkdtempSync(join(tmpdir(), 'habr-diff-'));
  try {
    const left = join(directory, 'left.md'), right = join(directory, 'right.md');
    const output = join(directory, 'change.diff');
    writeFileSync(left, '# Title\n\nOld paragraph.\n');
    writeFileSync(right, '# Title\n\nNew paragraph.\n');
    const result = spawnSync(process.execPath, ['scripts/habr-article-sync.mjs', 'compare',
      '--left', left, '--right', right, '--diff-output', output], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /-Old paragraph\.\n\+New paragraph\./);
    assert.ok(result.stdout.includes(readFileSync(output, 'utf8')));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('latest draft resolves all article sections instead of the index table of contents', () => {
  assert.equal(typeof sync.loadMarkdownSource, 'function');
  const source = sync.loadMarkdownSource({ draft: 'latest' });
  assert.equal(source.files.length, 10);
  assert.match(source.markdown, /Мета-теория связей 0\.0\.3/);
  assert.match(source.markdown, /TL;DR/);
  assert.match(source.markdown, /История изменений/);
  assert.doesNotMatch(source.markdown, /Статья разделена на секции для удобства/);
  assert.match(source.markdown, /https:\/\/raw\.githubusercontent\.com\/link-foundation\/meta-theory\/main\//);
  assert.equal(sync.loadMarkdownSource({ draft: '0.0.3' }).markdown, source.markdown);
});

test('unsafe CLI flag values cannot enable writes', () => {
  const result = spawnSync(process.execPath, ['scripts/habr-article-sync.mjs', 'apply',
    '--url', 'https://habr.com/ru/article/edit/1018142', '--source', 'missing.md', '--write=false'],
    { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--write.*boolean|--write.*value/);
});
