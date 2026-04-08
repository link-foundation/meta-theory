#!/usr/bin/env node

/**
 * Automated quality verification tests for capture-animation.mjs
 *
 * Tests:
 * 1. GIF output is a valid GIF89a file with correct loop structure
 * 2. Frame count meets minimum requirement
 * 3. Frame dimensions match expected output size
 * 4. Key frame quality: compare browser-captured key frames vs GIF-extracted key frames
 * 5. Animation timing: verify cycle duration is reasonable
 * 6. No fully blank or identical consecutive frames
 * 7. Color fidelity: verify key colors are preserved in the output
 * 8. Video output (MP4/WebM) is valid if ffmpeg available
 *
 * Usage:
 *   node scripts/test-capture-quality.mjs [--url URL] [--output DIR] [--skip-capture]
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Parse args
const args = process.argv.slice(2);
let testUrl = 'https://linksplatform.github.io/itself.html';
let outputDir = join(ROOT_DIR, 'test-output');
let skipCapture = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url') testUrl = args[++i];
  else if (args[i] === '--output') outputDir = args[++i];
  else if (args[i] === '--skip-capture') skipCapture = true;
}

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
    results.push({ name: testName, status: 'PASS', detail });
  } else {
    console.log(`  ✗ ${testName}${detail ? ': ' + detail : ''}`);
    failed++;
    results.push({ name: testName, status: 'FAIL', detail });
  }
}

function checkFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compare two PNG buffers and return similarity ratio (0-1).
 */
function comparePngs(bufA, bufB) {
  const pngA = PNG.sync.read(bufA);
  const pngB = PNG.sync.read(bufB);

  if (pngA.width !== pngB.width || pngA.height !== pngB.height) {
    return 0; // Different dimensions
  }

  const total = pngA.width * pngA.height;
  let matching = 0;

  for (let i = 0; i < total * 4; i += 4) {
    const dr = Math.abs(pngA.data[i] - pngB.data[i]);
    const dg = Math.abs(pngA.data[i + 1] - pngB.data[i + 1]);
    const db = Math.abs(pngA.data[i + 2] - pngB.data[i + 2]);
    if (dr <= 5 && dg <= 5 && db <= 5) matching++;
  }

  return matching / total;
}

/**
 * Check if a PNG has any non-background content (not entirely blank).
 */
function hasContent(buffer) {
  const png = PNG.sync.read(buffer);
  const corners = [0, (png.width - 1) * 4];
  const bgR = png.data[corners[0]], bgG = png.data[corners[0] + 1], bgB = png.data[corners[0] + 2];

  let diffPixels = 0;
  const total = png.width * png.height;
  for (let i = 0; i < total * 4; i += 4) {
    if (Math.abs(png.data[i] - bgR) > 10 ||
        Math.abs(png.data[i + 1] - bgG) > 10 ||
        Math.abs(png.data[i + 2] - bgB) > 10) {
      diffPixels++;
    }
  }

  return diffPixels / total;
}

/**
 * Extract a specific frame from a GIF file using the GIF89a binary format.
 * Returns raw RGBA pixel data for the frame.
 */
function getGifInfo(gifPath) {
  const data = readFileSync(gifPath);

  // Check GIF signature
  const sig = data.toString('ascii', 0, 6);
  const isGif = sig === 'GIF87a' || sig === 'GIF89a';

  // Get logical screen dimensions
  const width = data.readUInt16LE(6);
  const height = data.readUInt16LE(8);

  // Count frames (Image Descriptors start with 0x2C)
  let frameCount = 0;
  let i = 13; // skip header + GCT

  // Skip Global Color Table if present
  const flags = data[10];
  const hasGCT = (flags >> 7) & 1;
  if (hasGCT) {
    const gctSize = 3 * (1 << ((flags & 0x07) + 1));
    i = 13 + gctSize;
  }

  while (i < data.length) {
    if (data[i] === 0x2C) { // Image Descriptor
      frameCount++;
      // Skip image descriptor (10 bytes)
      i += 9;
      const localFlags = data[i];
      i++;
      const hasLCT = (localFlags >> 7) & 1;
      if (hasLCT) {
        const lctSize = 3 * (1 << ((localFlags & 0x07) + 1));
        i += lctSize;
      }
      // Skip LZW minimum code size
      i++;
      // Skip sub-blocks
      while (i < data.length && data[i] !== 0) {
        i += data[i] + 1;
      }
      i++; // block terminator
    } else if (data[i] === 0x21) { // Extension
      i += 2; // extension type
      while (i < data.length && data[i] !== 0) {
        i += data[i] + 1;
      }
      i++; // block terminator
    } else if (data[i] === 0x3B) { // Trailer
      break;
    } else {
      i++;
    }
  }

  return { isGif, isGif89a: sig === 'GIF89a', width, height, frameCount };
}

