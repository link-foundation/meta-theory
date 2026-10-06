import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { build } from 'esbuild';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import { loadMarkdownSource, extractHabrEditorStateFromPage, applyMarkdownToHabrEditorPage } from '../scripts/habr-article-sync.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'habr-drafts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, text) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  return { root, put };
}

test('draft selection supports flat articles and numeric versions, ignoring non-directories', t => {
  const { root, put } = fixture(t);
  put('drafts/0.0.9/article.md', '# Nine\n');
  put('drafts/0.0.10/article.md', '# Ten\n\n![Figure](images/figure.png)\n');
  put('drafts/0.0.99', 'not a version directory');
  const source = loadMarkdownSource({ draft: 'latest' }, root);
  assert.match(source.markdown, /^# Ten/);
  assert.match(source.markdown, /main\/drafts\/0\.0\.10\/images\/figure\.png/);
  assert.equal(loadMarkdownSource({ draft: '0.0.9' }, root).markdown, '# Nine\n');
});

test('version directories and archived revisions are selectable article sources', () => {
  const latest = loadMarkdownSource({ draft: 'latest' });
  assert.equal(loadMarkdownSource({ source: resolve('drafts/0.0.3') }).markdown, latest.markdown);
  for (const version of ['0.0.0', '0.0.1', '0.0.2']) {
    const source = loadMarkdownSource({ draft: version });
    assert.deepEqual(source.files, [resolve(`archive/${version}/article.md`)]);
    assert.match(source.markdown, new RegExp(`main/archive/${version.replaceAll('.', '\\.')}/images/`));
    assert.equal(loadMarkdownSource({ source: resolve(`archive/${version}`) }).markdown, source.markdown);
  }
});

test('image rewriting preserves code examples and complete Markdown destinations', t => {
  const { root, put } = fixture(t);
  put('drafts/0.0.3/article/01-start.md', [
    '# Title', '', '![Real](../images/plot(v2).png "Figure title")', '',
    '![Space](<../images/space name.png>)', '',
    '`![Inline example](../images/example.png)`', '',
    '```markdown', '![Block example](../images/example.png)', '```', '',
    '    ![Indented example](../images/example.png)', '',
    '![Reference][plot]', '', '[plot]: ../images/reference.png "Reference title"', '',
    '![Remote](https://example.com/a.png)', ''
  ].join('\n'));
  const { markdown } = loadMarkdownSource({ draft: 'latest' }, root);
  assert.match(markdown, /main\/drafts\/0\.0\.3\/images\/plot\(v2\)\.png "Figure title"/);
  assert.match(markdown, /main\/drafts\/0\.0\.3\/images\/space%20name\.png/);
  assert.ok(markdown.includes('`![Inline example](../images/example.png)`'));
  assert.ok(markdown.includes('```markdown\n![Block example](../images/example.png)\n```'));
  assert.ok(markdown.includes('    ![Indented example](../images/example.png)'));
  assert.match(markdown, /\[plot\]: https:\/\/raw\.githubusercontent\.com\/.*\/images\/reference\.png "Reference title"/);
  assert.ok(markdown.includes('![Remote](https://example.com/a.png)'));
});

test('standalone files remain byte-exact unless asset rewriting is requested', t => {
  const { root, put } = fixture(t);
  put('article.md', '# Title\r\n\r\n![Figure](images/figure.png)\r\n  ');
  const path = join(root, 'article.md');
  assert.equal(loadMarkdownSource({ source: path }, root).markdown, readFileSync(path, 'utf8'));
  const rewritten = loadMarkdownSource({ source: path, 'asset-base-url': 'https://example.com/repo/' }, root);
  assert.equal(rewritten.markdown, '# Title\r\n\r\n![Figure](https://example.com/repo/images/figure.png)\r\n  ');
});

test('static CodeMirror extraction does not invent a final newline', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.HABR_TEST_CHANNEL });
  try {
    const page = await browser.newPage();
    await page.setContent('<div class="cm-editor"><div class="cm-content" contenteditable="true"><div class="cm-line">Body  </div></div></div>');
    assert.equal((await extractHabrEditorStateFromPage(page)).markdown, 'Body  ');
  } finally { await browser.close(); }
});

test('every repository revision round-trips through a real virtualized article editor', { timeout: 60000 }, async () => {
  const bundle = await build({ stdin: { contents: `import {EditorState} from '@codemirror/state';
    import {EditorView} from '@codemirror/view';
    window.articleView = new EditorView({ state: EditorState.create({doc: '# Empty'}),
      parent: document.querySelector('#markdown') });`, resolveDir: process.cwd() },
    bundle: true, write: false, format: 'iife' });
  const browser = await chromium.launch({ headless: true, channel: process.env.HABR_TEST_CHANNEL });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="markdown" style="height:100px;overflow:auto"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    for (const version of ['0.0.0', '0.0.1', '0.0.2', '0.0.3', 'latest']) {
      const source = loadMarkdownSource({ draft: version });
      const result = await applyMarkdownToHabrEditorPage(page, source.markdown, { dryRun: false });
      assert.equal(result.postWriteComparison?.exactEqual ?? result.comparison.exactEqual, true, version);
      assert.equal((await extractHabrEditorStateFromPage(page)).markdown, source.markdown, version);
      assert.ok(await page.locator('.cm-line').count() < source.markdown.split('\n').length, version);
    }
  } finally { await browser.close(); }
});

test('visual extraction retains every figure, code block and formula in every revision', { timeout: 60000 }, async () => {
  const parser = new MarkdownIt().use(texmath, { engine: katex, delimiters: 'dollars' });
  for (const name of [...texmath.inlineRuleNames, ...texmath.blockRuleNames]) {
    parser.renderer.rules[name] = (tokens, index) => katex.renderToString(tokens[index].content.replace(/\\\\%/g, '\\%'), {
      displayMode: name !== 'math_inline', throwOnError: true, strict: 'ignore'
    });
  }
  const flatten = tokens => tokens.flatMap(token => [token, ...flatten(token.children || [])]);
  const count = (tokens, type) => flatten(tokens).filter(token => type === 'math' ? token.type.startsWith('math_') : token.type === type).length;
  const browser = await chromium.launch({ headless: true, channel: process.env.HABR_TEST_CHANNEL });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    for (const version of ['0.0.0', '0.0.1', '0.0.2', '0.0.3']) {
      const { markdown } = loadMarkdownSource({ draft: version });
      const tokens = parser.parse(markdown, {});
      const html = parser.renderer.render(tokens, parser.options, {}).replace('<h1>', '<h1 class="title">');
      await page.setContent(`<div class="ProseMirror" contenteditable="true">${html}</div>`);
      const state = await extractHabrEditorStateFromPage(page);
      const extracted = parser.parse(state.markdown, {});
      for (const type of ['image', 'fence', 'math']) {
        assert.equal(count(extracted, type), count(tokens, type), `${version}: ${type}`);
      }
      assert.equal(state.opaqueFormulaCount, 0, version);
    }
  } finally { await browser.close(); }
});
