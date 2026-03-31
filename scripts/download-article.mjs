#!/usr/bin/env node

/**
 * Script to download article content from web pages and convert to markdown
 *
 * This script extracts article content from Habr and converts it to markdown format.
 * It handles:
 * - Title extraction
 * - Headings (h2, h3, h4)
 * - Paragraphs with inline links
 * - Code blocks with syntax highlighting (preserves newlines from <br> tags)
 * - Lists (ordered and unordered)
 * - Blockquotes
 * - Images and figures with captions
 * - Links preservation
 * - LaTeX math formulas (extracted from img.formula elements' `source` attribute)
 *
 * FORMULA EXTRACTION:
 * Habr renders formulas as SVG/PNG images with class "formula". The original LaTeX
 * source code is stored in the `source` attribute of these img elements. This script
 * automatically extracts and converts them to proper LaTeX markdown format ($...$).
 *
 * Usage:
 *   node scripts/download-article.mjs [version]
 *   node scripts/download-article.mjs --all
 *
 * Examples:
 *   node scripts/download-article.mjs 0.0.1
 *   node scripts/download-article.mjs --all
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getArticle, getAllArticles } from './articles-config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    version: null,
    all: false,
    dryRun: false,
    verbose: false,
    outputFile: 'article.md'  // Default output file, can be changed with --downloaded
  };

  for (const arg of args) {
    if (arg === '--all') {
      options.all = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--downloaded') {
      options.outputFile = 'downloaded.md';
    } else if (!arg.startsWith('-')) {
      options.version = arg;
    }
  }

  return options;
}

/**
 * Extract article content from web page and convert to markdown
 */
