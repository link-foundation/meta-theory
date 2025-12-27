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
 *
 * LIMITATIONS:
 * - LaTeX/math formulas: Habr renders formulas as IMAGES, not as KaTeX/MathJax.
 *   The original article.md files were created by intelligently reconstructing
 *   LaTeX formulas from the visual content of these images. This script CANNOT
 *   automatically recreate LaTeX formulas - they would need to be added manually.
 * - The original articles in this repository contain manually-reconstructed
 *   LaTeX formulas that match the formula images on the web page.
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
    verbose: false
  };

  for (const arg of args) {
    if (arg === '--all') {
      options.all = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
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
        return text ? `**${text}**` : '';
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
        const language = codeEl?.className?.match(/language-(\w+)/)?.[1] || '';
        elements.push({
          type: 'code',
          language,
          content: code.trim()
        });
        return;
      }

      // Handle blockquotes
      if (tag === 'blockquote') {
        const content = nodeToMarkdownChildren(node).trim();
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

      // Handle standalone images
      if (tag === 'img' && !node.closest('figure')) {
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

  return content;
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

        // Use alt text from caption if available
        const altText = element.caption || `Figure ${figNum}`;
        lines.push(`![${altText}](images/figure-${figNum}.${ext})`);
        if (element.caption) {
          // Use italic for caption like the original articles
          lines.push(`*${element.caption}*`);
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

      case 'hr':
        lines.push('---');
        lines.push('');
        break;
    }
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * Download article and save as markdown
 */
async function downloadArticle(article, options) {
  const archivePath = join(ROOT_DIR, article.archivePath);
  const markdownPath = join(archivePath, article.markdownFile);

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
  --all       Download all articles
  --dry-run   Show what would be done without making changes
  --verbose   Show detailed output

Examples:
  node scripts/download-article.mjs 0.0.1
  node scripts/download-article.mjs --all
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
