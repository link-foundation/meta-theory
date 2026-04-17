#!/usr/bin/env node

/**
 * Script to download images from markdown files and update references to local paths.
 *
 * Uses @link-assistant/web-capture for:
 * - Image reference extraction from markdown
 * - Image download with retry logic
 * - Markdown URL replacement
 *
 * Usage:
 *   node scripts/download-markdown-images.mjs [version]
 *   node scripts/download-markdown-images.mjs --all
 *
 * Examples:
 *   node scripts/download-markdown-images.mjs 0.0.0
 *   node scripts/download-markdown-images.mjs --all
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getArticle, getAllArticles } from './articles-config.mjs';

// Import web-capture module for image localization
import { localizeImages } from '@link-assistant/web-capture/src/localize-images.js';

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
  const markdownText = readFileSync(markdownPath, 'utf-8');

  // Ensure images directory exists
  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true });
    console.log(`   Created images directory: ${imagesDir}`);
  }

  // Use web-capture's localizeImages to download and replace image references
  const result = await localizeImages(markdownText, {
    imagesDir: article.imagesDir,
    dryRun: options.dryRun,
    onProgress: (index, total, status, url) => {
      const shortUrl = url.length > 60 ? url.substring(0, 57) + '...' : url;
      console.log(`   [${index}/${total}] ${status}: ${shortUrl}`);
    }
  });

  if (result.total === 0) {
    console.log('   ✅ No external images to download - article already uses local images');
    return { success: true, downloaded: 0, total: 0 };
  }

  console.log(`\n   Found ${result.total} external images`);

  // Save downloaded image buffers to disk
  if (!options.dryRun) {
    for (const replacement of result.replacements) {
      if (replacement.buffer && replacement.filename) {
        const localPath = join(imagesDir, replacement.filename);
        writeFileSync(localPath, replacement.buffer);
      }
    }

    // Update markdown file with local paths
    writeFileSync(markdownPath, result.markdown, 'utf-8');
    console.log('   ✅ Markdown file updated');

    // Save metadata
    if (result.metadata.length > 0) {
      writeFileSync(
        join(imagesDir, 'metadata.json'),
        JSON.stringify(result.metadata, null, 2)
      );
      console.log('   ✅ Metadata saved');
    }
  }

  console.log(`\n   📊 Summary: Downloaded ${result.downloaded}/${result.total} images`);

  return {
    success: true,
    downloaded: result.downloaded,
    total: result.total,
    replacements: result.replacements.length
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

  console.log('🚀 Download Markdown Images Script (powered by @link-assistant/web-capture)');
  console.log('==========================================================================');
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
