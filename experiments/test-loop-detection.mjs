#!/usr/bin/env node

/**
 * Experiment: Test loop detection by capturing frames from itself.html
 * and logging similarity to first frame over time.
 * Goal: understand the similarity profile to debug loop detection.
 */

import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function comparePixelData(dataA, dataB, totalPixels, step = 4) {
  let matchingPixels = 0;
  let sampledPixels = 0;
  const len = totalPixels * 4;
  for (let i = 0; i < len; i += 4 * step) {
    sampledPixels++;
    const dr = Math.abs(dataA[i] - dataB[i]);
    const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
    const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
    if (dr <= 2 && dg <= 2 && db <= 2) matchingPixels++;
  }
  return matchingPixels / sampledPixels;
}

async function main() {
  const url = 'https://linksplatform.github.io/itself.html';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('Loading page...');
  await page.goto(url, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));

  // Test 1: Screenshot-based loop detection profile
  console.log('\n=== Screenshot-based similarity profile ===');
  const frames = [];
  const timestamps = [];
  let firstPixels = null;
  let totalPixels = 0;
  const startTime = Date.now();
  const simLog = [];

  for (let i = 0; i < 200; i++) {
    const t = Date.now();
    const buf = await page.screenshot({ type: 'png', fullPage: false });
    timestamps.push(t);
    const decoded = PNG.sync.read(buf);

    if (!firstPixels) {
      firstPixels = decoded.data;
      totalPixels = decoded.width * decoded.height;
      simLog.push({ frame: 0, time: 0, simToFirst: 1.0 });
      console.log(`Frame 0: reference (${decoded.width}x${decoded.height})`);
      continue;
    }

    const sim = comparePixelData(decoded.data, firstPixels, totalPixels);
    const elapsed = t - startTime;
    simLog.push({ frame: i, time: elapsed, simToFirst: sim });

    if (i % 10 === 0) {
      console.log(`Frame ${i}: sim=${(sim * 100).toFixed(1)}% (${elapsed}ms)`);
    }
  }

  // Analyze peaks
  console.log('\n=== Peak Analysis ===');
  const peaks = [];
  for (let i = 2; i < simLog.length - 2; i++) {
    const prev = simLog[i - 1].simToFirst;
    const curr = simLog[i].simToFirst;
    const next = simLog[i + 1].simToFirst;
    if (curr > prev && curr > next && curr > 0.9) {
      peaks.push(simLog[i]);
      console.log(`Peak at frame ${simLog[i].frame}: sim=${(curr * 100).toFixed(1)}% time=${simLog[i].time}ms`);
    }
  }

  if (peaks.length >= 2) {
    const loopDuration = peaks[1].time - peaks[0].time;
    const loopFrames = peaks[1].frame - peaks[0].frame;
    console.log(`\nEstimated loop: ${loopFrames} frames, ${loopDuration}ms duration`);
  }

  // Write full similarity profile
  const outDir = join(__dirname);
  writeFileSync(join(outDir, 'similarity-profile.json'), JSON.stringify(simLog, null, 2));
  console.log(`\nSimilarity profile saved to experiments/similarity-profile.json`);

  // Test 2: CDP screencast similarity profile
  console.log('\n=== CDP Screencast similarity profile ===');
  const cdp = await page.context().newCDPSession(page);
  const screencastFrames = [];
  let screencastDone = false;

  cdp.on('Page.screencastFrame', async (event) => {
    if (screencastDone) return;
    const captureTime = Date.now();
    const buffer = Buffer.from(event.data, 'base64');
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    } catch {}
    screencastFrames.push({ buffer, captureTime });
  });

  const scStartTime = Date.now();
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 100,
    maxWidth: 512,
    maxHeight: 512,
    everyNthFrame: 1,
  });

  // Capture for 30 seconds
  await new Promise(r => setTimeout(r, 30000));
  screencastDone = true;
  await cdp.send('Page.stopScreencast');

  console.log(`Captured ${screencastFrames.length} screencast frames in 30s`);
  console.log(`FPS: ${(screencastFrames.length / 30).toFixed(1)}`);

  // Now take PNG comparison screenshots at the timestamps of key frames
  // Actually, let's just decode the JPEG frames and compare
  const jpeg = (await import('jpeg-js')).default;

  let scFirstPixels = null;
  let scTotalPixels = 0;
  const scSimLog = [];

  for (let i = 0; i < screencastFrames.length; i++) {
    try {
      const jpegData = jpeg.decode(screencastFrames[i].buffer, { useTArray: true });
      const pixels = Buffer.from(jpegData.data);

      if (!scFirstPixels) {
        scFirstPixels = pixels;
        scTotalPixels = jpegData.width * jpegData.height;
        scSimLog.push({ frame: 0, time: 0, simToFirst: 1.0 });
        continue;
      }

      const sim = comparePixelData(pixels, scFirstPixels, scTotalPixels);
      const elapsed = screencastFrames[i].captureTime - screencastFrames[0].captureTime;
      scSimLog.push({ frame: i, time: elapsed, simToFirst: sim });
    } catch (e) {
      // skip bad frames
    }
  }

  // Analyze screencast peaks
  console.log('\n=== Screencast Peak Analysis ===');
  const scPeaks = [];
  for (let i = 2; i < scSimLog.length - 2; i++) {
    const prev = scSimLog[i - 1].simToFirst;
    const curr = scSimLog[i].simToFirst;
    const next = scSimLog[i + 1].simToFirst;
    if (curr > prev && curr > next && curr > 0.9) {
      scPeaks.push(scSimLog[i]);
    }
  }

  // Filter to significant peaks (at least 0.95 similarity and separated by > 100 frames)
  const sigPeaks = [];
  for (const p of scPeaks) {
    if (p.simToFirst > 0.95 && (sigPeaks.length === 0 || p.frame - sigPeaks[sigPeaks.length - 1].frame > 50)) {
      sigPeaks.push(p);
      console.log(`Significant peak at frame ${p.frame}: sim=${(p.simToFirst * 100).toFixed(1)}% time=${p.time}ms`);
    }
  }

  if (sigPeaks.length >= 2) {
    const loopDuration = sigPeaks[1].time - sigPeaks[0].time;
    const loopFrames = sigPeaks[1].frame - sigPeaks[0].frame;
    console.log(`\nEstimated loop (screencast): ${loopFrames} frames, ${loopDuration}ms duration`);
    console.log(`Expected output frame count at capture FPS: ${loopFrames}`);
  }

  writeFileSync(join(outDir, 'screencast-similarity-profile.json'), JSON.stringify(scSimLog, null, 2));
  console.log(`\nScreencast similarity profile saved to experiments/screencast-similarity-profile.json`);

  await cdp.detach();
  await browser.close();
}

main().catch(console.error);
