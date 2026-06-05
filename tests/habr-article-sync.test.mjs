import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';

import {
  applyMarkdownToHabrEditorPage,
  compareMarkdownTexts,
  deriveReadOnlyUrlFromEditUrl,
  extractHabrEditorStateFromPage
} from '../scripts/habr-article-sync.mjs';

async function withPage(fn) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await fn(page);
  } finally {
    await browser.close();
  }
}

test('deriveReadOnlyUrlFromEditUrl converts Habr edit URLs to article URLs', () => {
  assert.equal(
    deriveReadOnlyUrlFromEditUrl('https://habr.com/ru/article/edit/1018142'),
    'https://habr.com/ru/articles/1018142/'
  );
  assert.equal(
    deriveReadOnlyUrlFromEditUrl('https://habr.com/en/article/edit/895896/'),
    'https://habr.com/en/articles/895896/'
  );
});

test('compareMarkdownTexts reports byte-exact and normalized equality separately', () => {
  const exact = compareMarkdownTexts('line one\nline two\n', 'line one\nline two\n');
  assert.equal(exact.exactEqual, true);
  assert.equal(exact.normalizedEqual, true);

  const lineEndingOnly = compareMarkdownTexts('line one\r\nline two\r\n', 'line one\nline two\n');
  assert.equal(lineEndingOnly.exactEqual, false);
  assert.equal(lineEndingOnly.normalizedEqual, true);
  assert.equal(lineEndingOnly.firstDifference.leftLine, 1);
});

test('extractHabrEditorStateFromPage prefers the full markdown editor over formula CodeMirror fields', async () => {
  await withPage(async (page) => {
    await page.setContent(`
      <main>
        <div class="editor__content">
          <div class="tiptap ProseMirror" contenteditable="true">
            <h1 class="title">Fallback title</h1>
            <p>Fallback WYSIWYG paragraph.</p>
            <div class="node node_formula">
              <div class="cm-editor">
                <div class="cm-content" contenteditable="true">
                  <div class="cm-line">x + y</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <section class="markdown-mode">
          <div class="cm-editor">
            <div class="cm-content" contenteditable="true" data-testid="main-markdown">
              <div class="cm-line"># Markdown title</div>
              <div class="cm-line"><br></div>
              <div class="cm-line">Body from markdown mode.</div>
            </div>
          </div>
        </section>
      </main>
    `);

    const state = await extractHabrEditorStateFromPage(page, {
      minMarkdownEditorChars: 1
    });

    assert.equal(state.mode, 'markdown');
    assert.equal(state.markdown, '# Markdown title\n\nBody from markdown mode.\n');
    assert.equal(state.markdownEditorCount, 1);
  });
});

test('extractHabrEditorStateFromPage falls back to WYSIWYG HTML conversion', async () => {
  await withPage(async (page) => {
    await page.setContent(`
      <main>
        <div class="editor__content">
          <div class="tiptap ProseMirror" contenteditable="true">
            <h1 class="title">WYSIWYG title</h1>
            <p>First paragraph from the visual editor.</p>
          </div>
        </div>
      </main>
    `);

    const state = await extractHabrEditorStateFromPage(page, {
      minMarkdownEditorChars: 100
    });

    assert.equal(state.mode, 'wysiwyg');
    assert.match(state.markdown, /^# WYSIWYG title/m);
    assert.match(state.markdown, /First paragraph from the visual editor\./);
  });
});

test('applyMarkdownToHabrEditorPage supports dry-run and write modes', async () => {
  await withPage(async (page) => {
    await page.setContent(`
      <main>
        <div class="cm-editor">
          <div class="cm-content" contenteditable="true" data-testid="main-markdown">
            <div class="cm-line"># Old title</div>
            <div class="cm-line"><br></div>
            <div class="cm-line">Old body.</div>
          </div>
        </div>
      </main>
    `);

    const source = '# New title\n\nNew body.\n';
    const dryRun = await applyMarkdownToHabrEditorPage(page, source, {
      dryRun: true,
      minMarkdownEditorChars: 1
    });
    assert.equal(dryRun.dryRun, true);
    assert.equal(dryRun.written, false);

    let state = await extractHabrEditorStateFromPage(page, {
      minMarkdownEditorChars: 1
    });
    assert.equal(state.markdown, '# Old title\n\nOld body.\n');

    const write = await applyMarkdownToHabrEditorPage(page, source, {
      dryRun: false,
      minMarkdownEditorChars: 1
    });
    assert.equal(write.written, true);
    assert.equal(write.postWriteComparison.exactEqual, true);

    state = await extractHabrEditorStateFromPage(page, {
      minMarkdownEditorChars: 1
    });
    assert.equal(state.markdown, source);
  });
});
