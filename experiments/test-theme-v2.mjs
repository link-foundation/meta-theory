#!/usr/bin/env node

/**
 * Test proper Habr theme switching - investigate what controls the theme
 */

import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://habr.com/en/articles/895896/';

async function test() {
  const browser = await chromium.launch({ headless: true });

  // Test 1: Light theme using prefers-color-scheme
  console.log('=== Test: Light theme (colorScheme: light) ===');
  const lightCtx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'light',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const lightPage = await lightCtx.newPage();
  await lightPage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await lightPage.waitForSelector('.article-formatted-body', { timeout: 30000 });

  // Scroll to load content
  for (let pass = 0; pass < 2; pass++) {
    await lightPage.evaluate(async () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const scrollSteps = Math.ceil(scrollHeight / viewportHeight);
      for (let i = 0; i < scrollSteps; i++) {
        window.scrollTo(0, i * viewportHeight);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      window.scrollTo(0, 0);
    });
    await lightPage.waitForTimeout(1000);
  }
  await lightPage.waitForTimeout(2000);

  // Check theme state
  const lightInfo = await lightPage.evaluate(() => ({
    htmlClasses: document.documentElement.className,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
  }));
  console.log('Light info:', JSON.stringify(lightInfo));

  // Close popups by removing fixed elements that aren't navigation
  await lightPage.evaluate(() => {
    document.querySelectorAll('.tm-header').forEach(el => {}); // keep header
    // Remove any fixed overlays
    document.querySelectorAll('[class*="popup"], [class*="modal"], [class*="banner"], [class*="cookie"]').forEach(el => {
      el.remove();
    });
  });

  await lightPage.evaluate(() => window.scrollTo(0, 0));
  await lightPage.screenshot({ path: 'experiments/test-v2-light.png', fullPage: true });
  console.log('Light saved:', fs.statSync('experiments/test-v2-light.png').size);
  await lightCtx.close();

  // Test 2: Dark theme using prefers-color-scheme
  console.log('\n=== Test: Dark theme (colorScheme: dark) ===');
  const darkCtx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const darkPage = await darkCtx.newPage();
  await darkPage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await darkPage.waitForSelector('.article-formatted-body', { timeout: 30000 });

  // Scroll to load content
  for (let pass = 0; pass < 2; pass++) {
    await darkPage.evaluate(async () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const scrollSteps = Math.ceil(scrollHeight / viewportHeight);
      for (let i = 0; i < scrollSteps; i++) {
        window.scrollTo(0, i * viewportHeight);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      window.scrollTo(0, 0);
    });
    await darkPage.waitForTimeout(1000);
  }
  await darkPage.waitForTimeout(2000);

  const darkInfo = await darkPage.evaluate(() => ({
    htmlClasses: document.documentElement.className,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
  }));
  console.log('Dark info:', JSON.stringify(darkInfo));

  // Close popups
  await darkPage.evaluate(() => {
    document.querySelectorAll('[class*="popup"], [class*="modal"], [class*="banner"], [class*="cookie"]').forEach(el => {
      el.remove();
    });
  });

  await darkPage.evaluate(() => window.scrollTo(0, 0));
  await darkPage.screenshot({ path: 'experiments/test-v2-dark.png', fullPage: true });
  console.log('Dark saved:', fs.statSync('experiments/test-v2-dark.png').size);
  await darkCtx.close();

  await browser.close();
  console.log('\nDone! Compare test-v2-light.png and test-v2-dark.png');
}

test().catch(console.error);
