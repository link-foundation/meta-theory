#!/usr/bin/env node

import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });

  // Test dark color scheme via context
  const darkContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const darkPage = await darkContext.newPage();
  await darkPage.goto('https://habr.com/en/articles/895896/', {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });
  await darkPage.waitForSelector('.article-formatted-body', { timeout: 30000 });
  await darkPage.waitForTimeout(3000);

  const darkBg = await darkPage.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('Context dark body bg:', darkBg);
  await darkPage.screenshot({ path: 'experiments/test-dark.png', clip: { x: 0, y: 0, width: 1920, height: 400 } });

  // Test light color scheme via context
  const lightContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'light',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const lightPage = await lightContext.newPage();
  await lightPage.goto('https://habr.com/en/articles/895896/', {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });
  await lightPage.waitForSelector('.article-formatted-body', { timeout: 30000 });
  await lightPage.waitForTimeout(3000);

  const lightBg = await lightPage.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('Context light body bg:', lightBg);
  await lightPage.screenshot({ path: 'experiments/test-light.png', clip: { x: 0, y: 0, width: 1920, height: 400 } });

  // Cookie-based dark theme
  const cookieContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  await cookieContext.addCookies([{ name: 'theme', value: 'dark', domain: '.habr.com', path: '/' }]);
  const cookiePage = await cookieContext.newPage();
  await cookiePage.goto('https://habr.com/en/articles/895896/', {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });
  await cookiePage.waitForSelector('.article-formatted-body', { timeout: 30000 });
  await cookiePage.waitForTimeout(3000);

  const cookieBg = await cookiePage.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('Cookie dark body bg:', cookieBg);
  await cookiePage.screenshot({ path: 'experiments/test-cookie-dark.png', clip: { x: 0, y: 0, width: 1920, height: 400 } });

  await browser.close();
  console.log('Done');
}

test().catch(console.error);
