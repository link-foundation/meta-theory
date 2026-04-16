# Case Study: Issue #10 - Use web-capture for downloading and verifying pages

## Overview

**Issue:** [#10 - Use web-capture](https://github.com/link-foundation/meta-theory/issues/10)
**Pull Request:** [#56](https://github.com/link-foundation/meta-theory/pull/56)
**Date:** April 10, 2026; updated April 16, 2026
**Status:** Implemented with published package validation

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

1. **[#38](https://github.com/link-assistant/web-capture/issues/38)** - npm package version (1.1.2) behind GitHub source (1.2.0). Closed after newer packages were published.
2. **[#76](https://github.com/link-assistant/web-capture/issues/76)** - Habr article captures include page chrome instead of article-only content.
3. **[#77](https://github.com/link-assistant/web-capture/issues/77)** - Rust markdown capture is not feature-parity with JavaScript for Habr formulas and formatting.
4. **[#78](https://github.com/link-assistant/web-capture/issues/78)** - Habr markdown conversion drifts from meta-theory archive format.
5. **[#79](https://github.com/link-assistant/web-capture/issues/79)** - JavaScript CLI `--version` reports the caller package version.

## Installation

Install the published JavaScript package from npm:

```bash
npm install
```

This PR pins `@link-assistant/web-capture` to `1.7.6`, the latest npm release validated on April 16, 2026. The earlier `setup:web-capture` local-source workaround is no longer needed.

The Rust CLI release validated in the same pass is:

```bash
cargo install web-capture --version 0.3.1
```

## April 16 Published Package Validation

Latest releases checked:

| Package | Latest version | Source |
|---------|----------------|--------|
| JavaScript | `@link-assistant/web-capture@1.7.6` | npm / GitHub release `v1.7.6` |
| Rust | `web-capture@0.3.1` | crates.io |

Validation results:

| Check | Result |
|-------|--------|
| Install published JavaScript package | Passed with Node engine warning (`web-capture` declares Node `>=22 <23`; local runner was Node `20.20.2`) |
| Import all JavaScript modules used by meta-theory | Passed (`node scripts/test-web-capture-integration.mjs`, 19/19) |
| Install Rust CLI | Passed (`cargo install web-capture --version 0.3.1`) |
| Dry-run all meta-theory article downloads through JavaScript package | Passed after scoping rendered Habr pages to article content |
| Compare JavaScript/Rust CLI feature surface for article task | Gaps found and reported upstream |
| Compare generated article markdown against existing archives | Non-volatile drift found and reported upstream |

Important local finding:

The published JavaScript converter works for meta-theory only when the rendered Habr page is scoped before conversion. Passing the full page to web-capture includes Habr navigation, ads, login/search links, and unrelated user names in metadata. `download-article.mjs` now builds two scoped documents:

- full `<article>` plus head metadata for web-capture metadata extraction
- `article h1` plus `.article-formatted-body` for web-capture markdown conversion

This keeps the repository-specific page selection small while continuing to rely on web-capture for conversion, metadata formatting, LaTeX handling, and post-processing.

## Testing

Integration tests validate all web-capture imports and basic functionality:

```bash
node scripts/test-web-capture-integration.mjs
```

19 tests covering:
- Core library imports (convertHtmlToMarkdownEnhanced, fetchHtml)
- Metadata extraction and formatting
- Post-processing pipeline
- Image localization with dry-run
- Figure extraction from HTML
- Themed screenshot capture
- Animation frame capture
- Batch processing
- meta-theory article scoping to avoid page chrome
- Articles config compatibility
