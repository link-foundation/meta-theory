#!/usr/bin/env node

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function captureFullPage() {
  console.log('Starting Playwright browser...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    console.log('Navigating to https://habr.com/en/articles/895896...');

    // Navigate with increased timeout
    await page.goto('https://habr.com/en/articles/895896', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log('Page loaded, waiting for content to render...');

    // Wait for network to be idle
    await page.waitForLoadState('networkidle');

    // Wait a bit more for any dynamic content
    await page.waitForTimeout(5000);

    // Get the page content to understand structure
    const bodyHTML = await page.evaluate(() => {
      return document.body.innerHTML.substring(0, 2000);
    });
    console.log('Page body preview:', bodyHTML);

    // Scroll through the page to trigger lazy loading
    console.log('Scrolling through page to load all content...');
    await page.evaluate(async () => {
      const distance = 100;
      const delay = 100;

      while (document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight) {
        document.scrollingElement.scrollBy(0, distance);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Scroll back to top
      document.scrollingElement.scrollTo(0, 0);
    });

    // Wait after scrolling
    await page.waitForTimeout(3000);

    console.log('Taking full page screenshot...');

    const outputPath = join(__dirname, '..', 'archive', '0.0.2', 'article-screenshot.png');

    await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: 'png'
    });

    console.log(`Screenshot saved to: ${outputPath}`);

    // Get page info
    const title = await page.title();
    const contentHeight = await page.evaluate(() => document.body.scrollHeight);

    console.log(`Page title: ${title}`);
    console.log(`Content height: ${contentHeight}px`);

  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

// Run the script
captureFullPage().catch(error => {
  console.error('Failed to capture page:', error);
  process.exit(1);
});
