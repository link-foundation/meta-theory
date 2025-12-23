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
    waitUntil: 'networkidle',
    timeout: 60000
  });

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
  for (const figure of figures) {
    if (!figure.figureNum) continue;

    const ext = figure.src.includes('.jpeg') || figure.src.includes('.jpg') ? 'jpg' : 'png';
    const filename = `figure-${figure.figureNum}.${ext}`;
    const filepath = join(imagesDir, filename);

    console.log(`   Downloading Figure ${figure.figureNum}...`);

    try {
      await downloadFile(figure.src, filepath);
      downloadedImages.push({
        figureNum: figure.figureNum,
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
 * Capture a screenshot of the article
 */
async function captureScreenshot(article) {
  const archivePath = join(ROOT_DIR, article.archivePath);
  const screenshotPath = join(archivePath, article.screenshotFile);

  console.log(`\n📸 Capturing screenshot for ${article.title} (${article.version})`);
  console.log(`   URL: ${article.url}`);
  console.log(`   Target: ${screenshotPath}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('   Navigating to article...');
  await page.goto(article.url, {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  // Multi-pass scrolling to load all lazy content
  console.log('   Loading all content (3-pass scroll)...');
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

  // Wait for images to load
  console.log('   Waiting for images to load...');
  await page.waitForTimeout(3000);

  // Take full page screenshot
  console.log('   Taking screenshot...');
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });

  await browser.close();

  const stats = fs.statSync(screenshotPath);
  console.log(`   ✅ Screenshot saved: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
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
