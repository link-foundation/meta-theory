# Case Study: Issue #10 - Use web-capture for downloading and verifying pages

## Overview

**Issue:** [#10 - Use web-capture](https://github.com/link-foundation/meta-theory/issues/10)
**Pull Request:** [#56](https://github.com/link-foundation/meta-theory/pull/56)
**Date:** April 10, 2026
**Status:** Implemented

## Problem Statement

The meta-theory repository contains custom scripts for downloading Habr articles, extracting images, converting to markdown, capturing screenshots, and verifying content. These scripts duplicate functionality that is already available in the [`@link-assistant/web-capture`](https://github.com/link-assistant/web-capture) package.

The goal is to:
1. Move all downloading/capture logic to web-capture
2. Keep only verification logic in this repository
3. Ensure all previously supported features continue to work
4. Report any missing features to web-capture as issues

## Architecture Before Migration

### Scripts in meta-theory

| Script | Purpose | Lines |
|--------|---------|-------|
| `scripts/download-article.mjs` | Extract article content from Habr, convert to markdown (with LaTeX, figures, metadata) | ~1,157 |
| `scripts/download.mjs` | Download figure images and capture light/dark screenshots | ~444 |
| `scripts/download-markdown-images.mjs` | Download external images from markdown, update references to local paths | ~372 |
| `scripts/capture-animation.mjs` | Capture web animations as GIF/MP4/WebM | ~1,597 |
| `scripts/verify.mjs` | Verify markdown content matches web page | ~634 |
| `scripts/articles-config.mjs` | Article configuration (URLs, paths, expected figures) | ~80 |

**Total custom download/capture code: ~3,570 lines**

## Architecture After Migration

### web-capture modules used

| Module | Used by | Feature |
|--------|---------|---------|
| `lib.js` → `convertHtmlToMarkdownEnhanced()` | download-article.mjs | HTML-to-Markdown with LaTeX, metadata, code language detection |
| `metadata.js` → `formatMetadataBlock()`, `formatFooterBlock()` | download-article.mjs | Article metadata formatting |
| `postprocess.js` → `postProcessMarkdown()` | download-article.mjs | Unicode normalization, LaTeX spacing, bold fixes |
| `figures.js` → `extractFiguresFromUrl()` | download.mjs | Figure extraction and download |
| `themed-image.js` → `captureDualThemeScreenshots()` | download.mjs | Light/dark themed screenshots |
| `localize-images.js` → `localizeImages()` | download-markdown-images.mjs | Image download and markdown URL replacement |
| `animation.js` → `captureAnimationFrames()` | capture-animation.mjs | Screenshot-mode frame capture with loop detection |

### What stays in meta-theory

| Component | Reason |
|-----------|--------|
| `verify.mjs` | Verification logic is outside web-capture's scope (per issue #10) |
| `articles-config.mjs` | Repository-specific article configuration |
| GIF/MP4/WebM encoding | web-capture provides raw frames; encoding requires gif-encoder-2/ffmpeg |
| Screencast/beginframe capture modes | Chromium CDP-specific APIs not available in web-capture |
| Auto-crop and area-average resize | Advanced image processing for animation output quality |

### Code reduction

| Script | Before | After | Reduction |
|--------|--------|-------|-----------|
| download-article.mjs | 1,157 | ~240 | -79% |
| download.mjs | 444 | ~170 | -62% |
| download-markdown-images.mjs | 372 | ~170 | -54% |
| capture-animation.mjs | 1,597 | ~760 | -52% |
| **Total** | **3,570** | **~1,340** | **-62%** |

## Feature Compatibility Matrix

| Feature | Before (custom) | After (web-capture) | Status |
|---------|----------------|--------------------|----|
| HTML-to-Markdown conversion | Custom DOM traversal in Playwright | `convertHtmlToMarkdownEnhanced()` via Turndown | ✅ |
| LaTeX formula extraction | Custom `img.formula` parsing | `latex.js` module (Habr + KaTeX + MathJax) | ✅ |
| Article metadata | Custom Playwright evaluate | `metadata.js` module (Cheerio-based) | ✅ |
| Post-processing (unicode, spacing) | Custom `postProcessMarkdown()` | `postprocess.js` module | ✅ |
| Figure image download | Custom Playwright + HTTP | `figures.js` → `extractFiguresFromUrl()` | ✅ |
| Themed screenshots (light/dark) | Custom Playwright contexts | `themed-image.js` → `captureDualThemeScreenshots()` | ✅ |
| Markdown image localization | Custom HTTP download + regex | `localize-images.js` → `localizeImages()` | ✅ |
| Animation frame capture | Custom screenshot loop | `animation.js` → `captureAnimationFrames()` | ✅ |
| Screencast capture (CDP) | Custom CDP integration | Kept in meta-theory (CDP-specific) | ✅ |
| BeginFrame capture (CDP) | Custom CDP integration | Kept in meta-theory (CDP-specific) | ✅ |
| GIF encoding | gif-encoder-2 | Kept in meta-theory | ✅ |
| MP4/WebM encoding | ffmpeg | Kept in meta-theory | ✅ |
| Popup dismissal | Custom selector lists | `popups.js` module | ✅ |
| Content verification | Custom comparison | Stays in `verify.mjs` | ✅ |

## Issues Reported on web-capture

1. **[#38](https://github.com/link-assistant/web-capture/issues/38)** - npm package version (1.1.2) behind GitHub source (1.2.0). Missing animation, latex, metadata, localize-images, postprocess, batch, archive modules from npm.

## Installation

Until web-capture v1.2.0 is published to npm, install from GitHub source:

```bash
# Clone web-capture source
git clone --depth 1 https://github.com/link-assistant/web-capture.git /tmp/web-capture-src

# Install from local source
npm install /tmp/web-capture-src/js

# Install web-capture's dependencies
cd /tmp/web-capture-src/js && npm install --production
```

Or use the convenience script:
```bash
npm run setup:web-capture
```

## Testing

Integration tests validate all web-capture imports and basic functionality:

```bash
node scripts/test-web-capture-integration.mjs
```

18 tests covering:
- Core library imports (convertHtmlToMarkdownEnhanced, fetchHtml)
- Metadata extraction and formatting
- Post-processing pipeline
- Image localization with dry-run
- Figure extraction from HTML
- Themed screenshot capture
- Animation frame capture
- Batch processing
- Articles config compatibility
