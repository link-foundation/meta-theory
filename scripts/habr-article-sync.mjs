#!/usr/bin/env node

/**
 * Habr article state synchronization helper.
 *
 * The tool uses browser-commander for persistent browser launch/navigation and
 * raw Playwright DOM operations for the Habr editor's CodeMirror/ProseMirror
 * surfaces.
 */

import { createHash } from 'crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'url';

import { launchBrowser, makeBrowserCommander } from 'browser-commander';
import { extractHabrEditorStateFromPage, replaceHabrEditorMarkdown, installReadOnlyNetworkGuard } from './habr-editor.mjs';
import { createMarkdownDiff, loadMarkdownSource } from './habr-markdown.mjs';
export { extractHabrEditorStateFromPage, installReadOnlyNetworkGuard, createMarkdownDiff, loadMarkdownSource };
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
const DEFAULT_MIN_MARKDOWN_EDITOR_CHARS = 0;
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

export async function applyMarkdownToHabrEditorPage(page, markdown, options = {}) {
  if (typeof markdown !== 'string' || !markdown.trim()) throw new Error('Source markdown must be a non-empty string.');
  const current = await extractHabrEditorStateFromPage(page, options);
  const comparison = compareMarkdownTexts(current.markdown, markdown);
  const result = { dryRun: options.dryRun !== false, written: false, targetMode: current.mode,
    comparison, warnings: current.warnings || [], diff: createMarkdownDiff(current.markdown, markdown), currentMarkdown: current.markdown };
  if (result.dryRun || comparison.exactEqual) return result;
  const written = await replaceHabrEditorMarkdown(page, markdown, options);
  return { ...result, dryRun: false, written: true,
    postWriteComparison: compareMarkdownTexts(written.markdown, markdown),
    postWriteDiff: createMarkdownDiff(written.markdown, markdown, 'editor-after.md', 'source.md'),
    postWriteMarkdown: written.markdown };
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

export function buildReadOnlyArticleMarkdown({ metadataHtml, contentHtml, url, includeMetadata = false }) {
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

  if (!includeMetadata) return postProcessMarkdown(contentResult.markdown.trim() + '\n');
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
    verbose = false,
    launch = 'engine',
    executablePath,
    noSandbox = false,
    allowRemoteWrites = false
  } = options;

  // Habr also autosaves to localStorage. A guarded session uses a disposable
  // profile copy so closing prefill really discards unsent changes. Cookies
  // and existing local draft state are retained, but worker registrations,
  // restored tabs and browser caches cannot bypass the new network guard.
  const temporaryProfile = allowRemoteWrites ? null : mkdtempSync(join(tmpdir(), 'habr-sync-profile-'));
  const skipped = new Set(['Service Worker', 'Sessions', 'Cache', 'Code Cache', 'GPUCache',
    'SingletonLock', 'SingletonSocket', 'SingletonCookie', 'lockfile']);
  let browser, page;
  try {
    if (temporaryProfile && existsSync(profileDir)) {
      cpSync(profileDir, temporaryProfile, { recursive: true, filter: path => !skipped.has(basename(path)) });
    }
    if (verbose && temporaryProfile) console.error('[habr-sync] using disposable copy of the login profile');
    ({ browser, page } = await launchBrowser({
      engine: 'playwright', launch, executablePath,
      args: noSandbox ? ['--no-sandbox'] : [],
      restrictions: allowRemoteWrites ? [] : ['no-extensions', 'no-sync', 'no-background-networking'],
      headless, userDataDir: temporaryProfile || profileDir, slowMo, verbose
    }));
  } catch (error) {
    if (temporaryProfile) rmSync(temporaryProfile, { recursive: true, force: true });
    throw error;
  }
  let guard, commander;
  try {
    // Install before navigation: Habr autosaves on input, blur and close.
    guard = allowRemoteWrites ? null : await installReadOnlyNetworkGuard(page, { verbose });
    if (!allowRemoteWrites) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Network.setBypassServiceWorker', { bypass: true });
      await cdp.detach();
    }
    commander = makeBrowserCommander({
      page,
      verbose,
      enableNetworkTracking: false,
      enableNavigationManager: false
    });
  } catch (error) {
    try { await browser.close(); } finally {
      if (temporaryProfile) rmSync(temporaryProfile, { recursive: true, force: true });
    }
    throw error;
  }

  return {
    browser,
    page,
    commander,
    guard,
    close: async () => {
      try { await commander.destroy(); } finally {
        try { await browser.close(); } finally {
          if (temporaryProfile) rmSync(temporaryProfile, { recursive: true, force: true });
        }
      }
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
    const result = await fn(session);
    if (options.allowRemoteWrites && options.autosaveWaitMs) {
      await session.page.waitForTimeout(options.autosaveWaitMs);
    }
    if (options.keepOpen) {
      console.error('Browser is open for review. Press Enter to close it.');
      const input = createInterface({ input: process.stdin, output: process.stderr });
      try { await input.question(''); } finally { input.close(); }
    }
    return result;
  } finally {
    await session.close();
  }
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {
    command,
    positional: []
  };
  const flags = new Set(['write', 'headed', 'verbose', 'force', 'allow-wysiwyg-paste', 'keep-open', 'json', 'include-metadata', 'no-sandbox']);
  const values = new Set(['url', 'output', 'left', 'right', 'source', 'draft', 'edit-url', 'readonly-url', 'work-dir',
    'profile', 'slow-mo', 'min-markdown-chars', 'diff-output', 'launch', 'executable-path', 'wait-ms', 'asset-base-url', 'autosave-wait-ms']);

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith('--')) {
      options.positional.push(arg);
      continue;
    }

    const eqIndex = arg.indexOf('=');
    if (eqIndex !== -1) {
      const name = arg.slice(2, eqIndex);
      if (flags.has(name)) throw new Error(`--${name} is a boolean flag and does not accept a value.`);
      if (!values.has(name)) throw new Error(`Unknown option: --${name}`);
      if (!arg.slice(eqIndex + 1)) throw new Error(`Missing value for --${name}`);
      options[name] = arg.slice(eqIndex + 1);
      continue;
    }

    const name = arg.slice(2);
    if (flags.has(name)) { options[name] = true; continue; }
    if (!values.has(name)) throw new Error(`Unknown option: --${name}`);
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) {
      options[name] = next;
      i++;
    } else {
      throw new Error(`Missing value for --${name}`);
    }
  }

  if (options.positional.length) throw new Error(`Unexpected argument: ${options.positional[0]}`);
  if (options.launch && !['real', 'engine'].includes(options.launch)) throw new Error('--launch must be real or engine.');
  if (options.write && !['apply', 'prefill', 'sync'].includes(command)) throw new Error('--write is only supported by apply, prefill and sync.');
  if (options['keep-open'] && (!options.headed || !process.stdin.isTTY)) {
    throw new Error('--keep-open requires --headed and an interactive terminal.');
  }
  for (const name of ['slow-mo', 'min-markdown-chars', 'wait-ms', 'autosave-wait-ms']) {
    if (options[name] !== undefined && (!Number.isFinite(Number(options[name])) || Number(options[name]) < 0)) {
      throw new Error(`--${name} must be a non-negative number.`);
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
    verbose: Boolean(options.verbose),
    launch: options.launch || 'engine',
    executablePath: options['executable-path'],
    noSandbox: Boolean(options['no-sandbox']),
    keepOpen: Boolean(options['keep-open']),
    allowRemoteWrites: Boolean(options.write),
    autosaveWaitMs: options['autosave-wait-ms'] !== undefined ? Number(options['autosave-wait-ms']) : 3000
  };
}

