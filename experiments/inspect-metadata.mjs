#!/usr/bin/env node

/**
 * Experiment: Inspect Habr article page HTML structure to find metadata selectors
 */

import { chromium } from 'playwright';

const URL = 'https://habr.com/en/articles/895896/';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });

  // Extract metadata using various selectors
  const metadata = await page.evaluate(() => {
    const result = {};

    // 1. Title
    const titleEl = document.querySelector('article h1, h1.tm-title');
    result.title = titleEl ? titleEl.innerText.trim() : null;
    result.titleSelector = titleEl ? titleEl.className : null;

    // 2. Author - try various selectors
    const authorSelectors = [
      '.tm-user-info__username',
      '.tm-article-presenter__header a[href*="/users/"]',
      'a.tm-user-info__username',
      '[data-test-id="article-author"]',
      '.article-author a',
      'article a[href*="/users/"]'
    ];
    for (const sel of authorSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        result.author = el.innerText.trim();
        result.authorSelector = sel;
        result.authorHref = el.href || null;
        break;
      }
    }

    // 3. Publication date
    const dateSelectors = [
      'time[datetime]',
      '.tm-article-datetime-published time',
      'article time',
      '[data-test-id="article-publish-date"]',
      'span[data-test-id="published-at"]'
    ];
    for (const sel of dateSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        result.publishDate = el.getAttribute('datetime') || el.innerText.trim();
        result.publishDateText = el.innerText.trim();
        result.publishDateSelector = sel;
        break;
      }
    }

    // 4. Reading time
    const readTimeSelectors = [
      '.tm-article-reading-time__label',
      '[data-test-id="reading-time"]',
      'span.tm-article-reading-time'
    ];
    for (const sel of readTimeSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        result.readingTime = el.innerText.trim();
        result.readingTimeSelector = sel;
        break;
      }
    }

    // 5. Difficulty level
    const diffSelectors = [
      '.tm-article-complexity__label',
      '[data-test-id="difficulty"]'
    ];
    for (const sel of diffSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        result.difficulty = el.innerText.trim();
        result.difficultySelector = sel;
        break;
      }
    }

    // 6. Hubs
    const hubSelectors = [
      '.tm-article-presenter__hubs a',
      '.tm-hubs-list__link',
      'a[href*="/hubs/"]'
    ];
    const hubEls = document.querySelectorAll(hubSelectors.find(sel => document.querySelector(sel)) || '.nonexistent');
    result.hubs = Array.from(hubEls).map(el => ({
      text: el.innerText.trim(),
      href: el.href
    }));
    result.hubsSelector = hubSelectors.find(sel => document.querySelector(sel));

    // 7. Tags
    const tagSelectors = [
      '.tm-article-presenter__tags a',
      '.tm-tags-list__link',
      'a[rel="tag"]',
      '.tm-article-body__tags a'
    ];
    const tagSel = tagSelectors.find(sel => document.querySelector(sel));
    const tagEls = tagSel ? document.querySelectorAll(tagSel) : [];
    result.tags = Array.from(tagEls).map(el => el.innerText.trim());
    result.tagsSelector = tagSel;

    // 8. Views
    const viewSelectors = [
      '.tm-icon-counter__value',
      '[data-test-id="views-count"]',
      '.tm-data-icons__item_views .tm-icon-counter__value'
    ];

    // 9. Translation info
    const translationSelectors = [
      '.tm-article-presenter__meta-translation',
      '.tm-article-body__translation-source',
      '[data-test-id="translation"]',
      '.tm-article-presenter__origin'
    ];
    for (const sel of translationSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        result.translation = el.innerText.trim();
        result.translationSelector = sel;
        break;
      }
    }

    // 10. Get the full article header HTML for analysis
    const headerSelectors = [
      '.tm-article-presenter__header',
      '.tm-article-presenter__meta',
      'article header',
      '.tm-page-article__header'
    ];
    for (const sel of headerSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        result.headerHTML = el.outerHTML.substring(0, 5000);
        result.headerSelector = sel;
        break;
      }
    }

    // 11. Try to find the LD+JSON schema
    const ldJsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
    result.ldJson = [];
    for (const script of ldJsonScripts) {
      try {
        const data = JSON.parse(script.textContent);
        result.ldJson.push(data);
      } catch (e) {
        result.ldJson.push({ error: e.message, raw: script.textContent.substring(0, 500) });
      }
    }

    // 12. Scan for meta tags
    result.metaTags = {};
    const metaEls = document.querySelectorAll('meta[property], meta[name]');
    for (const meta of metaEls) {
      const key = meta.getAttribute('property') || meta.getAttribute('name');
      const value = meta.getAttribute('content');
      if (key && value) {
        result.metaTags[key] = value;
      }
    }

    // 13. Get all text content from article info area (before body)
    const infoArea = document.querySelector('.tm-article-presenter__body, .tm-page-article');
    if (infoArea) {
      // Get all elements before the article body
      const body = infoArea.querySelector('.article-formatted-body, .tm-article-body');
      if (body) {
        const walker = document.createTreeWalker(infoArea, NodeFilter.SHOW_ELEMENT);
        const preBodyElements = [];
        let node;
        while ((node = walker.nextNode())) {
          if (body.contains(node)) break;
          if (node.className && typeof node.className === 'string') {
            preBodyElements.push({
              tag: node.tagName,
              className: node.className.substring(0, 100),
              text: node.innerText?.substring(0, 200) || '',
              id: node.id || ''
            });
          }
        }
        result.preBodyElements = preBodyElements.slice(0, 50);
      }
    }

    return result;
  });

  console.log(JSON.stringify(metadata, null, 2));
  await browser.close();
}

main().catch(console.error);
