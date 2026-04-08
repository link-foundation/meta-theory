#!/usr/bin/env node

/**
 * Universal animation capture tool
 *
 * Captures any looped web animation as GIF, MP4, or WebM by taking screenshots
 * at regular intervals and detecting when the animation loops back to the first frame.
 * No knowledge of the page's implementation details is required.
 *
 * Key design decisions:
 * - Captures at the target output resolution directly (no post-capture scaling)
 *   to avoid quality loss from interpolation
 * - Uses real capture timestamps for GIF frame delays so playback matches the original
 * - Uses deviceScaleFactor=1 for pixel-perfect capture (no sub-pixel aliasing)
 * - Uses octree color quantization for GIF (exact colors, no blur)
 * - Supports MP4 (H.264) and WebM (VP9) via ffmpeg for social media compatibility
 *
 * Usage:
 *   node scripts/capture-animation.mjs <url>
 *   node scripts/capture-animation.mjs <url> --output out.gif
 *   node scripts/capture-animation.mjs <url> --output out.mp4 --format mp4
 *   node scripts/capture-animation.mjs <url> --max-size 512 --interval 50
 *
 * Options:
 *   --output PATH         Output file path (default: docs/animations/capture.gif)
 *   --format FORMAT       Output format: gif, mp4, webm (default: auto from extension)
 *   --max-size N           Max dimension for the larger side (default: 1024)
 *   --capture-viewport WxH Actual browser viewport for capture (default: auto-computed)
 *   --viewport WxH         Logical viewport for page layout (default: 1920x1080)
 *   --interval N           Capture interval in ms (default: 0, as fast as possible)
 *   --fps N                Output frames per second (default: derived from real timing)
 *   --speed N              Playback speed multiplier (default: 1.0, e.g. 0.5 = half speed)
 *   --delay N              Explicit GIF frame delay in ms (overrides --fps/--speed)
 *   --min-frames N         Minimum frames to capture per cycle (default: 60)
 *   --loop-timeout N       Max seconds to wait for loop (default: 60)
 *   --static-timeout N     Max seconds with no change before stopping (default: 60)
 *   --similarity N         Pixel similarity threshold 0-1 (default: 0.99)
 *   --no-crop              Disable auto-crop to content
 *   --crop-padding N       Padding around content after crop in px (default: auto)
 *   --extract-keyframes    Extract 3 key frames as PNG for quality verification
 *   --verbose              Enable verbose logging
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, statSync, unlinkSync, rmdirSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, extname, basename } from 'path';
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
    format: null,     // null = auto from extension
    maxSize: 1024,
    viewportWidth: 1920,   // logical viewport for page layout (16:9)
    viewportHeight: 1080,
    captureViewportWidth: null,  // null = auto from maxSize
    captureViewportHeight: null,
    interval: 0,      // 0 = capture as fast as possible
    fps: null,         // null = derived from real capture timing
    speed: 1.0,        // 1.0 = match original animation speed
    delay: null,       // null = auto-calculated
    minFrames: 60,     // minimum frames per cycle
    loopTimeout: 60,
    staticTimeout: 60,
    similarity: 0.99,
    crop: true,
    cropPadding: null, // null = auto
    extractKeyframes: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      switch (arg) {
        case '--output':
          options.output = args[++i];
          break;
        case '--format':
          options.format = args[++i].toLowerCase();
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
        case '--capture-viewport': {
          const cvp = args[++i].split('x');
          options.captureViewportWidth = parseInt(cvp[0], 10);
          options.captureViewportHeight = parseInt(cvp[1], 10);
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
        case '--min-frames':
          options.minFrames = parseInt(args[++i], 10);
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
        case '--extract-keyframes':
          options.extractKeyframes = true;
          break;
        case '--verbose':
          options.verbose = true;
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

  // Auto-detect format from file extension
  if (options.format === null) {
    const ext = extname(options.output).toLowerCase();
    if (ext === '.mp4') options.format = 'mp4';
    else if (ext === '.webm') options.format = 'webm';
    else options.format = 'gif';
  }

  return options;
}

/**
 * Check if ffmpeg is available (needed for MP4/WebM output)
 */
function checkFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compare two raw RGBA pixel buffers using sampling for speed.
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
    if (dr <= 2 && dg <= 2 && db <= 2) {
      matchingPixels++;
    }
  }

  return matchingPixels / sampledPixels;
}

/**
 * Find the bounding box of non-background content in a PNG buffer.
 */
function findContentBounds(pngData) {
  const { width, height, data } = pngData;

  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4
  ];

  const bgColors = corners.map(i => ({
    r: data[i], g: data[i + 1], b: data[i + 2]
  }));

  const bgColor = bgColors.reduce((best, c) => {
    const count = bgColors.filter(
      o => Math.abs(o.r - c.r) <= 5 && Math.abs(o.g - c.g) <= 5 && Math.abs(o.b - c.b) <= 5
    ).length;
    return count > best.count ? { ...c, count } : best;
  }, { ...bgColors[0], count: 0 });

  const threshold = 10;
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
    return { x: 0, y: 0, w: width, h: height };
  }

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Compute the union bounding box across all frames, then normalize padding
 * so padding is equal on all sides. Makes output square if content is ~square.
 */
function computeCropRegion(frames, explicitPadding) {
  const allBounds = frames.map(buf => {
    const png = PNG.sync.read(buf);
    return { bounds: findContentBounds(png), width: png.width, height: png.height };
  });

  const imgWidth = allBounds[0].width;
  const imgHeight = allBounds[0].height;

  let minX = imgWidth, minY = imgHeight, maxX = 0, maxY = 0;
  for (const { bounds } of allBounds) {
    if (bounds.x < minX) minX = bounds.x;
    if (bounds.y < minY) minY = bounds.y;
    if (bounds.x + bounds.w - 1 > maxX) maxX = bounds.x + bounds.w - 1;
    if (bounds.y + bounds.h - 1 > maxY) maxY = bounds.y + bounds.h - 1;
  }

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;

  let padding;
  if (explicitPadding !== null) {
    padding = explicitPadding;
  } else {
    const padLeft = minX;
    const padRight = imgWidth - maxX - 1;
    const padTop = minY;
    const padBottom = imgHeight - maxY - 1;
    padding = Math.min(padLeft, padRight, padTop, padBottom);
    padding = Math.max(padding, Math.round(Math.max(contentW, contentH) * 0.02));
  }

  let cropX = minX - padding;
  let cropY = minY - padding;
  let cropW = contentW + padding * 2;
  let cropH = contentH + padding * 2;

  // Make square if aspect ratio is close to 1:1 (within 20%)
  const aspectRatio = cropW / cropH;
  if (aspectRatio >= 0.8 && aspectRatio <= 1.25) {
    // Use the smaller side that fits within image boundaries
    const maxPossibleSide = Math.min(
      Math.max(cropW, cropH),
      imgWidth,
      imgHeight
    );
    const side = maxPossibleSide;
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

  // After clamping, re-enforce squareness if needed
  if (cropW !== cropH && aspectRatio >= 0.8 && aspectRatio <= 1.25) {
    const side = Math.min(cropW, cropH);
    cropW = side;
    cropH = side;
  }

  // Ensure even dimensions (required for video encoding)
  cropW = cropW % 2 === 0 ? cropW : cropW - 1;
  cropH = cropH % 2 === 0 ? cropH : cropH - 1;

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
 * Capture frames until animation loops or timeouts are reached.
 *
 * Loop detection: tracks similarity to first frame over time, detects periodic
 * peaks (two consecutive peaks = one full cycle).
 */
async function captureFrames(page, options) {
  const { interval, loopTimeout, staticTimeout, similarity, minFrames, verbose } = options;

  const frames = [];
  const timestamps = [];
  const simHistory = [];
  let firstPixels = null;
  let lastPixels = null;
  let totalPixels = 0;
  let lastChangeTime = Date.now();
  const startTime = Date.now();
  let frameIndex = 0;

  let peakIndices = [];
  let prevSim = 0;
  let rising = true;

  console.log(`\nCapturing frames (interval: ${interval}ms, min-frames: ${minFrames})...`);
  console.log(`   Loop timeout: ${loopTimeout}s | Static timeout: ${staticTimeout}s`);
  console.log(`   Similarity threshold: ${similarity}`);

  while (true) {
    const captureStart = Date.now();
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    timestamps.push(captureStart);
    frameIndex++;

    const decoded = PNG.sync.read(buffer);
    const currentPixels = decoded.data;

    if (firstPixels === null) {
      firstPixels = currentPixels;
      lastPixels = currentPixels;
      totalPixels = decoded.width * decoded.height;
      frames.push(buffer);
      simHistory.push(1.0);
      console.log(`   Frame 1 captured (reference frame, ${decoded.width}x${decoded.height})`);
      if (interval > 0) await new Promise(r => setTimeout(r, interval));
      continue;
    }

    const simToPrev = comparePixelData(currentPixels, lastPixels, totalPixels);
    const isStatic = simToPrev >= similarity;

    if (!isStatic) {
      lastChangeTime = Date.now();
    }

    frames.push(buffer);
    lastPixels = currentPixels;

    const simToFirst = comparePixelData(currentPixels, firstPixels, totalPixels);
    simHistory.push(simToFirst);

    // Peak detection for loop
    if (frames.length > 5) {
      if (rising && simToFirst < prevSim - 0.002) {
        peakIndices.push(frames.length - 2);
        rising = false;

        if (peakIndices.length === 1 && verbose) {
          console.log(`   First similarity peak at frame ${peakIndices[0]} (sim=${(simHistory[peakIndices[0]] * 100).toFixed(1)}%)`);
        }

        if (peakIndices.length >= 2) {
          const loopLength = peakIndices[peakIndices.length - 1] - peakIndices[peakIndices.length - 2];
          const peakSim1 = simHistory[peakIndices[peakIndices.length - 2]];
          const peakSim2 = simHistory[peakIndices[peakIndices.length - 1]];

          if (loopLength >= 10 && Math.abs(peakSim1 - peakSim2) < 0.02) {
            const cycleEnd = peakIndices[peakIndices.length - 1];

            // Enforce minimum frames
            if (cycleEnd < minFrames) {
              if (verbose) {
                console.log(`   Potential loop at frame ${cycleEnd} but need at least ${minFrames} frames, continuing...`);
              }
            } else {
              const cycleDuration = timestamps[cycleEnd - 1] - timestamps[0];
              console.log(`   Loop detected: cycle length = ${loopLength} frames (total: ${cycleEnd})`);
              console.log(`   Peak similarities: ${(peakSim1 * 100).toFixed(1)}%, ${(peakSim2 * 100).toFixed(1)}%`);
              console.log(`   Real cycle duration: ${cycleDuration}ms`);
              frames.length = cycleEnd;
              timestamps.length = cycleEnd;
              break;
            }
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

    const staticElapsed = (Date.now() - lastChangeTime) / 1000;
    if (staticElapsed >= staticTimeout) {
      console.log(`   Static timeout reached (${staticTimeout}s with no change)`);
      break;
    }

    const totalElapsed = (Date.now() - startTime) / 1000;
    if (totalElapsed >= loopTimeout) {
      console.log(`   Loop timeout reached (${loopTimeout}s total)`);
      break;
    }

    if (interval > 0) await new Promise(r => setTimeout(r, interval));
  }

  if (timestamps.length >= 2) {
    const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
    const avgInterval = totalTime / (timestamps.length - 1);
    console.log(`   Total frames captured: ${frames.length}`);
    console.log(`   Real average interval: ${avgInterval.toFixed(1)}ms`);
    console.log(`   Effective capture FPS: ~${(1000 / avgInterval).toFixed(1)}`);
  } else {
    console.log(`   Total frames captured: ${frames.length}`);
  }

  return { frames, timestamps };
}

/**
 * Extract key frames from the captured animation for quality verification.
 * Saves 3 evenly-spaced frames as PNG files alongside the output.
 */
function extractKeyframes(frames, outputPath) {
  const dir = dirname(outputPath);
  const base = basename(outputPath, extname(outputPath));
  const keyframeDir = join(dir, `${base}-keyframes`);

  if (!existsSync(keyframeDir)) {
    mkdirSync(keyframeDir, { recursive: true });
  }

  // Extract 3 key frames: first, middle, last
  const indices = [0, Math.floor(frames.length / 2), frames.length - 1];
  const labels = ['first', 'middle', 'last'];

  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    const path = join(keyframeDir, `keyframe-${labels[i]}-${idx}.png`);
    writeFileSync(path, frames[idx]);
    console.log(`   Key frame ${labels[i]} (frame ${idx}): ${path}`);
  }

  return keyframeDir;
}

/**
 * Assemble PNG frames into a GIF.
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
 * Assemble PNG frames into MP4 or WebM using ffmpeg.
 * Writes frames as temp PNGs, then encodes with ffmpeg.
 */
function assembleVideo(frames, format, outputPath, perFrameDelays, defaultFps) {
  const firstPng = PNG.sync.read(frames[0]);
  const width = firstPng.width;
  const height = firstPng.height;

  // Ensure even dimensions for video encoding
  const adjWidth = width % 2 === 0 ? width : width - 1;
  const adjHeight = height % 2 === 0 ? height : height - 1;

  // Calculate effective fps from delays
  let fps;
  if (perFrameDelays && perFrameDelays.length > 0) {
    const avgDelay = perFrameDelays.reduce((a, b) => a + b, 0) / perFrameDelays.length;
    fps = Math.round(1000 / avgDelay);
  } else {
    fps = defaultFps || 10;
  }
  fps = Math.max(1, Math.min(fps, 60)); // Clamp to reasonable range

  console.log(`\nAssembling ${format.toUpperCase()} (${frames.length} frames, ${fps}fps, ${adjWidth}x${adjHeight})...`);

  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Write frames to temp directory
  const tmpDir = join(outputDir, '.tmp-frames');
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  for (let i = 0; i < frames.length; i++) {
    const framePath = join(tmpDir, `frame-${String(i).padStart(6, '0')}.png`);
    writeFileSync(framePath, frames[i]);
  }

  // Build ffmpeg command
  let codec, extraArgs;
  if (format === 'mp4') {
    // H.264 with maximum compatibility (baseline profile for mobile/social media)
    codec = 'libx264';
    extraArgs = [
      '-profile:v', 'high',
      '-level', '4.0',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-crf', '18',           // High quality (lower = better, 18 is visually lossless)
      '-preset', 'slow',      // Better compression
    ];
  } else {
    // VP9 for WebM
    codec = 'libvpx-vp9';
    extraArgs = [
      '-pix_fmt', 'yuv420p',
      '-crf', '20',
      '-b:v', '0',            // Constant quality mode
    ];
  }

  const ffmpegCmd = [
    'ffmpeg', '-y',
    '-framerate', String(fps),
    '-i', join(tmpDir, 'frame-%06d.png'),
    '-c:v', codec,
    ...extraArgs,
    '-vf', `scale=${adjWidth}:${adjHeight}:flags=lanczos`,
    '-an',                     // No audio
    '-loop', '0',              // Loop (for WebM; ignored for MP4)
    outputPath
  ].join(' ');

  try {
    execSync(ffmpegCmd, { stdio: 'pipe' });
    const stats = statSync(outputPath);
    console.log(`   ${format.toUpperCase()} saved: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`   ffmpeg error: ${err.stderr?.toString() || err.message}`);
    throw new Error(`Failed to encode ${format.toUpperCase()}`);
  } finally {
    // Clean up temp frames
    for (let i = 0; i < frames.length; i++) {
      const framePath = join(tmpDir, `frame-${String(i).padStart(6, '0')}.png`);
      try { unlinkSync(framePath); } catch {}
    }
    try { rmdirSync(tmpDir); } catch {}
  }

  return outputPath;
}

/**
 * Compute the optimal capture viewport dimensions.
 *
 * Strategy: Capture at a resolution where the content area is at or slightly
 * above the target maxSize, avoiding quality-losing post-capture downscaling.
 *
 * We scale the logical viewport proportionally so the smaller dimension
 * is at least maxSize * 1.2 (small margin for padding after crop).
 * This is a balance: too large = slow screenshots, too small = needs upscale.
 */
function computeCaptureViewport(logicalW, logicalH, maxSize) {
  // Scale so smaller dimension is ~maxSize * 1.2 (slight margin for crop/padding)
  const minDim = Math.min(logicalW, logicalH);
  const targetMinDim = Math.max(maxSize * 1.2, minDim);
  const scale = targetMinDim / minDim;

  const captureW = Math.round(logicalW * scale);
  const captureH = Math.round(logicalH * scale);

  // Ensure even dimensions
  return {
    width: captureW % 2 === 0 ? captureW : captureW + 1,
    height: captureH % 2 === 0 ? captureH : captureH + 1,
  };
}

/**
 * Resize a PNG buffer so the larger side equals targetSize.
 * Uses Lanczos-like (area averaging) for downscaling to preserve detail.
 */
function resizePng(buffer, targetSize) {
  const src = PNG.sync.read(buffer);

  if (src.width <= targetSize && src.height <= targetSize) {
    return buffer;
  }

  const scale = targetSize / Math.max(src.width, src.height);
  let newW = Math.round(src.width * scale);
  let newH = Math.round(src.height * scale);

  // Ensure even dimensions
  newW = newW % 2 === 0 ? newW : newW + 1;
  newH = newH % 2 === 0 ? newH : newH + 1;

  const dst = new PNG({ width: newW, height: newH });

  // Area-averaging downscale (better quality than nearest-neighbor for downscaling)
  // For each output pixel, average all source pixels that contribute to it
  for (let y = 0; y < newH; y++) {
    const srcY0 = (y / newH) * src.height;
    const srcY1 = ((y + 1) / newH) * src.height;
    const y0 = Math.floor(srcY0);
    const y1 = Math.min(Math.ceil(srcY1), src.height);

    for (let x = 0; x < newW; x++) {
      const srcX0 = (x / newW) * src.width;
      const srcX1 = ((x + 1) / newW) * src.width;
      const x0 = Math.floor(srcX0);
      const x1 = Math.min(Math.ceil(srcX1), src.width);

      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, wSum = 0;

      for (let sy = y0; sy < y1; sy++) {
        // Vertical weight: fraction of this source row within the output pixel
        const wy = Math.min(sy + 1, srcY1) - Math.max(sy, srcY0);
        for (let sx = x0; sx < x1; sx++) {
          // Horizontal weight
          const wx = Math.min(sx + 1, srcX1) - Math.max(sx, srcX0);
          const w = wx * wy;
          const idx = (sy * src.width + sx) * 4;
          rSum += src.data[idx] * w;
          gSum += src.data[idx + 1] * w;
          bSum += src.data[idx + 2] * w;
          aSum += src.data[idx + 3] * w;
          wSum += w;
        }
      }

      const dstIdx = (y * newW + x) * 4;
      dst.data[dstIdx] = Math.round(rSum / wSum);
      dst.data[dstIdx + 1] = Math.round(gSum / wSum);
      dst.data[dstIdx + 2] = Math.round(bSum / wSum);
      dst.data[dstIdx + 3] = Math.round(aSum / wSum);
    }
  }

  return PNG.sync.write(dst);
}

/**
 * Main entry point
 */
async function main() {
  const options = parseArgs();

  // Check ffmpeg for video formats
  if ((options.format === 'mp4' || options.format === 'webm') && !checkFfmpeg()) {
    console.error(`Error: ffmpeg is required for ${options.format.toUpperCase()} output but was not found.`);
    console.error('Install it with: apt-get install ffmpeg (Linux) or brew install ffmpeg (macOS)');
    process.exit(1);
  }

  // Compute capture viewport: capture at a resolution where the output
  // after cropping is close to maxSize (avoiding quality-losing post-capture scaling)
  let captureW, captureH;
  if (options.captureViewportWidth && options.captureViewportHeight) {
    captureW = options.captureViewportWidth;
    captureH = options.captureViewportHeight;
  } else {
    const cv = computeCaptureViewport(options.viewportWidth, options.viewportHeight, options.maxSize);
    captureW = cv.width;
    captureH = cv.height;
  }

  console.log(`\nAnimation Capture Settings:`);
  console.log(`   URL: ${options.url}`);
  console.log(`   Logical viewport: ${options.viewportWidth}x${options.viewportHeight}`);
  console.log(`   Capture viewport: ${captureW}x${captureH}`);
  console.log(`   Max output size: ${options.maxSize}px`);
  console.log(`   Capture interval: ${options.interval}ms (0 = max rate)`);
  console.log(`   Min frames: ${options.minFrames}`);
  console.log(`   Speed: ${options.speed}x`);
  console.log(`   Format: ${options.format.toUpperCase()}`);
  console.log(`   Output: ${options.output}`);
  console.log(`   Auto-crop: ${options.crop}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: captureW, height: captureH },
    deviceScaleFactor: 1,  // 1:1 pixel mapping, no sub-pixel aliasing
  });
  const page = await context.newPage();

  try {
    console.log('\nLoading page...');
    await page.goto(options.url, { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 2000));

    const { frames: rawFrames, timestamps } = await captureFrames(page, options);

    if (rawFrames.length < 2) {
      console.error('Error: Not enough frames captured.');
      process.exit(1);
    }

    let frames = rawFrames;

    // Auto-crop to content
    if (options.crop) {
      console.log('\nAuto-cropping to content...');
      const cropRegion = computeCropRegion(frames, options.cropPadding);
      frames = frames.map(f => cropPng(f, cropRegion));
    }

    // Resize to max-size if the cropped frames are still larger
    const testPng = PNG.sync.read(frames[0]);
    if (testPng.width > options.maxSize || testPng.height > options.maxSize) {
      console.log(`\nResizing from ${testPng.width}x${testPng.height} to max ${options.maxSize}px (area-average)...`);
      frames = frames.map(f => resizePng(f, options.maxSize));
    }

    const finalPng = PNG.sync.read(frames[0]);
    console.log(`   Final frame size: ${finalPng.width}x${finalPng.height}`);

    // Extract key frames for quality verification
    if (options.extractKeyframes) {
      console.log('\nExtracting key frames...');
      extractKeyframes(frames, options.output);
    }

    // Compute per-frame delays from real timestamps
    let perFrameDelays = null;
    let effectiveDelay = 100;
    let effectiveFps = 10;

    if (options.delay !== null) {
      effectiveDelay = Math.max(20, options.delay);
      effectiveFps = Math.round(1000 / effectiveDelay);
    } else if (options.fps !== null) {
      effectiveDelay = Math.round(1000 / options.fps / options.speed);
      effectiveDelay = Math.max(20, effectiveDelay);
      effectiveFps = Math.round(1000 / effectiveDelay);
    } else if (timestamps.length >= 2) {
      // Use real capture timestamps for accurate playback timing
      perFrameDelays = [];
      for (let i = 0; i < frames.length; i++) {
        let realDelay;
        if (i < timestamps.length - 1) {
          realDelay = timestamps[i + 1] - timestamps[i];
        } else {
          const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
          realDelay = totalTime / (timestamps.length - 1);
        }
        // Apply speed multiplier
        realDelay = Math.round(realDelay / options.speed);
        realDelay = Math.max(20, realDelay);
        perFrameDelays.push(realDelay);
      }
      const avgDelay = perFrameDelays.reduce((a, b) => a + b, 0) / perFrameDelays.length;
      effectiveFps = Math.round(1000 / avgDelay);
      console.log(`\nTiming: using real capture timestamps`);
      console.log(`   Average real delay: ${avgDelay.toFixed(1)}ms (speed: ${options.speed}x)`);
      console.log(`   Effective FPS: ~${(1000 / avgDelay).toFixed(1)}`);
    }

    // Assemble output
    if (options.format === 'gif') {
      assembleGif(frames, effectiveDelay, options.output, perFrameDelays);
    } else {
      assembleVideo(frames, options.format, options.output, perFrameDelays, effectiveFps);
    }

    // Also generate additional formats if requested format is gif and ffmpeg available
    // Generate companion video formats for social media compatibility
    if (options.format === 'gif' && checkFfmpeg()) {
      const mp4Path = options.output.replace(/\.gif$/i, '.mp4');
      const webmPath = options.output.replace(/\.gif$/i, '.webm');

      console.log('\nGenerating companion video formats...');
      try {
        assembleVideo(frames, 'mp4', mp4Path, perFrameDelays, effectiveFps);
      } catch (e) {
        console.warn(`   Warning: MP4 generation failed: ${e.message}`);
      }
      try {
        assembleVideo(frames, 'webm', webmPath, perFrameDelays, effectiveFps);
      } catch (e) {
        console.warn(`   Warning: WebM generation failed: ${e.message}`);
      }
    }

    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error.message);
    if (options.verbose) console.error(error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
