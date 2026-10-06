import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import { loadMarkdownSource } from '../../scripts/habr-markdown.mjs';

const root = process.cwd();
const parser = new MarkdownIt().use(texmath, { engine: katex, delimiters: 'dollars' });
const flatten = tokens => tokens.flatMap(token => [token, ...flatten(token.children || [])]);
const revisions = ['archive', 'drafts'].flatMap(category => readdirSync(category, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^\d+\.\d+\.\d+$/.test(entry.name)).map(entry => ({ category, version: entry.name })));
const report = revisions.map(({ category, version }) => {
  const source = loadMarkdownSource({ draft: version });
  const tokens = flatten(parser.parse(source.markdown, {}));
  const images = tokens.filter(token => token.type === 'image').map(token => token.attrGet('src'));
  const missingAssets = images.filter(url => !existsSync(resolve(root, decodeURIComponent(url.split('/main/')[1]))));
  if (missingAssets.length) throw new Error(`Missing assets for ${version}: ${missingAssets.join(', ')}`);
  return { category, version, sourceFiles: source.files.map(file => relative(root, file)),
    bytes: Buffer.byteLength(source.markdown), sha256: createHash('sha256').update(source.markdown).digest('hex'),
    figures: images.length, codeBlocks: tokens.filter(token => token.type === 'fence').length,
    formulas: tokens.filter(token => token.type.startsWith('math_')).length, missingAssets };
});
console.log(JSON.stringify({ latest: relative(root, loadMarkdownSource({ draft: 'latest' }).path), revisions: report }, null, 2));
