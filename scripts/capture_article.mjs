#!/usr/bin/env node

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

async function captureArticle() {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ]
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Remove automation flags
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    console.log('Navigating to article...');
    await page.goto('https://habr.com/en/articles/658705/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('Waiting for main content to load...');
    await page.waitForSelector('article', { timeout: 30000 });

    // Wait a bit for initial content
    console.log('Waiting for initial content rendering...');
    await page.waitForTimeout(5000);

    // Slow scroll to trigger all lazy loading with multiple passes
    console.log('Performing slow scroll to trigger all lazy loading (pass 1)...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 50; // Smaller steps
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 50); // Slower scroll
      });
    });

    // Wait for content to load after first scroll
    await page.waitForTimeout(3000);

    // Second pass - scroll back up slowly
    console.log('Scrolling back up (pass 2)...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = window.scrollY;
        const distance = 50;
        const timer = setInterval(() => {
          window.scrollBy(0, -distance);
          totalHeight -= distance;

          if (totalHeight <= 0) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 50);
      });
    });

    await page.waitForTimeout(2000);

    // Third pass - scroll down again to ensure everything loads
    console.log('Final scroll pass (pass 3)...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    });

    // Final wait for all images to fully load
    console.log('Waiting for all images to complete loading...');
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => {
            img.addEventListener('load', resolve);
            img.addEventListener('error', resolve);
            // Force reload if image isn't loading
            if (!img.complete && img.src) {
              const src = img.src;
              img.src = '';
              img.src = src;
            }
          }))
      );
    });

    // Extra wait for any final rendering
    await page.waitForTimeout(5000);

    console.log('Taking screenshot...');
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    const outputPath = join(rootDir, 'archive/0.0.0/habr_article_full_page.png');
    writeFileSync(outputPath, screenshot);
    console.log(`Screenshot saved to: ${outputPath}`);

    // Extract the article HTML for analysis
    console.log('Extracting article content...');
    const articleContent = await page.evaluate(() => {
      const article = document.querySelector('article');
      if (!article) return null;

      return {
        title: document.querySelector('h1')?.textContent?.trim(),
        author: document.querySelector('[href*="/users/"]')?.textContent?.trim(),
        date: document.querySelector('time')?.textContent?.trim(),
        content: article.innerHTML,
        images: Array.from(document.querySelectorAll('article img')).map(img => ({
          src: img.src,
          alt: img.alt,
          width: img.naturalWidth,
          height: img.naturalHeight,
        })),
        codeBlocks: Array.from(document.querySelectorAll('pre code')).map(code => ({
          language: code.className.replace('hljs', '').trim(),
          content: code.textContent,
        })),
      };
    });

    const contentPath = join(rootDir, 'scripts/article_content.json');
    writeFileSync(contentPath, JSON.stringify(articleContent, null, 2));
    console.log(`Article content saved to: ${contentPath}`);

    console.log('\n=== Capture Summary ===');
    console.log(`Title: ${articleContent?.title || 'N/A'}`);
    console.log(`Author: ${articleContent?.author || 'N/A'}`);
    console.log(`Date: ${articleContent?.date || 'N/A'}`);
    console.log(`Images found: ${articleContent?.images?.length || 0}`);
    console.log(`Code blocks found: ${articleContent?.codeBlocks?.length || 0}`);

  } catch (error) {
    console.error('Error capturing article:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

captureArticle()
  .then(() => {
    console.log('\n✅ Article capture completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Article capture failed:', error);
    process.exit(1);
  });
