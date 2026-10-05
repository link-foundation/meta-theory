import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTwoFilesPatch } from 'diff';

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
    const versions = readdirSync(join(root, 'drafts')).filter(name => /^\d+\.\d+\.\d+$/.test(name));
    versions.sort((a, b) => {
      const left = a.split('.').map(Number), right = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
      return 0;
    });
    const version = options.draft === 'latest' ? versions.at(-1) : options.draft;
    if (!versions.includes(version)) throw new Error(`Unknown draft: ${options.draft}`);
    sourcePath = join(root, 'drafts', version, 'article');
  } else {
    if (!options.source) throw new Error('Provide --source <file/directory> or --draft <version/latest>.');
    sourcePath = resolve(options.source);
  }

  const directory = statSync(sourcePath).isDirectory() ? sourcePath : dirname(sourcePath);
  const assembled = statSync(sourcePath).isDirectory() || basename(sourcePath) === 'index.md';
  const sections = assembled ? readdirSync(directory).filter(name => /^\d+-.*\.md$/.test(name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : [];
  const files = sections.length ? sections.map(name => join(directory, name)) : [sourcePath];
  if (statSync(files[0]).isDirectory()) throw new Error(`No numbered Markdown sections found in ${sourcePath}`);
  const assetBase = options['asset-base-url'] || (sections.length ? ASSET_BASE : null);
  const markdown = files.map(file => {
    let text = readFileSync(file, 'utf8');
    if (assetBase) {
      text = text.replace(/(!\[[^\]]*\]\()([^\s)]+)([^)]*\))/g, (match, before, target, after) => {
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) return match;
        const asset = relative(root, resolve(dirname(file), decodeURI(target))).split(sep).join('/');
        if (asset.startsWith('../')) throw new Error(`Image is outside the repository: ${target}`);
        return before + new URL(asset, assetBase.endsWith('/') ? assetBase : assetBase + '/').href + after;
      });
    }
    return sections.length ? text.replace(/\s+$/, '') : text;
  }).join('\n\n') + (sections.length ? '\n' : '');
  if (!markdown.trim()) throw new Error('Source Markdown is empty.');
  return { path: sourcePath, files, markdown, assetBaseUrl: assetBase };
}
