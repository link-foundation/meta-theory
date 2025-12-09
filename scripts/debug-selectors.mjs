#!/usr/bin/env node

import { chromium } from 'playwright';

const ARTICLE_URL = 'https://habr.com/en/articles/895896';

async function debugSelectors() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(ARTICLE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(3000);

  // Try to find the article container
  const articleContainers = await page.$$eval('[class*="article"]', elements =>
    elements.map(el => ({
      tag: el.tagName,
      classes: el.className,
      id: el.id
    }))
  );

  console.log('Article containers found:', articleContainers.length);
  console.log(JSON.stringify(articleContainers.slice(0, 10), null, 2));

  // Try to find headings with various selectors
  const h1Count = await page.$$eval('h1', els => els.length);
  const h2Count = await page.$$eval('h2', els => els.length);
  const h3Count = await page.$$eval('h3', els => els.length);

  console.log('\nHeadings found:');
  console.log('- h1:', h1Count);
  console.log('- h2:', h2Count);
  console.log('- h3:', h3Count);

  // Get first few h1 and h2 with their text
  const headings = await page.$$eval('h1, h2, h3', elements =>
    elements.slice(0, 15).map(el => ({
      tag: el.tagName,
      text: el.innerText.trim().substring(0, 80),
      classes: el.className
    }))
  );

  console.log('\nFirst 15 headings:');
  console.log(JSON.stringify(headings, null, 2));

  await browser.close();
}

debugSelectors().catch(console.error);
