#!/usr/bin/env node

/**
 * Generalized script to download article content and images
 *
 * Usage:
 *   node scripts/download.mjs [version] [--images] [--screenshot]
 *
 * Examples:
 *   node scripts/download.mjs 0.0.2 --images     # Download images for 0.0.2
 *   node scripts/download.mjs 0.0.1 --screenshot # Capture screenshot for 0.0.1
 *   node scripts/download.mjs --all --images     # Download images for all articles
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import http from 'http';
import fs from 'fs';
import { getArticle, getAllArticles } from './articles-config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    version: null,
    all: false,
    images: false,
    screenshot: false
  };

  for (const arg of args) {
    if (arg === '--all') {
      options.all = true;
    } else if (arg === '--images') {
      options.images = true;
    } else if (arg === '--screenshot') {
      options.screenshot = true;
    } else if (!arg.startsWith('-')) {
      options.version = arg;
    }
  }

  return options;
}

/**
 * Download a file from URL
 */
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Delete incomplete file
      reject(err);
    });
  });
}

/**
 * Download figure images from an article
 */
async function downloadImages(article) {
  const archivePath = join(ROOT_DIR, article.archivePath);
  const imagesDir = join(archivePath, article.imagesDir);

  // Ensure images directory exists
  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true });
  }

  console.log(`\n📥 Downloading images for ${article.title} (${article.version})`);
  console.log(`   URL: ${article.url}`);
  console.log(`   Target: ${imagesDir}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('   Navigating to article...');
  await page.goto(article.url, {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });

  // Wait for article body to appear
  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });

  // Scroll to load all content
  console.log('   Scrolling to load lazy images...');
  await page.evaluate(async () => {
    const scrollHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const scrollSteps = Math.ceil(scrollHeight / viewportHeight);
    for (let i = 0; i < scrollSteps; i++) {
      window.scrollTo(0, i * viewportHeight);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    window.scrollTo(0, 0);
  });

  await page.waitForTimeout(2000);

  // Extract figure images (those within <figure> elements)
  console.log('   Extracting figure images...');
  const figures = await page.$$eval('.article-formatted-body figure', elements =>
    elements.map(figure => {
      const img = figure.querySelector('img');
      const figcaption = figure.querySelector('figcaption');
      if (!img) return null;

      // Extract figure number from caption (try multiple languages)
      const captionText = figcaption?.innerText || '';
      // Match "Figure X", "Рис. X", "Рисунок X"
      const figureMatch = captionText.match(/(?:Figure|Рис\.?|Рисунок)\s*(\d+)/i);
      const figureNum = figureMatch ? parseInt(figureMatch[1]) : null;

      return {
        figureNum,
        src: img.src,
        alt: img.alt,
        caption: captionText
      };
    }).filter(f => f !== null && f.src && !f.src.includes('.svg'))
  );

  console.log(`   Found ${figures.length} figure images`);

  await browser.close();

  // Download each figure image
  const downloadedImages = [];
  let sequentialNum = 0;
  for (const figure of figures) {
    sequentialNum++;
    // Use figure number from caption if available, otherwise use sequential number
    const figNum = figure.figureNum || sequentialNum;

    const ext = figure.src.includes('.jpeg') || figure.src.includes('.jpg') ? 'jpg' : 'png';
    const filename = `figure-${figNum}.${ext}`;
    const filepath = join(imagesDir, filename);

    console.log(`   Downloading Figure ${figNum}...`);

    try {
      await downloadFile(figure.src, filepath);
      downloadedImages.push({
        figureNum: figNum,
        filename,
        caption: figure.caption
      });
      console.log(`     ✓ Saved as ${filename}`);
    } catch (err) {
      console.error(`     ✗ Failed: ${err.message}`);
    }
  }

  // Save image metadata
  if (downloadedImages.length > 0) {
    writeFileSync(
      join(imagesDir, 'metadata.json'),
      JSON.stringify(downloadedImages, null, 2)
    );
  }

  console.log(`\n   ✅ Downloaded ${downloadedImages.length} images for ${article.version}`);
  return downloadedImages;
}

/**
 * Close any popup overlays/modals on the page
 */
async function closePopups(page) {
  // Handle Playwright dialog events (browser-level alerts/confirms)
  page.on('dialog', async dialog => {
    try { await dialog.dismiss(); } catch (e) { /* ignore */ }
  });

  await page.evaluate(() => {
    // Common popup/modal close buttons on Habr
    const closeSelectors = [
      // Cookie consent
      '.tm-cookie-banner__close',
      '.cookie-banner__close',
      '[data-test-id="cookie-banner-close"]',
      // Consent popup buttons (accept/reject/close)
      '.consent-popup__close',
      '.consent__close',
      'button[data-testid="consent-close"]',
      'button[data-testid="consent-reject"]',
      // Generic close buttons
      '.tm-popup__close',
      '.popup__close',
      '.modal__close',
      // Overlay close
      '.overlay__close',
      // Any visible close button with aria-label
      '[aria-label="Close"]',
      '[aria-label="Закрыть"]',
      // Dismiss buttons
      '.tm-base-modal__close',
      // Notification popups
      '.tm-notification__close',
    ];

    for (const selector of closeSelectors) {
      const els = document.querySelectorAll(selector);
      for (const el of els) {
        try { el.click(); } catch (e) { /* ignore */ }
      }
    }

    // Hide all fixed-position overlays that cover content
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const style = getComputedStyle(el);
      if (style.position === 'fixed' && el.offsetParent !== null) {
        const rect = el.getBoundingClientRect();
        // Skip very small elements (like tiny icons) and the main nav bar
        if (rect.height > 200 || el.className.match(/popup|modal|overlay|banner|cookie|notification|consent/i)) {
          el.style.display = 'none';
        }
      }
    }
  });

  // Wait for popups to close
  await page.waitForTimeout(500);

  // Try to close any remaining popups by pressing Escape
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch (e) { /* ignore */ }
}

/**
 * Load page content by scrolling through it to trigger lazy loading
 */
async function loadPageContent(page) {
  for (let pass = 0; pass < 3; pass++) {
    await page.evaluate(async () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const scrollSteps = Math.ceil(scrollHeight / viewportHeight);
      for (let i = 0; i < scrollSteps; i++) {
        window.scrollTo(0, i * viewportHeight);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1000);
  }
  // Wait for images to fully load
  await page.waitForTimeout(3000);
}

/**
 * Capture a single themed screenshot of the article
 *
 * Uses a fresh browser context with colorScheme set at context level,
 * which is the reliable way to trigger Habr's prefers-color-scheme media query.
 */
async function captureThemedScreenshot(browser, article, screenshotPath, theme) {
  console.log(`   Creating ${theme} theme context...`);
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: theme,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log(`   Navigating (${theme})...`);
  await page.goto(article.url, {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });
  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });

  // Load all lazy content
  await loadPageContent(page);

  // Close popups
  await closePopups(page);

  // Scroll to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  console.log(`   Taking ${theme} screenshot...`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });

  const stats = fs.statSync(screenshotPath);
  console.log(`   ✅ ${theme} screenshot saved: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);

  await context.close();
}

