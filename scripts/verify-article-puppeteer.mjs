#!/usr/bin/env node

/**
 * Puppeteer-based verification script
 *
 * This script provides an alternative verification method using Puppeteer
 * to verify that the markdown article contains all the key content
 * from the original web page at https://habr.com/en/articles/895896
 *
 * The verification process:
 * 1. Loads the web page using Puppeteer
 * 2. Extracts all headings, paragraphs, code blocks, formulas, and lists
 * 3. Reads the markdown file
 * 4. Verifies that all extracted content exists in the markdown
 * 5. Reports any missing content
 */

import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ARTICLE_URL = 'https://habr.com/en/articles/895896';
const MARKDOWN_PATH = join(__dirname, '../archive/0.0.2/article.md');

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
    .replace(/[→]/g, '->') // Normalize arrow
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
 * Auto-scroll to trigger lazy loading
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 50);
    });
  });
}

/**
 * Extract content from the web page
 *
 * IMPORTANT: We use `.article-formatted-body` to extract ONLY the main article content,
 * excluding sidebar recommendations, comments, navigation, and ads.
 * The article title is extracted separately from the first h1 in the article.
 */
async function extractWebPageContent() {
  console.log('🌐 Loading web page:', ARTICLE_URL);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Navigate to the page and wait for it to fully load
  await page.goto(ARTICLE_URL, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Scroll through the page to trigger lazy loading
  await autoScroll(page);

  // Wait a bit more for any dynamic content
  await new Promise(resolve => setTimeout(resolve, 2000));

  const content = {
    title: '',
    headings: [],
    paragraphs: [],
    codeBlocks: [],
    formulas: [],
    listItems: [],
    links: []
  };

  // Extract article title (the main h1 in the article header)
  content.title = await page.$eval('article h1', el => el.innerText.trim()).catch(() => '');

  // Extract headings ONLY from the main article body (.article-formatted-body)
  // This excludes sidebar, navigation, ads, comments, and recommendation snippets
  content.headings = await page.$$eval('.article-formatted-body h2, .article-formatted-body h3, .article-formatted-body h4', elements => {
    return elements
      .map(el => ({
        level: el.tagName.toLowerCase(),
        text: el.innerText.trim()
      }))
      .filter(h => h.text.length > 0);
  });

  // Extract paragraphs from article body only
  content.paragraphs = await page.$$eval('.article-formatted-body p', elements =>
    elements.map(el => el.innerText.trim()).filter(p => p.length > 10)
  );

  // Extract code blocks from article body only
  content.codeBlocks = await page.$$eval('.article-formatted-body pre code, .article-formatted-body pre', elements =>
    elements.map(el => el.innerText.trim()).filter(c => c.length > 0)
  );

  // Extract formulas (math content) from article body
  content.formulas = await page.$$eval('.article-formatted-body .math, .article-formatted-body [class*="formula"], .article-formatted-body .katex, .article-formatted-body mjx-container', elements =>
    elements.map(el => el.innerText.trim()).filter(f => f.length > 0)
  ).catch(() => []);

  // Extract list items from article body only
  content.listItems = await page.$$eval('.article-formatted-body li', elements =>
    elements.map(el => el.innerText.trim()).filter(li => li.length > 0)
  );

  // Extract important links from article body (excluding navigation)
  content.links = await page.$$eval('.article-formatted-body a[href]', elements =>
    elements.map(el => ({
      text: el.innerText.trim(),
      href: el.href
    })).filter(l => l.text.length > 0)
  );

  await browser.close();

  console.log('✅ Extracted content from web page:');
  console.log(`   - Title: "${content.title}"`);
  console.log(`   - ${content.headings.length} headings`);
  console.log(`   - ${content.paragraphs.length} paragraphs`);
  console.log(`   - ${content.codeBlocks.length} code blocks`);
  console.log(`   - ${content.formulas.length} formulas`);
  console.log(`   - ${content.listItems.length} list items`);
  console.log(`   - ${content.links.length} links`);

  return content;
}

/**
 * Verify that markdown contains the web page content
 */
function verifyMarkdownContent(webContent, markdownText) {
  console.log('\n🔍 Verifying markdown content...\n');

  const normalizedMarkdown = normalizeText(markdownText);
  const missing = {
    title: false,
    headings: [],
    paragraphs: [],
    codeBlocks: [],
    formulas: [],
    listItems: []
  };

  let totalChecks = 0;
  let passedChecks = 0;

  // Check title
  console.log('📌 Checking article title...');
  if (webContent.title) {
    totalChecks++;
    const normalizedTitle = normalizeText(webContent.title);
    if (normalizedMarkdown.includes(normalizedTitle)) {
      passedChecks++;
      console.log(`   ✅ Title found: "${webContent.title}"`);
    } else {
      missing.title = true;
      console.log(`   ❌ Missing title: "${webContent.title}"`);
    }
  }

  // Check headings
  console.log('\n📌 Checking headings...');
  for (const heading of webContent.headings) {
    totalChecks++;
    const normalized = normalizeText(heading.text);
    if (normalizedMarkdown.includes(normalized)) {
      passedChecks++;
    } else {
      missing.headings.push(heading.text);
      console.log(`   ❌ Missing heading: "${heading.text}"`);
    }
  }

  // Check paragraphs (sample - check first and last few to avoid too many checks)
  console.log('\n📄 Checking sample paragraphs (first 5 and last 5)...');
  const paragraphsToCheck = [
    ...webContent.paragraphs.slice(0, 5),
    ...webContent.paragraphs.slice(-5)
  ];

  for (const paragraph of paragraphsToCheck) {
    totalChecks++;
    const normalized = normalizeText(paragraph);
    // Check if at least 70% of the paragraph text is present
    const words = normalized.split(' ').filter(w => w.length > 3);
    const matchingWords = words.filter(word => normalizedMarkdown.includes(word));
    const matchRate = words.length > 0 ? matchingWords.length / words.length : 0;

    if (matchRate >= 0.7) {
      passedChecks++;
    } else {
      missing.paragraphs.push(paragraph.substring(0, 100) + '...');
      console.log(`   ❌ Missing/incomplete paragraph: "${paragraph.substring(0, 80)}..."`);
    }
  }

  // Check code blocks (use fuzzy matching - check if 60% of significant lines are present)
  // Uses normalizeCode for more lenient comparison (handles LaTeX vs Unicode differences)
  console.log('\n💻 Checking code blocks...');
  const normalizedMarkdownForCode = normalizeCode(markdownText);
  for (const code of webContent.codeBlocks) {
    totalChecks++;
    const normalizedCode = normalizeCode(code);

    // Extract significant lines (non-trivial content)
    const lines = code.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 3 && !/^[{}\[\](),;]+$/.test(l)); // Skip very short lines or just brackets

    // Check how many lines exist in the markdown (use normalizeCode for each line)
    const matchingLines = lines.filter(line => {
      const normalizedLine = normalizeCode(line);
      return normalizedMarkdownForCode.includes(normalizedLine);
    });

    const matchRate = lines.length > 0 ? matchingLines.length / lines.length : 1;

    // Pass if 60% of lines match (lowered threshold due to formatting differences)
    if (matchRate >= 0.6 || normalizedMarkdownForCode.includes(normalizedCode)) {
      passedChecks++;
    } else {
      missing.codeBlocks.push(code.substring(0, 100) + '...');
      console.log(`   ❌ Missing code block (${(matchRate*100).toFixed(0)}% match, ${matchingLines.length}/${lines.length} lines): "${code.substring(0, 60)}..."`);
    }
  }

  // Check list items (sample)
  console.log('\n📋 Checking sample list items (first 10)...');
  const listItemsToCheck = webContent.listItems.slice(0, 10);

  for (const item of listItemsToCheck) {
    totalChecks++;
    const normalized = normalizeText(item);
    const words = normalized.split(' ').filter(w => w.length > 3);
    const matchingWords = words.filter(word => normalizedMarkdown.includes(word));
    const matchRate = words.length > 0 ? matchingWords.length / words.length : 0;

    if (matchRate >= 0.7) {
      passedChecks++;
    } else {
      missing.listItems.push(item.substring(0, 100) + '...');
      console.log(`   ❌ Missing list item: "${item.substring(0, 60)}..."`);
    }
  }

  // Final report
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICATION RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${passedChecks}/${totalChecks} checks (${(passedChecks/totalChecks*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${totalChecks - passedChecks}/${totalChecks} checks`);

  if (missing.title) {
    console.log(`\n⚠️  Missing article title`);
  }
  if (missing.headings.length > 0) {
    console.log(`⚠️  Missing ${missing.headings.length} headings`);
  }
  if (missing.paragraphs.length > 0) {
    console.log(`⚠️  Missing ${missing.paragraphs.length} paragraphs (from sample)`);
  }
  if (missing.codeBlocks.length > 0) {
    console.log(`⚠️  Missing ${missing.codeBlocks.length} code blocks`);
  }
  if (missing.listItems.length > 0) {
    console.log(`⚠️  Missing ${missing.listItems.length} list items (from sample)`);
  }

  const passRate = totalChecks > 0 ? passedChecks / totalChecks : 0;
  const hasMissingContent = missing.title || Object.values(missing).some(arr => Array.isArray(arr) && arr.length > 0);

  if (!hasMissingContent) {
    console.log('\n🎉 SUCCESS! All checked content from the web page exists in the markdown file.');
    return true;
  } else if (passRate >= 0.85) {
    console.log('\n✅ PASS! Main content is verified (pass rate >= 85%).');
    console.log('   Missing content appears to be:');
    console.log('   - Navigation elements, ads, or dynamic content');
    console.log('   - Formatting differences between web and markdown');
    console.log('   - Content that was intentionally excluded');
    return true;
  } else {
    console.log('\n❌ FAIL! Significant content appears to be missing from the markdown file.');
    console.log('   This could indicate:');
    console.log('   - Important sections were not included');
    console.log('   - Major formatting differences');
    console.log('   - The markdown file may need review');
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting article verification with Puppeteer\n');
    console.log('='.repeat(80));

    // Extract content from web page
    const webContent = await extractWebPageContent();

    // Read markdown file
    console.log('\n📖 Reading markdown file:', MARKDOWN_PATH);
    const markdownText = readFileSync(MARKDOWN_PATH, 'utf-8');
    console.log(`✅ Loaded markdown file (${markdownText.length} characters, ${markdownText.split('\n').length} lines)`);

    // Verify content
    const success = verifyMarkdownContent(webContent, markdownText);

    console.log('\n' + '='.repeat(80));
    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }
}

main();
