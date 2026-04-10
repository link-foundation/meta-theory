#!/usr/bin/env node
/**
 * Verify frame timing smoothness by capturing and analyzing inter-frame intervals.
 * Checks for "jumping" frames — large gaps in timing that indicate dropped frames.
 */
import { chromium } from 'playwright';
import jpeg from 'jpeg-js';

const URL = 'https://linksplatform.github.io/itself.html';
const CAPTURE_SECONDS = 6;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1076, height: 1076 } });
  await page.goto(URL, { waitUntil: 'networkidle' });

  const cdp = await page.context().newCDPSession(page);
  const timestamps = [];
  let done = false;

  cdp.on('Page.screencastFrame', async (event) => {
    if (done) return;
    timestamps.push(Date.now());
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    } catch { /* ignore */ }
  });

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 100,
    maxWidth: 1076,
    maxHeight: 1076,
    everyNthFrame: 1,
  });

  await new Promise(r => setTimeout(r, CAPTURE_SECONDS * 1000));
  done = true;

  try { await cdp.send('Page.stopScreencast'); } catch {}
  try { await cdp.detach(); } catch {}
  await browser.close();

  // Analyze intervals
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const maxInterval = Math.max(...intervals);
  const minInterval = Math.min(...intervals);
  const fps = 1000 / avgInterval;

  // Count "jumps" — intervals more than 3x the average
  const jumpThreshold = avgInterval * 3;
  const jumps = intervals.filter(i => i > jumpThreshold);

  console.log(`Frames captured: ${timestamps.length}`);
  console.log(`Duration: ${CAPTURE_SECONDS}s`);
  console.log(`FPS: ${fps.toFixed(1)}`);
  console.log(`Avg interval: ${avgInterval.toFixed(1)}ms`);
  console.log(`Min interval: ${minInterval}ms`);
  console.log(`Max interval: ${maxInterval}ms`);
  console.log(`Jumps (>${jumpThreshold.toFixed(0)}ms): ${jumps.length}`);
  if (jumps.length > 0) {
    console.log(`Jump intervals: ${jumps.map(j => j + 'ms').join(', ')}`);
  }

  // Histogram
  const buckets = [0, 10, 20, 30, 40, 50, 75, 100, 150, 200, 500];
  console.log('\nInterval distribution:');
  for (let b = 0; b < buckets.length - 1; b++) {
    const count = intervals.filter(i => i >= buckets[b] && i < buckets[b + 1]).length;
    const bar = '#'.repeat(Math.min(count, 60));
    console.log(`  ${String(buckets[b]).padStart(4)}-${String(buckets[b + 1]).padStart(4)}ms: ${String(count).padStart(4)} ${bar}`);
  }
  const over500 = intervals.filter(i => i >= 500).length;
  if (over500 > 0) {
    console.log(`   500+ms: ${over500}`);
  }

  // Pass/fail
  const smoothness = jumps.length === 0 ? 'SMOOTH' : `${jumps.length} JUMPS DETECTED`;
  console.log(`\nResult: ${smoothness}`);
  process.exit(jumps.length > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
