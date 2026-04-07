#!/usr/bin/env node

/**
 * Universal animation capture tool
 *
 * Captures any looped web animation as a GIF by taking screenshots at regular
 * intervals and detecting when the animation loops back to the first frame.
 * No knowledge of the page's implementation details is required.
 *
 * Usage:
 *   node scripts/capture-animation.mjs <url>
 *   node scripts/capture-animation.mjs <url> --output out.gif
 *   node scripts/capture-animation.mjs <url> --max-size 512 --interval 100
 *
 * Options:
 *   --output PATH         Output file path (default: docs/animations/capture.gif)
 *   --max-size N           Max dimension for the larger side (default: 1024)
 *   --viewport WxH         Browser viewport size (default: 1920x1080)
 *   --interval N           Capture interval in ms (default: 0, as fast as possible)
 *   --fps N                Output GIF frames per second (default: derived from real timing)
 *   --speed N              Playback speed multiplier (default: 1.0, e.g. 0.5 = half speed)
 *   --delay N              Explicit GIF frame delay in ms (overrides --fps/--speed)
 *   --loop-timeout N       Max seconds to wait for loop (default: 60)
 *   --static-timeout N     Max seconds with no change before stopping (default: 60)
 *   --similarity N         Pixel similarity threshold 0-1 (default: 0.99)
 *   --no-crop              Disable auto-crop to content
 *   --crop-padding N       Padding around content after crop in px (default: auto)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import GIFEncoder from 'gif-encoder-2';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    output: join(ROOT_DIR, 'docs', 'animations', 'capture.gif'),
    maxSize: 1024,
    viewportWidth: 1920,  // 16:9 default to match common SVG/page layouts
    viewportHeight: 1080,
    interval: 0,  // 0 = capture as fast as possible (screenshot overhead is the bottleneck)
    fps: null,     // null = derived from real capture timing
    speed: 1.0,    // playback speed multiplier (0.5 = half speed, 2.0 = double)
    delay: null,   // null = auto-calculated from real timestamps/fps/speed
    loopTimeout: 60,
    staticTimeout: 60,
    similarity: 0.99,
    crop: true,
    cropPadding: null, // null = auto
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      switch (arg) {
        case '--output':
          options.output = args[++i];
          break;
        case '--max-size':
          options.maxSize = parseInt(args[++i], 10);
          break;
        case '--viewport': {
          const vp = args[++i].split('x');
          options.viewportWidth = parseInt(vp[0], 10);
          options.viewportHeight = parseInt(vp[1], 10);
          break;
        }
        case '--interval':
          options.interval = parseInt(args[++i], 10);
          break;
        case '--fps':
          options.fps = parseFloat(args[++i]);
          break;
        case '--speed':
          options.speed = parseFloat(args[++i]);
          break;
        case '--delay':
          options.delay = parseInt(args[++i], 10);
          break;
        case '--loop-timeout':
          options.loopTimeout = parseInt(args[++i], 10);
          break;
        case '--static-timeout':
          options.staticTimeout = parseInt(args[++i], 10);
          break;
        case '--similarity':
          options.similarity = parseFloat(args[++i]);
          break;
        case '--no-crop':
          options.crop = false;
          break;
        case '--crop-padding':
          options.cropPadding = parseInt(args[++i], 10);
          break;
        default:
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
      }
    } else if (!options.url) {
      options.url = arg;
    }
  }

  if (!options.url) {
    console.error('Usage: node scripts/capture-animation.mjs <url> [options]');
    process.exit(1);
  }

  return options;
}

/**
 * Compare two raw RGBA pixel buffers using sampling for speed.
 * Compares every Nth pixel (step) for fast approximate similarity.
 * Returns similarity ratio (0-1).
 */
function comparePixelData(dataA, dataB, totalPixels, step = 4) {
  let matchingPixels = 0;
  let sampledPixels = 0;
  const len = totalPixels * 4;

  for (let i = 0; i < len; i += 4 * step) {
    sampledPixels++;
    const dr = Math.abs(dataA[i] - dataB[i]);
    const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
    const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
    // Allow small per-channel differences for anti-aliasing
    if (dr <= 2 && dg <= 2 && db <= 2) {
      matchingPixels++;
    }
  }

  return matchingPixels / sampledPixels;
}

/**
 * Find the bounding box of non-background content in a PNG buffer.
 * Detects the background color from the corner pixels.
 */
