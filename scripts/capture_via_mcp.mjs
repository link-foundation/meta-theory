#!/usr/bin/env node

// This script uses the same Playwright installation as MCP
// We'll just use run_code to take screenshot via existing browser

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

async function captureArticle() {
  console.log('Launching browser...');

  // Use more permissive settings
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Set a longer default timeout
    page.setDefaultTimeout(90000);

    console.log('Navigating to article...');
    await page.goto('https://habr.com/en/articles/658705/', {
      waitUntil: 'load',
      timeout: 90000,
    });

    console.log('Waiting a bit for content...');
    await page.waitForTimeout(5000);

    console.log('Taking screenshot...');
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    const outputPath = join(rootDir, 'archive/0.0.0/habr_article_full_page.png');
    writeFileSync(outputPath, screenshot);
    console.log(`✅ Screenshot saved to: ${outputPath}`);

    // Extract images info
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('article img')).map(img => ({
        src: img.src,
        alt: img.alt,
        loaded: img.complete && img.naturalHeight !== 0,
      }));
    });

    console.log(`\n📊 Images found: ${images.length}`);
    console.log(`✓ Loaded: ${images.filter(i => i.loaded).length}`);
    console.log(`✗ Failed: ${images.filter(i => !i.loaded).length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

captureArticle()
  .then(() => {
    console.log('\n✅ Capture completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Capture failed:', error.message);
    process.exit(1);
  });
