#!/usr/bin/env node

/**
 * Script to download all figure images from the article
 * and update the markdown file with proper image references
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import http from 'http';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ARTICLE_URL = 'https://habr.com/en/articles/895896';
const IMAGES_DIR = join(__dirname, '../archive/0.0.2/images');
const MARKDOWN_PATH = join(__dirname, '../archive/0.0.2/article.md');

// Ensure images directory exists
if (!existsSync(IMAGES_DIR)) {
  mkdirSync(IMAGES_DIR, { recursive: true });
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

async function downloadImages() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to article...');
  await page.goto(ARTICLE_URL, {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  // Scroll to load all content
  console.log('Scrolling to load lazy images...');
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
  console.log('Extracting figure images...');
  const figures = await page.$$eval('.article-formatted-body figure', elements =>
    elements.map(figure => {
      const img = figure.querySelector('img');
      const figcaption = figure.querySelector('figcaption');
      if (!img) return null;

      // Extract figure number from caption
      const captionText = figcaption?.innerText || '';
      const figureMatch = captionText.match(/Figure\s+(\d+)/i);
      const figureNum = figureMatch ? parseInt(figureMatch[1]) : null;

      return {
        figureNum,
        src: img.src,
        alt: img.alt,
        caption: captionText
      };
    }).filter(f => f !== null && f.src && !f.src.includes('.svg'))
  );

  console.log(`Found ${figures.length} figure images to download`);

  await browser.close();

  // Download each figure image
  const downloadedImages = [];
  for (const figure of figures) {
    if (!figure.figureNum) continue;

    const ext = figure.src.includes('.jpeg') || figure.src.includes('.jpg') ? 'jpg' : 'png';
    const filename = `figure-${figure.figureNum}.${ext}`;
    const filepath = join(IMAGES_DIR, filename);

    console.log(`Downloading Figure ${figure.figureNum}: ${figure.src.substring(0, 80)}...`);

    try {
      await downloadFile(figure.src, filepath);
      downloadedImages.push({
        figureNum: figure.figureNum,
        filename,
        caption: figure.caption
      });
      console.log(`  ✓ Saved as ${filename}`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
    }
  }

  console.log(`\nDownloaded ${downloadedImages.length} images`);

  // Save image metadata
  writeFileSync(
    join(IMAGES_DIR, 'metadata.json'),
    JSON.stringify(downloadedImages, null, 2)
  );

  return downloadedImages;
}

downloadImages()
  .then(images => {
    console.log('\n=== SUMMARY ===');
    console.log(`Successfully downloaded ${images.length} figure images`);
    console.log('Images saved to:', IMAGES_DIR);
  })
  .catch(console.error);