function minMarkdownEditorCharsFromCli(options) {
  return options['min-markdown-chars']
    ? Number(options['min-markdown-chars'])
    : DEFAULT_MIN_MARKDOWN_EDITOR_CHARS;
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function reportDiff(options, diff) {
  if (options['diff-output']) {
    ensureDirForFile(options['diff-output']);
    writeFileSync(options['diff-output'], diff, 'utf8');
  }
  if (!options.json && diff) process.stdout.write(diff);
}

function editorNavigationOptions(options) {
  return { waitSelector: EDITOR_WAIT_SELECTOR, waitTimeout: options['wait-ms'] ? Number(options['wait-ms']) : DEFAULT_EDITOR_WAIT_MS };
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
      url,
      includeMetadata: Boolean(options['include-metadata'])
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
  const source = options.source || options.draft ? loadMarkdownSource(options) : null;
  if (options['diff-output'] && !source) throw new Error('download-edit --diff-output requires --source or --draft.');

  return withBrowserSession(browserOptionsFromCli(options), async ({ commander, page }) => {
    await gotoWithCommander(commander, url, editorNavigationOptions(options));
    const state = await extractHabrEditorStateFromPage(page, {
      minMarkdownEditorChars,
      url
    });
    ensureDirForFile(output);
    writeFileSync(output, state.markdown, 'utf8');
    const comparison = source ? compareMarkdownTexts(state.markdown, source.markdown) : null;
    const diff = source ? createMarkdownDiff(state.markdown, source.markdown, output, source.path) : '';
    if (source) reportDiff(options, diff);
    printJson({
      command: 'download-edit',
      url,
      output,
      mode: state.mode,
      source: state.source,
      warnings: state.warnings || [],
      comparison,
      ...(options.json ? { diff } : {}),
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
  const diff = createMarkdownDiff(left, right, leftPath, rightPath);
  reportDiff(options, diff);
  printJson({
    command: 'compare',
    left: leftPath,
    right: rightPath,
    ...comparison,
    ...(options.json ? { diff } : {})
  });
  process.exitCode = comparison.exactEqual ? 0 : 1;
}

async function commandApply(options) {
  const url = requireOption(options, 'url');
  const source = loadMarkdownSource(options);
  const markdown = source.markdown;
  const dryRun = options.command !== 'prefill' && !options.write;
  const minMarkdownEditorChars = minMarkdownEditorCharsFromCli(options);

  return withBrowserSession(browserOptionsFromCli(options), async ({ commander, page }) => {
    await gotoWithCommander(commander, url, editorNavigationOptions(options));
    const workDir = resolve(options['work-dir'] || join(ROOT_DIR, '.browser', 'habr-sync', 'runs'));
    mkdirSync(workDir, { recursive: true });
    const before = await extractHabrEditorStateFromPage(page, { minMarkdownEditorChars, url });
    writeFileSync(join(workDir, 'edit-before.md'), before.markdown);
    writeFileSync(join(workDir, 'source.md'), markdown);
    // Persist recovery artifacts before invoking editor code, including when
    // a clipboard parser fails after partially changing the document.
    const result = await applyMarkdownToHabrEditorPage(page, markdown, {
      dryRun,
      minMarkdownEditorChars,
      allowWysiwygPaste: Boolean(options['allow-wysiwyg-paste'])
    });
    reportDiff(options, result.diff);
    if (result.postWriteMarkdown !== undefined) {
      writeFileSync(join(workDir, 'edit-after.md'), result.postWriteMarkdown);
      writeFileSync(join(workDir, 'after-source.diff'), result.postWriteDiff);
    }
    const { currentMarkdown, postWriteMarkdown, diff, postWriteDiff, ...summary } = result;
    const mismatch = result.postWriteComparison && !result.postWriteComparison.exactEqual;
    if (mismatch) process.exitCode = 1;
    printJson({
      command: options.command,
      status: mismatch ? 'verification-mismatch' : dryRun ? 'dry-run' : !result.written ? 'unchanged' : options.write ? 'written' : 'prefilled',
      url,
      source: source.path,
      sourceFiles: source.files,
      workDir,
      remoteWritesEnabled: Boolean(options.write),
      dryRun,
      ...summary,
      ...(options.json ? { diff, postWriteDiff } : {})
    });
  });
}

async function commandSync(options) {
  const editUrl = requireOption(options, 'edit-url');
  const source = loadMarkdownSource(options);
  const workDir = resolve(options['work-dir'] || join(ROOT_DIR, '.browser', 'habr-sync', 'runs'));
  const readOnlyUrl = options['readonly-url'] || deriveReadOnlyUrlFromEditUrl(editUrl);
  const readonlyPath = join(workDir, 'readonly.md');
  const editPath = join(workDir, 'edit.md');
  const sourceMarkdown = source.markdown;
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

    await gotoWithCommander(commander, editUrl, editorNavigationOptions(options));
    const editState = await extractHabrEditorStateFromPage(page, {
      minMarkdownEditorChars,
      url: editUrl
    });
    writeFileSync(editPath, editState.markdown, 'utf8');

    const currentComparison = compareMarkdownTexts(readonlyMarkdown, editState.markdown);
    const currentDiff = createMarkdownDiff(readonlyMarkdown, editState.markdown, readonlyPath, editPath);
    const sourceDiff = createMarkdownDiff(editState.markdown, sourceMarkdown, editPath, source.path);
    writeFileSync(join(workDir, 'readonly-edit.diff'), currentDiff);
    writeFileSync(join(workDir, 'edit-source.diff'), sourceDiff);
    writeFileSync(join(workDir, 'source.md'), sourceMarkdown);
    if (!options.json && currentDiff) process.stdout.write(currentDiff);
    reportDiff(options, sourceDiff);
    if (!currentComparison.exactEqual && !options.force) {
      printJson({
        command: 'sync',
        status: 'blocked',
        reason: 'read-only and edit-form markdown are not byte-identical',
        readonlyPath,
        editPath,
        currentComparison,
        sourceComparison: compareMarkdownTexts(editState.markdown, sourceMarkdown),
        ...(options.json ? { currentDiff, sourceDiff } : {})
      });
      process.exitCode = 1;
      return;
    }

    const applyResult = await applyMarkdownToHabrEditorPage(page, sourceMarkdown, {
      dryRun,
      minMarkdownEditorChars,
      allowWysiwygPaste: Boolean(options['allow-wysiwyg-paste'])
    });

    if (applyResult.postWriteMarkdown !== undefined) {
      writeFileSync(join(workDir, 'edit-after.md'), applyResult.postWriteMarkdown);
      writeFileSync(join(workDir, 'after-source.diff'), applyResult.postWriteDiff);
    }
    const { currentMarkdown, postWriteMarkdown, diff, postWriteDiff, ...summary } = applyResult;
    const mismatch = applyResult.postWriteComparison && !applyResult.postWriteComparison.exactEqual;
    if (mismatch) process.exitCode = 1;
    printJson({
      command: 'sync',
      status: mismatch ? 'verification-mismatch' : dryRun ? 'dry-run' : applyResult.written ? 'written' : 'unchanged',
      readonlyUrl: readOnlyUrl,
      editUrl,
      readonlyPath,
      editPath,
      editMode: editState.mode,
      currentComparison,
      remoteWritesEnabled: Boolean(options.write),
      applyResult: summary,
      ...(options.json ? { currentDiff, sourceDiff, postWriteDiff } : {})
    });
  });
}

async function commandLogin(options) {
  if (!options.headed || !process.stdin.isTTY) throw new Error('login requires --headed and an interactive terminal.');
  const url = requireOption(options, 'url');
  const session = await createBrowserSession({ ...browserOptionsFromCli(options), allowRemoteWrites: true });
  const input = createInterface({ input: process.stdin, output: process.stderr });
  try {
    await gotoWithCommander(session.commander, url);
    await input.question('Log in manually, then press Enter here to close and retain the profile. ');
  } finally { input.close(); await session.close(); }
}

function commandPrepare(options) {
  const output = requireOption(options, 'output');
  const source = loadMarkdownSource(options);
  ensureDirForFile(output);
  writeFileSync(output, source.markdown);
  printJson({ command: 'prepare', output, sourceFiles: source.files, sha256: sha256(source.markdown) });
}

function printHelp() {
  console.log(`
Usage: node scripts/habr-article-sync.mjs <command> [options]

Commands:
  login             --url <edit-url> --headed
  prepare           --draft <version/latest> --output <file>
  download-readonly --url <article-url> --output <file>
  download-edit     --url <edit-url> --output <file>
  compare           --left <file> --right <file>
  apply             --url <edit-url> (--source <file/dir> | --draft <version/latest>) [--write]
  prefill           --url <edit-url> (--source <file/dir> | --draft <version/latest>) [--write]
  sync              --edit-url <edit-url> (--source <file/dir> | --draft <version/latest>) [--write]

Shared browser options:
  --profile <dir>              Persistent browser profile. Default: .browser/habr
  --headed                     Run a visible browser so you can log in or inspect state
  --slow-mo <ms>               Slow browser actions
  --verbose                    Enable browser-commander logs
  --min-markdown-chars <n>     Minimum CodeMirror text length for full Markdown mode detection
  --launch <engine/real>        Bundled Chromium (default) or installed Chrome
  --executable-path <path>      Explicit browser executable
  --no-sandbox                  Explicit opt-in for containers without Chromium sandbox support
  --wait-ms <ms>                Wait for the editor (default 30000)
  --autosave-wait-ms <ms>        Give opt-in draft autosaves time before closing (default 3000)
  --keep-open                   Keep a headed browser open until Enter is pressed
  --diff-output <file>          Export a unified diff (also printed by default)
  --json                        Output JSON with diff strings, without terminal patches
  --asset-base-url <url>        Base for repository-relative images in an assembled draft
  --include-metadata            Include public metadata in download-readonly (default: title/body)

Source selection:
  --draft <version/latest>      Draft version, archived version, or highest numeric draft
  --source <file/dir>           Markdown file, version directory, or numbered section directory
  --work-dir <dir>              Snapshot/diff directory (default: .browser/habr-sync/runs)

Safety options:
  --write                      Allow editor changes and remote draft autosaves
  --force                      Allow sync to continue when current read-only/edit snapshots differ
  --allow-wysiwyg-paste        Use Habr's Markdown clipboard parser in the visual editor

apply/sync are dry-run by default. prefill changes the local browser buffer but
blocks non-read HTTP requests and WebSockets unless --write is passed.
Guarded sessions use disposable copies of the login profile and discard local autosaves.
These commands never click save, submit, settings or publish buttons.

Examples:
  node scripts/habr-article-sync.mjs download-edit --url https://habr.com/ru/article/edit/1018142 --output docs/case-studies/issue-57/edit.md --headed
  node scripts/habr-article-sync.mjs download-edit --url https://habr.com/ru/article/edit/1018142 --output .browser/edit.md --draft latest --diff-output .browser/editor.diff
  node scripts/habr-article-sync.mjs prefill --url https://habr.com/ru/article/edit/1018142 --draft latest --headed --keep-open --allow-wysiwyg-paste
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.command || options.command === 'help' || options.command === '--help') {
    printHelp();
    return;
  }

  // Upstream verbose launch/navigation diagnostics use console.log. Keep the
  // CLI's machine-readable report on stdout and retain tracing on stderr.
  if (options.json) console.log = console.error.bind(console);

  switch (options.command) {
    case 'login':
      await commandLogin(options);
      break;
    case 'prepare':
      commandPrepare(options);
      break;
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
    case 'prefill':
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
