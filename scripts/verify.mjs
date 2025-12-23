#!/usr/bin/env node

/**
 * Generalized script to verify article content
 *
 * This script verifies that the markdown article contains all the key content
 * from the original web page.
 *
 * Usage:
 *   node scripts/verify.mjs [version]
 *   node scripts/verify.mjs --all
 *
 * Examples:
 *   node scripts/verify.mjs 0.0.2     # Verify 0.0.2 article
 *   node scripts/verify.mjs --all     # Verify all articles
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
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
    verbose: false
  };

  for (const arg of args) {
    if (arg === '--all') {
      options.all = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (!arg.startsWith('-')) {
      options.version = arg;
    }
  }

  return options;
}

/**
 * Normalize text for comparison by removing extra whitespace and normalizing unicode
 */
function normalizeText(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u2000-\u200F\u2028-\u202F]/g, ' ') // Replace various unicode spaces
    .replace(/\u00A0/g, ' ') // Replace non-breaking space
    .replace(/['']/g, "'") // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/[×]/g, 'x') // Normalize multiplication sign to 'x'
    .replace(/\\times/g, 'x') // Normalize LaTeX times to 'x'
    .replace(/[→↦]/g, '->') // Normalize arrows
    .replace(/\\to/g, '->') // Normalize LaTeX arrow
    .replace(/[−]/g, '-') // Normalize minus sign
    .replace(/\$\$/g, '') // Remove LaTeX block delimiters
    .replace(/\$/g, '') // Remove LaTeX inline delimiters
    .replace(/\\subseteq/g, '⊆')
    .replace(/\\mathbb\{n\}_0/gi, 'ℕ₀')
    .replace(/\\in/g, '∈')
    .replace(/\\emptyset/g, '∅')
    .replace(/\^2/g, '²')
    .replace(/\^n/g, 'ⁿ')
    .toLowerCase();
}

/**
 * Normalize code for comparison - more lenient for code blocks
 */
function normalizeCode(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u2000-\u200F\u2028-\u202F]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[×]/g, 'x')
    .replace(/\\times/g, 'x')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .toLowerCase();
}

/**
 * Extract content from the web page
 */
async function extractWebPageContent(article, verbose = false) {
  if (verbose) console.log('🌐 Loading web page:', article.url);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to the page and wait for it to fully load
  await page.goto(article.url, {
    waitUntil: 'networkidle',
    timeout: 60000
  });

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

  const content = {
    title: '',
    headings: [],
    paragraphs: [],
    codeBlocks: [],
    formulas: [],
    listItems: [],
    links: [],
    figures: []
  };

  // Extract article title
  const title = await page.$eval('article h1', el => el.innerText.trim()).catch(() => '');
  content.title = title;

  // Extract headings from main article body
  const headings = await page.$$eval('.article-formatted-body h2, .article-formatted-body h3, .article-formatted-body h4', elements => {
    return elements
      .map(el => ({
        level: el.tagName.toLowerCase(),
        text: el.innerText.trim()
      }))
      .filter(h => h.text.length > 0);
  });
  content.headings = headings;

  // Extract paragraphs from article body
  const paragraphs = await page.$$eval('.article-formatted-body p', elements =>
    elements.map(el => el.innerText.trim())
  );
  content.paragraphs = paragraphs.filter(p => p.length > 10);

  // Extract code blocks from article body
  const codeBlocks = await page.$$eval('.article-formatted-body pre code, .article-formatted-body pre', elements =>
    elements.map(el => el.innerText.trim())
  );
  content.codeBlocks = codeBlocks.filter(c => c.length > 0);

  // Extract formulas (math content) from article body
  const formulas = await page.$$eval('.article-formatted-body .math, .article-formatted-body [class*="formula"], .article-formatted-body .katex, .article-formatted-body mjx-container', elements =>
    elements.map(el => el.innerText.trim())
  );
  content.formulas = formulas.filter(f => f.length > 0);

  // Extract list items from article body
  const listItems = await page.$$eval('.article-formatted-body li', elements =>
    elements.map(el => el.innerText.trim())
  );
  content.listItems = listItems.filter(li => li.length > 0);

  // Extract important links from article body
  const links = await page.$$eval('.article-formatted-body a[href]', elements =>
    elements.map(el => ({
      text: el.innerText.trim(),
      href: el.href
    }))
  );
  content.links = links.filter(l => l.text.length > 0);

  // Extract figure count
  const figures = await page.$$eval('.article-formatted-body figure', elements =>
    elements.map(figure => {
      const figcaption = figure.querySelector('figcaption');
      const captionText = figcaption?.innerText || '';
      // Match multiple languages: "Figure X", "Рис. X", "Рисунок X"
      const figureMatch = captionText.match(/(?:Figure|Рис\.?|Рисунок)\s*(\d+)/i);
      return figureMatch ? parseInt(figureMatch[1]) : null;
    }).filter(f => f !== null)
  );
  content.figures = figures;

  await browser.close();

  if (verbose) {
    console.log('✅ Extracted content from web page:');
    console.log(`   - Title: "${content.title}"`);
    console.log(`   - ${content.headings.length} headings`);
    console.log(`   - ${content.paragraphs.length} paragraphs`);
    console.log(`   - ${content.codeBlocks.length} code blocks`);
    console.log(`   - ${content.formulas.length} formulas`);
    console.log(`   - ${content.listItems.length} list items`);
    console.log(`   - ${content.links.length} links`);
    console.log(`   - ${content.figures.length} figures`);
  }

  return content;
}

