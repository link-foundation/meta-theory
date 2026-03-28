#!/usr/bin/env node

/**
 * Debug: inspect blockquote structure for formula paragraphs on Habr
 */

import { chromium } from 'playwright';

const ARTICLE_URL = 'https://habr.com/en/articles/895896/';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  await page.goto(ARTICLE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // Inspect all blockquotes in detail
  const blockquotes = await page.evaluate(() => {
    const articleBody = document.querySelector('.article-formatted-body');
    if (!articleBody) return [];

    const bqs = articleBody.querySelectorAll('blockquote');
    return Array.from(bqs).map((bq, i) => {
      const directChildren = Array.from(bq.children).map(child => ({
        tag: child.tagName,
        class: child.className,
        html: child.outerHTML.substring(0, 300),
        textContent: child.textContent.substring(0, 100),
        hasFormula: !!child.querySelector('img.formula'),
        formulaSource: child.querySelector('img.formula')?.getAttribute('source') || null
      }));

      // Also check for :scope > p
      const directPs = Array.from(bq.querySelectorAll(':scope > p'));
      const nestedPs = Array.from(bq.querySelectorAll(':scope > div > p'));

      return {
        index: i,
        outerHTML: bq.outerHTML.substring(0, 500),
        childCount: bq.children.length,
        directChildren,
        directPCount: directPs.length,
        nestedPCount: nestedPs.length,
        directPContents: directPs.map(p => ({
          text: p.textContent.substring(0, 80),
          formulaSource: p.querySelector('img.formula')?.getAttribute('source') || null
        })),
        nestedPContents: nestedPs.map(p => ({
          text: p.textContent.substring(0, 80),
          formulaSource: p.querySelector('img.formula')?.getAttribute('source') || null
        }))
      };
    });
  });

  console.log('=== BLOCKQUOTES ===\n');
  for (const bq of blockquotes) {
    console.log(`\nBlockquote ${bq.index} (${bq.childCount} children, ${bq.directPCount} direct <p>, ${bq.nestedPCount} nested <p>):`);
    console.log(`  HTML preview: ${bq.outerHTML.substring(0, 200)}`);
    console.log(`  Direct children:`);
    for (const child of bq.directChildren) {
      console.log(`    ${child.tag}.${child.class}: formula=${child.formulaSource}, text="${child.textContent}"`);
    }
    if (bq.directPCount > 0) {
      console.log(`  Direct <p> elements:`);
      for (const p of bq.directPContents) {
        console.log(`    formula=${p.formulaSource}, text="${p.text}"`);
      }
    }
    if (bq.nestedPCount > 0) {
      console.log(`  Nested <p> elements:`);
      for (const np of bq.nestedPContents) {
        console.log(`    formula=${np.formulaSource}, text="${np.text}"`);
      }
    }
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
