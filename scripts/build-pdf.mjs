#!/usr/bin/env node

// Offline Markdown → print-ready PDF. Run with --help for usage.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import puppeteer from 'puppeteer';
import { zipSync } from 'fflate';

const require = createRequire(import.meta.url);
export const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const numericSort = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const sectionId = (source) => `section-${basename(source, '.md')}`;
const slug = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

async function entries(path) {
  try { return await readdir(path, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export async function discoverDocuments(rootDir = ROOT_DIR) {
  const documents = [];
  for (const category of ['archive', 'drafts']) {
    for (const entry of await entries(join(rootDir, category))) {
      if (!entry.isDirectory() || !/^0\.0\.(0|[1-9]\d*)$/.test(entry.name)) continue;
      const folder = `${category}/${entry.name}`;
      const files = await entries(join(rootDir, folder));
      let sources;
      if (files.some((file) => file.isFile() && file.name === 'article.md')) {
        sources = [`${folder}/article.md`];
      } else {
        sources = (await entries(join(rootDir, folder, 'article')))
          .filter((file) => file.isFile() && /^\d+-.+\.md$/.test(file.name))
          .map((file) => `${folder}/article/${file.name}`).sort(numericSort);
      }
      if (!sources.length) throw new Error(`No article sources found in ${folder}`);
      if (documents.some((doc) => doc.version === entry.name)) throw new Error(`Duplicate theory version: ${entry.name}`);
      const first = await readFile(join(rootDir, sources[0]), 'utf8');
      const title = first.match(/^#\s+(.+)$/m)?.[1] ?? `Meta-theory ${entry.name}`;
      documents.push({ version: entry.name, title, language: /[А-Яа-яЁё]/u.test(title) ? 'ru' : 'en', draft: category === 'drafts', sources, filename: `meta-theory-${entry.name}.pdf` });
    }
  }
  return documents.sort((a, b) => numericSort(a.version, b.version));
}

let stylesPromise;
async function embeddedStyles() {
  if (!stylesPromise) stylesPromise = (async () => {
    const files = [require.resolve('katex/dist/katex.min.css'), join(ROOT_DIR, 'scripts/pdf.css')];
    for (const subset of ['latin', 'cyrillic']) {
      for (const style of ['400', '700', '400-italic']) files.push(require.resolve(`@fontsource/noto-serif/${subset}-${style}.css`));
      files.push(require.resolve(`@fontsource/noto-sans-mono/${subset}-400.css`));
    }
    const css = [];
    for (const file of files) {
      let content = await readFile(file, 'utf8');
      // Retain only WOFF2 rather than embedding three formats of each font.
      content = content.replace(/src:[^;]+;/g, (src) => {
        const woff = src.match(/url\(([^)]+\.woff2[^)]*)\)/);
        return woff ? `src: url(${woff[1]}) format('woff2');` : src;
      });
      const urls = [...content.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)];
      for (const [full, url] of urls) {
        const bytes = await readFile(resolve(dirname(file), url));
        content = content.replace(full, `url(data:${MIME[extname(url)]};base64,${bytes.toString('base64')})`);
      }
      css.push(content);
    }
    return css.join('\n');
  })();
  return stylesPromise;
}

export async function renderDocument(document, { rootDir = ROOT_DIR, sourceRef = 'main' } = {}) {
  const md = new MarkdownIt({ html: false, linkify: true }).use(texmath, { engine: katex, delimiters: 'dollars' });
  // texmath's default renderer catches parse failures; publication must fail instead.
  for (const name of [...texmath.inlineRuleNames, ...texmath.blockRuleNames]) {
    // The archived scraper encoded \% as \\%; TeX treats the latter as a
    // line break followed by a comment, silently dropping the percent sign.
    md.renderer.rules[name] = (tokens, index) => katex.renderToString(tokens[index].content.replace(/\\\\%/g, '\\%'), {
      displayMode: name !== 'math_inline', throwOnError: true, strict: 'ignore', trust: false,
    });
  }
  const sections = [];
  for (const source of document.sources) {
    const tokens = md.parse(await readFile(join(rootDir, source), 'utf8'), {});
    const usedIds = new Map();
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      if (token.type === 'heading_open') {
        const base = `${sectionId(source)}-${slug(tokens[index + 1].content)}`;
        const count = usedIds.get(base) ?? 0;
        usedIds.set(base, count + 1);
        token.attrSet('id', count ? `${base}-${count}` : base);
      }
      for (const child of token.children ?? []) {
        if (child.type === 'image') {
          const url = child.attrGet('src');
          if (/^(?:[a-z]+:|\/\/)/i.test(url)) throw new Error(`Figures must be local: ${source}: ${url}`);
          const asset = resolve(rootDir, dirname(source), decodeURIComponent(url));
          const local = relative(resolve(rootDir), asset);
          if (local.startsWith(`..${sep}`) || local === '..' || !MIME[extname(asset)]) throw new Error(`Invalid local figure: ${source}: ${url}`);
          let bytes;
          try { bytes = await readFile(asset); }
          catch (error) { throw new Error(`Missing figure in ${source}: ${url}`, { cause: error }); }
          child.attrSet('src', `data:${MIME[extname(asset)]};base64,${bytes.toString('base64')}`);
        }
        if (child.type === 'link_open') {
          const href = child.attrGet('href');
          if (/^(?:[a-z]+:|\/\/)/i.test(href)) continue;
          const [path, fragment] = href.split('#');
          const destination = path ? relative(rootDir, resolve(rootDir, dirname(source), decodeURIComponent(path))).split(sep).join('/') : source;
          if (document.sources.includes(destination)) {
            child.attrSet('href', `#${sectionId(destination)}${fragment ? `-${slug(decodeURIComponent(fragment))}` : ''}`);
          } else {
            child.attrSet('href', `https://github.com/link-foundation/meta-theory/blob/${sourceRef}/${destination}${fragment ? `#${fragment}` : ''}`);
          }
        }
      }
    }
    sections.push(`<section id="${sectionId(source)}">${md.renderer.render(tokens, md.options, {})}</section>`);
  }
  return `<!doctype html><html lang="${document.language}"><head><meta charset="utf-8"><title>${md.utils.escapeHtml(document.title)}</title><style>${await embeddedStyles()}</style></head><body>
<div class="edition">Theory ${document.version}${document.draft ? ' · Draft / Черновик' : ''}</div>
${sections.join('\n')}
</body></html>`;
}

export async function buildPdfs({ rootDir = ROOT_DIR, outputDir = join(ROOT_DIR, 'dist/pdf'), versions, verbose = false } = {}) {
  const available = await discoverDocuments(rootDir);
  if (versions?.some((version) => !available.some((doc) => doc.version === version))) throw new Error(`Unknown theory version. Available: ${available.map((doc) => doc.version).join(', ')}`);
  const documents = versions ? available.filter((doc) => versions.includes(doc.version)) : available;
  if (!documents.length) throw new Error('No theory documents found');
  await mkdir(outputDir, { recursive: true });
  let sourceCommit = null;
  try { sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* Fixtures need not be git repositories. */ }
  const manifest = { sourceCommit, documents: [] };
  const browser = await puppeteer.launch({ headless: true, ...(process.env.PDF_NO_SANDBOX === '1' ? { args: ['--no-sandbox'] } : {}) });
  try {
    for (const document of documents) {
      const html = await renderDocument(document, { rootDir, sourceRef: sourceCommit ?? 'main' });
      const page = await browser.newPage();
      try {
        await page.setRequestInterception(true);
        page.on('request', (request) => /^(data:|about:)/.test(request.url()) ? request.continue() : request.abort());
        if (verbose) page.on('console', (message) => console.log(`[${document.version}] ${message.text()}`));
        await page.setContent(html, { waitUntil: 'load' });
        await page.emulateMediaType('print');
        const broken = await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => {})));
          return Array.from(document.images).filter((image) => !image.naturalWidth).map((image) => image.alt);
        });
        if (broken.length) throw new Error(`Undecodable figures in ${document.version}: ${broken.join(', ')}`);
        const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true,
          displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#555"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
          margin: { top: '18mm', right: '18mm', bottom: '20mm', left: '18mm' } });
        await writeFile(join(outputDir, document.filename), pdf);
        await writeFile(join(outputDir, document.filename.replace(/\.pdf$/, '.html')), html);
        manifest.documents.push({ ...document, sha256: hash(pdf), bytes: pdf.length });
        console.log(`Built ${document.filename} (${pdf.length} bytes, ${document.sources.length} source files)`);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
  const bundleFiles = {};
  for (const document of manifest.documents) bundleFiles[document.filename] = new Uint8Array(await readFile(join(outputDir, document.filename)));
  const bundle = zipSync(bundleFiles, { level: 0 });
  await writeFile(join(outputDir, 'meta-theory-pdfs.zip'), bundle);
  manifest.bundle = { filename: 'meta-theory-pdfs.zip', sha256: hash(bundle), bytes: bundle.length };
  await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const checksums = [...manifest.documents.map((doc) => `${doc.sha256}  ${doc.filename}`), `${manifest.bundle.sha256}  ${manifest.bundle.filename}`, `${hash(await readFile(join(outputDir, 'manifest.json')))}  manifest.json`];
  await writeFile(join(outputDir, 'SHA256SUMS'), `${checksums.join('\n')}\n`);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node scripts/build-pdf.mjs [--all | 0.0.x] [--output DIR] [--verbose]');
  } else {
    try {
      let outputDir;
      let version;
      for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === '--output' && args[index + 1]) outputDir = resolve(args[++index]);
        else if (arg === '--all' || arg === '--verbose') continue;
        else if (/^0\.0\.\d+$/.test(arg) && !version) version = arg;
        else throw new Error(`Unknown or incomplete argument: ${arg}`);
      }
      await buildPdfs({ outputDir, versions: version ? [version] : undefined, verbose: args.includes('--verbose') });
    } catch (error) { console.error(error); process.exitCode = 1; }
  }
}
