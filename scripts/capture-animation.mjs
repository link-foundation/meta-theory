#!/usr/bin/env node

/**
 * Universal animation capture tool
 *
 * Captures any looped web animation as GIF, MP4, or WebM by taking screenshots
 * at regular intervals and detecting when the animation loops back to the first frame.
 * No knowledge of the page's implementation details is required.
 *
 * Uses @link-assistant/web-capture for:
 * - Frame capture with loop detection (screenshot mode via captureAnimationFrames)
 * - Popup dismissal and content loading
 *
 * Advanced capture modes (screencast/beginframe) use Playwright CDP directly
 * as these require Chromium-specific APIs not available in web-capture.
 *
 * Encoding (GIF/MP4/WebM) uses gif-encoder-2 and ffmpeg respectively,
 * as web-capture provides raw frames but not encoding.
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
 *   --min-frames N         Minimum frames to capture per cycle (default: 120)
 *   --loop-timeout N       Max seconds to wait for loop (default: 60)
 *   --static-timeout N     Max seconds with no change before stopping (default: 60)
 *   --similarity N         Pixel similarity threshold 0-1 (default: 0.99)
 *   --no-crop              Disable auto-crop to content
 *   --crop-padding N       Padding around content after crop in px (default: auto)
 *   --extract-keyframes    Extract 3 key frames as PNG for quality verification
 *   --capture-mode MODE    Capture method: screencast (CDP push, 30-60 FPS),
 *                         beginframe (deterministic frame-perfect), or
 *                         screenshot (polling via web-capture, 3-8 FPS). Default: screencast
 *   --source-width N       Source capture viewport width (default: auto from max-size)
 *   --source-height N      Source capture viewport height (default: auto from max-size)
 *   --target-width N       Target output width (default: from max-size)
 *   --target-height N      Target output height (default: from max-size)
 *   --target-fps N         Target output FPS (default: derived from capture timing)
 *   --jpeg-quality N       JPEG quality for screencast capture 0-100 (default: 100)
 *   --screencast-format F  Format for screencast frames: jpeg or png (default: png)
 *   --preheat              Capture twice, use second (warmer) run for better quality
 *   --verbose              Enable verbose logging
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync, rmdirSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, extname, basename } from 'path';
import GIFEncoder from 'gif-encoder-2';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

// Import web-capture for screenshot-mode frame capture
import { captureAnimationFrames, compareFrames } from '@link-assistant/web-capture/src/animation.js';

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
    minFrames: 120,    // minimum frames per cycle (more frames = smoother animation)
    loopTimeout: 60,
    staticTimeout: 60,
    similarity: 0.99,
    crop: true,
    cropPadding: null, // null = auto
    captureMode: 'screencast',  // 'screencast' (CDP push), 'beginframe' (deterministic), or 'screenshot' (web-capture)
    sourceWidth: null,
    sourceHeight: null,
    targetWidth: null,
    targetHeight: null,
    targetFps: null,
    jpegQuality: 100,
    screencastFormat: 'png',
    preheat: false,
    extractKeyframes: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      switch (arg) {
        case '--output': options.output = args[++i]; break;
        case '--format': options.format = args[++i].toLowerCase(); break;
        case '--max-size': options.maxSize = parseInt(args[++i], 10); break;
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
        case '--interval': options.interval = parseInt(args[++i], 10); break;
        case '--fps': options.fps = parseFloat(args[++i]); break;
        case '--speed': options.speed = parseFloat(args[++i]); break;
        case '--delay': options.delay = parseInt(args[++i], 10); break;
        case '--min-frames': options.minFrames = parseInt(args[++i], 10); break;
        case '--loop-timeout': options.loopTimeout = parseInt(args[++i], 10); break;
        case '--static-timeout': options.staticTimeout = parseInt(args[++i], 10); break;
        case '--similarity': options.similarity = parseFloat(args[++i]); break;
        case '--no-crop': options.crop = false; break;
        case '--crop-padding': options.cropPadding = parseInt(args[++i], 10); break;
        case '--capture-mode':
          options.captureMode = args[++i].toLowerCase();
          if (!['screencast', 'screenshot', 'beginframe'].includes(options.captureMode)) {
            console.error('Error: --capture-mode must be "screencast", "beginframe", or "screenshot"');
            process.exit(1);
          }
          break;
        case '--source-width': options.sourceWidth = parseInt(args[++i], 10); break;
        case '--source-height': options.sourceHeight = parseInt(args[++i], 10); break;
        case '--target-width': options.targetWidth = parseInt(args[++i], 10); break;
        case '--target-height': options.targetHeight = parseInt(args[++i], 10); break;
        case '--target-fps': options.targetFps = parseFloat(args[++i]); break;
        case '--jpeg-quality': options.jpegQuality = parseInt(args[++i], 10); break;
        case '--screencast-format':
          options.screencastFormat = args[++i].toLowerCase();
          if (!['jpeg', 'png'].includes(options.screencastFormat)) {
            console.error('Error: --screencast-format must be "jpeg" or "png"');
            process.exit(1);
          }
          break;
        case '--preheat': options.preheat = true; break;
        case '--extract-keyframes': options.extractKeyframes = true; break;
        case '--verbose': options.verbose = true; break;
        default:
          console.warn(`Warning: Unknown option ${arg}`);
      }
    } else if (!options.url) {
      options.url = arg;
    }
  }

  if (!options.url) {
    console.error('Error: URL is required.');
    console.error('Usage: node scripts/capture-animation.mjs <url> [options]');
    process.exit(1);
  }

  // Auto-detect format from output extension
  if (!options.format) {
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

  const edgePixels = [];
  const sampleStep = Math.max(1, Math.floor(Math.max(width, height) / 100));

  for (let x = 0; x < width; x += sampleStep) {
    const topIdx = x * 4;
    edgePixels.push({ r: data[topIdx], g: data[topIdx + 1], b: data[topIdx + 2] });
    const botIdx = ((height - 1) * width + x) * 4;
    edgePixels.push({ r: data[botIdx], g: data[botIdx + 1], b: data[botIdx + 2] });
  }
  for (let y = 0; y < height; y += sampleStep) {
    const leftIdx = (y * width) * 4;
    edgePixels.push({ r: data[leftIdx], g: data[leftIdx + 1], b: data[leftIdx + 2] });
    const rightIdx = (y * width + (width - 1)) * 4;
    edgePixels.push({ r: data[rightIdx], g: data[rightIdx + 1], b: data[rightIdx + 2] });
  }

  const bgColor = edgePixels.reduce((best, c) => {
    const count = edgePixels.filter(
      o => Math.abs(o.r - c.r) <= 5 && Math.abs(o.g - c.g) <= 5 && Math.abs(o.b - c.b) <= 5
    ).length;
    return count > best.count ? { ...c, count } : best;
  }, { ...edgePixels[0], count: 0 });

  const threshold = 8;
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
 * Compute the union bounding box across all frames with centered padding.
 */