/**
 * Capture screenshots of the article in both light and dark themes
 */
async function captureScreenshot(article) {
  const archivePath = join(ROOT_DIR, article.archivePath);

  console.log(`\n📸 Capturing screenshots for ${article.title} (${article.version})`);
  console.log(`   URL: ${article.url}`);

  const browser = await chromium.launch({ headless: true });

  // Capture light theme screenshot
  const lightPath = join(archivePath, article.screenshotLightFile || 'article-light.png');
  console.log(`   Target (light): ${lightPath}`);
  await captureThemedScreenshot(browser, article, lightPath, 'light');

  // Capture dark theme screenshot
  const darkPath = join(archivePath, article.screenshotDarkFile || 'article-dark.png');
  console.log(`   Target (dark): ${darkPath}`);
  await captureThemedScreenshot(browser, article, darkPath, 'dark');

  // Also save a default article.png (light theme copy) for backward compatibility
  const defaultPath = join(archivePath, article.screenshotFile);
  fs.copyFileSync(lightPath, defaultPath);
  console.log(`   ✅ Default screenshot (light copy): ${defaultPath}`);

  await browser.close();
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  // Show help if no action specified
  if (!options.images && !options.screenshot) {
    console.log(`
Usage: node scripts/download.mjs [version] [options]

Options:
  --images      Download figure images from the article
  --screenshot  Capture a full-page screenshot
  --all         Apply to all articles

Examples:
  node scripts/download.mjs 0.0.2 --images
  node scripts/download.mjs 0.0.1 --screenshot
  node scripts/download.mjs --all --images
`);
    process.exit(0);
  }

  // Get articles to process
  let articles = [];
  if (options.all) {
    articles = getAllArticles();
  } else if (options.version) {
    articles = [getArticle(options.version)];
  } else {
    console.error('Error: Please specify a version or use --all');
    process.exit(1);
  }

  console.log('🚀 Download Script');
  console.log('==================');

  for (const article of articles) {
    try {
      if (options.images) {
        await downloadImages(article);
      }
      if (options.screenshot) {
        await captureScreenshot(article);
      }
    } catch (error) {
      console.error(`\n❌ Error processing ${article.version}:`, error.message);
    }
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
