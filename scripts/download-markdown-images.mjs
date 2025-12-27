#!/usr/bin/env node

/**
 * Script to download images from markdown files and update references to local paths
 *
 * This script:
 * 1. Reads markdown files in archive directories
 * 2. Extracts all external image URLs (habrastorage, etc.)
 * 3. Downloads images to local images/ directory
 * 4. Updates markdown to reference local paths
 *
 * Usage:
 *   node scripts/download-markdown-images.mjs [version]
 *   node scripts/download-markdown-images.mjs --all
 *
 * Examples:
 *   node scripts/download-markdown-images.mjs 0.0.0
 *   node scripts/download-markdown-images.mjs --all
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname, basename } from 'path';
import https from 'https';
import http from 'http';
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
    dryRun: false,
    verbose: false
  };

  for (const arg of args) {
    if (arg === '--all') {
      options.all = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (!arg.startsWith('-')) {
      options.version = arg;
    }
  }

  return options;
}

/**
 * Download a file from URL with retry logic
 */
function downloadFile(url, filepath, retries = 3) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const makeRequest = (attemptsLeft) => {
      const file = createWriteStream(filepath);

      const request = protocol.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
          file.close();
          const redirectUrl = response.headers.location;
          // Handle relative redirects
          const absoluteUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, url).href;
          downloadFile(absoluteUrl, filepath, attemptsLeft)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          if (attemptsLeft > 1) {
            console.log(`     Retry (${attemptsLeft - 1} left): HTTP ${response.statusCode}`);
            setTimeout(() => makeRequest(attemptsLeft - 1), 1000);
          } else {
            reject(new Error(`HTTP ${response.statusCode}`));
          }
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
        file.on('error', (err) => {
          file.close();
          reject(err);
        });
      });

      request.on('error', (err) => {
        file.close();
        if (attemptsLeft > 1) {
          console.log(`     Retry (${attemptsLeft - 1} left): ${err.message}`);
          setTimeout(() => makeRequest(attemptsLeft - 1), 1000);
        } else {
          reject(err);
        }
      });

      request.setTimeout(30000, () => {
        request.destroy();
        if (attemptsLeft > 1) {
          console.log(`     Retry (${attemptsLeft - 1} left): Timeout`);
          setTimeout(() => makeRequest(attemptsLeft - 1), 1000);
        } else {
          reject(new Error('Request timeout'));
        }
      });
    };

    makeRequest(retries);
  });
}

/**
 * Get file extension from URL
 */
function getExtensionFromUrl(url) {
  // Remove query parameters
  const cleanUrl = url.split('?')[0];
  const ext = extname(cleanUrl).toLowerCase();
  // Default to .png if no extension found
  return ext || '.png';
}

/**
 * Extract image references from markdown
 */
function extractImageReferences(markdownText) {
  // Match markdown image syntax: ![alt text](url)
  const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  const images = [];
  let match;

  while ((match = imageRegex.exec(markdownText)) !== null) {
    images.push({
      fullMatch: match[0],
      altText: match[1],
      url: match[2]
    });
  }

  return images;
}

/**
 * Generate local filename from URL and index
 */
function generateLocalFilename(url, index, altText) {
  const ext = getExtensionFromUrl(url);

  // Try to extract meaningful name from URL
  const urlPath = url.split('/').pop().split('?')[0];

  // Use index-based naming for consistency
  return `image-${String(index + 1).padStart(2, '0')}${ext}`;
}

/**
 * Process a single article - download images and update markdown
 */
