#!/usr/bin/env node

/**
 * Inspect the translation badge / origin panel HTML from Habr articles
 * to understand its structure for metadata extraction.
 */

import { chromium } from 'playwright';

const ARTICLES = [
  { version: '0.0.0', url: 'https://habr.com/en/companies/deepfoundation/articles/658705/' },
  { version: '0.0.1', url: 'https://habr.com/ru/companies/deepfoundation/articles/804617/' },
  { version: '0.0.2', url: 'https://habr.com/en/articles/895896/' },
];

async function inspect() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  for (const article of ARTICLES) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Article ${article.version}: ${article.url}`);
    console.log('='.repeat(70));

    const page = await context.newPage();
    await page.goto(article.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('.article-formatted-body', { timeout: 30000 });

    // Check for translation badge/panel
    const translationInfo = await page.evaluate(() => {
      const result = {};

      // Check .tm-article-presenter__origin
      const originEl = document.querySelector('.tm-article-presenter__origin');
      if (originEl) {
        result.originHTML = originEl.outerHTML;
        result.originText = originEl.innerText.trim();
        // Check for links inside
        const links = originEl.querySelectorAll('a');
        result.originLinks = Array.from(links).map(a => ({
          href: a.href,
          text: a.innerText.trim()
        }));
      }

      // Check for translation type indicator
      const typeEl = document.querySelector('.tm-publication-type');
      if (typeEl) {
        result.typeHTML = typeEl.outerHTML;
        result.typeText = typeEl.innerText.trim();
      }

      // Check tm-article-presenter__meta area
      const metaEl = document.querySelector('.tm-article-presenter__meta');
      if (metaEl) {
        result.metaHTML = metaEl.outerHTML;
      }

      // Check for any element mentioning "translation" or "перевод"
      const allText = document.body.innerText;
      const translationMarkers = [];
      if (allText.includes('Перевод')) translationMarkers.push('Перевод found');
      if (allText.includes('Translation')) translationMarkers.push('Translation found');
      if (allText.includes('перевод')) translationMarkers.push('перевод found');
      if (allText.includes('translation')) translationMarkers.push('translation found');
      result.translationMarkers = translationMarkers;

      // Look for the specific translation badge selectors
      const badgeSelectors = [
        '.tm-article-presenter__origin',
        '.tm-article-presenter__origin-link',
        '.tm-publication-type__label',
        '.tm-article-snippet__labels',
        '[class*="origin"]',
        '[class*="translation"]',
        '[class*="translated"]',
      ];

      result.foundSelectors = {};
      for (const sel of badgeSelectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          result.foundSelectors[sel] = Array.from(els).map(el => ({
            outerHTML: el.outerHTML.substring(0, 500),
            text: el.innerText.trim()
          }));
        }
      }

      // Also check LD+JSON for article type
      const ldJsonScript = document.querySelector('script[type="application/ld+json"]');
      if (ldJsonScript) {
        try {
          const ldData = JSON.parse(ldJsonScript.textContent);
          result.ldJson = ldData;
        } catch (e) {}
      }

      return result;
    });

    console.log(JSON.stringify(translationInfo, null, 2));
    await page.close();
  }

  await browser.close();
}

inspect().catch(console.error);
