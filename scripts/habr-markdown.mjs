import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTwoFilesPatch } from 'diff';
import { rewriteMarkdownImages } from './habr-markdown-assets.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ASSET_BASE = 'https://raw.githubusercontent.com/link-foundation/meta-theory/main/';

export function createMarkdownDiff(left, right, leftName = 'current.md', rightName = 'source.md') {
  if (left === right) return '';
  return createTwoFilesPatch(leftName, rightName, left, right, '', '', { context: 3 });
}

export function loadMarkdownSource(options = {}, root = ROOT) {
  if (options.source && options.draft) throw new Error('Choose either --source or --draft.');
  let sourcePath;
  if (options.draft) {
    const draftRoot = join(root, 'drafts');
    const versions = existsSync(draftRoot) ? readdirSync(draftRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^\d+\.\d+\.\d+$/.test(entry.name)).map(entry => entry.name) : [];
    versions.sort((a, b) => {
      const left = a.split('.').map(Number), right = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
      return 0;
    });
    const version = options.draft === 'latest' ? versions.at(-1) : options.draft;
    if (versions.includes(version)) sourcePath = join(root, 'drafts', version);
    else if (/^\d+\.\d+\.\d+$/.test(version || '') && existsSync(join(root, 'archive', version))) {
      sourcePath = join(root, 'archive', version);
    } else throw new Error(`Unknown draft: ${options.draft}`);
  } else {
    if (!options.source) throw new Error('Provide --source <file/directory> or --draft <version/latest>.');
    sourcePath = resolve(options.source);
  }

  const directorySelected = statSync(sourcePath).isDirectory();
  if (directorySelected) {
    if (existsSync(join(sourcePath, 'article.md'))) sourcePath = join(sourcePath, 'article.md');
    else if (existsSync(join(sourcePath, 'article')) && statSync(join(sourcePath, 'article')).isDirectory()) sourcePath = join(sourcePath, 'article');
  }
  const directory = statSync(sourcePath).isDirectory() ? sourcePath : dirname(sourcePath);
  const assembled = statSync(sourcePath).isDirectory() || basename(sourcePath) === 'index.md';
  const sections = assembled ? readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^\d+-.+\.md$/.test(entry.name)).map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : [];
  const files = sections.length ? sections.map(name => join(directory, name)) : [sourcePath];
  if (statSync(files[0]).isDirectory()) throw new Error(`No numbered Markdown sections found in ${sourcePath}`);
  const assetBase = options['asset-base-url'] || (sections.length || options.draft || directorySelected ? ASSET_BASE : null);
  const markdown = files.map(file => {
    let text = readFileSync(file, 'utf8');
    if (assetBase) text = rewriteMarkdownImages(text, file, root, assetBase);
    return sections.length ? text.replace(/\s+$/, '') : text;
  }).join('\n\n') + (sections.length ? '\n' : '');
  if (!markdown.trim()) throw new Error('Source Markdown is empty.');
  return { path: sourcePath, files, markdown, assetBaseUrl: assetBase };
}