function computeCropRegion(frames, explicitPadding, maxSize) {
  const sampleIndices = [0];
  const step = Math.max(1, Math.floor(frames.length / 20));
  for (let i = step; i < frames.length - 1; i += step) {
    sampleIndices.push(i);
  }
  sampleIndices.push(frames.length - 1);
  const uniqueIndices = [...new Set(sampleIndices)];

  const firstPng = PNG.sync.read(frames[0]);
  const imgWidth = firstPng.width;
  const imgHeight = firstPng.height;

  // Detect background color from edges
  const edgePixels = [];
  const sampleStep = Math.max(1, Math.floor(Math.max(imgWidth, imgHeight) / 100));
  for (let x = 0; x < imgWidth; x += sampleStep) {
    const topIdx = x * 4;
    edgePixels.push({ r: firstPng.data[topIdx], g: firstPng.data[topIdx + 1], b: firstPng.data[topIdx + 2] });
    const botIdx = ((imgHeight - 1) * imgWidth + x) * 4;
    edgePixels.push({ r: firstPng.data[botIdx], g: firstPng.data[botIdx + 1], b: firstPng.data[botIdx + 2] });
  }
  for (let y = 0; y < imgHeight; y += sampleStep) {
    const leftIdx = (y * imgWidth) * 4;
    edgePixels.push({ r: firstPng.data[leftIdx], g: firstPng.data[leftIdx + 1], b: firstPng.data[leftIdx + 2] });
    const rightIdx = (y * imgWidth + (imgWidth - 1)) * 4;
    edgePixels.push({ r: firstPng.data[rightIdx], g: firstPng.data[rightIdx + 1], b: firstPng.data[rightIdx + 2] });
  }
  const bgColor = edgePixels.reduce((best, c) => {
    const count = edgePixels.filter(
      o => Math.abs(o.r - c.r) <= 5 && Math.abs(o.g - c.g) <= 5 && Math.abs(o.b - c.b) <= 5
    ).length;
    return count > best.count ? { ...c, count } : best;
  }, { ...edgePixels[0], count: 0 });

  const allBounds = uniqueIndices.map(idx => {
    const png = idx === 0 ? firstPng : PNG.sync.read(frames[idx]);
    return findContentBounds(png);
  });

  let minX = imgWidth, minY = imgHeight, maxX = 0, maxY = 0;
  for (const bounds of allBounds) {
    if (bounds.x < minX) minX = bounds.x;
    if (bounds.y < minY) minY = bounds.y;
    if (bounds.x + bounds.w - 1 > maxX) maxX = bounds.x + bounds.w - 1;
    if (bounds.y + bounds.h - 1 > maxY) maxY = bounds.y + bounds.h - 1;
  }

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;

  const MIN_PADDING_OUTPUT = 4;
  const downscaleRatio = Math.max(contentW, contentH) / maxSize;
  const minPaddingCapture = Math.ceil(MIN_PADDING_OUTPUT * downscaleRatio);

  let padding;
  if (explicitPadding !== null) {
    padding = Math.max(minPaddingCapture, Math.ceil(explicitPadding * downscaleRatio));
  } else {
    padding = Math.max(minPaddingCapture, Math.round(Math.max(contentW, contentH) * 0.02));
  }

  const contentCenterX = minX + contentW / 2;
  const contentCenterY = minY + contentH / 2;

  let cropW = contentW + padding * 2;
  let cropH = contentH + padding * 2;

  const aspectRatio = cropW / cropH;
  if (aspectRatio >= 0.8 && aspectRatio <= 1.25) {
    const side = Math.max(cropW, cropH);
    cropW = side;
    cropH = side;
  }

  let cropX = Math.round(contentCenterX - cropW / 2);
  let cropY = Math.round(contentCenterY - cropH / 2);

  cropW = cropW % 2 === 0 ? cropW : cropW + 1;
  cropH = cropH % 2 === 0 ? cropH : cropH + 1;

  const padLeft = minX - cropX;
  const padRight = (cropX + cropW - 1) - maxX;
  const padTop = minY - cropY;
  const padBottom = (cropY + cropH - 1) - maxY;

  console.log(`   Content bounds: ${contentW}x${contentH} at (${minX},${minY})`);
  console.log(`   Background color: rgb(${bgColor.r},${bgColor.g},${bgColor.b})`);
  console.log(`   Padding: ${padding}px at capture res (~${Math.round(padding / downscaleRatio)}px in output)`);
  console.log(`   Actual padding: L=${padLeft} R=${padRight} T=${padTop} B=${padBottom}`);
  console.log(`   Crop region: ${cropW}x${cropH} at (${cropX},${cropY})`);

  return { x: cropX, y: cropY, w: cropW, h: cropH, bgColor };
}

