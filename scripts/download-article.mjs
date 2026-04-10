#!/usr/bin/env node

/**
 * Script to download article content from web pages and convert to markdown.
 *
 * Uses @link-assistant/web-capture for:
 * - HTML-to-Markdown conversion with LaTeX formula extraction
 * - Article metadata extraction (author, date, hubs, tags)
 * - Post-processing (unicode normalization, formatting fixes)
 *
 * Browser rendering (Playwright) is used to fetch fully-rendered HTML
 * from JavaScript-heavy pages like Habr.
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

// Import web-capture modules for enhanced markdown conversion
import { convertHtmlToMarkdownEnhanced } from '@link-assistant/web-capture/src/lib.js';
import { formatMetadataBlock, formatFooterBlock } from '@link-assistant/web-capture/src/metadata.js';
import { postProcessMarkdown } from '@link-assistant/web-capture/src/postprocess.js';

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
    outputFile: 'article.md'
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
 * Fetch fully-rendered HTML from a URL using Playwright.
 * Habr articles require JavaScript execution for full content rendering
 * (lazy loading, formula images, dynamic elements).
 */
async function fetchRenderedHtml(url, verbose = false) {
  if (verbose) console.log('   Loading web page with Playwright:', url);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  await page.goto(url, {
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

  // Get the fully rendered HTML
  const html = await page.content();

  await browser.close();
  return html;
}

/**
 * Build markdown from web-capture's enhanced conversion output.
 *
 * web-capture's convertHtmlToMarkdownEnhanced handles:
 * - HTML-to-Markdown with Turndown (GFM tables, etc.)
 * - LaTeX formula extraction (Habr img.formula, KaTeX, MathJax)
 * - Code language detection/correction (matlab → coq)
 * - Metadata extraction (author, date, hubs, tags, translation info)
 * - Post-processing (unicode normalization, LaTeX spacing, bold fixes)
 *
 * This function assembles the final markdown with metadata header/footer.
 */
function buildArticleMarkdown(enhancedResult) {
  const { markdown, metadata } = enhancedResult;
  const lines = [];

  // Add metadata header after the title
  if (metadata) {
    const metadataLines = formatMetadataBlock(metadata);
    if (metadataLines.length > 0) {
      // Find where the title ends (first line should be # Title)
      const markdownLines = markdown.split('\n');
      let titleEndIdx = 0;

      // Find the title line and skip past it
      for (let i = 0; i < markdownLines.length; i++) {
        if (markdownLines[i].startsWith('# ')) {
          titleEndIdx = i + 1;
          // Skip blank lines after title
          while (titleEndIdx < markdownLines.length && markdownLines[titleEndIdx].trim() === '') {
            titleEndIdx++;
          }
          break;
        }
      }

      // Insert metadata between title and content
      const beforeContent = markdownLines.slice(0, titleEndIdx).join('\n');
      const afterContent = markdownLines.slice(titleEndIdx).join('\n');

      lines.push(beforeContent);
      lines.push('');
      for (const line of metadataLines) {
        lines.push(line);
        lines.push('');
      }
      lines.push('---');
      lines.push('');
      lines.push(afterContent);
    } else {
      lines.push(markdown);
    }

    // Add footer metadata
    const footerLines = formatFooterBlock(metadata);
    if (footerLines.length > 0) {
      lines.push('');
      for (const line of footerLines) {
        lines.push(line);
      }
    }
  } else {
    lines.push(markdown);
  }

  const rawMarkdown = lines.join('\n').trim() + '\n';

  // Apply post-processing (unicode normalization, LaTeX spacing, etc.)
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

  // Fetch fully rendered HTML using Playwright
  console.log('   Fetching rendered HTML with Playwright...');
  const html = await fetchRenderedHtml(article.url, options.verbose);
  console.log(`   ✅ Fetched ${(html.length / 1024).toFixed(1)} KB of HTML`);

  // Convert HTML to enhanced markdown using web-capture
  console.log('   Converting to markdown with web-capture...');
  const enhancedResult = convertHtmlToMarkdownEnhanced(html, article.url, {
    extractLatex: true,
    extractMetadata: true,
    postProcess: false, // We'll apply post-processing after assembling the full markdown
    detectCodeLanguage: true
  });

  if (!enhancedResult || !enhancedResult.markdown) {
    console.error('   ❌ Failed to convert HTML to markdown');
    return { success: false, error: 'Failed to convert HTML' };
  }

  if (options.verbose) {
    console.log('   Metadata:', JSON.stringify(enhancedResult.metadata, null, 2));
  }

  console.log(`   ✅ Converted to markdown (${enhancedResult.metadata ? 'with' : 'without'} metadata)`);

  // Build final markdown with metadata header/footer
  const markdown = buildArticleMarkdown(enhancedResult);

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
  --dry-run     Show what would be done without making changes
  --verbose     Show detailed output

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

  console.log('🚀 Article Download Script (powered by @link-assistant/web-capture)');
  console.log('===================================================================');
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