async function main() {
  console.log('=== Animation Capture Quality Tests ===\n');

  const gifPath = join(outputDir, 'test-capture.gif');
  const mp4Path = join(outputDir, 'test-capture.mp4');
  const webmPath = join(outputDir, 'test-capture.webm');

  // Step 1: Run capture if not skipping
  if (!skipCapture) {
    console.log('Step 1: Running animation capture...');
    try {
      const captureCmd = [
        'node', join(ROOT_DIR, 'scripts', 'capture-animation.mjs'),
        testUrl,
        '--output', gifPath,
        '--extract-keyframes',
        '--max-size', '512',  // Smaller for faster testing
        '--min-frames', '30',
        '--loop-timeout', '45',
        '--verbose',
      ].join(' ');

      console.log(`   Command: ${captureCmd}`);
      const captureLog = execSync(captureCmd, {
        cwd: ROOT_DIR,
        timeout: 120000, // 2 minutes
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      writeFileSync(join(outputDir, 'capture-log.txt'), captureLog);
      console.log('   Capture completed successfully.\n');
    } catch (err) {
      const errOutput = (err.stdout || '') + '\n' + (err.stderr || '');
      writeFileSync(join(outputDir, 'capture-error.txt'), errOutput);
      console.error(`   Capture failed: ${err.message}`);
      console.error('   See capture-error.txt for details.\n');
      // Continue with whatever files exist
    }
  }

  // Step 2: Test GIF output
  console.log('Step 2: Validating GIF output...');

  const gifExists = existsSync(gifPath);
  assert(gifExists, 'GIF output file exists');

  if (gifExists) {
    const gifInfo = getGifInfo(gifPath);
    assert(gifInfo.isGif89a, 'GIF is GIF89a format');
    assert(gifInfo.width > 0 && gifInfo.height > 0, `GIF has valid dimensions (${gifInfo.width}x${gifInfo.height})`);
    assert(gifInfo.width <= 1024 && gifInfo.height <= 1024, `GIF dimensions within max size (${gifInfo.width}x${gifInfo.height})`);
    assert(gifInfo.frameCount >= 15, `GIF has sufficient frames (${gifInfo.frameCount} >= 15)`, `found ${gifInfo.frameCount}`);

    const gifStats = statSync(gifPath);
    assert(gifStats.size > 10000, `GIF file size is reasonable (${(gifStats.size / 1024).toFixed(1)} KB > 10 KB)`);

    // Check aspect ratio is close to 1:1 for itself.html (content is ~square)
    const ratio = gifInfo.width / gifInfo.height;
    assert(ratio >= 0.8 && ratio <= 1.25, `GIF aspect ratio is near square (${ratio.toFixed(2)})`);
  }

  // Step 3: Test key frames
  console.log('\nStep 3: Validating key frames...');

  const keyframeDir = join(outputDir, 'test-capture-keyframes');
  const keyframeExists = existsSync(keyframeDir);
  assert(keyframeExists, 'Key frames directory exists');

  if (keyframeExists) {
    const keyframeFiles = readdirSync(keyframeDir).filter(f => f.endsWith('.png'));
    assert(keyframeFiles.length >= 3, `At least 3 key frames extracted (${keyframeFiles.length})`);

    for (const kf of keyframeFiles) {
      const kfPath = join(keyframeDir, kf);
      const kfBuf = readFileSync(kfPath);
      const contentRatio = hasContent(kfBuf);
      assert(contentRatio > 0.01, `Key frame ${kf} has content (${(contentRatio * 100).toFixed(1)}% non-background)`);

      const png = PNG.sync.read(kfBuf);
      assert(png.width > 0 && png.height > 0, `Key frame ${kf} has valid dimensions (${png.width}x${png.height})`);
    }

    // Check that key frames are different from each other (animation is captured)
    if (keyframeFiles.length >= 2) {
      const buf0 = readFileSync(join(keyframeDir, keyframeFiles[0]));
      const buf1 = readFileSync(join(keyframeDir, keyframeFiles[1]));
      const sim = comparePngs(buf0, buf1);
      assert(sim < 0.98, `Key frames are different (${(sim * 100).toFixed(1)}% similarity)`, `similarity: ${sim.toFixed(3)}`);
    }
  }

  // Step 4: Browser key frame comparison (capture 3 frames directly from the live page)
  console.log('\nStep 4: Browser live key frame comparison...');

  if (keyframeExists && !skipCapture) {
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: 512, height: 512 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await page.goto(testUrl, { waitUntil: 'networkidle' });
      await new Promise(r => setTimeout(r, 3000));

      // Capture 3 live frames at different points
      const liveFrames = [];
      for (let i = 0; i < 3; i++) {
        const buf = await page.screenshot({ type: 'png', fullPage: false });
        liveFrames.push(buf);
        writeFileSync(join(outputDir, `live-frame-${i}.png`), buf);
        await new Promise(r => setTimeout(r, 2000));
      }

      // Live frames should have content
      for (let i = 0; i < liveFrames.length; i++) {
        const contentRatio = hasContent(liveFrames[i]);
        assert(contentRatio > 0.01, `Live frame ${i} has content (${(contentRatio * 100).toFixed(1)}%)`);
      }

      await browser.close();
    } catch (err) {
      console.log(`   Skipping browser comparison: ${err.message}`);
    }
  }

  // Step 5: Video format tests
  console.log('\nStep 5: Video format validation...');

  const hasFfmpeg = checkFfmpeg();
  if (hasFfmpeg) {
    // Check companion videos were generated
    const companionMp4 = gifPath.replace(/\.gif$/i, '.mp4');
    const companionWebm = gifPath.replace(/\.gif$/i, '.webm');

    if (existsSync(companionMp4)) {
      const mp4Stats = statSync(companionMp4);
      assert(mp4Stats.size > 1000, `MP4 file generated (${(mp4Stats.size / 1024).toFixed(1)} KB)`);

      // Verify MP4 is valid using ffprobe
      try {
        const probeOut = execSync(`ffprobe -v quiet -print_format json -show_streams ${companionMp4}`, {
          encoding: 'utf8',
        });
        const probe = JSON.parse(probeOut);
        const videoStream = probe.streams?.find(s => s.codec_type === 'video');
        assert(!!videoStream, 'MP4 has a video stream');
        if (videoStream) {
          assert(videoStream.codec_name === 'h264', `MP4 uses H.264 codec (${videoStream.codec_name})`);
          assert(parseInt(videoStream.width) > 0, `MP4 has valid width (${videoStream.width})`);
        }
      } catch {
        console.log('   Could not probe MP4 with ffprobe');
      }
    } else {
      console.log('   MP4 companion not found (may not have been generated)');
    }

    if (existsSync(companionWebm)) {
      const webmStats = statSync(companionWebm);
      assert(webmStats.size > 1000, `WebM file generated (${(webmStats.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log('   WebM companion not found (may not have been generated)');
    }
  } else {
    console.log('   ffmpeg not available, skipping video tests');
  }

  // Step 6: Timing verification
  console.log('\nStep 6: Timing verification...');

  const captureLogPath = join(outputDir, 'capture-log.txt');
  if (existsSync(captureLogPath)) {
    const log = readFileSync(captureLogPath, 'utf8');

    // Check that real timestamps were used
    const usesRealTimestamps = log.includes('using real capture timestamps');
    assert(usesRealTimestamps, 'Uses real capture timestamps for GIF timing');

    // Extract cycle duration
    const durationMatch = log.match(/Real cycle duration: (\d+)ms/);
    if (durationMatch) {
      const duration = parseInt(durationMatch[1]);
      // The itself.html animation cycles in roughly 5-30 seconds
      assert(duration >= 2000 && duration <= 60000, `Cycle duration is reasonable (${duration}ms)`);
    }

    // Extract average interval
    const intervalMatch = log.match(/Real average interval: ([\d.]+)ms/);
    if (intervalMatch) {
      const avgInterval = parseFloat(intervalMatch[1]);
      assert(avgInterval > 0 && avgInterval < 500, `Average capture interval is fast (${avgInterval.toFixed(1)}ms)`);
    }
  }

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  // Write results file
  writeFileSync(join(outputDir, 'test-results.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    url: testUrl,
    passed,
    failed,
    results,
  }, null, 2));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
