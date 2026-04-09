#!/usr/bin/env node

/**
 * Quick experiment: test CDP screencast FPS vs page.screenshot() FPS
 */

import { chromium } from 'playwright';

const url = 'https://linksplatform.github.io/itself.html';

async function testScreenshot(page, duration = 5000) {
  const frames = [];
  const start = Date.now();

  while (Date.now() - start < duration) {
    await page.screenshot({ type: 'png', fullPage: false });
    frames.push(Date.now());
  }

  const elapsed = (Date.now() - start) / 1000;
  const fps = frames.length / elapsed;
  console.log(`Screenshot mode: ${frames.length} frames in ${elapsed.toFixed(1)}s = ${fps.toFixed(1)} FPS`);
  return fps;
}

async function testScreencast(page, duration = 5000) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  const start = Date.now();

  cdp.on('Page.screencastFrame', async (event) => {
    frames.push(Date.now());
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    } catch {}
  });

  const viewport = page.viewportSize();
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 90,
    maxWidth: viewport.width,
    maxHeight: viewport.height,
    everyNthFrame: 1,
  });

  await new Promise(r => setTimeout(r, duration));

  try {
    await cdp.send('Page.stopScreencast');
    await cdp.detach();
  } catch {}

  const elapsed = (Date.now() - start) / 1000;
  const fps = frames.length / elapsed;
  console.log(`Screencast mode: ${frames.length} frames in ${elapsed.toFixed(1)}s = ${fps.toFixed(1)} FPS`);
  return fps;
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Test at 1024x1024 (typical capture size)
  console.log('--- Testing at 1024x1024 viewport ---');
  const ctx1 = await browser.newContext({ viewport: { width: 1024, height: 1024 } });
  const page1 = await ctx1.newPage();
  await page1.goto(url, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Testing page.screenshot()...');
  const screenshotFps = await testScreenshot(page1, 5000);

  await page1.close();
  await ctx1.close();

  // New context for screencast test
  const ctx2 = await browser.newContext({ viewport: { width: 1024, height: 1024 } });
  const page2 = await ctx2.newPage();
  await page2.goto(url, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Testing CDP screencast...');
  const screencastFps = await testScreencast(page2, 5000);

  await page2.close();
  await ctx2.close();

  // Test at 2150x2150 (current 2x capture size)
  console.log('\n--- Testing at 2150x2150 viewport ---');
  const ctx3 = await browser.newContext({ viewport: { width: 2150, height: 2150 } });
  const page3 = await ctx3.newPage();
  await page3.goto(url, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Testing page.screenshot()...');
  const screenshotFps2 = await testScreenshot(page3, 5000);

  await page3.close();
  await ctx3.close();

  const ctx4 = await browser.newContext({ viewport: { width: 2150, height: 2150 } });
  const page4 = await ctx4.newPage();
  await page4.goto(url, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Testing CDP screencast...');
  const screencastFps2 = await testScreencast(page4, 5000);

  await page4.close();
  await ctx4.close();

  console.log('\n--- Summary ---');
  console.log(`1024x1024: screenshot=${screenshotFps.toFixed(1)} FPS, screencast=${screencastFps.toFixed(1)} FPS (${(screencastFps/screenshotFps).toFixed(1)}x faster)`);
  console.log(`2150x2150: screenshot=${screenshotFps2.toFixed(1)} FPS, screencast=${screencastFps2.toFixed(1)} FPS (${(screencastFps2/screenshotFps2).toFixed(1)}x faster)`);

  await browser.close();
}

main().catch(console.error);
