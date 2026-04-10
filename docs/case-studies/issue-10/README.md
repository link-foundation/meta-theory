# Case Study: Issue #10 - Use web-capture for downloading and verifying pages

## Overview

**Issue:** [#10 - Use web-capture](https://github.com/link-foundation/meta-theory/issues/10)
**Pull Request:** [#56](https://github.com/link-foundation/meta-theory/pull/56)
**Date:** April 10, 2026
**Status:** In Progress

## Problem Statement

The meta-theory repository contains custom scripts for downloading Habr articles, extracting images, converting to markdown, capturing screenshots, and verifying content. These scripts duplicate functionality that is already available (or should be) in the [`@link-assistant/web-capture`](https://github.com/link-assistant/web-capture) package.

The goal is to:
1. Move all downloading/capture logic to web-capture
2. Keep only verification logic in this repository
3. Ensure all previously supported features continue to work
4. Report any missing features to web-capture as issues

## Current Architecture (Before)

### Scripts in meta-theory

| Script | Purpose | Lines |
|--------|---------|-------|
| `scripts/download-article.mjs` | Extract article content from Habr, convert to markdown (with LaTeX, figures, metadata) | ~750 |
| `scripts/download.mjs` | Download figure images and capture light/dark screenshots | ~445 |
| `scripts/download-markdown-images.mjs` | Download external images from markdown, update references to local paths | ~370 |
| `scripts/capture-animation.mjs` | Capture web animations as GIF/MP4/WebM | ~1800 |
| `scripts/verify.mjs` | Verify markdown content matches web page | ~700 |
| `scripts/articles-config.mjs` | Article configuration (URLs, paths, expected figures) | ~80 |

**Total custom download/capture code: ~3,365 lines**

### Dependencies

- `playwright` - Browser automation for screenshots and article extraction
- `puppeteer` - Browser automation for animation capture
- `gif-encoder-2` - GIF encoding
- `jpeg-js` - JPEG decoding for frame comparison
- `pngjs` - PNG processing

## web-capture Capabilities

### Package Info

- **npm:** `@link-assistant/web-capture` (v1.1.2 published, v1.2.0 in repo)
- **GitHub:** [link-assistant/web-capture](https://github.com/link-assistant/web-capture)
- **License:** Unlicense (public domain)

### Available Features

| Feature | web-capture Module | Status |
|---------|-------------------|--------|
| HTML fetch | `lib.js` (`fetchHtml`) | Available |
| HTML-to-Markdown conversion | `lib.js` (`convertHtmlToMarkdown`, `convertHtmlToMarkdownEnhanced`) | Available |
| LaTeX formula extraction (Habr, KaTeX, MathJax) | `latex.js` | Available |
| Article metadata extraction (Habr-specific) | `metadata.js` | Available |
| Markdown post-processing (Unicode, LaTeX spacing, bold formatting) | `postprocess.js` | Available |
| Figure extraction from pages | `figures.js` (`extractFigures`, `extractFiguresFromUrl`) | Available |
| Figure image download | `figures.js` (`downloadFigures`) | Available |
| Image localization in markdown | `localize-images.js` (`localizeImages`) | Available |
| Screenshots (themed light/dark, full-page) | `/image` endpoint + CLI | Available |
| ZIP archive (markdown + local images) | `archive.js` | Available |
| PDF generation | `pdf.js` | Available |
| DOCX generation | `docx.js` | Available |
| Popup/modal dismissal (including Google FC consent) | `popups.js` | Available |
| Animation capture (screencast, screenshot, beginframe modes) | `animation.js` | Available |
| Content verification | `verify.js` | Available |
| Batch processing with config | `batch.js` | Available |
| URL normalization (relative to absolute) | `lib.js` | Available |
| Retry logic for downloads | `retry.js` | Available |

## Requirements Analysis

### Requirement 1: Download articles to markdown

**Current behavior:** `download-article.mjs` launches Playwright, navigates to Habr URL, scrolls to load lazy content, then performs custom DOM traversal to extract content elements (headings, paragraphs, code blocks, figures, formulas, lists, blockquotes) and converts them to markdown.

**web-capture equivalent:** `convertHtmlToMarkdownEnhanced(html, baseUrl, options)` in `lib.js` provides:
- LaTeX formula extraction from Habr `img.formula` elements
- Article metadata extraction (author, date, hubs, tags)
- Code language detection/correction (Coq vs MATLAB)
- Blockquote math grouping
- Full post-processing pipeline (Unicode normalization, LaTeX spacing, bold formatting)

**Gap analysis:**
- web-capture's enhanced conversion handles the same Habr-specific features
- The batch module (`batch.js`) can load our `articles-config.mjs` directly
- web-capture uses Cheerio (no browser needed for markdown conversion) - faster than our Playwright-based approach
- For JavaScript-rendered content, web-capture also has browser-based extraction via `extractFiguresFromUrl`

**Status: Fully covered by web-capture**

### Requirement 2: Download figure images

**Current behavior:** `download.mjs` (with `--images` flag) launches Playwright, finds `<figure>` elements, extracts image URLs, downloads them to `archive/{version}/images/figure-N.{ext}`.

**web-capture equivalent:**
- `extractFigures(html, baseUrl)` - extracts figure metadata (same multilingual caption parsing)
- `downloadFigures(figures, options)` - downloads with retry logic
- `extractFiguresFromUrl(url, options)` - browser-based extraction + download in one call

**Status: Fully covered by web-capture**

### Requirement 3: Download markdown images (localize external image references)

**Current behavior:** `download-markdown-images.mjs` reads markdown files, finds external image URLs (habrastorage.org), downloads them locally, updates markdown references.

**web-capture equivalent:** `localizeImages(markdownText, options)` in `localize-images.js` provides:
- Image URL extraction from markdown
- Download with retry
- Local filename generation
- Markdown reference updating
- Metadata generation
- `dryRun` and `onProgress` callback support

**Status: Fully covered by web-capture**

### Requirement 4: Capture themed screenshots (light/dark)

**Current behavior:** `download.mjs` (with `--screenshot` flag) launches Playwright with `colorScheme: 'light'` or `'dark'`, navigates to page, scrolls to load lazy content, dismisses popups, takes full-page screenshot.

**web-capture equivalent:** CLI: `web-capture URL -f png --theme light --fullPage -o screenshot.png`
- API endpoint: `/image?url=URL&theme=dark&fullPage=true`
- Popup dismissal is built-in (`dismissPopups` parameter)
- Supports both PNG and JPEG formats

**Status: Fully covered by web-capture**

### Requirement 5: Capture animations

**Current behavior:** `capture-animation.mjs` (~1800 lines) captures web animations as GIF/MP4/WebM with multiple capture modes (screencast, screenshot, beginframe), loop detection, keyframe extraction, quality optimization.

**web-capture equivalent:** `animation.js` provides:
- Same capture modes (screencast, screenshot, beginframe)
- Loop detection with pixel similarity threshold
- Keyframe extraction
- Per-frame callbacks

**Gap analysis:**
- web-capture's animation module returns frames as PNG buffers and metadata
- GIF/MP4/WebM encoding appears to be in the CLI/handler layer
- The meta-theory script has extensive GIF encoding (octree quantization, H.264/VP9 via ffmpeg)
- Need to verify web-capture's animation output format support

**Status: Partially covered - frame capture is there, but final GIF/video encoding may need verification**

### Requirement 6: Verify content

**Current behavior:** `verify.mjs` verifies markdown files contain expected content from original web pages by checking title, headings, paragraphs, code blocks, list items, formulas, and image references.

**web-capture equivalent:** `verify.js` provides:
- Same verification checks (title, headings, paragraphs, code blocks, lists, formulas, images)
- Same normalization strategy
- Same 85% pass rate threshold
- Fuzzy matching with configurable thresholds

**Issue note:** The issue states "Verification can stay in our repository logic." So even though web-capture has verification, we may keep our own verification script.

**Status: Fully covered by web-capture (but may keep local verification per issue instructions)**

### Requirement 7: Batch processing with articles-config.mjs

**Current behavior:** `articles-config.mjs` defines article configurations. Scripts import and iterate over them.

**web-capture equivalent:** `batch.js` provides:
- `loadConfig(configPath)` - loads `.json`, `.mjs`, `.js` config files
- Supports the same article config structure (url, title, language, archivePath, etc.)
- `getAllVersions()`, `getAllArticles()`, `getArticle()` functions

**Status: Fully covered by web-capture**

## Feature Comparison Summary

| Feature | meta-theory | web-capture | Gap? |
|---------|-------------|-------------|------|
| Markdown from Habr | Custom DOM traversal via Playwright | Turndown + Cheerio with enhanced pipeline | No |
| LaTeX formula extraction | `img.formula` source attribute | Habr + KaTeX + MathJax support | No (web-capture has more) |
| Metadata extraction | Custom Habr-specific parsing | Same + LD+JSON structured data | No (web-capture has more) |
| Post-processing | Unicode, LaTeX spacing, bold fixes | Same + percent sign fix for GitHub | No (web-capture has more) |
| Figure extraction | Browser-based, multilingual captions | Same, browser and Cheerio modes | No |
| Image localization | Custom download + markdown rewrite | `localizeImages()` with same features | No |
| Screenshots (themed) | Playwright + popup dismissal | Same, CLI + API + library | No |
| Animation capture | Full GIF/MP4/WebM encoding | Frame capture + metadata | Partial |
| Popup dismissal | Google FC + Habr-specific | Same selectors | No |
| Content verification | Custom verification checks | Same checks with same thresholds | No |
| Batch config loading | Custom `articles-config.mjs` | `loadConfig()` supports .mjs | No |
| Code language detection | Coq vs MATLAB fix | Same detection | No |

## Proposed Solutions

### Solution Plan: Migrate download scripts to use web-capture

#### Phase 1: Add web-capture dependency

1. Add `@link-assistant/web-capture` to `package.json` dependencies
2. Keep `playwright` as it may still be needed for verification and animation
3. Remove `puppeteer` if web-capture handles all browser-based tasks

#### Phase 2: Replace download-article.mjs

Replace the custom 750-line DOM traversal with web-capture's library:

```javascript
import { fetchHtml, convertHtmlToMarkdownEnhanced } from '@link-assistant/web-capture/src/lib.js';

async function downloadArticle(article) {
  const html = await fetchHtml(article.url);
  const { markdown, metadata } = convertHtmlToMarkdownEnhanced(html, article.url, {
    extractLatex: true,
    extractMetadata: true,
    postProcess: true,
    detectCodeLanguage: true
  });
  writeFileSync(join(archivePath, article.markdownFile), markdown);
}
```

#### Phase 3: Replace download.mjs (images + screenshots)

**For images:**
```javascript
import { extractFigures, downloadFigures } from '@link-assistant/web-capture/src/figures.js';

const html = await fetchHtml(article.url);
const figures = extractFigures(html, article.url);
await downloadFigures(figures, { outputDir: imagesDir });
```

**For screenshots:** Use web-capture CLI or library:
```javascript
import { createBrowser } from '@link-assistant/web-capture/src/browser.js';
import { dismissPopups } from '@link-assistant/web-capture/src/popups.js';
// Or simply use CLI: web-capture URL -f png --theme light --fullPage -o path.png
```

#### Phase 4: Replace download-markdown-images.mjs

```javascript
import { localizeImages } from '@link-assistant/web-capture/src/localize-images.js';

const markdownText = readFileSync(markdownPath, 'utf-8');
const result = await localizeImages(markdownText, {
  imagesDir: 'images',
  onProgress: (index, total, status, url) => {
    console.log(`[${index}/${total}] ${status}: ${url}`);
  }
});
writeFileSync(markdownPath, result.markdown);
```

#### Phase 5: Update articles-config.mjs for batch module compatibility

Use web-capture's batch module to load our config:
```javascript
import { loadConfig, getAllArticles } from '@link-assistant/web-capture/src/batch.js';
const config = await loadConfig('./scripts/articles-config.mjs');
const articles = getAllArticles(config);
```

#### Phase 6: Keep verification local (as issue specifies)

The issue states: "Verification can stay in our repository logic." Keep `verify.mjs` as-is or optionally delegate to web-capture's verify module while keeping our script as the entry point.

#### Phase 7: Animation capture assessment

The animation capture script is the most complex (~1800 lines). Web-capture has frame capture support but may not have full GIF/MP4/WebM encoding. Options:
1. If web-capture's animation module supports the needed output formats, migrate
2. If not, file an issue on web-capture and keep the local script until the feature is added
3. Consider contributing the GIF/video encoding features to web-capture

### Issues to Report on web-capture

Based on the comparison, the following issues should be considered:

1. **npm version is outdated (1.1.2 vs repo 1.2.0):** The npm-published version is from December 2025. A new release with the latest features would be helpful.

2. **Animation output formats:** Verify whether web-capture's animation module supports GIF, MP4, and WebM output directly, or only raw frames. If only raw frames, an issue should be filed for adding video format output support.

3. **Batch download CLI command:** web-capture has batch config loading but may not have a single CLI command for batch processing multiple articles. Consider requesting a `web-capture --batch config.mjs` command.

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| web-capture API changes breaking our scripts | Medium | Pin dependency version, add integration tests |
| Missing features in web-capture | Low | Most features already available; file issues for gaps |
| npm version lag | Medium | Can reference GitHub repo directly in package.json |
| Animation encoding gap | Low | Keep local animation script until web-capture adds support |

## External Resources

- [web-capture repository](https://github.com/link-assistant/web-capture)
- [web-capture npm package](https://www.npmjs.com/package/@link-assistant/web-capture)
- [Turndown HTML-to-Markdown](https://github.com/mixmark-io/turndown) - used by web-capture
- [Cheerio](https://github.com/cheeriojs/cheerio) - used by web-capture for HTML parsing
- [Playwright](https://playwright.dev/) - browser automation
- [Puppeteer](https://pptr.dev/) - browser automation (used by web-capture default engine)

## Data Collection

### Feature matrix data

The full feature comparison is documented in the tables above.

### Code metrics

| Metric | meta-theory scripts | web-capture equivalent |
|--------|-------------------|----------------------|
| Total download/capture LOC | ~3,365 | Provided by package |
| Verification LOC | ~700 | Can stay local |
| Dependencies for download | playwright, puppeteer, gif-encoder-2, jpeg-js, pngjs | @link-assistant/web-capture |
| Habr-specific features | LaTeX, figures, metadata, popups | All included |

### Version tracking

| Package | npm version | Repo version | Last publish |
|---------|-------------|--------------|--------------|
| @link-assistant/web-capture | 1.1.2 | 1.2.0 | 2025-12-22 |
