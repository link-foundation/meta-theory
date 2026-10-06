import { convertHtmlToMarkdownEnhanced } from '@link-assistant/web-capture/src/lib.js';
import { postProcessMarkdown } from '@link-assistant/web-capture/src/postprocess.js';

// Runs entirely in the page. Keep selection shared by extraction and writing.
function analyzeEditor({ minMarkdownEditorChars = 0, replacement = null }) {
  function viewFor(element) {
    // CodeMirror 6 changed its DOM back-reference in 6.39. Both are guarded:
    // never interpret a rendered viewport as the complete live document.
    return element.cmTile?.root?.view || element.cmView?.rootView?.view || null;
  }
  function readCodeMirror(element) {
    const view = viewFor(element);
    if (view?.state?.doc) return { markdown: view.state.doc.toString(), source: 'codemirror-state', view };
    if (element.closest('.cm-editor')?.querySelector('.cm-gap')) {
      throw new Error('CodeMirror is virtualized but its complete document state is unavailable.');
    }
    const lines = [...element.querySelectorAll('.cm-line')];
    const text = lines.map(line => line.textContent || '').join('\n');
    return {
      markdown: lines.length ? text : element.textContent || '',
      source: 'codemirror-dom', view: null
    };
  }
  const ignored = '.ProseMirror, .node_formula, .formula-form, .node_code, .code, .node_embed, .abbr-form, .bubble-menu, [data-tippy-root]';
  const elements = [...document.querySelectorAll('.cm-content')];
  const candidates = elements.filter(element => !element.closest(ignored) && element.getClientRects().length)
    .map(element => ({ element, ...readCodeMirror(element) }))
    .filter(candidate => candidate.view || candidate.markdown.length >= minMarkdownEditorChars);
  if (candidates.length > 1) throw new Error('Multiple article Markdown editors found; refusing an ambiguous target.');
  const selected = candidates[0];
  const editor = document.querySelector('.ProseMirror') || document.querySelector('.editor__content');
  const titleElement = document.querySelector('h1.title');
  const title = (titleElement?.textContent || '').trim();

  if (selected) {
    if (replacement !== null) {
      if (selected.view) {
        selected.view.dispatch({ changes: { from: 0, to: selected.view.state.doc.length, insert: replacement } });
      } else {
        selected.element.setAttribute('data-habr-sync-target', 'true');
      }
    }
    return {
      mode: 'markdown', markdown: selected.markdown, source: selected.source, title,
      markdownEditorCount: candidates.length, codeMirrorCount: elements.length,
      proseMirrorCount: document.querySelectorAll('.ProseMirror').length,
      editorContentCount: document.querySelectorAll('.editor__content').length,
      needsKeyboard: replacement !== null && !selected.view
    };
  }
  if (!editor) throw new Error('Could not find a Habr editor body in the current page.');
  const clone = editor.cloneNode(true);
  const opaqueFormulas = [];
  const formulaWarnings = [];
  const originalMath = [...editor.querySelectorAll('mjx-container, .katex')];
  [...clone.querySelectorAll('mjx-container, .katex')].forEach((element, index) => {
    const original = originalMath[index];
    let latex = original.getAttribute('data-tex') || original.getAttribute('data-latex') ||
      original.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    for (let ancestor = original; !latex && ancestor && ancestor !== editor; ancestor = ancestor.parentElement) {
      const node = ancestor.pmViewDesc?.node;
      if (node && /formula|math/i.test(node.type.name)) {
        latex = node.attrs.latex || node.attrs.tex || node.attrs.formula || node.attrs.value || node.attrs.text || node.textContent;
      }
    }
    if (!latex && window.MathJax?.startup?.document?.getMathItemsWithin) {
      latex = window.MathJax.startup.document.getMathItemsWithin([original])[0]?.math;
    }
    if (typeof latex === 'string' && latex) {
      const image = document.createElement('img');
      image.className = 'formula';
      image.setAttribute('source', latex);
      element.replaceWith(image);
    } else {
      const token = `HABRSYNCOPAQUEMATH${index}END`;
      opaqueFormulas.push({ token, html: original.outerHTML });
      element.replaceWith(document.createTextNode(token));
      formulaWarnings.push('Formula source unavailable; preserved rendered formula as raw HTML.');
    }
  });
  // Code and figures are non-editable node views in Habr. Preserve them before
  // removing controls; a blanket [contenteditable=false] deletion loses data.
  const originals = [...editor.querySelectorAll('.cm-content')];
  [...clone.querySelectorAll('.cm-content')].forEach((element, index) => {
    const container = element.closest('.code, .node_code') || element.closest('.cm-editor');
    const pre = document.createElement('pre'), code = document.createElement('code');
    code.textContent = readCodeMirror(originals[index]).markdown;
    const language = container.getAttribute('data-language') || container.querySelector('[data-language]')?.getAttribute('data-language');
    if (language) code.className = `language-${language}`;
    pre.append(code);
    container.replaceWith(pre);
  });
  clone.querySelectorAll([
    '.node__drag-control', '.right-menu__container', '.block-menu', '.bubble-menu',
    '[data-tippy-root]', '.node__error', '.embed__placeholder', '.cm-gutters',
    'button', 'input', 'select', 'svg:not(.MathJax svg)', 'script', 'style'
  ].join(',')).forEach(element => element.remove());
  // Habr node-view wrappers need block boundaries for HTML-to-Markdown.
  clone.querySelectorAll('.node_paragraph').forEach(element => {
    const paragraph = document.createElement('p');
    paragraph.innerHTML = element.innerHTML;
    element.replaceWith(paragraph);
  });
  return {
    mode: 'wysiwyg', html: clone.outerHTML, title, source: 'prosemirror-html',
    markdownEditorCount: 0, codeMirrorCount: elements.length,
    proseMirrorCount: document.querySelectorAll('.ProseMirror').length,
    editorContentCount: document.querySelectorAll('.editor__content').length,
    opaqueFormulas, formulaWarnings
  };
}

