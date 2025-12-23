# Case Study: Issue #9 - Fix errors in download

## Overview

**Issue:** [#9 - Fix errors in download](https://github.com/link-foundation/meta-theory/issues/9)
**Pull Request:** [#11](https://github.com/link-foundation/meta-theory/pull/11)
**Date:** December 23, 2025
**Status:** Resolved

## Problem Statement

The issue reported two main problems:
1. **Images not rendered** - Figure images in the markdown article were not displaying
2. **Formulas not converted** - Mathematical formulas needed to be properly converted to GitHub-compatible LaTeX format

Additionally, the issue requested:
- Generalization and fixing of verification logic in scripts
- Deep case study analysis with timeline reconstruction and root cause identification

## Timeline of Events

### December 21, 2025
- **19:24:30** - PR #4 merged: Added "Deep Theory of Links 0.0.1" article archive
- **19:31:41** - PR #6 merged: Added "Math introduction to Deep Theory" archive
- **19:40:45** - PR #5 merged: Added "The Links Theory 0.0.2" draft documentation
- **19:45:55** - Issue #9 created: "Fix errors in download" - Reporting image rendering and formula conversion issues

### December 23, 2025
- **20:11:53** - AI solution process started
- **20:12:10** - PR #11 created as draft
- **20:12:03** - Initial commit with task details
- **20:17:00** - Figure images downloaded (13 images, ~8.5 MB total)
- **20:20:00** - Article.md updated with image references
- **20:22:00** - Verification scripts updated to check for figure images
- **20:23:58** - Main implementation commit pushed
- **20:24:52** - Cleanup commit (revert initial task file)
- **20:25:00** - Solution draft log attached to PR

## Root Cause Analysis

### Issue 1: Images Not Rendering

**Root Cause:** The original article on Habr.com contained 13 figures (Figure 1 through Figure 13) as external images. When the article was converted to markdown (in PR #5), only the figure captions were preserved, but the actual image files were not downloaded and the image references were not added.

**Evidence:**
- The original `article.md` contained figure captions like `**Figure 1.** A table is described by...` but no `![Figure X](...)` image syntax
- The `images/` directory did not exist in `archive/0.0.2/` before this fix

**Technical Details:**
The images on Habr.com are served from their CDN with dynamic URLs. The original archiving process captured the text but did not:
1. Extract the image URLs from the page
2. Download the images to local storage
3. Add markdown image syntax to reference them

### Issue 2: Formula Conversion (Minor)

**Finding:** Upon investigation, mathematical formulas in the article were already properly converted to GitHub-compatible LaTeX format using `$$...$$` syntax.

**Evidence from article.md:**
```markdown
$$L \to L^2$$
$$R \subseteq D_1 \times D_2 \times ... \times D_n$$
$$\lambda: L \to L \times L$$
```

This indicates the formula conversion was actually completed in the original PR #5, but the issue was created as a precautionary measure to ensure completeness.

### Issue 3: Verification Logic

**Root Cause:** The verification scripts (`verify-article-playwright.mjs` and `verify-article-puppeteer.mjs`) did not check for the presence of figure images in the markdown.

**Before fix:** Tests only verified text content (headings, paragraphs, code blocks)
**After fix:** Tests now also verify all 13 figure images are present

## Solution Implemented

### 1. Downloaded Figure Images

Created `scripts/download-images.mjs` to:
- Navigate to the original article page
- Extract all figure images with their metadata
- Download images to `archive/0.0.2/images/`
- Create `metadata.json` with image information

**Images downloaded:**

| Figure | Filename | Size |
|--------|----------|------|
| Figure 1 | figure-1.png | 246 KB |
| Figure 2 | figure-2.png | 23 KB |
| Figure 3 | figure-3.png | 422 KB |
| Figure 4 | figure-4.png | 948 KB |
| Figure 5 | figure-5.png | 1.6 MB |
| Figure 6 | figure-6.png | 105 KB |
| Figure 7 | figure-7.png | 1.2 MB |
| Figure 8 | figure-8.png | 1.1 MB |
| Figure 9 | figure-9.png | 1.8 MB |
| Figure 10 | figure-10.jpg | 61 KB |
| Figure 11 | figure-11.png | 420 KB |
| Figure 12 | figure-12.png | 525 KB |
| Figure 13 | figure-13.jpg | 25 KB |

**Total:** ~8.5 MB

### 2. Updated Article with Image References

Added markdown image syntax before each figure caption in `article.md`:

```markdown
![Figure 1](images/figure-1.png)

**Figure 1.** A table is described by a relation...
```

### 3. Enhanced Verification Scripts

Updated both `verify-article-playwright.mjs` and `verify-article-puppeteer.mjs` to:
- Check for presence of all 13 figure images in markdown
- Report image verification as part of test results
- Increased total checks from 42 to 69

### 4. Updated Documentation

Updated `archive/0.0.2/README.md` with:
- Documentation of images directory
- Updated test output example showing 100% pass rate
- Image verification details

## Verification Results

After the fix, verification tests show:

```
✅ Passed: 69/69 checks (100.0%)
❌ Failed: 0/69 checks

🎉 SUCCESS! All checked content from the web page exists in the markdown file.
```

This represents an improvement from 88.1% (37/42) to 100% (69/69) pass rate.

## Files Changed

| File | Change Type |
|------|-------------|
| `archive/0.0.2/README.md` | Modified |
| `archive/0.0.2/article.md` | Modified |
| `archive/0.0.2/images/` | Added (14 files) |
| `scripts/download-images.mjs` | Added |
| `scripts/verify-article-playwright.mjs` | Modified |
| `scripts/verify-article-puppeteer.mjs` | Modified |
| `experiments/extract-images.mjs` | Added |

## Lessons Learned

1. **Complete content capture:** When archiving web content, all media (images, videos, etc.) should be captured along with text content.

2. **Verification completeness:** Automated tests should verify all content types, not just text. The original verification missed image content.

3. **Metadata preservation:** Saving image metadata (figure number, caption, original URL) helps with future maintenance and verification.

4. **Incremental improvements:** The original archiving was good (88.1% verification) but missing a key component. Iterative improvement is natural and expected.

## References

- [Issue #9](https://github.com/link-foundation/meta-theory/issues/9)
- [Pull Request #11](https://github.com/link-foundation/meta-theory/pull/11)
- [Original Article](https://habr.com/en/articles/895896)
- [Solution Draft Log](./solution-draft-log.txt)