/**
 * Verify that markdown contains the web page content
 */
function verifyMarkdownContent(article, webContent, markdownText, verbose = false) {
  if (verbose) console.log('\n🔍 Verifying markdown content...\n');

  const normalizedMarkdown = normalizeText(markdownText);
  const missing = {
    title: false,
    headings: [],
    paragraphs: [],
    codeBlocks: [],
    formulas: [],
    listItems: [],
    images: 0
  };

  let totalChecks = 0;
  let passedChecks = 0;

  // Check title
  if (verbose) console.log('📌 Checking article title...');
  if (webContent.title) {
    totalChecks++;
    const normalizedTitle = normalizeText(webContent.title);
    if (normalizedMarkdown.includes(normalizedTitle)) {
      passedChecks++;
      if (verbose) console.log(`   ✅ Title found: "${webContent.title}"`);
    } else {
      missing.title = true;
      if (verbose) console.log(`   ❌ Missing title: "${webContent.title}"`);
    }
  }

  // Check headings
  if (verbose) console.log('\n📌 Checking headings...');
  for (const heading of webContent.headings) {
    totalChecks++;
    const normalized = normalizeText(heading.text);
    if (normalizedMarkdown.includes(normalized)) {
      passedChecks++;
    } else {
      missing.headings.push(heading.text);
      if (verbose) console.log(`   ❌ Missing heading: "${heading.text}"`);
    }
  }

  // Check paragraphs (sample)
  if (verbose) console.log('\n📄 Checking sample paragraphs (first 5 and last 5)...');
  const paragraphsToCheck = [
    ...webContent.paragraphs.slice(0, 5),
    ...webContent.paragraphs.slice(-5)
  ];

  for (const paragraph of paragraphsToCheck) {
    totalChecks++;
    const normalized = normalizeText(paragraph);
    const words = normalized.split(' ').filter(w => w.length > 2);
    const matchingWords = words.filter(word => normalizedMarkdown.includes(word));
    const matchRate = words.length > 0 ? matchingWords.length / words.length : 0;

    const substringMatch = normalized.length > 20 &&
      normalizedMarkdown.includes(normalized.substring(0, Math.min(50, normalized.length)));

    if (matchRate >= 0.6 || substringMatch) {
      passedChecks++;
    } else {
      missing.paragraphs.push(paragraph.substring(0, 100) + '...');
      if (verbose) console.log(`   ❌ Missing/incomplete paragraph: "${paragraph.substring(0, 80)}..."`);
    }
  }

  // Check code blocks (fuzzy matching)
  if (verbose) console.log('\n💻 Checking code blocks...');
  const normalizedMarkdownForCode = normalizeCode(markdownText);
  for (const code of webContent.codeBlocks) {
    totalChecks++;
    const normalizedCode = normalizeCode(code);

    const lines = code.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 3 && !/^[{}\[\](),;]+$/.test(l));

    const matchingLines = lines.filter(line => {
      const normalizedLine = normalizeCode(line);
      return normalizedMarkdownForCode.includes(normalizedLine);
    });

    const matchRate = lines.length > 0 ? matchingLines.length / lines.length : 1;

    if (matchRate >= 0.6 || normalizedMarkdownForCode.includes(normalizedCode)) {
      passedChecks++;
    } else {
      missing.codeBlocks.push(code.substring(0, 100) + '...');
      if (verbose) console.log(`   ❌ Missing code block (${(matchRate*100).toFixed(0)}% match): "${code.substring(0, 60)}..."`);
    }
  }

  // Check list items (sample)
  if (verbose) console.log('\n📋 Checking sample list items (first 10)...');
  const listItemsToCheck = webContent.listItems.slice(0, 10);

  for (const item of listItemsToCheck) {
    totalChecks++;
    const normalized = normalizeText(item);
    const words = normalized.split(' ').filter(w => w.length > 2);
    const matchingWords = words.filter(word => normalizedMarkdown.includes(word));
    const matchRate = words.length > 0 ? matchingWords.length / words.length : 0;

    const substringMatch = normalized.length > 15 &&
      normalizedMarkdown.includes(normalized.substring(0, Math.min(40, normalized.length)));

    if (matchRate >= 0.6 || substringMatch) {
      passedChecks++;
    } else {
      missing.listItems.push(item.substring(0, 100) + '...');
      if (verbose) console.log(`   ❌ Missing list item: "${item.substring(0, 60)}..."`);
    }
  }

  // Check for figure images (only for articles with local images)
  if (article.hasLocalImages && article.expectedFigures) {
    if (verbose) console.log('\n🖼️ Checking figure images...');
    const figurePattern = /!\[(?:Figure|Рис\.?|Рисунок)\s*\d+\]\(images\/figure-\d+\.(png|jpg)\)/gi;
    const figureMatches = markdownText.match(figurePattern) || [];

    totalChecks++;
    if (figureMatches.length >= article.expectedFigures) {
      passedChecks++;
      if (verbose) console.log(`   ✅ All ${figureMatches.length} figure images found in markdown`);
    } else {
      missing.images = article.expectedFigures - figureMatches.length;
      if (verbose) console.log(`   ❌ Missing figure images: found ${figureMatches.length}/${article.expectedFigures}`);
    }
  } else if (!article.hasLocalImages) {
    // For articles with external images, check that images are referenced
    if (verbose) console.log('\n🖼️ Checking external image references...');
    const imagePattern = /!\[.*?\]\(https?:\/\/.*?\)/g;
    const imageMatches = markdownText.match(imagePattern) || [];

    totalChecks++;
    if (imageMatches.length > 0) {
      passedChecks++;
      if (verbose) console.log(`   ✅ Found ${imageMatches.length} external image references`);
    } else {
      if (verbose) console.log(`   ⚠️ No external image references found`);
    }
  }

  // Calculate results
  const passRate = totalChecks > 0 ? passedChecks / totalChecks : 0;
  const hasMissingContent = missing.title || missing.images > 0 ||
    Object.values(missing).some(arr => Array.isArray(arr) && arr.length > 0);

  return {
    totalChecks,
    passedChecks,
    passRate,
    hasMissingContent,
    missing,
    success: !hasMissingContent || passRate >= 0.85
  };
}

