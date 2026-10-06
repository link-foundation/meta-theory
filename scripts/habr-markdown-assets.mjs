import { dirname, relative, resolve, sep } from 'node:path';
import MarkdownIt from 'markdown-it';

// Edit only destination spans. Rendering Markdown again would change code,
// whitespace and formatting, making an exact editor/source diff less useful.
export function rewriteMarkdownImages(text, file, root, assetBase) {
  const base = new URL(assetBase.endsWith('/') ? assetBase : assetBase + '/');
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Asset base must be an HTTP(S) URL.');
  const parser = new MarkdownIt();
  const env = {};
  const blocks = parser.parse(text, env);
  const offsets = [0];
  for (const match of text.matchAll(/\n/g)) offsets.push(match.index + 1);
  offsets.push(text.length);
  const replacements = new Map();
  const references = new Set();

  function rewrite(start, end, destination) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(destination)) return;
    const url = new URL(destination, 'https://local.invalid/');
    const path = destination.split(/[?#]/, 1)[0];
    const asset = relative(root, resolve(dirname(file), decodeURIComponent(path))).split(sep).join('/');
    if (asset === '..' || asset.startsWith('../')) throw new Error(`Image is outside the repository: ${destination}`);
    // Encode path components separately so #, spaces and Unicode in filenames
    // cannot turn into a fragment or be resolved against habr.com.
    const target = new URL(asset.split('/').map(encodeURIComponent).join('/'), base);
    target.search = url.search;
    target.hash = url.hash;
    const angle = text[start] === '<';
    replacements.set(start, { end, value: angle ? `<${target.href}>` : target.href });
  }

  const imageRule = parser.inline.ruler.getRules('').find(rule => rule.name === 'image');
  let blockOffset = 0;
  let blockText;
  parser.inline.ruler.at('image', (state, silent) => {
    const start = state.pos;
    const handled = imageRule(state, silent);
    if (!handled || silent || state.src !== blockText) return handled;
    const image = state.tokens.at(-1);
    if (image?.type !== 'image') return handled;
    if (image.meta?.label) {
      references.add(image.meta.label);
      return handled;
    }
    const labelEnd = parser.helpers.parseLinkLabel(state, start + 1, false);
    let destinationStart = labelEnd + 2;
    while (/\s/.test(state.src[destinationStart] || '') && destinationStart < state.pos) destinationStart++;
    const destination = parser.helpers.parseLinkDestination(state.src, destinationStart, state.pos);
    if (destination.ok) rewrite(blockOffset + destinationStart, blockOffset + destination.pos, destination.str);
    return handled;
  });
  // Inline parsing on each original block retains absolute offsets, including
  // CRLF and list/blockquote prefixes, and naturally excludes backtick examples.
  const ranges = blocks.filter(token => (token.type === 'inline' || token.type === 'table_open') && token.map);
  for (const token of ranges) {
    blockOffset = offsets[token.map[0]];
    blockText = text.slice(blockOffset, offsets[token.map[1]]);
    parser.inline.parse(blockText, parser, env, []);
  }

  // Reference destinations are shared by all images using the same label.
  // Mask code blocks before scanning definitions; examples are never assets.
  let definitions = text;
  for (const token of blocks.filter(token => ['fence', 'code_block'].includes(token.type)).reverse()) {
    const start = offsets[token.map[0]], end = offsets[token.map[1]];
    definitions = definitions.slice(0, start) + definitions.slice(start, end).replace(/[^\r\n]/g, ' ') + definitions.slice(end);
  }
  for (const match of definitions.matchAll(/^ {0,3}\[([^\]\r\n]+)\]:\s*/gm)) {
    const label = parser.utils.normalizeReference(match[1]);
    if (!references.has(label)) continue;
    const start = match.index + match[0].length;
    const destination = parser.helpers.parseLinkDestination(definitions, start, definitions.length);
    if (destination.ok && parser.normalizeLink(destination.str) === env.references[label]?.href) {
      rewrite(start, destination.pos, destination.str);
      references.delete(label);
    }
  }
  for (const [start, { end, value }] of [...replacements].sort((a, b) => b[0] - a[0])) {
    text = text.slice(0, start) + value + text.slice(end);
  }
  return text;
}