function findContentBounds(pngData) {
  const { width, height, data } = pngData;

  // Sample corner pixels to determine background color
  const corners = [
    0,                              // top-left
    (width - 1) * 4,                // top-right
    (height - 1) * width * 4,       // bottom-left
    ((height - 1) * width + (width - 1)) * 4 // bottom-right
  ];

  // Use the most common corner color as background
  const bgColors = corners.map(i => ({
    r: data[i], g: data[i + 1], b: data[i + 2]
  }));

  // Pick the color that appears most often among corners
  const bgColor = bgColors.reduce((best, c) => {
    const count = bgColors.filter(
      o => Math.abs(o.r - c.r) <= 5 && Math.abs(o.g - c.g) <= 5 && Math.abs(o.b - c.b) <= 5
    ).length;
    return count > best.count ? { ...c, count } : best;
  }, { ...bgColors[0], count: 0 });

  const threshold = 10; // color distance threshold for "is background"

  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dr = Math.abs(data[i] - bgColor.r);
      const dg = Math.abs(data[i + 1] - bgColor.g);
      const db = Math.abs(data[i + 2] - bgColor.b);

      if (dr > threshold || dg > threshold || db > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    // No content found — return full image
    return { x: 0, y: 0, w: width, h: height };
  }

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Compute the union bounding box across all frames, then normalize padding
 * so that padding is equal on all sides and the result is square if content is ~square.
 */
function computeCropRegion(frames, explicitPadding) {
  // Parse all frames and find content bounds
  const allBounds = frames.map(buf => {
    const png = PNG.sync.read(buf);
    return { bounds: findContentBounds(png), width: png.width, height: png.height };
  });

  const imgWidth = allBounds[0].width;
  const imgHeight = allBounds[0].height;

  // Union of all content bounds
  let minX = imgWidth, minY = imgHeight, maxX = 0, maxY = 0;
  for (const { bounds } of allBounds) {
    if (bounds.x < minX) minX = bounds.x;
    if (bounds.y < minY) minY = bounds.y;
    if (bounds.x + bounds.w - 1 > maxX) maxX = bounds.x + bounds.w - 1;
    if (bounds.y + bounds.h - 1 > maxY) maxY = bounds.y + bounds.h - 1;
  }

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;

  // Determine padding: auto = minimum existing padding from any edge
  let padding;
  if (explicitPadding !== null) {
    padding = explicitPadding;
  } else {
    const padLeft = minX;
    const padRight = imgWidth - maxX - 1;
    const padTop = minY;
    const padBottom = imgHeight - maxY - 1;
    // Use the minimum padding from any side to normalize
    padding = Math.min(padLeft, padRight, padTop, padBottom);
    // Ensure at least a small padding
    padding = Math.max(padding, Math.round(Math.max(contentW, contentH) * 0.02));
  }

  // Create equal-padded crop region
  let cropX = minX - padding;
  let cropY = minY - padding;
  let cropW = contentW + padding * 2;
  let cropH = contentH + padding * 2;

  // Make square if aspect ratio is close to 1:1 (within 20%)
  const aspectRatio = cropW / cropH;
  if (aspectRatio >= 0.8 && aspectRatio <= 1.25) {
    const side = Math.max(cropW, cropH);
    // Center the content in the square
    const centerX = cropX + cropW / 2;
    const centerY = cropY + cropH / 2;
    cropX = Math.round(centerX - side / 2);
    cropY = Math.round(centerY - side / 2);
    cropW = side;
    cropH = side;
  }

  // Clamp to image boundaries
  cropX = Math.max(0, cropX);
  cropY = Math.max(0, cropY);
  cropW = Math.min(cropW, imgWidth - cropX);
  cropH = Math.min(cropH, imgHeight - cropY);

  console.log(`   Content bounds: ${contentW}x${contentH} at (${minX},${minY})`);
  console.log(`   Padding: ${padding}px (equal on all sides)`);
  console.log(`   Crop region: ${cropW}x${cropH} at (${cropX},${cropY})`);

  return { x: cropX, y: cropY, w: cropW, h: cropH };
}

/**
 * Crop a PNG buffer to the given region
 */
function cropPng(buffer, region) {
  const src = PNG.sync.read(buffer);
  const dst = new PNG({ width: region.w, height: region.h });

  for (let y = 0; y < region.h; y++) {
    for (let x = 0; x < region.w; x++) {
      const srcIdx = ((region.y + y) * src.width + (region.x + x)) * 4;
      const dstIdx = (y * region.w + x) * 4;
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }

  return PNG.sync.write(dst);
}

/**
 * Resize a PNG buffer so the larger side equals maxSize
 */
function resizePng(buffer, maxSize) {
  const src = PNG.sync.read(buffer);

  if (src.width <= maxSize && src.height <= maxSize) {
    return buffer; // no resize needed
  }

  const scale = maxSize / Math.max(src.width, src.height);
  const newW = Math.round(src.width * scale);
  const newH = Math.round(src.height * scale);

  const dst = new PNG({ width: newW, height: newH });

  // Nearest-neighbor interpolation for sharp, crisp output (no blur)
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const srcX = Math.min(Math.floor((x / newW) * src.width), src.width - 1);
      const srcY = Math.min(Math.floor((y / newH) * src.height), src.height - 1);
      const srcIdx = (srcY * src.width + srcX) * 4;
      const dstIdx = (y * newW + x) * 4;
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }

  return PNG.sync.write(dst);
}

/**
 * Capture frames until animation loops or timeouts are reached.
 *
 * Loop detection strategy: since screenshots are taken at arbitrary points in
 * the animation cycle, an exact pixel match to the first frame is unlikely.
 * Instead, we track the similarity to the first frame over time. When we detect
 * a periodic pattern (similarity peaks), we use the second peak as the loop
 * point — meaning one full animation cycle has been captured.
 */
async function captureFrames(page, options) {
  const { interval, loopTimeout, staticTimeout, similarity } = options;

  const frames = [];       // PNG buffers for GIF assembly
  const timestamps = [];   // real capture timestamps for accurate GIF timing
  const simHistory = [];   // similarity-to-first for each frame
  let firstPixels = null;  // decoded pixel data of first frame (cached for fast comparison)
  let lastPixels = null;   // decoded pixel data of previous frame
  let totalPixels = 0;     // pixel count for comparison
  let lastChangeTime = Date.now();
  const startTime = Date.now();
  let frameIndex = 0;

  // For peak detection: track local maxima of similarity to first frame
  let peakIndices = [];
  let prevSim = 0;
  let rising = true;

  console.log(`\nCapturing frames (interval: ${interval}ms)...`);
  console.log(`   Loop timeout: ${loopTimeout}s | Static timeout: ${staticTimeout}s`);
  console.log(`   Similarity threshold: ${similarity}`);

  while (true) {
    const captureStart = Date.now();
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    timestamps.push(captureStart);
    frameIndex++;

    // Decode PNG once per frame (avoid repeated decoding in comparisons)
    const decoded = PNG.sync.read(buffer);
    const currentPixels = decoded.data;

    if (firstPixels === null) {
      firstPixels = currentPixels;
      lastPixels = currentPixels;
      totalPixels = decoded.width * decoded.height;
      frames.push(buffer);
      simHistory.push(1.0);
      console.log(`   Frame 1 captured (reference frame, ${decoded.width}x${decoded.height})`);
      await new Promise(r => setTimeout(r, interval));
      continue;
    }

    // Check if frame differs from previous frame (using cached pixel data)
    const simToPrev = comparePixelData(currentPixels, lastPixels, totalPixels);
    const isStatic = simToPrev >= similarity;

    if (!isStatic) {
      lastChangeTime = Date.now();
    }

    // Always store the frame (even near-duplicates help with smooth GIF)
    frames.push(buffer);
    lastPixels = currentPixels;

    // Compute similarity to first frame for loop detection (using cached first frame pixels)
    const simToFirst = comparePixelData(currentPixels, firstPixels, totalPixels);
    simHistory.push(simToFirst);

    // Peak detection: find local maxima in similarity-to-first
    // A peak occurs when similarity was rising and starts falling
    if (frames.length > 5) {
      if (rising && simToFirst < prevSim - 0.002) {
        // We just passed a peak at the previous frame
        peakIndices.push(frames.length - 2); // -2 because current frame is already added
        rising = false;

        if (peakIndices.length === 1) {
          console.log(`   First similarity peak at frame ${peakIndices[0]} (sim=${(simHistory[peakIndices[0]] * 100).toFixed(1)}%)`);
        }

        if (peakIndices.length >= 2) {
          const loopLength = peakIndices[peakIndices.length - 1] - peakIndices[peakIndices.length - 2];
          const peakSim1 = simHistory[peakIndices[peakIndices.length - 2]];
          const peakSim2 = simHistory[peakIndices[peakIndices.length - 1]];

          // Verify this is a real cycle: peaks should have similar similarity values
          // and the cycle length should be reasonable (at least 5 frames)
          if (loopLength >= 10 && Math.abs(peakSim1 - peakSim2) < 0.02) {
            // Trim frames to one complete cycle: from start to second peak
            const cycleEnd = peakIndices[peakIndices.length - 1];
            const cycleDuration = timestamps[cycleEnd - 1] - timestamps[0];
            console.log(`   Loop detected: cycle length = ${loopLength} frames`);
            console.log(`   Peak similarities: ${(peakSim1 * 100).toFixed(1)}%, ${(peakSim2 * 100).toFixed(1)}%`);
            console.log(`   Real cycle duration: ${cycleDuration}ms`);
            console.log(`   Trimming to ${cycleEnd} frames (one complete cycle)`);
            frames.length = cycleEnd;
            timestamps.length = cycleEnd;
            break;
          }
        }
      } else if (simToFirst > prevSim + 0.002) {
        rising = true;
      }
    }
    prevSim = simToFirst;

    if (frameIndex % 20 === 0) {
      console.log(`   Frame ${frames.length} captured (${((Date.now() - startTime) / 1000).toFixed(1)}s elapsed, sim=${(simToFirst * 100).toFixed(1)}%)`);
    }

    // Check static timeout (no change for N seconds)
    const staticElapsed = (Date.now() - lastChangeTime) / 1000;
    if (staticElapsed >= staticTimeout) {
      console.log(`   Static timeout reached (${staticTimeout}s with no change)`);
      break;
    }

    // Check loop timeout (total capture time)
    const totalElapsed = (Date.now() - startTime) / 1000;
    if (totalElapsed >= loopTimeout) {
      console.log(`   Loop timeout reached (${loopTimeout}s total)`);
      break;
    }

    await new Promise(r => setTimeout(r, interval));
  }

  // Compute real average interval from timestamps
  if (timestamps.length >= 2) {
    const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
    const avgInterval = totalTime / (timestamps.length - 1);
    console.log(`   Total frames captured: ${frames.length}`);
    console.log(`   Real average interval: ${avgInterval.toFixed(1)}ms (requested: ${interval}ms)`);
    console.log(`   Effective capture FPS: ~${(1000 / avgInterval).toFixed(1)}`);
  } else {
    console.log(`   Total frames captured: ${frames.length}`);
  }

  return { frames, timestamps };
}

/**
 * Assemble PNG frames into a GIF.
 * @param {Buffer[]} frames - PNG frame buffers
 * @param {number} defaultDelay - Default delay in ms (used when perFrameDelays not provided)
 * @param {string} outputPath - Output file path
 * @param {number[]|null} perFrameDelays - Per-frame delays in ms (optional)
 */
function assembleGif(frames, defaultDelay, outputPath, perFrameDelays) {
  const firstPng = PNG.sync.read(frames[0]);
  const width = firstPng.width;
  const height = firstPng.height;

  const usePerFrame = perFrameDelays && perFrameDelays.length === frames.length;
  if (usePerFrame) {
    const avgDelay = perFrameDelays.reduce((a, b) => a + b, 0) / perFrameDelays.length;
    console.log(`\nAssembling GIF (${frames.length} frames, avg ${avgDelay.toFixed(1)}ms delay, ${width}x${height})...`);
  } else {
    console.log(`\nAssembling GIF (${frames.length} frames, ${defaultDelay}ms delay, ${width}x${height})...`);
  }

  const encoder = new GIFEncoder(width, height, 'octree', false);

  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  encoder.setRepeat(0); // loop forever

  if (!usePerFrame) {
    encoder.setDelay(defaultDelay);
  }

  encoder.start();

  for (let i = 0; i < frames.length; i++) {
    if (usePerFrame) {
      encoder.setDelay(perFrameDelays[i]);
    }
    const png = PNG.sync.read(frames[i]);
    encoder.addFrame(png.data);
  }

  encoder.finish();
  const gifBuffer = encoder.out.getData();

  writeFileSync(outputPath, gifBuffer);
  const stats = statSync(outputPath);
  console.log(`   GIF saved: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);

  return outputPath;
}

/**
 * Main entry point
 */
async function main() {
  const options = parseArgs();

  // Compute effective GIF frame delay:
  // - If --delay is explicitly set, use it directly
  // - Otherwise, derive from interval, fps, and speed
  //   Default behavior: GIF plays at the same speed as the original animation
  //   (delay = interval), adjusted by --speed multiplier
  let effectiveDelay;
  if (options.delay !== null) {
    effectiveDelay = options.delay;
  } else if (options.fps !== null) {
    // fps overrides interval-based calculation
    effectiveDelay = Math.round(1000 / options.fps / options.speed);
  } else {
    // Match original animation speed: delay = capture interval / speed
    effectiveDelay = Math.round(options.interval / options.speed);
  }
  // GIF minimum delay is 20ms (browsers clamp lower values to 100ms)
  effectiveDelay = Math.max(20, effectiveDelay);

  const effectiveFps = Math.round(1000 / effectiveDelay);

  console.log(`\nAnimation Capture Settings:`);
  console.log(`   URL: ${options.url}`);
  console.log(`   Viewport: ${options.viewportWidth}x${options.viewportHeight}`);
  console.log(`   Max size: ${options.maxSize}px`);
  console.log(`   Capture interval: ${options.interval}ms`);
  console.log(`   Speed: ${options.speed}x`);
  if (options.delay !== null) {
    console.log(`   GIF frame delay: ${effectiveDelay}ms (explicit)`);
  } else if (options.fps !== null) {
    console.log(`   GIF frame delay: ${effectiveDelay}ms (~${effectiveFps} fps, from --fps)`);
  } else {
    console.log(`   GIF frame delay: auto (from real capture timestamps)`);
  }
  console.log(`   Output: ${options.output}`);
  console.log(`   Auto-crop: ${options.crop}`);

  // Use configured viewport (default 1920x1080 to match common page layouts)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: options.viewportWidth, height: options.viewportHeight }
  });
  const page = await context.newPage();

  try {
    console.log('\nLoading page...');
    await page.goto(options.url, { waitUntil: 'networkidle' });
    // Let the page initialize and animation start
    await new Promise(r => setTimeout(r, 2000));

    // Capture frames with real timestamps
    const { frames: rawFrames, timestamps } = await captureFrames(page, options);

    if (rawFrames.length < 2) {
      console.error('Error: Not enough frames captured. The page may not have an animation.');
      process.exit(1);
    }

    let frames = rawFrames;

    // Auto-crop to content
    if (options.crop) {
      console.log('\nAuto-cropping to content...');
      const cropRegion = computeCropRegion(frames, options.cropPadding);
      frames = frames.map(f => cropPng(f, cropRegion));
    }

    // Resize to max-size
    console.log(`\nResizing to max ${options.maxSize}px...`);
    frames = frames.map(f => resizePng(f, options.maxSize));

    const finalPng = PNG.sync.read(frames[0]);
    console.log(`   Final frame size: ${finalPng.width}x${finalPng.height}`);

    // Compute per-frame delays from real timestamps when no explicit delay/fps is set
    let perFrameDelays = null;
    if (options.delay === null && options.fps === null && timestamps.length >= 2) {
      // Use real capture timestamps for accurate playback timing
      perFrameDelays = [];
      for (let i = 0; i < frames.length; i++) {
        let realDelay;
        if (i < timestamps.length - 1) {
          realDelay = timestamps[i + 1] - timestamps[i];
        } else {
          // Last frame: use average of previous delays
          const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
          realDelay = totalTime / (timestamps.length - 1);
        }
        // Apply speed multiplier: slower speed = longer delay
        realDelay = Math.round(realDelay / options.speed);
        // GIF minimum delay is 20ms (browsers clamp lower values to 100ms)
        realDelay = Math.max(20, realDelay);
        perFrameDelays.push(realDelay);
      }
      const avgDelay = perFrameDelays.reduce((a, b) => a + b, 0) / perFrameDelays.length;
      console.log(`\nTiming: using real capture timestamps`);
      console.log(`   Average real delay: ${avgDelay.toFixed(1)}ms (speed: ${options.speed}x)`);
      console.log(`   Effective FPS: ~${(1000 / avgDelay).toFixed(1)}`);
    }

    // Assemble GIF
    assembleGif(frames, effectiveDelay, options.output, perFrameDelays);

    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