/**
 * Crop a PNG buffer to the given region.
 */
function cropPng(buffer, region, bgColor) {
  const src = PNG.sync.read(buffer);
  const bg = bgColor || { r: 255, g: 255, b: 255 };
  const dst = new PNG({ width: region.w, height: region.h });

  for (let y = 0; y < region.h; y++) {
    for (let x = 0; x < region.w; x++) {
      const srcX = region.x + x;
      const srcY = region.y + y;
      const dstIdx = (y * region.w + x) * 4;

      if (srcX >= 0 && srcX < src.width && srcY >= 0 && srcY < src.height) {
        const srcIdx = (srcY * src.width + srcX) * 4;
        dst.data[dstIdx] = src.data[srcIdx];
        dst.data[dstIdx + 1] = src.data[srcIdx + 1];
        dst.data[dstIdx + 2] = src.data[srcIdx + 2];
        dst.data[dstIdx + 3] = src.data[srcIdx + 3];
      } else {
        dst.data[dstIdx] = bg.r;
        dst.data[dstIdx + 1] = bg.g;
        dst.data[dstIdx + 2] = bg.b;
        dst.data[dstIdx + 3] = 255;
      }
    }
  }

  return PNG.sync.write(dst);
}

/**
 * Capture frames using web-capture's captureAnimationFrames (screenshot mode).
 * This delegates frame capture and loop detection to web-capture.
 */
