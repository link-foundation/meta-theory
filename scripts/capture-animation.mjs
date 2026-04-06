#!/usr/bin/env node

/**
 * Capture animation from https://linksplatform.github.io/itself.html as GIF
 *
 * This script uses Playwright to capture frames of the animated Bézier curve
 * visualization, then assembles them into a GIF file.
 *
 * Usage:
 *   node scripts/capture-animation.mjs
 *   node scripts/capture-animation.mjs --frames 100 --delay 50
 *   node scripts/capture-animation.mjs --output docs/animations/closed-link.gif
 *
 * Options:
 *   --frames N    Number of frames to capture (default: 100)
 *   --delay N     Delay between frames in ms for GIF (default: 50)
 *   --width N     Viewport width (default: 960)
 *   --height N    Viewport height (default: 540)
 *   --output PATH Output file path (default: docs/animations/closed-link.gif)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import GIFEncoder from 'gif-encoder-2';
import { PNG } from 'pngjs';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const PAGE_URL = 'https://linksplatform.github.io/itself.html';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    frames: 100,
    delay: 50,
    width: 960,
    height: 540,
    output: join(ROOT_DIR, 'docs', 'animations', 'closed-link.gif')
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--frames':
        options.frames = parseInt(args[++i], 10);
        break;
      case '--delay':
        options.delay = parseInt(args[++i], 10);
        break;
      case '--width':
        options.width = parseInt(args[++i], 10);
        break;
      case '--height':
        options.height = parseInt(args[++i], 10);
        break;
      case '--output':
        options.output = args[++i];
        break;
    }
  }

  return options;
}

/**
 * Capture animation frames by controlling the t parameter directly
 */
async function captureFrames(page, frameCount, width, height) {
  const frames = [];

  // Stop the built-in animation timer by overriding d3.timer
  // and take control of the t parameter directly
  await page.evaluate(() => {
    // Stop the running d3 timer by clearing the animation
    if (window.d3 && window.d3.timer) {
      // Override the timer flush to prevent updates
      window.__animationStopped = true;
    }
  });

  // Override the update loop: we'll set t and call update() manually
  await page.evaluate(() => {
    // Clear all d3 timers by replacing the timer mechanism
    // The animation uses d3.timer which calls update() continuously
    // We need to stop it and control t ourselves
    const origTimer = d3.timer;
    d3.timer = function() {}; // no-op new timers
    // Force stop existing timer by setting a flag
    window.__captureMode = true;
  });

  console.log(`📸 Capturing ${frameCount} frames...`);

  for (let i = 0; i < frameCount; i++) {
    const tValue = i / frameCount;

    // Set t and trigger a manual update
    await page.evaluate((tVal) => {
      // Access the global t variable used by the animation
      t = tVal;
      bezier = {}; // Reset cached curve data so it redraws
      update();
    }, tValue);

    // Small wait for rendering
    await page.waitForTimeout(20);

    // Capture the frame
    const buffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height }
    });

    frames.push(buffer);

    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`   Frame ${i + 1}/${frameCount} (t=${tValue.toFixed(2)})`);
    }
  }

  return frames;
}

/**
 * Assemble PNG frames into a GIF
 */
function assembleGif(frames, width, height, delay, outputPath) {
  console.log(`\n🎬 Assembling GIF (${frames.length} frames, ${delay}ms delay)...`);

  const encoder = new GIFEncoder(width, height, 'neuquant', false);

  // Use a writable stream
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  encoder.setDelay(delay);
  encoder.setRepeat(0); // 0 = loop forever
  encoder.setQuality(10); // Lower = better quality but slower
  encoder.start();

  for (let i = 0; i < frames.length; i++) {
    const png = PNG.sync.read(frames[i]);
    encoder.addFrame(png.data);
  }

  encoder.finish();
  const gifBuffer = encoder.out.getData();

  writeFileSync(outputPath, gifBuffer);
  const stats = fs.statSync(outputPath);
  console.log(`✅ GIF saved: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);

  return outputPath;
}

/**
 * Main entry point
 */
async function main() {
  const options = parseArgs();
  const { frames: frameCount, delay, width, height, output } = options;

  console.log(`\n🎯 Animation Capture Settings:`);
  console.log(`   URL: ${PAGE_URL}`);
  console.log(`   Frames: ${frameCount}`);
  console.log(`   Delay: ${delay}ms (${(1000 / delay).toFixed(1)} FPS)`);
  console.log(`   Viewport: ${width}x${height}`);
  console.log(`   Output: ${output}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height }
  });
  const page = await context.newPage();

  try {
    console.log('🌐 Loading page...');
    await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
    // Wait for D3 and the animation to initialize
    await page.waitForTimeout(1000);

    console.log('⏸️  Stopping built-in animation...');
    // Verify the page has the expected global variables
    const hasGlobals = await page.evaluate(() => {
      return typeof t !== 'undefined' && typeof update === 'function' && typeof bezier !== 'undefined';
    });

    if (!hasGlobals) {
      throw new Error('Page does not have expected global variables (t, update, bezier). The page structure may have changed.');
    }

    const frames = await captureFrames(page, frameCount, width, height);
    assembleGif(frames, width, height, delay, output);

    console.log('\n✨ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
