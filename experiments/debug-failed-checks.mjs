#!/usr/bin/env node

/**
 * Debug script to investigate the failing verification checks
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ARTICLE_URL = 'https://habr.com/en/articles/895896';
const MARKDOWN_PATH = join(__dirname, '../archive/0.0.2/article.md');

async function debugFailedChecks() {
  console.log('='.repeat(80));
  console.log('DEBUG: Investigating failing verification checks');
  console.log('='.repeat(80));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(ARTICLE_URL, {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  // Scroll to load all content
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

  await page.waitForTimeout(2000);

  // Read markdown
  const markdownText = readFileSync(MARKDOWN_PATH, 'utf-8');

  // 1. Debug the SVG paragraph issue
  console.log('\n' + '='.repeat(80));
  console.log('1. INVESTIGATING: "Which is rendered as SVG (clickable):" paragraph');
  console.log('='.repeat(80));

  const allParagraphs = await page.$$eval('.article-formatted-body p', elements =>
    elements.map(el => el.innerText.trim())
  );

  const svgParagraphs = allParagraphs.filter(p =>
    p.toLowerCase().includes('svg') || p.toLowerCase().includes('clickable')
  );

  console.log('\nParagraphs containing "svg" or "clickable":');
  svgParagraphs.forEach((p, i) => {
    console.log(`\n[${i}] (${p.length} chars):`);
    console.log(`"${p}"`);
  });

  // Check if it exists in markdown
  console.log('\nSearching in markdown...');
  const markdownLower = markdownText.toLowerCase();
  if (markdownLower.includes('svg')) {
    console.log('Found "svg" in markdown');
    // Find the context
    const svgIndex = markdownLower.indexOf('svg');
    console.log('Context: "...' + markdownText.substring(svgIndex - 50, svgIndex + 100) + '..."');
  } else {
    console.log('NOT FOUND: "svg" not in markdown');
  }

  // 2. Debug the list items issue
  console.log('\n' + '='.repeat(80));
  console.log('2. INVESTIGATING: List items with V, E, L variables');
  console.log('='.repeat(80));

  const allListItems = await page.$$eval('.article-formatted-body li', elements =>
    elements.map(el => el.innerText.trim())
  );

  console.log('\nFirst 15 list items from web page:');
  allListItems.slice(0, 15).forEach((item, i) => {
    console.log(`\n[${i}] (${item.length} chars):`);
    console.log(`"${item.substring(0, 120)}${item.length > 120 ? '...' : ''}"`);
  });

  // The problematic items according to test:
  const problematicTexts = [
    'is a set whose elements are called vertices, nodes, or point',
    'is the set of references',
    'denotes a mapping (function)'
  ];

  console.log('\n\nSearching for problematic list item patterns:');
  for (const text of problematicTexts) {
    const found = allListItems.find(item => item.toLowerCase().includes(text.toLowerCase()));
    if (found) {
      console.log(`\nFOUND in web page: "${text}"`);
      console.log(`Full item: "${found.substring(0, 200)}..."`);

      // Check in markdown
      if (markdownLower.includes(text.toLowerCase())) {
        console.log('ALSO in markdown: YES');
      } else {
        console.log('ALSO in markdown: NO');
        // Try to find what's actually there
        const words = text.split(' ').filter(w => w.length > 3);
        console.log(`Searching for individual words: ${words.join(', ')}`);
        const matchingWords = words.filter(word => markdownLower.includes(word.toLowerCase()));
        console.log(`Words found in markdown: ${matchingWords.join(', ')}`);
      }
    }
  }

  // 3. Check the specific list item format
  console.log('\n' + '='.repeat(80));
  console.log('3. Checking web page structure for V, E definitions');
  console.log('='.repeat(80));

  // Get the HTML structure around "Where:" sections
  const whereElements = await page.$$eval('.article-formatted-body', elements => {
    const results = [];
    for (const el of elements) {
      const html = el.innerHTML;
      if (html.includes('Where:') || html.includes('vertices')) {
        // Find list items near "Where:"
        const whereIndex = html.indexOf('Where:');
        if (whereIndex > -1) {
          results.push({
            context: html.substring(whereIndex, whereIndex + 500)
          });
        }
      }
    }
    return results;
  });

  console.log('\nHTML context around "Where:":');
  whereElements.forEach((el, i) => {
    console.log(`\n[${i}]: ${el.context.substring(0, 300)}...`);
  });

  // 4. Look at how markdown represents these sections
  console.log('\n' + '='.repeat(80));
  console.log('4. Markdown representation of "Where:" sections');
  console.log('='.repeat(80));

  const lines = markdownText.split('\n');
  let inWhereSection = false;
  let whereContext = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('Where:') || line.includes('**Where**:')) {
      inWhereSection = true;
      whereContext.push(`Line ${i}: ${line}`);
    } else if (inWhereSection) {
      whereContext.push(`Line ${i}: ${line}`);
      if (line.trim() === '' && whereContext.length > 5) {
        inWhereSection = false;
        console.log('\n' + whereContext.join('\n'));
        whereContext = [];
      }
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(80));
  console.log('DEBUG COMPLETE');
  console.log('='.repeat(80));
}

debugFailedChecks().catch(console.error);