async function captureFramesWebCapture(options) {
  console.log(`\nCapturing frames via web-capture (screenshot mode, min-frames: ${options.minFrames})...`);
  console.log(`   Loop timeout: ${options.loopTimeout}s | Static timeout: ${options.staticTimeout}s`);
  console.log(`   Similarity threshold: ${options.similarity}`);

  const result = await captureAnimationFrames(options.url, {
    engine: 'playwright',
    captureMode: 'screenshot',
    maxSize: options.maxSize,
    viewportWidth: options.viewportWidth,
    viewportHeight: options.viewportHeight,
    interval: options.interval,
    minFrames: options.minFrames,
    loopTimeout: options.loopTimeout,
    staticTimeout: options.staticTimeout,
    similarity: options.similarity,
    crop: false, // We handle cropping ourselves for better quality
    dismissPopups: true,
    extractKeyframes: false, // We handle keyframe extraction ourselves
    onFrame: (index, _buffer) => {
      if (index > 0 && index % 20 === 0) {
        console.log(`   Frame ${index + 1} captured...`);
      }
    },
    onLoop: (frameIndex) => {
      console.log(`   Loop detected at frame ${frameIndex}`);
    }
  });

  console.log(`   Total frames: ${result.frames.length}`);
  console.log(`   Loop detected: ${result.loopDetected}`);
  if (result.duration) {
    console.log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`);
  }

  return {
    frames: result.frames,
    timestamps: result.timestamps
  };
}

/**
 * Capture frames using CDP Page.startScreencast for high FPS (30-60 FPS).
 * This requires direct Playwright CDP access (not available in web-capture).
 */
async function captureFramesScreencast(page, options) {
  const { loopTimeout, staticTimeout, similarity, minFrames, verbose, jpegQuality, screencastFormat } = options;

  const frameBuffers = [];
  const timestamps = [];
  const simHistory = [];
  let firstPixels = null;
  let lastPixels = null;
  let totalPixels = 0;
  let lastChangeTime = Date.now();
  const startTime = Date.now();

  let peakIndices = [];
  let prevSim = 0;
  let rising = true;
  let loopDetected = false;
  let cycleStartIndex = 0;
  let cycleEndIndex = -1;

  const targetMaxSize = options.targetWidth ? Math.max(options.targetWidth, options.targetHeight) : options.maxSize;
  const streamSize = Math.round(targetMaxSize * 1.1);
  const captureW = streamSize % 2 === 0 ? streamSize : streamSize + 1;
  const captureH = captureW;

  const useJpeg = screencastFormat === 'jpeg';
  const formatLabel = useJpeg ? `JPEG quality: ${jpegQuality}` : 'PNG (lossless)';

  console.log(`\nCapturing frames via CDP screencast (${formatLabel}, min-frames: ${minFrames})...`);
  console.log(`   Screencast stream: ${captureW}x${captureH}`);
  console.log(`   Loop timeout: ${loopTimeout}s | Static timeout: ${staticTimeout}s`);
  console.log(`   Similarity threshold: ${similarity}`);

  const cdp = await page.context().newCDPSession(page);

  const frameQueue = [];
  let processingDone = false;

  cdp.on('Page.screencastFrame', async (event) => {
    if (processingDone) return;
    const captureTime = Date.now();
    const buffer = Buffer.from(event.data, 'base64');
    try { await cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }); } catch {}
    frameQueue.push({ buffer, captureTime });
  });

  await cdp.send('Page.startScreencast', {
    format: useJpeg ? 'jpeg' : 'png',
    quality: useJpeg ? jpegQuality : 100,
    maxWidth: captureW,
    maxHeight: captureH,
    everyNthFrame: 1,
  });

  function decodeFrame(buffer) {
    if (useJpeg) {
      const jpegData = jpeg.decode(buffer, { useTArray: true });
      return { pixels: Buffer.from(jpegData.data), width: jpegData.width, height: jpegData.height };
    } else {
      const pngData = PNG.sync.read(buffer);
      return { pixels: pngData.data, width: pngData.width, height: pngData.height };
    }
  }

  const processInterval = setInterval(() => {
    while (frameQueue.length > 0 && !loopDetected) {
      const { buffer: frameBuffer, captureTime } = frameQueue.shift();

      let currentPixels;
      try {
        const decoded = decodeFrame(frameBuffer);
        currentPixels = decoded.pixels;
        if (firstPixels === null) {
          firstPixels = currentPixels;
          lastPixels = currentPixels;
          totalPixels = decoded.width * decoded.height;
        }
      } catch { continue; }

      frameBuffers.push(frameBuffer);
      timestamps.push(captureTime);
      const frameIndex = frameBuffers.length - 1;

      if (frameIndex === 0) {
        simHistory.push(1.0);
        console.log(`   Frame 1 captured (reference frame, ${captureW}x${captureH})`);
        continue;
      }

      const simToPrev = comparePixelData(currentPixels, lastPixels, totalPixels);
      if (simToPrev < similarity) lastChangeTime = Date.now();
      lastPixels = currentPixels;

      const simToFirst = comparePixelData(currentPixels, firstPixels, totalPixels);
      simHistory.push(simToFirst);

      const MIN_LOOP_PEAK_SIM = useJpeg ? 0.95 : 0.97;

      if (frameBuffers.length > 5) {
        if (rising && simToFirst < prevSim - 0.002) {
          const peakFrame = frameBuffers.length - 2;
          const peakSim = simHistory[peakFrame];
          rising = false;

          if (peakSim >= MIN_LOOP_PEAK_SIM) {
            peakIndices.push(peakFrame);
            if (peakIndices.length >= 2) {
              const loopLength = peakIndices[peakIndices.length - 1] - peakIndices[peakIndices.length - 2];
              const peakSim1 = simHistory[peakIndices[peakIndices.length - 2]];
              const peakSim2 = simHistory[peakIndices[peakIndices.length - 1]];
              const cycleStart = peakIndices[peakIndices.length - 2];
              const cycleEnd = peakIndices[peakIndices.length - 1];
              const cycleDuration = timestamps[cycleEnd - 1] - timestamps[cycleStart];

              if ((loopLength >= minFrames || cycleDuration >= 2000) && Math.abs(peakSim1 - peakSim2) < 0.03) {
                console.log(`   Loop detected: cycle length = ${loopLength} frames`);
                console.log(`   Real cycle duration: ${cycleDuration}ms`);
                loopDetected = true;
                cycleStartIndex = cycleStart;
                cycleEndIndex = cycleEnd;
                break;
              }
            }
          }
        } else if (simToFirst > prevSim + 0.002) {
          rising = true;
        }
      }
      prevSim = simToFirst;

      if (frameIndex % 50 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const fps = (frameBuffers.length / ((Date.now() - startTime) / 1000)).toFixed(1);
        console.log(`   Frame ${frameBuffers.length} captured (${elapsed}s, ~${fps} FPS, sim=${(simToFirst * 100).toFixed(1)}%)`);
      }

      if ((Date.now() - lastChangeTime) / 1000 >= staticTimeout) {
        console.log(`   Static timeout reached`);
        loopDetected = true;
        cycleEndIndex = frameBuffers.length;
        break;
      }
      if ((Date.now() - startTime) / 1000 >= loopTimeout) {
        console.log(`   Loop timeout reached`);
        loopDetected = true;
        cycleEndIndex = frameBuffers.length;
        break;
      }
    }
  }, 5);

  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (loopDetected) { clearInterval(checkInterval); resolve(); }
    }, 50);
  });

  processingDone = true;
  clearInterval(processInterval);
  try { await cdp.send('Page.stopScreencast'); } catch {}
  try { await cdp.detach(); } catch {}

  if (cycleEndIndex > 0) {
    const trimmedBuffers = frameBuffers.slice(cycleStartIndex, cycleEndIndex);
    const trimmedTimestamps = timestamps.slice(cycleStartIndex, cycleEndIndex);
    frameBuffers.length = 0;
    frameBuffers.push(...trimmedBuffers);
    timestamps.length = 0;
    timestamps.push(...trimmedTimestamps);
    console.log(`   Trimmed to ${frameBuffers.length} frames`);
  }

  // Convert JPEG frames to PNG if needed
  let pngFrames;
  if (useJpeg) {
    console.log(`\nConverting ${frameBuffers.length} JPEG frames to PNG...`);
    pngFrames = [];
    for (let i = 0; i < frameBuffers.length; i++) {
      try {
        const jpegData = jpeg.decode(frameBuffers[i], { useTArray: true });
        const png = new PNG({ width: jpegData.width, height: jpegData.height });
        png.data = Buffer.from(jpegData.data);
        pngFrames.push(PNG.sync.write(png));
      } catch (e) {
        if (verbose) console.log(`   Warning: failed to convert frame ${i}: ${e.message}`);
      }
    }
    console.log(`   Converted ${pngFrames.length}/${frameBuffers.length} frames to PNG`);
  } else {
    pngFrames = frameBuffers;
  }

  if (timestamps.length >= 2) {
    const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
    const avgInterval = totalTime / (timestamps.length - 1);
    console.log(`   Effective capture FPS: ~${(1000 / avgInterval).toFixed(1)}`);
  }

  return { frames: pngFrames, timestamps };
}

/**
 * Capture frames using HeadlessExperimental.beginFrame for deterministic capture.
 * This requires direct Playwright CDP access (not available in web-capture).
 */
async function captureFramesBeginFrame(page, options) {
  const { loopTimeout, minFrames, verbose, similarity } = options;

  const targetFps = options.targetFps || 30;
  const frameIntervalMs = 1000 / targetFps;
  const maxDuration = loopTimeout * 1000;
  const maxFrames = Math.ceil(maxDuration / frameIntervalMs);

  const viewportSize = page.viewportSize();

  console.log(`\nCapturing frames via HeadlessExperimental.beginFrame (deterministic, ${targetFps} FPS)...`);
  console.log(`   Frame interval: ${frameIntervalMs.toFixed(2)}ms`);
  console.log(`   Capture resolution: ${viewportSize.width}x${viewportSize.height}`);

  const cdp = await page.context().newCDPSession(page);

  // Warmup
  const warmupFrames = Math.ceil(targetFps * 2);
  const baseTime = Date.now() * 1000;
  for (let i = 0; i < warmupFrames; i++) {
    await cdp.send('HeadlessExperimental.beginFrame', {
      frameTimeTicks: baseTime + i * frameIntervalMs * 1000,
      interval: frameIntervalMs,
      noDisplayUpdates: false,
    });
  }

  const frames = [];
  const timestamps = [];
  const simHistory = [];
  let firstPixels = null;
  let totalPixels = 0;
  let peakIndices = [];
  let prevSim = 0;
  let rising = true;
  let loopDetected = false;
  let cycleStartIndex = 0;
  let cycleEndIndex = -1;

  const captureStartTime = Date.now();
  const captureBaseTime = baseTime + warmupFrames * frameIntervalMs * 1000;

  for (let i = 0; i < maxFrames && !loopDetected; i++) {
    const frameTick = captureBaseTime + i * frameIntervalMs * 1000;

    let result;
    try {
      result = await cdp.send('HeadlessExperimental.beginFrame', {
        frameTimeTicks: frameTick,
        interval: frameIntervalMs,
        noDisplayUpdates: false,
        screenshot: { format: 'png' },
      });
    } catch (e) {
      if (verbose) console.log(`   Frame ${i} error: ${e.message}`);
      continue;
    }

    if (!result.screenshotData) continue;

    const pngBuffer = Buffer.from(result.screenshotData, 'base64');
    frames.push(pngBuffer);
    timestamps.push(captureStartTime + i * frameIntervalMs);

    let currentPixels;
    try {
      const pngData = PNG.sync.read(pngBuffer);
      currentPixels = pngData.data;
      if (firstPixels === null) {
        firstPixels = currentPixels;
        totalPixels = pngData.width * pngData.height;
        simHistory.push(1.0);
        console.log(`   Frame 1 captured (${pngData.width}x${pngData.height})`);
        continue;
      }
    } catch { continue; }

    const simToFirst = comparePixelData(currentPixels, firstPixels, totalPixels);
    simHistory.push(simToFirst);

    const frameIndex = frames.length - 1;
    const MIN_LOOP_PEAK_SIM = 0.97;

    if (frameIndex > 5) {
      if (rising && simToFirst < prevSim - 0.002) {
        const peakFrame = frameIndex - 1;
        const peakSim = simHistory[peakFrame];
        rising = false;

        if (peakSim >= MIN_LOOP_PEAK_SIM) {
          peakIndices.push(peakFrame);
          if (peakIndices.length >= 2) {
            const loopLength = peakIndices[peakIndices.length - 1] - peakIndices[peakIndices.length - 2];
            const peakSim1 = simHistory[peakIndices[peakIndices.length - 2]];
            const peakSim2 = simHistory[peakIndices[peakIndices.length - 1]];
            const cycleDuration = loopLength * frameIntervalMs;

            if ((loopLength >= minFrames || cycleDuration >= 2000) && Math.abs(peakSim1 - peakSim2) < 0.03) {
              console.log(`   Loop detected: ${loopLength} frames (${cycleDuration.toFixed(0)}ms)`);
              loopDetected = true;
              cycleStartIndex = peakIndices[peakIndices.length - 2];
              cycleEndIndex = peakIndices[peakIndices.length - 1];
            }
          }
        }
      } else if (simToFirst > prevSim + 0.002) {
        rising = true;
      }
    }
    prevSim = simToFirst;

    if (frameIndex > 0 && frameIndex % 60 === 0) {
      console.log(`   Frame ${frameIndex + 1} (${(frameIndex / targetFps).toFixed(1)}s, sim=${(simToFirst * 100).toFixed(1)}%)`);
    }
  }

  try { await cdp.detach(); } catch {}

  if (cycleEndIndex > 0) {
    const trimmed = frames.slice(cycleStartIndex, cycleEndIndex);
    const trimmedTs = timestamps.slice(cycleStartIndex, cycleEndIndex);
    frames.length = 0;
    frames.push(...trimmed);
    timestamps.length = 0;
    timestamps.push(...trimmedTs);
  }

  console.log(`   Total: ${frames.length} deterministic frames at ${targetFps} FPS`);

  return { frames, timestamps };
}

/**
 * Extract key frames for quality verification.
 */
function extractKeyframes(frames, outputPath) {
  const dir = dirname(outputPath);
  const base = basename(outputPath, extname(outputPath));
  const keyframeDir = join(dir, `${base}-keyframes`);

  if (!existsSync(keyframeDir)) {
    mkdirSync(keyframeDir, { recursive: true });
  }

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

  encoder.setRepeat(0);
  if (!usePerFrame) encoder.setDelay(defaultDelay);

  encoder.start();

  for (let i = 0; i < frames.length; i++) {
    if (usePerFrame) encoder.setDelay(perFrameDelays[i]);
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
 */
function assembleVideo(frames, format, outputPath, perFrameDelays, defaultFps) {
  const firstPng = PNG.sync.read(frames[0]);
  const width = firstPng.width;
  const height = firstPng.height;

  const adjWidth = width % 2 === 0 ? width : width - 1;
  const adjHeight = height % 2 === 0 ? height : height - 1;

  let fps;
  if (perFrameDelays && perFrameDelays.length > 0) {
    const avgDelay = perFrameDelays.reduce((a, b) => a + b, 0) / perFrameDelays.length;
    fps = Math.round(1000 / avgDelay);
  } else {
    fps = defaultFps || 10;
  }
  fps = Math.max(1, Math.min(fps, 60));

  console.log(`\nAssembling ${format.toUpperCase()} (${frames.length} frames, ${fps}fps, ${adjWidth}x${adjHeight})...`);

  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const tmpDir = join(outputDir, '.tmp-frames');
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  for (let i = 0; i < frames.length; i++) {
    writeFileSync(join(tmpDir, `frame-${String(i).padStart(6, '0')}.png`), frames[i]);
  }

  let codec, extraArgs;
  if (format === 'mp4') {
    codec = 'libx264';
    extraArgs = ['-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', '-crf', '18', '-preset', 'slow'];
  } else {
    codec = 'libvpx-vp9';
    extraArgs = ['-pix_fmt', 'yuv420p', '-crf', '20', '-b:v', '0'];
  }

  const ffmpegCmd = [
    'ffmpeg', '-y', '-framerate', String(fps),
    '-i', join(tmpDir, 'frame-%06d.png'),
    '-c:v', codec, ...extraArgs,
    '-vf', `scale=${adjWidth}:${adjHeight}:flags=lanczos`,
    '-an', '-loop', '0', outputPath
  ].join(' ');

  try {
    execSync(ffmpegCmd, { stdio: 'pipe' });
    const stats = statSync(outputPath);
    console.log(`   ${format.toUpperCase()} saved: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`   ffmpeg error: ${err.stderr?.toString() || err.message}`);
    throw new Error(`Failed to encode ${format.toUpperCase()}`);
  } finally {
    for (let i = 0; i < frames.length; i++) {
      try { unlinkSync(join(tmpDir, `frame-${String(i).padStart(6, '0')}.png`)); } catch {}
    }
    try { rmdirSync(tmpDir); } catch {}
  }

  return outputPath;
}