export async function extractHabrEditorStateFromPage(page, options = {}) {
  const state = await page.evaluate(analyzeEditor, { minMarkdownEditorChars: options.minMarkdownEditorChars ?? 0 });
  if (state.mode === 'wysiwyg') {
    const result = convertHtmlToMarkdownEnhanced(`<html><head><meta charset="utf-8"></head><body><article>${state.html}</article></body></html>`, options.url || page.url(), {
      extractLatex: true, extractMetadata: false, postProcess: false, detectCodeLanguage: true
    });
    state.markdown = postProcessMarkdown(result.markdown.trim() + '\n');
    for (const { token, html } of state.opaqueFormulas) state.markdown = state.markdown.replace(token, html);
    state.opaqueFormulaCount = state.opaqueFormulas.length;
    state.warnings = [...new Set(state.formulaWarnings)];
    delete state.opaqueFormulas;
    delete state.formulaWarnings;
    delete state.html;
  }
  return state;
}

export async function replaceHabrEditorMarkdown(page, markdown, options = {}) {
  const state = await page.evaluate(analyzeEditor, {
    minMarkdownEditorChars: options.minMarkdownEditorChars ?? 0, replacement: markdown
  });
  if (state.mode === 'markdown') {
    if (state.needsKeyboard) {
      const target = page.locator('[data-habr-sync-target="true"]');
      await target.click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.insertText(markdown);
      await target.evaluate(element => element.removeAttribute('data-habr-sync-target'));
    }
  } else {
    if (!options.allowWysiwygPaste) {
      throw new Error('Visual editor detected. Use --allow-wysiwyg-paste to opt into Habr Markdown clipboard conversion.');
    }
    const target = page.locator('.ProseMirror[contenteditable="true"]').first();
    await target.click();
    await page.keyboard.press('ControlOrMeta+A');
    const handled = await target.evaluate((element, text) => {
      const data = new DataTransfer();
      data.setData('text/plain', text);
      return !element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, markdown);
    if (!handled) throw new Error('Habr did not handle the Markdown clipboard event; editor content was not replaced.');
  }
  // Let editor input/paste handlers finish before taking the verification snapshot.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return extractHabrEditorStateFromPage(page, options);
}

export async function installReadOnlyNetworkGuard(page, { verbose = false } = {}) {
  let blockedRequests = 0;
  const context = page.context();
  // The launcher does not forward Playwright's serviceWorkers option. Disable
  // registration before page scripts run; guarded profiles omit existing SWs.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: false });
  });
  await context.route('**/*', async route => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.continue();
    blockedRequests++;
    if (verbose) console.error(`[habr-sync] blocked ${route.request().method()} ${new URL(route.request().url()).pathname}`);
    await route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => { blockedRequests++; socket.close(); });
  return { get blockedRequests() { return blockedRequests; } };
}
