#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

async function captureArticle() {
  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ]
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Navigating to article...');
    await page.goto('https://habr.com/en/articles/658705/', {
      waitUntil: 'networkidle0',
      timeout: 90000,
    });

    console.log('Waiting for content...');
    await page.waitForSelector('article', { timeout: 30000 });

    console.log('Scrolling to load all content...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 200;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            setTimeout(resolve, 2000);
          }
        }, 100);
      });
    });

    console.log('Taking screenshot...');
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    const outputPath = join(rootDir, 'archive/0.0.0/habr_article_full_page.png');
    writeFileSync(outputPath, screenshot);
    console.log(`✅ Screenshot saved to: ${outputPath}`);
    console.log(`   Size: ${Math.round(screenshot.length / 1024)} KB`);

    // Get page info
    const info = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('article img'));
      const mathElements = Array.from(document.querySelectorAll('article img[src*="habrastorage"]'));

      return {
        title: document.querySelector('h1')?.textContent?.trim(),
        imagesTotal: images.length,
        mathImages: mathElements.length,
        imagesLoaded: images.filter(img => img.complete && img.naturalHeight > 0).length,
      };
    });

    console.log('\n📊 Content Analysis:');
    console.log(`   Title: ${info.title}`);
    console.log(`   Total images: ${info.imagesTotal}`);
    console.log(`   Math formula images: ${info.mathImages}`);
    console.log(`   Images loaded: ${info.imagesLoaded}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

captureArticle()
  .then(() => {
    console.log('\n✅ Capture completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Capture failed:', error.message);
    process.exit(1);
  });