async function extractArticleContent(article, verbose = false) {
  if (verbose) console.log('   Loading web page:', article.url);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Navigate to the page
  await page.goto(article.url, {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });

  // Wait for article body to appear
  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });

  // Scroll through the page to trigger lazy loading
  await page.evaluate(async () => {
    const scrollHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const scrollSteps = Math.ceil(scrollHeight / viewportHeight);

    for (let i = 0; i < scrollSteps; i++) {
      window.scrollTo(0, i * viewportHeight);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    window.scrollTo(0, 0);
  });

  // Wait for dynamic content
  await page.waitForTimeout(2000);

  // Extract article metadata from the page header area
  const metadata = await page.evaluate(() => {
    const meta = {};

    // Author
    const authorEl = document.querySelector('.tm-user-info__username');
    if (authorEl) {
      meta.author = authorEl.innerText.trim();
      meta.authorUrl = authorEl.href || null;
    }

    // Publication date
    const timeEl = document.querySelector('time[datetime]');
    if (timeEl) {
      meta.publishDate = timeEl.getAttribute('datetime');
      meta.publishDateText = timeEl.innerText.trim();
    }

    // Reading time
    const readTimeEl = document.querySelector('.tm-article-reading-time__label');
    if (readTimeEl) {
      meta.readingTime = readTimeEl.innerText.trim();
    }

    // Difficulty level
    const diffEl = document.querySelector('.tm-article-complexity__label');
    if (diffEl) {
      meta.difficulty = diffEl.innerText.trim();
    }

    // Views
    const viewsEl = document.querySelector('.tm-icon-counter__value');
    if (viewsEl) {
      meta.views = viewsEl.getAttribute('title') || viewsEl.innerText.trim();
    }

    // Hubs (use specific hub link selector to avoid duplicates)
    const hubEls = document.querySelectorAll('.tm-publication-hub__link');
    meta.hubs = Array.from(hubEls).map(el => {
      // Get only the first span text (hub name), not the asterisk
      const nameSpan = el.querySelector('span:first-child');
      return nameSpan ? nameSpan.innerText.trim() : el.innerText.trim().replace(/\s*\*\s*$/, '');
    });

    // Tags from meta keywords
    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (keywordsMeta) {
      const content = keywordsMeta.getAttribute('content');
      if (content) {
        meta.tags = content.split(',').map(t => t.trim()).filter(Boolean);
      }
    }

    // Translation badge - detect if article is a translation
    const translationLabelEl = document.querySelector('.tm-publication-label_variant-translation');
    if (translationLabelEl) {
      meta.isTranslation = true;
      meta.translationLabel = translationLabelEl.innerText.trim();
    }

    // Translation / original author info and link to original article
    const originLinkEl = document.querySelector('.tm-article-presenter__origin-link');
    if (originLinkEl) {
      meta.originalArticleUrl = originLinkEl.href || null;
      // Extract just the author names from the span inside the link
      const authorSpan = originLinkEl.querySelector('span');
      if (authorSpan) {
        meta.originalAuthors = authorSpan.innerText.trim();
      }
      // Full text includes the label like "Original author: ..."
      meta.originalAuthorText = originLinkEl.innerText.trim();
    }

    // LD+JSON structured data for additional metadata
    const ldJsonScript = document.querySelector('script[type="application/ld+json"]');
    if (ldJsonScript) {
      try {
        const ldData = JSON.parse(ldJsonScript.textContent);
        if (ldData.dateModified) meta.dateModified = ldData.dateModified;
        if (ldData.author?.name) meta.authorFullName = ldData.author.name;
      } catch (e) {
        // ignore parse errors
      }
    }

    // Votes (upvotes/downvotes)
    const votesEl = document.querySelector('.tm-votes-meter__value');
    if (votesEl) {
      meta.votes = votesEl.innerText.trim();
    }

    // Comments count
    const commentsEl = document.querySelector('.tm-article-comments-counter-link__value');
    if (commentsEl) {
      meta.comments = commentsEl.innerText.trim();
    }

    // Bookmarks count
    const bookmarksEl = document.querySelector('.bookmarks-button__counter');
    if (bookmarksEl) {
      meta.bookmarks = bookmarksEl.innerText.trim();
    }

    // Author karma and rating (from author card in sidebar or inline)
    const karmaEl = document.querySelector('.tm-karma__votes');
    if (karmaEl) {
      meta.authorKarma = karmaEl.innerText.trim();
    }

    // Hub URLs for linking
    const hubLinkEls = document.querySelectorAll('.tm-publication-hub__link');
    meta.hubUrls = Array.from(hubLinkEls).map(el => ({
      name: (el.querySelector('span:first-child')?.innerText || el.innerText).trim().replace(/\s*\*\s*$/, ''),
      url: el.href || null
    }));

    // Tags with URLs (from article footer)
    const tagEls = document.querySelectorAll('.tm-article-body__tags-item a, .tm-tags-list__link');
    if (tagEls.length > 0) {
      meta.tagLinks = Array.from(tagEls).map(el => ({
        name: el.innerText.trim(),
        url: el.href || null
      }));
    }

    return meta;
  });

  if (verbose) {
    console.log('   Metadata extracted:', JSON.stringify(metadata, null, 2));
  }

  // Extract article content as structured data with HTML processing
  const content = await page.evaluate(() => {
    const articleBody = document.querySelector('.article-formatted-body');
    if (!articleBody) return null;

    // Get article title
    const titleEl = document.querySelector('article h1');
    const title = titleEl ? titleEl.innerText.trim() : '';

    /**
     * Convert an HTML element to markdown, preserving links and formatting
     */
    function nodeToMarkdown(node, context = {}) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = node.tagName.toLowerCase();

      // Skip script, style, etc.
      if (['script', 'style', 'noscript', 'svg'].includes(tag)) return '';

      // Handle links
      if (tag === 'a') {
        const href = node.getAttribute('href');
        const text = nodeToMarkdownChildren(node);
        if (href && text) {
          return `[${text}](${href})`;
        }
        return text;
      }

      // Handle bold
      if (tag === 'strong' || tag === 'b') {
        const text = nodeToMarkdownChildren(node);
        // Trim spaces inside bold markers to prevent broken rendering
        // e.g., "**Figure 11. **" → "**Figure 11.**"
        return text ? `**${text.trim()}**` : '';
      }

      // Handle italic
      if (tag === 'em' || tag === 'i') {
        const text = nodeToMarkdownChildren(node);
        return text ? `*${text}*` : '';
      }

      // Handle inline code
      if (tag === 'code' && !node.closest('pre')) {
        const text = node.textContent;
        return text ? `\`${text}\`` : '';
      }

      // Handle line breaks
      if (tag === 'br') {
        return '\n';
      }

      // Handle subscript/superscript (common in math)
      if (tag === 'sub') {
        return `₍${node.textContent}₎`;
      }
      if (tag === 'sup') {
        return `^${node.textContent}`;
      }

      // Handle formula images (Habr stores LaTeX in `source` attribute)
      if (tag === 'img' && node.classList.contains('formula')) {
        const source = node.getAttribute('source');
        if (source) {
          // Trim whitespace from LaTeX source to prevent broken rendering
          // (e.g., "$L $" with trailing space won't render on GitHub)
          const trimmed = source.trim();
          // Inline formula - wrap in single $
          return `$${trimmed}$`;
        }
        // Fallback to alt text
        const alt = node.getAttribute('alt');
        if (alt) {
          return `$${alt.trim()}$`;
        }
        return '';
      }

      // Handle math elements (KaTeX/MathJax)
      if (node.classList.contains('katex') || node.classList.contains('math') ||
          tag === 'mjx-container' || node.classList.contains('MathJax')) {
        const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation) {
          return annotation.textContent;
        }
        // Try to get the LaTeX from data attributes
        const tex = node.getAttribute('data-tex') || node.getAttribute('data-latex');
        if (tex) return tex;
        // Fallback to text content cleaned up
        return node.textContent.trim();
      }

      // Handle spans (just process children)
      if (tag === 'span') {
        return nodeToMarkdownChildren(node);
      }

      // Default: process children
      return nodeToMarkdownChildren(node);
    }

    function nodeToMarkdownChildren(node) {
      let result = '';
      for (const child of node.childNodes) {
        result += nodeToMarkdown(child);
      }
      return result;
    }

    // Process all elements in order
    const elements = [];
    let figureIndex = 0;

    const processElement = (node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();

      // Skip certain elements
      if (['script', 'style', 'noscript'].includes(tag)) return;

      // Handle headings
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        elements.push({
          type: 'heading',
          level: parseInt(tag[1]),
          content: nodeToMarkdownChildren(node).trim()
        });
        return;
      }

      // Handle paragraphs
      if (tag === 'p') {
        const content = nodeToMarkdownChildren(node).trim();
        if (content) {
          elements.push({
            type: 'paragraph',
            content: content
          });
        }
        return;
      }

      // Handle code blocks
      if (tag === 'pre') {
        const codeEl = node.querySelector('code');
        // Get innerHTML and convert <br> to newlines, then strip remaining HTML
        let codeHTML = codeEl ? codeEl.innerHTML : node.innerHTML;
        // Convert <br> and <br/> to newlines
        let code = codeHTML.replace(/<br\s*\/?>/gi, '\n');
        // Strip remaining HTML tags
        const temp = document.createElement('div');
        temp.innerHTML = code;
        code = temp.textContent || temp.innerText;
        // Habr uses both "language-xxx" and bare class names like "python", "matlab"
        let language = codeEl?.className?.match(/language-(\w+)/)?.[1]
          || codeEl?.className?.match(/^(\w+)$/)?.[1]
          || '';

        // Content-based language correction: Habr sometimes misidentifies languages
        // Detect Coq by characteristic keywords (Habr labels it as "matlab")
        const trimmedCode = code.trim();
        if (language === 'matlab' && (
          /\b(Require\s+Import|Definition|Fixpoint|Lemma|Theorem|Proof|Qed|Notation|Inductive)\b/.test(trimmedCode)
        )) {
          language = 'coq';
        }

        elements.push({
          type: 'code',
          language,
          content: trimmedCode
        });
        return;
      }

      // Handle blockquotes
      if (tag === 'blockquote') {
        // Process child paragraphs individually to handle multi-formula blockquotes
        // Habr often has blockquotes with multiple <p> elements, each containing a formula
        const childParagraphs = Array.from(node.querySelectorAll(':scope > p, :scope > div > p'));
        const childContents = childParagraphs.length > 0
          ? childParagraphs.map(p => nodeToMarkdownChildren(p).trim()).filter(Boolean)
          : [nodeToMarkdownChildren(node).trim()];

        // Check if ALL children are formula-only (blockquote-math pattern)
        const formulaPattern = /^\s*\$([^$]+)\$\s*$/;
        const allFormulas = childContents.every(c => formulaPattern.test(c));

        if (allFormulas && childContents.length > 0) {
          // Group all formulas into a single blockquote-math-group element
          // so they render as one continuous blockquote (matching original)
          const formulas = childContents.map(c => {
            const match = c.match(formulaPattern);
            return match ? match[1].trim() : c;
          });
          elements.push({
            type: 'blockquote-math-group',
            formulas: formulas
          });
          return;
        }

        // For non-formula blockquotes, join all paragraph content with newlines
        const content = childContents.join('\n');
        elements.push({
          type: 'blockquote',
          content: content
        });
        return;
      }

      // Handle unordered lists
      if (tag === 'ul') {
        const items = Array.from(node.querySelectorAll(':scope > li')).map(li =>
          nodeToMarkdownChildren(li).trim()
        );
        elements.push({
          type: 'unordered-list',
          items: items.filter(item => item)
        });
        return;
      }

      // Handle ordered lists
      if (tag === 'ol') {
        const items = Array.from(node.querySelectorAll(':scope > li')).map(li =>
          nodeToMarkdownChildren(li).trim()
        );
        elements.push({
          type: 'ordered-list',
          items: items.filter(item => item)
        });
        return;
      }

      // Handle figures (images with captions)
      if (tag === 'figure') {
        figureIndex++;
        const img = node.querySelector('img');
        const figcaption = node.querySelector('figcaption');
        if (img) {
          elements.push({
            type: 'figure',
            index: figureIndex,
            src: img.src,
            alt: img.alt || '',
            caption: figcaption ? nodeToMarkdownChildren(figcaption).trim() : ''
          });
        }
        return;
      }

      // Handle standalone images (but not formula images - those are inline)
      if (tag === 'img' && !node.closest('figure')) {
        // Check if this is a formula image - handle as block formula if standalone
        if (node.classList.contains('formula')) {
          const source = node.getAttribute('source');
          if (source) {
            // Standalone formula - treat as block formula
            elements.push({
              type: 'math-block',
              content: source.trim()
            });
            return;
          }
        }
        // Regular image
        elements.push({
          type: 'image',
          src: node.src,
          alt: node.alt || ''
        });
        return;
      }

      // Handle horizontal rules
      if (tag === 'hr') {
        elements.push({ type: 'hr' });
        return;
      }

      // Handle div elements that might contain math blocks
      if (tag === 'div') {
        // Check for math block
        const mathEl = node.querySelector('.katex-display, .math-display, mjx-container[display="true"]');
        if (mathEl) {
          const annotation = mathEl.querySelector('annotation[encoding="application/x-tex"]');
          const tex = annotation ? annotation.textContent :
                     (mathEl.getAttribute('data-tex') || mathEl.textContent);
          if (tex) {
            elements.push({
              type: 'math-block',
              content: tex.trim()
            });
          }
          return;
        }

        // For other divs, process children
        for (const child of node.children) {
          processElement(child);
        }
        return;
      }

      // For other block elements, try to process children
      if (['section', 'article', 'main', 'aside', 'header', 'footer', 'details'].includes(tag)) {
        for (const child of node.children) {
          processElement(child);
        }
      }
    };

    for (const child of articleBody.children) {
      processElement(child);
    }

    return { title, elements };
  });

  await browser.close();

  if (content) {
    content.metadata = metadata;
  }

  return content;
}