async function processArticle(article, options) {
  const archivePath = join(ROOT_DIR, article.archivePath);
  const markdownPath = join(archivePath, article.markdownFile);
  const imagesDir = join(archivePath, article.imagesDir);

  console.log(`\n📋 Processing ${article.title} (${article.version})`);
  console.log('='.repeat(70));

  // Check if markdown file exists
  if (!existsSync(markdownPath)) {
    console.log(`   ❌ Markdown file not found: ${markdownPath}`);
    return { success: false, error: 'Markdown file not found' };
  }

  // Read markdown file
  let markdownText = readFileSync(markdownPath, 'utf-8');

  // Extract image references
  const images = extractImageReferences(markdownText);

  // Filter to only external images (habrastorage, etc.) that haven't been localized
  const externalImages = images.filter(img =>
    img.url.includes('habrastorage.org') ||
    (img.url.startsWith('http') && !img.url.includes('images/'))
  );

  if (externalImages.length === 0) {
    console.log('   ✅ No external images to download - article already uses local images or has no images');
    return { success: true, downloaded: 0 };
  }

  console.log(`   Found ${externalImages.length} external images to download`);

  // Ensure images directory exists
  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true });
    console.log(`   Created images directory: ${imagesDir}`);
  }

  // Download images and build replacement map
  const replacements = [];
  let downloadedCount = 0;

  for (let i = 0; i < externalImages.length; i++) {
    const image = externalImages[i];
    const localFilename = generateLocalFilename(image.url, i, image.altText);
    const localPath = join(imagesDir, localFilename);
    const relativePath = `images/${localFilename}`;

    console.log(`\n   [${i + 1}/${externalImages.length}] ${image.altText.substring(0, 40)}...`);
    console.log(`       URL: ${image.url.substring(0, 60)}...`);

    if (options.dryRun) {
      console.log(`       Would save to: ${relativePath}`);
      replacements.push({
        from: image.fullMatch,
        to: `![${image.altText}](${relativePath})`
      });
      continue;
    }

    try {
      await downloadFile(image.url, localPath);
      downloadedCount++;
      console.log(`       ✅ Saved: ${localFilename}`);

      replacements.push({
        from: image.fullMatch,
        to: `![${image.altText}](${relativePath})`
      });
    } catch (err) {
      console.error(`       ❌ Failed: ${err.message}`);
      // Keep original URL if download fails
    }
  }

  // Update markdown with local paths
  if (replacements.length > 0 && !options.dryRun) {
    console.log(`\n   Updating markdown file with ${replacements.length} local image references...`);

    for (const replacement of replacements) {
      markdownText = markdownText.replace(replacement.from, replacement.to);
    }

    writeFileSync(markdownPath, markdownText, 'utf-8');
    console.log('   ✅ Markdown file updated');
  }

  // Save metadata
  if (downloadedCount > 0 && !options.dryRun) {
    const metadata = replacements.map((r, i) => ({
      index: i + 1,
      originalUrl: externalImages[i].url,
      altText: externalImages[i].altText,
      localPath: r.to.match(/\(([^)]+)\)/)[1]
    }));

    writeFileSync(
      join(imagesDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    console.log('   ✅ Metadata saved');
  }

  console.log(`\n   📊 Summary: Downloaded ${downloadedCount}/${externalImages.length} images`);

  return {
    success: true,
    downloaded: downloadedCount,
    total: externalImages.length,
    replacements: replacements.length
  };
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  // Show help if no version specified
  if (!options.all && !options.version) {
    console.log(`
Usage: node scripts/download-markdown-images.mjs [version] [options]

Options:
  --all       Process all articles
  --dry-run   Show what would be done without making changes
  --verbose   Show detailed output

Examples:
  node scripts/download-markdown-images.mjs 0.0.0
  node scripts/download-markdown-images.mjs --all
  node scripts/download-markdown-images.mjs 0.0.1 --dry-run
`);
    process.exit(0);
  }

  // Get articles to process
  let articles = [];
  if (options.all) {
    articles = getAllArticles();
  } else if (options.version) {
    articles = [getArticle(options.version)];
  }

  console.log('🚀 Download Markdown Images Script');
  console.log('===================================');
  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  const results = [];

  for (const article of articles) {
    try {
      const result = await processArticle(article, options);
      results.push({ article, ...result });
    } catch (error) {
      console.error(`\n❌ Error processing ${article.version}:`, error.message);
      results.push({ article, success: false, error: error.message });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(70));

  let totalDownloaded = 0;
  let totalImages = 0;

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const details = result.downloaded !== undefined
      ? `${result.downloaded}/${result.total} images`
      : result.error;
    console.log(`   ${status} ${result.article.version}: ${details}`);

    if (result.downloaded) totalDownloaded += result.downloaded;
    if (result.total) totalImages += result.total;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`   Total: ${totalDownloaded}/${totalImages} images downloaded`);

  process.exit(results.every(r => r.success) ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
