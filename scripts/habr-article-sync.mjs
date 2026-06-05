#!/usr/bin/env node

/**
 * Habr article state synchronization helper.
 *
 * The tool uses browser-commander for persistent browser launch/navigation and
 * raw Playwright DOM operations for the Habr editor's CodeMirror/ProseMirror
 * surfaces.
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { launchBrowser, makeBrowserCommander } from 'browser-commander';
import { convertHtmlToMarkdownEnhanced } from '@link-assistant/web-capture/src/lib.js';
import { postProcessMarkdown } from '@link-assistant/web-capture/src/postprocess.js';

import {
  buildArticleDocumentHtml,
  buildArticleMarkdown
} from './download-article.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const DEFAULT_PROFILE_DIR = join(ROOT_DIR, '.browser', 'habr');
const DEFAULT_MIN_MARKDOWN_EDITOR_CHARS = 500;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 120000;
const DEFAULT_EDITOR_WAIT_MS = 30000;

const EDITOR_WAIT_SELECTOR = [
  '.editor__content',
  '.ProseMirror',
  '.cm-content[contenteditable="true"]'
].join(',');

function ensureDirForFile(filePath) {
  const dir = dirname(resolve(filePath));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function normalizeMarkdownForComparison(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function firstDifference(left, right) {
  if (left === right) {
    return null;
  }

  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const maxLines = Math.max(leftLines.length, rightLines.length);

  for (let i = 0; i < maxLines; i++) {
    if (leftLines[i] !== rightLines[i]) {
      return {
        leftLine: i + 1,
        rightLine: i + 1,
        leftText: leftLines[i] ?? null,
        rightText: rightLines[i] ?? null
      };
    }
  }

  return {
    leftLine: leftLines.length,
    rightLine: rightLines.length,
    leftText: null,
    rightText: null
  };
}

export function compareMarkdownTexts(left, right) {
  const normalizedLeft = normalizeMarkdownForComparison(left);
  const normalizedRight = normalizeMarkdownForComparison(right);

  return {
    exactEqual: left === right,
    normalizedEqual: normalizedLeft === normalizedRight,
    leftSha256: sha256(left),
    rightSha256: sha256(right),
    normalizedLeftSha256: sha256(normalizedLeft),
    normalizedRightSha256: sha256(normalizedRight),
    firstDifference: firstDifference(left, right),
    normalizedFirstDifference: firstDifference(normalizedLeft, normalizedRight),
    leftBytes: Buffer.byteLength(left, 'utf8'),
    rightBytes: Buffer.byteLength(right, 'utf8'),
    leftLines: left.split('\n').length,
    rightLines: right.split('\n').length
  };
}

export function deriveReadOnlyUrlFromEditUrl(editUrl) {
  const url = new URL(editUrl);
  const match = url.pathname.match(/^\/([^/]+)\/article\/edit\/(\d+)\/?$/);

  if (!match) {
    throw new Error(`Cannot derive a read-only Habr URL from: ${editUrl}`);
  }

  const [, language, articleId] = match;
  url.pathname = `/${language}/articles/${articleId}/`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function getEditorDomState(page, options) {
  return page.evaluate((analysisOptions) => {
    const analyzeEditorDom = (function editorDomAnalyzerInPage() {
      function readCodeMirrorMarkdownFromElement(element) {
        const lines = Array.from(element.querySelectorAll('.cm-line'));

        if (lines.length === 0) {
          return `${(element.innerText || element.textContent || '').replace(/\r\n?/g, '\n').trimEnd()}\n`;
        }

        return `${lines.map(line => {
          const text = line.textContent || '';
          return text.replace(/\u00a0/g, ' ');
        }).join('\n').trimEnd()}\n`;
      }

      return function analyzeEditorDom(optionsInPage) {
        const { minMarkdownEditorChars } = optionsInPage;
        const ignoredCodeMirrorAncestorSelectors = [
          '.node_formula',
          '.formula-form',
          '.node_code',
          '.node_embed',
          '.abbr-form',
          '.bubble-menu',
          '[data-tippy-root]'
        ].join(',');
        const codeMirrorElements = Array.from(
          document.querySelectorAll('.cm-content[contenteditable="true"], .cm-content')
        );
        const markdownCandidates = codeMirrorElements
          .map((element, index) => {
            const markdown = readCodeMirrorMarkdownFromElement(element);
            const ignored = Boolean(element.closest(ignoredCodeMirrorAncestorSelectors));
            return {
              index,
              ignored,
              markdown,
              textLength: markdown.trim().length
            };
          })
          .filter(candidate => !candidate.ignored)
          .filter(candidate => candidate.textLength >= minMarkdownEditorChars)
          .sort((a, b) => b.textLength - a.textLength);
        const editorElement =
          document.querySelector('.editor__content') ||
          document.querySelector('.ProseMirror');
        const titleElement =
          document.querySelector('.editor__content h1.title') ||
          document.querySelector('.ProseMirror h1.title') ||
          document.querySelector('h1.title') ||
          document.querySelector('h1');

        let wysiwygHtml = '';
        if (editorElement) {
          const clone = editorElement.cloneNode(true);
          clone.querySelectorAll([
            '[contenteditable="false"]',
            '.right-menu__container',
            '.block-menu',
            '.bubble-menu',
            '[data-tippy-root]',
            '.node__error',
            '.embed__placeholder',
            'button',
            'input[type="file"]'
          ].join(',')).forEach(element => element.remove());
          wysiwygHtml = clone.outerHTML;
        }

        return {
          title: (titleElement?.innerText || titleElement?.textContent || '').trim(),
          markdownCandidates,
          wysiwygHtml,
          codeMirrorCount: codeMirrorElements.length,
          proseMirrorCount: document.querySelectorAll('.ProseMirror').length,
          editorContentCount: document.querySelectorAll('.editor__content').length
        };
      };
    })();

    return analyzeEditorDom(analysisOptions);
  }, options);
}

function buildMarkdownFromEditorHtml(html, url = 'https://habr.com/') {
  const documentHtml = buildArticleDocumentHtml({
    headHtml: '',
    articleHtml: `<article>${html}</article>`
  });
  const result = convertHtmlToMarkdownEnhanced(documentHtml, url, {
    extractLatex: true,
    extractMetadata: false,
    postProcess: false,
    detectCodeLanguage: true
  });

  return postProcessMarkdown(`${result.markdown.trim()}\n`);
}

export async function extractHabrEditorStateFromPage(page, options = {}) {
  const {
    minMarkdownEditorChars = DEFAULT_MIN_MARKDOWN_EDITOR_CHARS,
    url = page.url()
  } = options;

  const domState = await getEditorDomState(page, {
    minMarkdownEditorChars
  });

  if (domState.markdownCandidates.length > 0) {
    const selected = domState.markdownCandidates[0];
    return {
      mode: 'markdown',
      markdown: selected.markdown,
      title: domState.title,
      source: 'codemirror',
      markdownEditorCount: domState.markdownCandidates.length,
      codeMirrorCount: domState.codeMirrorCount,
      proseMirrorCount: domState.proseMirrorCount,
      editorContentCount: domState.editorContentCount
    };
  }

  if (domState.wysiwygHtml) {
    return {
      mode: 'wysiwyg',
      markdown: buildMarkdownFromEditorHtml(domState.wysiwygHtml, url),
      title: domState.title,
      source: 'prosemirror-html',
      markdownEditorCount: 0,
      codeMirrorCount: domState.codeMirrorCount,
      proseMirrorCount: domState.proseMirrorCount,
      editorContentCount: domState.editorContentCount
    };
  }

  throw new Error('Could not find a Habr editor body in the current page.');
}

async function markMainMarkdownEditor(page, options = {}) {
  const {
    minMarkdownEditorChars = DEFAULT_MIN_MARKDOWN_EDITOR_CHARS
  } = options;

  return page.evaluate((analysisOptions) => {
    document
      .querySelectorAll('[data-habr-sync-target="true"]')
      .forEach(element => element.removeAttribute('data-habr-sync-target'));

    function readCodeMirrorMarkdownFromElement(element) {
      const lines = Array.from(element.querySelectorAll('.cm-line'));

      if (lines.length === 0) {
        return `${(element.innerText || element.textContent || '').replace(/\r\n?/g, '\n').trimEnd()}\n`;
      }

      return `${lines.map(line => {
        const text = line.textContent || '';
        return text.replace(/\u00a0/g, ' ');
      }).join('\n').trimEnd()}\n`;
    }

    const ignoredCodeMirrorAncestorSelectors = [
      '.node_formula',
      '.formula-form',
      '.node_code',
      '.node_embed',
      '.abbr-form',
      '.bubble-menu',
      '[data-tippy-root]'
    ].join(',');
    const codeMirrorElements = Array.from(
      document.querySelectorAll('.cm-content[contenteditable="true"], .cm-content')
    );
    const markdownCandidates = codeMirrorElements
      .map((element, index) => {
        const markdown = readCodeMirrorMarkdownFromElement(element);
        const ignored = Boolean(element.closest(ignoredCodeMirrorAncestorSelectors));
        return {
          element,
          index,
          ignored,
          markdown,
          textLength: markdown.trim().length
        };
      })
      .filter(candidate => !candidate.ignored)
      .filter(candidate => candidate.textLength >= analysisOptions.minMarkdownEditorChars)
      .sort((a, b) => b.textLength - a.textLength);

    const selected = markdownCandidates[0];
    if (!selected) {
      return {
        found: false,
        markdownEditorCount: 0,
        codeMirrorCount: codeMirrorElements.length
      };
    }

    selected.element.setAttribute('data-habr-sync-target', 'true');
    return {
      found: true,
      markdownEditorCount: markdownCandidates.length,
      codeMirrorCount: codeMirrorElements.length,
      currentMarkdown: selected.markdown
    };
  }, {
    minMarkdownEditorChars
  });
}

export async function applyMarkdownToHabrEditorPage(page, markdown, options = {}) {
  const {
    dryRun = true,
    minMarkdownEditorChars = DEFAULT_MIN_MARKDOWN_EDITOR_CHARS,
    allowWysiwygPaste = false
  } = options;

  if (typeof markdown !== 'string' || markdown.length === 0) {
    throw new Error('Source markdown must be a non-empty string.');
  }

  const currentState = await extractHabrEditorStateFromPage(page, {
    minMarkdownEditorChars
  });
  const comparison = compareMarkdownTexts(currentState.markdown, markdown);

  if (dryRun) {
    return {
      dryRun: true,
      written: false,
      targetMode: currentState.mode,
      comparison
    };
  }

  const marked = await markMainMarkdownEditor(page, {
    minMarkdownEditorChars
  });

  if (!marked.found) {
    if (!allowWysiwygPaste) {
      throw new Error(
        'No full-page Markdown CodeMirror editor was found. Switch Habr to Markdown mode or pass allowWysiwygPaste.'
      );
    }

    const wysiwyg = page.locator('.ProseMirror[contenteditable="true"], .ProseMirror').first();
    await wysiwyg.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(markdown);
    return {
      dryRun: false,
      written: true,
      targetMode: 'wysiwyg',
      comparison
    };
  }

  const target = page.locator('[data-habr-sync-target="true"]').first();
  await target.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(markdown);
  await page.waitForTimeout(250);

  const writtenState = await extractHabrEditorStateFromPage(page, {
    minMarkdownEditorChars
  });

  return {
    dryRun: false,
    written: true,
    targetMode: 'markdown',
    comparison,
    postWriteComparison: compareMarkdownTexts(writtenState.markdown, markdown)
  };
}

async function scrollToLoadLazyContent(page) {
  await page.evaluate(async () => {
    const scrollHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight || 1080;
    const scrollSteps = Math.ceil(scrollHeight / viewportHeight);

    for (let i = 0; i < scrollSteps; i++) {
      window.scrollTo(0, i * viewportHeight);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);
}

export async function extractReadOnlyArticleDocumentsFromPage(page) {
  await page.waitForSelector('.article-formatted-body', {
    timeout: DEFAULT_EDITOR_WAIT_MS
  });
  await scrollToLoadLazyContent(page);

  const html = await page.evaluate(() => {
    const articleEl = document.querySelector('article');
    if (!articleEl) {
      throw new Error('Article element not found');
    }

    const titleEl = articleEl.querySelector('h1');
    if (!titleEl) {
      throw new Error('Article title not found');
    }

    const bodyEl = articleEl.querySelector('.article-formatted-body');
    if (!bodyEl) {
      throw new Error('Article formatted body not found');
    }

    const headSelectors = [
      'meta[name="keywords"]',
      'meta[name="description"]',
      'meta[property^="og:"]',
      'meta[name^="twitter:"]',
      'meta[itemprop="description"]',
      'link[rel="canonical"]',
      'link[rel="alternate"]',
      'script[type="application/ld+json"]'
    ];
    const headHtml = Array.from(document.head.querySelectorAll(headSelectors.join(',')))
      .map(element => element.outerHTML)
      .join('\n');

    return {
      headHtml,
      metadataArticleHtml: articleEl.outerHTML,
      contentArticleHtml: `<article>${titleEl.outerHTML}\n${bodyEl.outerHTML}</article>`
    };
  });

  return {
    metadataHtml: buildArticleDocumentHtml({
      headHtml: html.headHtml,
      articleHtml: html.metadataArticleHtml
    }),
    contentHtml: buildArticleDocumentHtml({
      headHtml: html.headHtml,
      articleHtml: html.contentArticleHtml
    })
  };
}

export function buildReadOnlyArticleMarkdown({ metadataHtml, contentHtml, url }) {
  const metadataResult = convertHtmlToMarkdownEnhanced(metadataHtml, url, {
    extractLatex: false,
    extractMetadata: true,
    postProcess: false,
    detectCodeLanguage: false
  });
  const contentResult = convertHtmlToMarkdownEnhanced(contentHtml, url, {
    extractLatex: true,
    extractMetadata: false,
    postProcess: false,
    detectCodeLanguage: true
  });

  return buildArticleMarkdown({
    markdown: contentResult.markdown,
    metadata: metadataResult.metadata
  });
}

export async function createBrowserSession(options = {}) {
  const {
    headless = true,
    profileDir = DEFAULT_PROFILE_DIR,
    slowMo = 0,
    verbose = false
  } = options;

  const { browser, page } = await launchBrowser({
    engine: 'playwright',
    headless,
    userDataDir: profileDir,
    slowMo,
    verbose
  });
  const commander = makeBrowserCommander({
    page,
    verbose,
    enableNetworkTracking: false,
    enableNavigationManager: false
  });

  return {
    browser,
    page,
    commander,
    close: async () => {
      await commander.destroy();
      await browser.close();
    }
  };
}

async function gotoWithCommander(commander, url, options = {}) {
  const {
    timeout = DEFAULT_NAVIGATION_TIMEOUT_MS,
    waitSelector = null,
    waitTimeout = DEFAULT_EDITOR_WAIT_MS
  } = options;

  await commander.goto({
    url,
    waitUntil: 'domcontentloaded',
    timeout,
    verify: false
  });

  if (waitSelector) {
    await commander.page.waitForSelector(waitSelector, {
      timeout: waitTimeout
    });
  }
}

async function withBrowserSession(options, fn) {
  const session = await createBrowserSession(options);
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {
    command,
    positional: []
  };

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith('--')) {
      options.positional.push(arg);
      continue;
    }

    const eqIndex = arg.indexOf('=');
    if (eqIndex !== -1) {
      options[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      continue;
    }

    const name = arg.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) {
      options[name] = next;
      i++;
    } else {
      options[name] = true;
    }
  }

  return options;
}

function requireOption(options, name) {
  const value = options[name];
  if (!value || value === true) {
    throw new Error(`Missing required option: --${name}`);
  }
  return value;
}

function browserOptionsFromCli(options) {
  return {
    headless: !options.headed,
    profileDir: options.profile ? resolve(options.profile) : DEFAULT_PROFILE_DIR,
    slowMo: options['slow-mo'] ? Number(options['slow-mo']) : 0,
    verbose: Boolean(options.verbose)
  };
}

function minMarkdownEditorCharsFromCli(options) {
  return options['min-markdown-chars']
    ? Number(options['min-markdown-chars'])
    : DEFAULT_MIN_MARKDOWN_EDITOR_CHARS;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function commandDownloadReadonly(options) {
  const url = requireOption(options, 'url');
  const output = requireOption(options, 'output');

  return withBrowserSession(browserOptionsFromCli(options), async ({ commander, page }) => {
    await gotoWithCommander(commander, url, {
      waitSelector: '.article-formatted-body'
    });
    const documents = await extractReadOnlyArticleDocumentsFromPage(page);
    const markdown = buildReadOnlyArticleMarkdown({
      ...documents,
      url
    });
    ensureDirForFile(output);
    writeFileSync(output, markdown, 'utf8');
    printJson({
      command: 'download-readonly',
      url,
      output,
      sha256: sha256(markdown),
      bytes: Buffer.byteLength(markdown, 'utf8')
    });
  });
}

async function commandDownloadEdit(options) {
  const url = requireOption(options, 'url');
  const output = requireOption(options, 'output');
  const minMarkdownEditorChars = minMarkdownEditorCharsFromCli(options);

  return withBrowserSession(browserOptionsFromCli(options), async ({ commander, page }) => {
    await gotoWithCommander(commander, url, {
      waitSelector: EDITOR_WAIT_SELECTOR
    });
    const state = await extractHabrEditorStateFromPage(page, {
      minMarkdownEditorChars,
      url
    });
    ensureDirForFile(output);
    writeFileSync(output, state.markdown, 'utf8');
    printJson({
      command: 'download-edit',
      url,
      output,
      mode: state.mode,
      source: state.source,
      sha256: sha256(state.markdown),
      bytes: Buffer.byteLength(state.markdown, 'utf8')
    });
  });
}

async function commandCompare(options) {
  const leftPath = requireOption(options, 'left');
  const rightPath = requireOption(options, 'right');
  const left = readFileSync(leftPath, 'utf8');
  const right = readFileSync(rightPath, 'utf8');
  const comparison = compareMarkdownTexts(left, right);
  printJson({
    command: 'compare',
    left: leftPath,
    right: rightPath,
    ...comparison
  });
  process.exitCode = comparison.exactEqual ? 0 : 1;
}

async function commandApply(options) {
  const url = requireOption(options, 'url');
  const sourcePath = requireOption(options, 'source');
  const markdown = readFileSync(sourcePath, 'utf8');
  const dryRun = !options.write;
  const minMarkdownEditorChars = minMarkdownEditorCharsFromCli(options);

  return withBrowserSession(browserOptionsFromCli(options), async ({ commander, page }) => {
    await gotoWithCommander(commander, url, {
      waitSelector: EDITOR_WAIT_SELECTOR
    });
    const result = await applyMarkdownToHabrEditorPage(page, markdown, {
      dryRun,
      minMarkdownEditorChars,
      allowWysiwygPaste: Boolean(options['allow-wysiwyg-paste'])
    });
    printJson({
      command: 'apply',
      url,
      source: sourcePath,
      dryRun,
      ...result
    });
  });
}

async function commandSync(options) {
  const editUrl = requireOption(options, 'edit-url');
  const sourcePath = requireOption(options, 'source');
  const workDir = resolve(options['work-dir'] || join(ROOT_DIR, 'docs', 'case-studies', 'issue-57', 'runs'));
  const readOnlyUrl = options['readonly-url'] || deriveReadOnlyUrlFromEditUrl(editUrl);
  const readonlyPath = join(workDir, 'readonly.md');
  const editPath = join(workDir, 'edit.md');
  const sourceMarkdown = readFileSync(sourcePath, 'utf8');
  const dryRun = !options.write;
  const minMarkdownEditorChars = minMarkdownEditorCharsFromCli(options);

  mkdirSync(workDir, { recursive: true });

  return withBrowserSession(browserOptionsFromCli(options), async ({ commander, page }) => {
    await gotoWithCommander(commander, readOnlyUrl, {
      waitSelector: '.article-formatted-body'
    });
    const documents = await extractReadOnlyArticleDocumentsFromPage(page);
    const readonlyMarkdown = buildReadOnlyArticleMarkdown({
      ...documents,
      url: readOnlyUrl
    });
    writeFileSync(readonlyPath, readonlyMarkdown, 'utf8');

    await gotoWithCommander(commander, editUrl, {
      waitSelector: EDITOR_WAIT_SELECTOR
    });
    const editState = await extractHabrEditorStateFromPage(page, {
      minMarkdownEditorChars,
      url: editUrl
    });
    writeFileSync(editPath, editState.markdown, 'utf8');

    const currentComparison = compareMarkdownTexts(readonlyMarkdown, editState.markdown);
    if (!currentComparison.exactEqual && !options.force) {
      printJson({
        command: 'sync',
        status: 'blocked',
        reason: 'read-only and edit-form markdown are not byte-identical',
        readonlyPath,
        editPath,
        currentComparison
      });
      process.exitCode = 1;
      return;
    }

    const applyResult = await applyMarkdownToHabrEditorPage(page, sourceMarkdown, {
      dryRun,
      minMarkdownEditorChars,
      allowWysiwygPaste: Boolean(options['allow-wysiwyg-paste'])
    });

    printJson({
      command: 'sync',
      status: dryRun ? 'dry-run' : 'written',
      readonlyUrl: readOnlyUrl,
      editUrl,
      readonlyPath,
      editPath,
      editMode: editState.mode,
      currentComparison,
      applyResult
    });
  });
}

function printHelp() {
  console.log(`
Usage: node scripts/habr-article-sync.mjs <command> [options]

Commands:
  download-readonly --url <article-url> --output <file>
  download-edit     --url <edit-url> --output <file>
  compare           --left <file> --right <file>
  apply             --url <edit-url> --source <markdown-file> [--write]
  sync              --edit-url <edit-url> --source <markdown-file> [--readonly-url <url>] [--write]

Shared browser options:
  --profile <dir>              Persistent browser profile. Default: .browser/habr
  --headed                     Run a visible browser so you can log in or inspect state
  --slow-mo <ms>               Slow browser actions
  --verbose                    Enable browser-commander logs
  --min-markdown-chars <n>     Minimum CodeMirror text length for full Markdown mode detection

Safety options:
  --write                      Actually paste source markdown into the edit form
  --force                      Allow sync to continue when current read-only/edit snapshots differ
  --allow-wysiwyg-paste        Paste into ProseMirror if Markdown mode is not detected

Examples:
  node scripts/habr-article-sync.mjs download-edit --url https://habr.com/ru/article/edit/1018142 --output docs/case-studies/issue-57/edit.md --headed
  node scripts/habr-article-sync.mjs sync --edit-url https://habr.com/ru/article/edit/1018142 --source drafts/0.0.3/article/index.md --headed
  node scripts/habr-article-sync.mjs sync --edit-url https://habr.com/ru/article/edit/1018142 --source drafts/0.0.3/article/index.md --headed --write
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.command || options.command === 'help' || options.command === '--help') {
    printHelp();
    return;
  }

  switch (options.command) {
    case 'download-readonly':
      await commandDownloadReadonly(options);
      break;
    case 'download-edit':
      await commandDownloadEdit(options);
      break;
    case 'compare':
      await commandCompare(options);
      break;
    case 'apply':
      await commandApply(options);
      break;
    case 'sync':
      await commandSync(options);
      break;
    default:
      throw new Error(`Unknown command: ${options.command}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