/**
 * Verify a single article
 */
async function verifyArticle(article, verbose = false) {
  const archivePath = join(ROOT_DIR, article.archivePath);
  const markdownPath = join(archivePath, article.markdownFile);

  console.log(`\n📋 Verifying ${article.title} (${article.version})`);
  console.log('='.repeat(70));

  // Check if markdown file exists
  if (!existsSync(markdownPath)) {
    console.log(`   ❌ Markdown file not found: ${markdownPath}`);
    return false;
  }

  // Extract content from web page
  const webContent = await extractWebPageContent(article, verbose);

  // Read markdown file
  if (verbose) console.log('\n📖 Reading markdown file:', markdownPath);
  const markdownText = readFileSync(markdownPath, 'utf-8');
  if (verbose) console.log(`✅ Loaded markdown file (${markdownText.length} characters, ${markdownText.split('\n').length} lines)`);

  // Verify content
  const result = verifyMarkdownContent(article, webContent, markdownText, verbose);

  // Print summary
  console.log('\n' + '─'.repeat(70));
  console.log('📊 VERIFICATION RESULTS');
  console.log('─'.repeat(70));
  console.log(`✅ Passed: ${result.passedChecks}/${result.totalChecks} checks (${(result.passRate*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${result.totalChecks - result.passedChecks}/${result.totalChecks} checks`);

  if (result.missing.title) {
    console.log(`⚠️  Missing article title`);
  }
  if (result.missing.headings.length > 0) {
    console.log(`⚠️  Missing ${result.missing.headings.length} headings`);
  }
  if (result.missing.paragraphs.length > 0) {
    console.log(`⚠️  Missing ${result.missing.paragraphs.length} paragraphs (from sample)`);
  }
  if (result.missing.codeBlocks.length > 0) {
    console.log(`⚠️  Missing ${result.missing.codeBlocks.length} code blocks`);
  }
  if (result.missing.listItems.length > 0) {
    console.log(`⚠️  Missing ${result.missing.listItems.length} list items (from sample)`);
  }
  if (result.missing.images > 0) {
    console.log(`⚠️  Missing ${result.missing.images} figure images`);
  }

  if (!result.hasMissingContent) {
    console.log('\n🎉 SUCCESS! All checked content from the web page exists in the markdown file.');
  } else if (result.passRate >= 0.85) {
    console.log('\n✅ PASS! Main content is verified (pass rate >= 85%).');
  } else {
    console.log('\n❌ FAIL! Significant content appears to be missing from the markdown file.');
  }

  return result.success;
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  // Show help if no version specified
  if (!options.all && !options.version) {
    console.log(`
Usage: node scripts/verify.mjs [version] [options]

Options:
  --all       Verify all articles
  --verbose   Show detailed verification output

Examples:
  node scripts/verify.mjs 0.0.2
  node scripts/verify.mjs --all
  node scripts/verify.mjs 0.0.2 --verbose
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

  console.log('🚀 Article Verification Script');
  console.log('==============================');

  let allPassed = true;
  const results = [];

  for (const article of articles) {
    try {
      const success = await verifyArticle(article, options.verbose);
      results.push({ article, success });
      if (!success) allPassed = false;
    } catch (error) {
      console.error(`\n❌ Error verifying ${article.version}:`, error.message);
      results.push({ article, success: false, error: error.message });
      allPassed = false;
    }
  }

  // Print overall summary
  if (articles.length > 1) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 OVERALL SUMMARY');
    console.log('='.repeat(70));
    for (const { article, success } of results) {
      console.log(`   ${success ? '✅' : '❌'} ${article.version}: ${article.title}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Error during verification:', error);
  process.exit(1);
});
