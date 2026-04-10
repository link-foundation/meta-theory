#!/usr/bin/env node
/**
 * Test beginFrame capture for a full animation cycle.
 * Uses deterministic frame control to advance animation at exact intervals.
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

async function testFullCycleBeginFrame() {
  console.log('Testing beginFrame full cycle capture...\n');

  const targetFps = 60;
  const frameIntervalMs = 1000 / targetFps; // ~16.67ms
  const maxDuration = 12000; // 12 seconds max
  const maxFrames = Math.ceil(maxDuration / frameIntervalMs);
  const viewportSize = 1200; // slightly larger than 1024 for crop margin

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--deterministic-mode',
      '--enable-begin-frame-control',
      '--disable-new-content-rendering-timeout',
      '--run-all-compositor-stages-before-draw',
      '--disable-threaded-animation',
      '--disable-threaded-scrolling',
      '--disable-checker-imaging',
      '--disable-image-animation-resync',
      '--enable-surface-synchronization',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: viewportSize, height: viewportSize },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await page.context().newCDPSession(page);

  try {
    console.log('Loading page...');
    // Use goto without waiting for networkidle since beginFrame controls rendering
    await page.goto('https://linksplatform.github.io/itself.html', { waitUntil: 'load' });

    // Send initial frames to let page initialize
    console.log('Warming up (30 frames)...');
    for (let i = 0; i < 30; i++) {
      await cdp.send('HeadlessExperimental.beginFrame', {
        frameTimeTicks: (Date.now() + i * frameIntervalMs) * 1000,
        interval: frameIntervalMs,
        noDisplayUpdates: false,
      });
    }

    // Now capture frames with screenshots
    console.log(`\nCapturing at ${targetFps} FPS (max ${maxFrames} frames, ${maxDuration/1000}s)...`);
    const frames = [];
    const startTick = Date.now() * 1000; // microseconds

    for (let i = 0; i < maxFrames; i++) {
      const frameTick = startTick + i * frameIntervalMs * 1000;

      const result = await cdp.send('HeadlessExperimental.beginFrame', {
        frameTimeTicks: frameTick,
        interval: frameIntervalMs,
        noDisplayUpdates: false,
        screenshot: {
          format: 'png',
        },
      });

      if (result.screenshotData) {
        frames.push(Buffer.from(result.screenshotData, 'base64'));
      }

      if (i > 0 && i % 60 === 0) {
        console.log(`  ${i} frames captured (${(i / targetFps).toFixed(1)}s)`);
      }
    }

    console.log(`\nTotal: ${frames.length} frames at ${targetFps} FPS = ${(frames.length / targetFps).toFixed(1)}s`);
    console.log(`Frame size: ${Math.round(frames.reduce((s, f) => s + f.length, 0) / frames.length)} bytes avg`);

    // Save first 3 frames as test
    if (frames.length > 3) {
      writeFileSync('/tmp/beginframe-frame0.png', frames[0]);
      writeFileSync('/tmp/beginframe-frame1.png', frames[1]);
      writeFileSync('/tmp/beginframe-frame60.png', frames[Math.min(60, frames.length - 1)]);
      console.log('\nSaved test frames to /tmp/beginframe-frame*.png');
    }

  } catch (e) {
    console.error('Error:', e.message);
    if (e.message.includes('Target closed') || e.message.includes('Session closed')) {
      console.log('\nNote: beginFrame with screenshot may require specific Chrome version/config');
    }
  } finally {
    await browser.close();
  }
}

await testFullCycleBeginFrame();