/**
 * Post-process markdown to fix formatting issues
 */
function postProcessMarkdown(markdown) {
  let result = markdown;

  // Unicode character normalization to match article.md style
  // Normalize curly quotes to straight quotes
  result = result.replace(/['']/g, "'");
  result = result.replace(/[""]/g, '"');

  // Normalize em-dash and en-dash to regular dash with spaces
  result = result.replace(/—/g, ' — ');  // Keep em-dash with spaces for readability
  result = result.replace(/–/g, '-');     // Convert en-dash to hyphen

  // Normalize ellipsis
  result = result.replace(/…/g, '...');

  // Fix spacing around inline LaTeX formulas using a line-by-line token-based approach.
  // Simple regex replacements fail because they cannot distinguish opening/closing $ delimiters.
  // Instead, we process each line, identify formula spans, and fix spacing around/inside them.
  result = result.split('\n').map(line => {
    // Skip block formula lines ($$...$$) and blockquote block formulas (> $$...$$)
    const trimmedLine = line.replace(/^>\s*/, '');
    if (trimmedLine.startsWith('$$') && trimmedLine.endsWith('$$')) return line;

    // Find all inline formula spans by tracking $ delimiters
    // We parse left to right, matching opening $ with closing $
    const formulas = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '$' && (i === 0 || line[i - 1] !== '\\')) {
        // Skip $$ block delimiters
        if (line[i + 1] === '$') {
          i += 2;
          continue;
        }
        // Found opening $, find closing $
        const start = i;
        i++;
        while (i < line.length && (line[i] !== '$' || line[i - 1] === '\\')) {
          i++;
        }
        if (i < line.length) {
          // Found closing $
          formulas.push({ start, end: i });
          i++;
        }
      } else {
        i++;
      }
    }

    if (formulas.length === 0) return line;

    // Build the line with fixes applied
    let fixed = '';
    let pos = 0;
    for (const f of formulas) {
      // Add text before this formula
      fixed += line.substring(pos, f.start);

      // Extract and trim formula content (remove internal leading/trailing whitespace)
      const rawInner = line.substring(f.start + 1, f.end);
      const inner = rawInner.trim();

      // Add space before formula if preceded by word character or comma
      // (comma-adjacent formulas like "i.e.,$L$" need a space for readability)
      if (fixed.length > 0 && /[a-zA-Zа-яА-ЯёЁ,]$/.test(fixed)) {
        fixed += ' ';
      }

      // Add the formula with trimmed content
      fixed += `$${inner}$`;

      // Check if next character after formula is a word character and add space
      const afterPos = f.end + 1;
      if (afterPos < line.length && /^[a-zA-Zа-яА-ЯёЁ]/.test(line[afterPos])) {
        fixed += ' ';
      }

      pos = f.end + 1;
    }
    // Add remaining text
    fixed += line.substring(pos);

    return fixed;
  }).join('\n');

  // Fix simple numeric percentage formulas — GitHub doesn't render $100\%$ properly
  // Convert patterns like $100\%$ or $100\\%$ to plain text "100%"
  result = result.replace(/\$(\d+)\\+%\$/g, '$1%');

  // Fix bold formatting artifacts:
  // 1. Remove empty bold markers (**** or ** ** with only inline whitespace),
  //    preserving a space between non-whitespace chars on each side.
  //    Use [^\S\n] (non-newline whitespace) to avoid matching across lines.
  result = result.replace(/(\S)\*\*[^\S\n]*\*\*(\S)/g, '$1 $2');
  result = result.replace(/\*\*[^\S\n]*\*\*/g, '');
  // 2. Ensure space after closing bold marker before next word character.
  //    Only match closing ** (preceded by non-whitespace) followed by a word character.
  //    e.g., "**Figure 11.**In this" → "**Figure 11.** In this"
  result = result.replace(/(\S)\*\*([a-zA-Zа-яА-ЯёЁ\[(])/g, '$1** $2');

  // Fix double spaces (but not in code blocks)
  result = result.replace(/([^\n`])  +/g, (match, char) => {
    return char + ' ';
  });

  // Clean up extra spaces around em-dashes that we may have introduced
  result = result.replace(/\s+—\s+/g, ' — ');

  // Fix stray standalone $ signs that might have been left from parsing
  // Pattern: $\n\n$ or just a standalone $ on its own line should be removed
  result = result.replace(/^\$\s*$/gm, '');

  return result;
}

/**
 * Format metadata as a markdown block to be placed after the title
 */
function formatMetadataBlock(metadata) {
  if (!metadata) return [];

  const lines = [];

  // Author line
  if (metadata.author) {
    const authorName = metadata.authorFullName
      ? `${metadata.authorFullName} (${metadata.author})`
      : metadata.author;
    const authorLink = metadata.authorUrl
      ? `[${authorName}](${metadata.authorUrl})`
      : authorName;
    lines.push(`**Author:** ${authorLink}`);
  }

  // Article type (translation)
  if (metadata.isTranslation) {
    lines.push(`**Type:** ${metadata.translationLabel || 'Translation'}`);
  }

  // Original article link and authors (for translations)
  if (metadata.originalAuthors) {
    const authorsText = metadata.originalAuthors;
    if (metadata.originalArticleUrl) {
      lines.push(`**Original article:** [${authorsText}](${metadata.originalArticleUrl})`);
    } else {
      lines.push(`**Original authors:** ${authorsText}`);
    }
  }

  // Publication date
  if (metadata.publishDate) {
    const date = new Date(metadata.publishDate);
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    let dateLine = `**Published:** ${formatted}`;
    if (metadata.dateModified) {
      const modDate = new Date(metadata.dateModified);
      const modFormatted = modDate.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      if (modFormatted !== formatted) {
        dateLine += ` (updated ${modFormatted})`;
      }
    }
    lines.push(dateLine);
  }

  // Reading time and difficulty
  const infoItems = [];
  if (metadata.readingTime) infoItems.push(`Reading time: ${metadata.readingTime}`);
  if (metadata.difficulty) infoItems.push(`Difficulty: ${metadata.difficulty}`);
  if (metadata.views) infoItems.push(`Views: ${metadata.views}`);
  if (infoItems.length > 0) {
    lines.push(`**${infoItems.join(' | ')}**`);
  }

  // Hubs
  if (metadata.hubs && metadata.hubs.length > 0) {
    lines.push(`**Hubs:** ${metadata.hubs.join(', ')}`);
  }

  // Tags
  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`**Tags:** ${metadata.tags.join(', ')}`);
  }

  return lines;
}

/**
 * Format footer metadata block to be placed at the end of the article
 * This repeats tags and hubs as they appear at the bottom of the original Habr article
 */
function formatFooterBlock(metadata) {
  if (!metadata) return [];

  const lines = [];

  lines.push('---');
  lines.push('');

  // Tags with links (matching Habr article footer)
  if (metadata.tagLinks && metadata.tagLinks.length > 0) {
    const tagStrings = metadata.tagLinks.map(t =>
      t.url ? `[${t.name}](${t.url})` : t.name
    );
    lines.push(`**Tags:** ${tagStrings.join(', ')}`);
    lines.push('');
  } else if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`**Tags:** ${metadata.tags.join(', ')}`);
    lines.push('');
  }

  // Hubs with links
  if (metadata.hubUrls && metadata.hubUrls.length > 0) {
    const hubStrings = metadata.hubUrls.map(h =>
      h.url ? `[${h.name}](${h.url})` : h.name
    );
    lines.push(`**Hubs:** ${hubStrings.join(', ')}`);
    lines.push('');
  } else if (metadata.hubs && metadata.hubs.length > 0) {
    lines.push(`**Hubs:** ${metadata.hubs.join(', ')}`);
    lines.push('');
  }

  // Article stats
  const stats = [];
  if (metadata.votes) stats.push(`Votes: ${metadata.votes}`);
  if (metadata.views) stats.push(`Views: ${metadata.views}`);
  if (metadata.bookmarks) stats.push(`Bookmarks: ${metadata.bookmarks}`);
  if (metadata.comments) stats.push(`Comments: ${metadata.comments}`);
  if (stats.length > 0) {
    lines.push(`**${stats.join(' | ')}**`);
    lines.push('');
  }

  // Author info
  if (metadata.author) {
    const authorName = metadata.authorFullName
      ? `${metadata.authorFullName} (${metadata.author})`
      : metadata.author;
    const authorLink = metadata.authorUrl
      ? `[${authorName}](${metadata.authorUrl})`
      : authorName;
    let authorLine = `**Author:** ${authorLink}`;
    if (metadata.authorKarma) {
      authorLine += ` | Karma: ${metadata.authorKarma}`;
    }
    lines.push(authorLine);
    lines.push('');
  }

  return lines;
}

/**
 * Convert extracted content to markdown
 */
function contentToMarkdown(content, article) {
  if (!content) return '';

  const lines = [];

  // Add title
  if (content.title) {
    lines.push(`# ${content.title}`);
    lines.push('');
  }

  // Add metadata block after title
  // Each metadata line gets its own blank line separator so GitHub renders them
  // as separate paragraphs (consecutive lines without blanks merge into one paragraph)
  const metadataLines = formatMetadataBlock(content.metadata);
  if (metadataLines.length > 0) {
    for (const line of metadataLines) {
      lines.push(line);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  let imageIndex = 1;

  for (const element of content.elements) {
    switch (element.type) {
      case 'heading':
        const prefix = '#'.repeat(element.level);
        lines.push(`${prefix} ${element.content}`);
        lines.push('');
        break;

      case 'paragraph':
        if (element.content) {
          lines.push(element.content);
          lines.push('');
        }
        break;

      case 'code':
        lines.push('```' + (element.language || ''));
        lines.push(element.content);
        lines.push('```');
        lines.push('');
        break;

      case 'blockquote':
        const quoteLines = element.content.split('\n');
        for (const line of quoteLines) {
          lines.push(`> ${line}`);
        }
        lines.push('');
        break;

      case 'unordered-list':
        for (const item of element.items) {
          // Handle multi-line list items
          const itemLines = item.split('\n');
          lines.push(`- ${itemLines[0]}`);
          for (let i = 1; i < itemLines.length; i++) {
            lines.push(`  ${itemLines[i]}`);
          }
        }
        lines.push('');
        break;

      case 'ordered-list':
        element.items.forEach((item, i) => {
          const itemLines = item.split('\n');
          lines.push(`${i + 1}. ${itemLines[0]}`);
          for (let j = 1; j < itemLines.length; j++) {
            lines.push(`   ${itemLines[j]}`);
          }
        });
        lines.push('');
        break;

      case 'figure':
        // Use local image path with figure number
        const figureMatch = element.caption.match(/(?:Figure|Рис\.?|Рисунок)\s*(\d+)/i);
        const figNum = figureMatch ? figureMatch[1] : element.index;
        const ext = element.src.includes('.jpeg') || element.src.includes('.jpg') ? 'jpg' : 'png';

        // Simple alt text format: "Figure N" only, not the full caption
        // This matches the article.md format
        const simpleAltText = `Figure ${figNum}`;
        lines.push(`![${simpleAltText}](images/figure-${figNum}.${ext})`);
        if (element.caption) {
          // Caption already includes bold formatting from extraction (e.g., **Figure 1.** ...)
          // Don't wrap it again in bold, just output as-is
          lines.push('');
          lines.push(element.caption);
        }
        lines.push('');
        break;

      case 'image':
        // Use local path format
        const imgExt = element.src.includes('.jpeg') || element.src.includes('.jpg') ? 'jpg' : 'png';
        lines.push(`![${element.alt}](images/image-${String(imageIndex).padStart(2, '0')}.${imgExt})`);
        lines.push('');
        imageIndex++;
        break;

      case 'math-block':
        lines.push('$$' + element.content + '$$');
        lines.push('');
        break;

      case 'blockquote-math':
        // Single formula in a blockquote — use display math for standalone formulas
        lines.push('> $$' + element.content + '$$');
        lines.push('');
        break;

      case 'blockquote-math-group':
        // Multiple formulas grouped in a single continuous blockquote
        // Use "> " prefix on each line with ">" on blank lines to keep the blockquote connected
        for (let fi = 0; fi < element.formulas.length; fi++) {
          lines.push('> $$' + element.formulas[fi] + '$$');
          if (fi < element.formulas.length - 1) {
            lines.push('>');  // blank line within blockquote to separate formulas
          }
        }
        lines.push('');
        break;

      case 'hr':
        lines.push('---');
        lines.push('');
        break;
    }
  }

  // Add footer metadata (tags, hubs, author info — matching Habr article bottom)
  const footerLines = formatFooterBlock(content.metadata);
  if (footerLines.length > 0) {
    for (const line of footerLines) {
      lines.push(line);
    }
  }

  const rawMarkdown = lines.join('\n').trim() + '\n';
  return postProcessMarkdown(rawMarkdown);
}

/**
 * Download article and save as markdown
 */
async function downloadArticle(article, options) {
  const archivePath = join(ROOT_DIR, article.archivePath);
  const outputFileName = options.outputFile || article.markdownFile;
  const markdownPath = join(archivePath, outputFileName);

  console.log(`\n📥 Downloading ${article.title} (${article.version})`);
  console.log('='.repeat(70));
  console.log(`   URL: ${article.url}`);
  console.log(`   Target: ${markdownPath}`);

  // Ensure archive directory exists
  if (!existsSync(archivePath)) {
    mkdirSync(archivePath, { recursive: true });
    console.log(`   Created directory: ${archivePath}`);
  }

  // Extract content from web page
  console.log('   Extracting content from web page...');
  const content = await extractArticleContent(article, options.verbose);

  if (!content) {
    console.error('   ❌ Failed to extract article content');
    return { success: false, error: 'Failed to extract content' };
  }

  console.log(`   ✅ Extracted ${content.elements.length} elements`);

  // Convert to markdown
  console.log('   Converting to markdown...');
  const markdown = contentToMarkdown(content, article);

  if (options.dryRun) {
    console.log('   [DRY RUN] Would save markdown file');
    console.log(`   Preview (first 500 chars):\n${markdown.substring(0, 500)}...`);
    return { success: true, dryRun: true };
  }

  // Save markdown file
  writeFileSync(markdownPath, markdown, 'utf-8');
  console.log(`   ✅ Saved ${markdownPath}`);
  console.log(`   File size: ${(markdown.length / 1024).toFixed(1)} KB`);

  return { success: true, path: markdownPath, size: markdown.length };
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  // Show help if no version specified
  if (!options.all && !options.version) {
    console.log(`
Usage: node scripts/download-article.mjs [version] [options]

Options:
  --all         Download all articles
  --downloaded  Save as downloaded.md instead of article.md
  --dry-run     Show what would be done without making changes
  --verbose     Show detailed output

Examples:
  node scripts/download-article.mjs 0.0.1
  node scripts/download-article.mjs --all
  node scripts/download-article.mjs --all --downloaded
  node scripts/download-article.mjs 0.0.2 --dry-run
`);
    process.exit(0);
  }

  // Get articles to process
  let articles = [];
  if (options.all) {
    articles = getAllArticles();
  } else if (options.version) {
    articles = [getArticle(options.version)];
  }

  console.log('🚀 Article Download Script');
  console.log('==========================');
  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No files will be created\n');
  }

  const results = [];

  for (const article of articles) {
    try {
      const result = await downloadArticle(article, options);
      results.push({ article, ...result });
    } catch (error) {
      console.error(`\n❌ Error downloading ${article.version}:`, error.message);
      results.push({ article, success: false, error: error.message });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 DOWNLOAD SUMMARY');
  console.log('='.repeat(70));

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const details = result.success
      ? (result.dryRun ? 'dry run' : `${(result.size / 1024).toFixed(1)} KB`)
      : result.error;
    console.log(`   ${status} ${result.article.version}: ${details}`);
  }

  console.log('\n' + '='.repeat(70));
  process.exit(results.every(r => r.success) ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
