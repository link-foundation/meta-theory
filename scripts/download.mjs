#!/usr/bin/env node

/**
 * Script to download article images and capture themed screenshots.
 *
 * Uses @link-assistant/web-capture for:
 * - Figure extraction and download (extractFiguresFromUrl, downloadFigures)
 * - Dual-themed screenshots (captureDualThemeScreenshots)
 *
 * Usage:
 *   node scripts/download.mjs [version] [--images] [--screenshot]
 *
 * Examples:
 *   node scripts/download.mjs 0.0.2 --images     # Download images for 0.0.2
 *   node scripts/download.mjs 0.0.1 --screenshot  # Capture screenshot for 0.0.1
 *   node scripts/download.mjs --all --images      # Download images for all articles
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getArticle, getAllArticles } from './articles-config.mjs';

// Import web-capture modules for figure extraction and themed screenshots
import { extractFiguresFromUrl } from '@link-assistant/web-capture/src/figures.js';
import { captureDualThemeScreenshots } from '@link-assistant/web-capture/src/themed-image.js';

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
 * Download figure images from an article using web-capture
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

  // Use web-capture to extract and download figures
  const result = await extractFiguresFromUrl(article.url, {
    engine: 'playwright',
    onProgress: (figureNum, status) => {
      console.log(`   Figure ${figureNum}: ${status}`);
    }
  });

  console.log(`   Found ${result.totalFound} figure images`);

  // Save each downloaded figure to disk
  const downloadedImages = [];
  for (const figure of result.figures) {
    if (figure.buffer) {
      const filepath = join(imagesDir, figure.filename);
      writeFileSync(filepath, figure.buffer);
      downloadedImages.push({
        figureNum: figure.figureNum,
        filename: figure.filename,
        caption: figure.caption
      });
      console.log(`     ✓ Saved as ${figure.filename}`);
    } else if (figure.error) {
      console.error(`     ✗ Figure ${figure.figureNum} failed: ${figure.error}`);
    }
  }

  // Save image metadata
  if (downloadedImages.length > 0) {
    writeFileSync(
      join(imagesDir, 'metadata.json'),
      JSON.stringify(downloadedImages, null, 2)
    );
  }

  console.log(`\n   ✅ Downloaded ${result.totalDownloaded} images for ${article.version}`);
  return downloadedImages;
}

/**
 * Capture screenshots of the article in both light and dark themes using web-capture
 */
async function captureScreenshot(article) {
  const archivePath = join(ROOT_DIR, article.archivePath);

  console.log(`\n📸 Capturing screenshots for ${article.title} (${article.version})`);
  console.log(`   URL: ${article.url}`);

  // Use web-capture for dual-themed screenshots
  const result = await captureDualThemeScreenshots(article.url, {
    engine: 'playwright',
    width: 1920,
    height: 1080,
    fullPage: true,
    dismissPopups: true
  });

  // Save light theme screenshot
  const lightPath = join(archivePath, article.screenshotLightFile || 'article-light.png');
  writeFileSync(lightPath, result.light);
  const lightSize = result.light.length;
  console.log(`   ✅ Light screenshot saved: ${(lightSize / 1024 / 1024).toFixed(1)} MB`);

  // Save dark theme screenshot
  const darkPath = join(archivePath, article.screenshotDarkFile || 'article-dark.png');
  writeFileSync(darkPath, result.dark);
  const darkSize = result.dark.length;
  console.log(`   ✅ Dark screenshot saved: ${(darkSize / 1024 / 1024).toFixed(1)} MB`);
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
  --screenshot  Capture full-page themed screenshots (light + dark)
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

  console.log('🚀 Download Script (powered by @link-assistant/web-capture)');
  console.log('============================================================');

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
