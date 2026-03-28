#!/usr/bin/env node

/**
 * Inspect how Habr handles themes to understand the CSS mechanism
 */

import { chromium } from 'playwright';

async function inspect() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  const page = await context.newPage();
  await page.goto('https://habr.com/en/articles/895896/', {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });
  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });

  // Check what classes/attributes are on html and body
  const themeInfo = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;

    return {
      htmlClasses: html.className,
      bodyClasses: body.className,
      htmlDataAttrs: Array.from(html.attributes).filter(a => a.name.startsWith('data-')).map(a => `${a.name}="${a.value}"`),
      bodyDataAttrs: Array.from(body.attributes).filter(a => a.name.startsWith('data-')).map(a => `${a.name}="${a.value}"`),
      // Check for any theme-related elements
      themeToggle: document.querySelector('[class*="theme"]')?.outerHTML?.substring(0, 200) || null,
      // Look for CSS custom properties on root
      rootStyles: getComputedStyle(html).getPropertyValue('--color-bg-primary') || null,
      bodyBg: getComputedStyle(body).backgroundColor,
    };
  });

  console.log('Theme info:', JSON.stringify(themeInfo, null, 2));

  // Try using Habr's built-in theme switcher via localStorage/cookies
  const themeInfo2 = await page.evaluate(() => {
    // Check localStorage for theme preference
    const keys = Object.keys(localStorage);
    const themeKeys = keys.filter(k => k.toLowerCase().includes('theme') || k.toLowerCase().includes('dark') || k.toLowerCase().includes('color'));
    const themeValues = {};
    for (const k of themeKeys) {
      themeValues[k] = localStorage.getItem(k);
    }

    // Check cookies
    const cookies = document.cookie;

    return {
      themeLocalStorageKeys: themeKeys,
      themeLocalStorageValues: themeValues,
      allLocalStorageKeys: keys.filter(k => k.includes('habr') || k.includes('tm-')),
      cookies: cookies,
    };
  });

  console.log('Storage info:', JSON.stringify(themeInfo2, null, 2));

  // Try to find the theme toggle button
  const toggleInfo = await page.evaluate(() => {
    // Search for theme toggle
    const selectors = [
      '.tm-header__toggle-theme',
      '[class*="theme-toggle"]',
      '[class*="ThemeToggle"]',
      'button[class*="theme"]',
      '[data-test-id*="theme"]',
    ];

    const results = {};
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        results[sel] = el.outerHTML.substring(0, 500);
      }
    }
    return results;
  });

  console.log('Toggle info:', JSON.stringify(toggleInfo, null, 2));

  await browser.close();
}

inspect().catch(console.error);
