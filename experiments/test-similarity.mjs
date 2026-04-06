#!/usr/bin/env node

/**
 * Test frame similarity to understand the loop detection threshold needed
 */

import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const PAGE_URL = 'https://linksplatform.github.io/itself.html';

function compareFrames(bufA, bufB) {
  const pngA = PNG.sync.read(bufA);
  const pngB = PNG.sync.read(bufB);
  if (pngA.width !== pngB.width || pngA.height !== pngB.height) return 0;

  const totalPixels = pngA.width * pngA.height;
  let matchingPixels = 0;
  let totalDiff = 0;

  for (let i = 0; i < pngA.data.length; i += 4) {
    const dr = Math.abs(pngA.data[i] - pngB.data[i]);
    const dg = Math.abs(pngA.data[i + 1] - pngB.data[i + 1]);
    const db = Math.abs(pngA.data[i + 2] - pngB.data[i + 2]);
    totalDiff += dr + dg + db;
    if (dr <= 2 && dg <= 2 && db <= 2) matchingPixels++;
  }

  return {
    similarity: matchingPixels / totalPixels,
    avgDiff: totalDiff / (totalPixels * 3)
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 1024 } });
  const page = await context.newPage();

  await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));

  // Capture first frame
  const firstFrame = await page.screenshot({ type: 'png' });
  console.log('First frame captured');

  // Capture frames and compare to first every second
  const frames = [firstFrame];
  const startTime = Date.now();

  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 500));
    const frame = await page.screenshot({ type: 'png' });
    frames.push(frame);

    const result = compareFrames(frame, firstFrame);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Also compare consecutive frames
    const prevResult = compareFrames(frame, frames[frames.length - 2]);

    console.log(`${elapsed}s: sim_to_first=${(result.similarity * 100).toFixed(2)}% avg_diff=${result.avgDiff.toFixed(3)} sim_to_prev=${(prevResult.similarity * 100).toFixed(2)}%`);

    // Stop early if we detect clear loop
    if (result.similarity > 0.98 && i > 10) {
      console.log(`\nLoop detected at ${elapsed}s with ${(result.similarity * 100).toFixed(2)}% similarity`);
      break;
    }
  }

  await browser.close();
}

main();
