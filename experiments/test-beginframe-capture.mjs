#!/usr/bin/env node
/**
 * Experiment: Test HeadlessExperimental.beginFrame for deterministic frame capture.
 *
 * This approach uses Chrome's beginFrame control to capture frames deterministically,
 * eliminating dropped frames and timing issues entirely.
 */

import { chromium } from 'playwright';

async function testBeginFrame() {
  console.log('Testing HeadlessExperimental.beginFrame capture...\n');

  // Launch with deterministic mode flags
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
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await page.context().newCDPSession(page);

  try {
    console.log('Loading page...');
    await page.goto('https://linksplatform.github.io/itself.html', { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 2000));

    // Try to use HeadlessExperimental.beginFrame
    console.log('\nAttempting beginFrame capture...');
    const targetFps = 30;
    const frameInterval = 1000 / targetFps; // ~33.33ms
    const frames = [];
    const maxFrames = 10; // Just test a few frames

    for (let i = 0; i < maxFrames; i++) {
      try {
        const result = await cdp.send('HeadlessExperimental.beginFrame', {
          frameTimeTicks: Date.now() * 1000, // microseconds
          interval: frameInterval,
          noDisplayUpdates: false,
          screenshot: {
            format: 'png',
            quality: 100,
          },
        });

        if (result.screenshotData) {
          frames.push(Buffer.from(result.screenshotData, 'base64'));
          console.log(`  Frame ${i + 1}: ${frames[frames.length - 1].length} bytes`);
        } else {
          console.log(`  Frame ${i + 1}: no screenshot data`);
        }
      } catch (e) {
        console.log(`  Frame ${i + 1} error: ${e.message}`);
        break;
      }
    }

    console.log(`\nTotal frames captured: ${frames.length}`);
    if (frames.length > 0) {
      console.log('SUCCESS: beginFrame capture works with Playwright!');
    } else {
      console.log('FAILED: beginFrame capture did not work');
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

// Also test Page.startScreencast with PNG format (no compression)
async function testScreencastPng() {
  console.log('\n\n=== Testing screencast with PNG format (no compression) ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await page.context().newCDPSession(page);

  try {
    await page.goto('https://linksplatform.github.io/itself.html', { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 2000));

    const frames = [];
    let done = false;

    cdp.on('Page.screencastFrame', async (event) => {
      if (done) return;
      const buffer = Buffer.from(event.data, 'base64');
      frames.push({ buffer, time: Date.now(), metadata: event.metadata });
      try {
        await cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
      } catch {}
    });

    // Try PNG format
    console.log('Starting screencast with PNG format...');
    await cdp.send('Page.startScreencast', {
      format: 'png',
      quality: 100,
      maxWidth: 1024,
      maxHeight: 1024,
      everyNthFrame: 1,
    });

    // Capture for 3 seconds
    await new Promise(r => setTimeout(r, 3000));
    done = true;
    await cdp.send('Page.stopScreencast');

    console.log(`Captured ${frames.length} PNG frames in 3 seconds`);
    if (frames.length > 0) {
      const fps = frames.length / 3;
      console.log(`FPS: ~${fps.toFixed(1)}`);
      console.log(`Avg frame size: ${Math.round(frames.reduce((s, f) => s + f.buffer.length, 0) / frames.length)} bytes`);

      // Check frame intervals
      const intervals = [];
      for (let i = 1; i < frames.length; i++) {
        intervals.push(frames[i].time - frames[i-1].time);
      }
      if (intervals.length > 0) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const maxInterval = Math.max(...intervals);
        const minInterval = Math.min(...intervals);
        console.log(`Interval: avg=${avgInterval.toFixed(1)}ms, min=${minInterval}ms, max=${maxInterval}ms`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

// Test screencast with JPEG quality 100 and larger viewport
async function testScreencastHighRes() {
  console.log('\n\n=== Testing screencast with higher resolution (2x) ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 2048, height: 2048 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await page.context().newCDPSession(page);

  try {
    await page.goto('https://linksplatform.github.io/itself.html', { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 2000));

    const frames = [];
    let done = false;

    cdp.on('Page.screencastFrame', async (event) => {
      if (done) return;
      const buffer = Buffer.from(event.data, 'base64');
      frames.push({ buffer, time: Date.now() });
      try {
        await cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
      } catch {}
    });

    // JPEG quality 100 at 2x resolution
    console.log('Starting screencast at 2048x2048 JPEG Q100...');
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 100,
      maxWidth: 2048,
      maxHeight: 2048,
      everyNthFrame: 1,
    });

    await new Promise(r => setTimeout(r, 3000));
    done = true;
    await cdp.send('Page.stopScreencast');

    console.log(`Captured ${frames.length} frames in 3 seconds`);
    if (frames.length > 0) {
      const fps = frames.length / 3;
      console.log(`FPS: ~${fps.toFixed(1)}`);
      console.log(`Avg frame size: ${Math.round(frames.reduce((s, f) => s + f.buffer.length, 0) / frames.length)} bytes`);

      const intervals = [];
      for (let i = 1; i < frames.length; i++) {
        intervals.push(frames[i].time - frames[i-1].time);
      }
      if (intervals.length > 0) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const maxInterval = Math.max(...intervals);
        console.log(`Interval: avg=${avgInterval.toFixed(1)}ms, max=${maxInterval}ms`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

await testBeginFrame();
await testScreencastPng();
await testScreencastHighRes();