/**
 * Resize a PNG buffer so the larger side equals targetSize.
 * Uses area averaging for downscaling to preserve detail.
 */
function resizePng(buffer, targetSize) {
  const src = PNG.sync.read(buffer);

  if (src.width <= targetSize && src.height <= targetSize) {
    return buffer;
  }

  const scale = targetSize / Math.max(src.width, src.height);
  let newW = Math.round(src.width * scale);
  let newH = Math.round(src.height * scale);
  newW = newW % 2 === 0 ? newW : newW + 1;
  newH = newH % 2 === 0 ? newH : newH + 1;

  const dst = new PNG({ width: newW, height: newH });

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
        const wy = Math.min(sy + 1, srcY1) - Math.max(sy, srcY0);
        for (let sx = x0; sx < x1; sx++) {
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

  console.log(`\nAnimation Capture Settings:`);
  console.log(`   URL: ${options.url}`);
  console.log(`   Capture mode: ${options.captureMode}`);
  console.log(`   Target max output size: ${options.maxSize}px`);
  console.log(`   Format: ${options.format.toUpperCase()}`);
  console.log(`   Output: ${options.output}`);

  // For screenshot mode, delegate to web-capture
  if (options.captureMode === 'screenshot') {
    const captureResult = await captureFramesWebCapture(options);
    await processAndEncode(captureResult.frames, captureResult.timestamps, options);
    return;
  }

  // For screencast/beginframe modes, use Playwright directly
  const captureW = options.sourceWidth || Math.round(options.maxSize * 2 * 1.05);
  const captureH = options.sourceHeight || captureW;

  const launchOptions = { headless: true };
  if (options.captureMode === 'beginframe') {
    launchOptions.args = [
      '--deterministic-mode', '--enable-begin-frame-control',
      '--disable-new-content-rendering-timeout', '--run-all-compositor-stages-before-draw',
      '--disable-threaded-animation', '--disable-threaded-scrolling',
      '--disable-checker-imaging', '--disable-image-animation-resync',
      '--enable-surface-synchronization',
    ];
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: captureW, height: captureH },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    console.log('\nLoading page...');
    await page.goto(options.url, { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 2000));

    function runCapture() {
      if (options.captureMode === 'beginframe') {
        return captureFramesBeginFrame(page, options);
      } else {
        return captureFramesScreencast(page, options);
      }
    }

    let captureResult;
    if (options.preheat) {
      console.log('\n--- PREHEAT RUN ---');
      await runCapture();
      console.log('\n--- ACTUAL CAPTURE ---');
      await page.goto(options.url, { waitUntil: 'networkidle' });
      await new Promise(r => setTimeout(r, 2000));
      captureResult = await runCapture();
    } else {
      captureResult = await runCapture();
    }

    await processAndEncode(captureResult.frames, captureResult.timestamps, options);
  } catch (error) {
    console.error('Error:', error.message);
    if (options.verbose) console.error(error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

/**
 * Process captured frames (crop, resize) and encode to output format.
 */
async function processAndEncode(rawFrames, timestamps, options) {
  if (rawFrames.length < 2) {
    console.error('Error: Not enough frames captured.');
    process.exit(1);
  }

  let frames = rawFrames;
  const targetMaxSize = options.targetWidth
    ? Math.max(options.targetWidth, options.targetHeight)
    : options.maxSize;

  // Auto-crop to content
  if (options.crop) {
    console.log('\nAuto-cropping to content...');
    const cropRegion = computeCropRegion(frames, options.cropPadding, targetMaxSize);
    frames = frames.map(f => cropPng(f, cropRegion, cropRegion.bgColor));
  }

  // Resize to target dimensions
  const testPng = PNG.sync.read(frames[0]);
  if (testPng.width > targetMaxSize || testPng.height > targetMaxSize) {
    console.log(`\nResizing from ${testPng.width}x${testPng.height} to max ${targetMaxSize}px...`);
    frames = frames.map(f => resizePng(f, targetMaxSize));
  }

  const finalPng = PNG.sync.read(frames[0]);
  console.log(`   Final frame size: ${finalPng.width}x${finalPng.height}`);

  if (options.extractKeyframes) {
    console.log('\nExtracting key frames...');
    extractKeyframes(frames, options.output);
  }

  // Compute per-frame delays from timestamps
  let perFrameDelays = null;
  let effectiveDelay = 100;
  let effectiveFps = 10;

  if (options.delay !== null) {
    effectiveDelay = Math.max(20, options.delay);
    effectiveFps = Math.round(1000 / effectiveDelay);
  } else if (options.targetFps !== null) {
    effectiveDelay = Math.round(1000 / options.targetFps / options.speed);
    effectiveDelay = Math.max(20, effectiveDelay);
    effectiveFps = Math.round(1000 / effectiveDelay);
  } else if (options.fps !== null) {
    effectiveDelay = Math.round(1000 / options.fps / options.speed);
    effectiveDelay = Math.max(20, effectiveDelay);
    effectiveFps = Math.round(1000 / effectiveDelay);
  } else if (timestamps.length >= 2) {
    perFrameDelays = [];
    for (let i = 0; i < frames.length; i++) {
      let realDelay;
      if (i < timestamps.length - 1) {
        realDelay = timestamps[i + 1] - timestamps[i];
      } else {
        const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
        realDelay = totalTime / (timestamps.length - 1);
      }
      realDelay = Math.round(realDelay / options.speed);
      realDelay = Math.max(20, realDelay);
      perFrameDelays.push(realDelay);
    }
    const avgDelay = perFrameDelays.reduce((a, b) => a + b, 0) / perFrameDelays.length;
    effectiveFps = Math.round(1000 / avgDelay);
  }

  // Encode output
  if (options.format === 'gif') {
    assembleGif(frames, effectiveDelay, options.output, perFrameDelays);
  } else {
    assembleVideo(frames, options.format, options.output, perFrameDelays, effectiveFps);
  }

  // Generate companion video formats
  if (options.format === 'gif' && checkFfmpeg()) {
    console.log('\nGenerating companion video formats...');
    try { assembleVideo(frames, 'mp4', options.output.replace(/\.gif$/i, '.mp4'), perFrameDelays, effectiveFps); } catch (e) { console.warn(`   Warning: MP4 generation failed: ${e.message}`); }
    try { assembleVideo(frames, 'webm', options.output.replace(/\.gif$/i, '.webm'), perFrameDelays, effectiveFps); } catch (e) { console.warn(`   Warning: WebM generation failed: ${e.message}`); }
  }

  console.log('\nDone!');
}

main();
