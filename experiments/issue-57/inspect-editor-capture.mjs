import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { extractHabrEditorStateFromPage } from '../../scripts/habr-editor.mjs';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  await page.setContent(readFileSync('docs/case-studies/issue-57/data/habr-article-editor-page.html', 'utf8'));
  const dom = await page.evaluate(() => ({
    titleInsideArticle: !!document.querySelector('.ProseMirror h1.title'),
    formulas: document.querySelectorAll('mjx-container').length,
    codeEditors: document.querySelectorAll('.ProseMirror .cm-content').length,
    figures: document.querySelectorAll('.ProseMirror img:not(.formula)').length
  }));
  const state = await extractHabrEditorStateFromPage(page);
  console.log(JSON.stringify({ dom, mode: state.mode, opaqueFormulas: state.opaqueFormulaCount,
    codeBlocks: (state.markdown.match(/^```/gm) || []).length / 2, warnings: state.warnings }, null, 2));
} finally { await browser.close(); }
