# Case Study: Issue #30 — Properly format metadata and minimize difference from original articles

## Issue Summary

**Issue:** [#30](https://github.com/link-foundation/meta-theory/issues/30)
**Type:** Bug / Enhancement
**Status:** Fixed
**Date:** 2026-03-31
**PR:** [#31](https://github.com/link-foundation/meta-theory/pull/31)

## Problem Description

The downloaded markdown articles have several formatting discrepancies compared to the original Habr articles. These issues reduce the accuracy of the archived versions.

## Root Causes Found and Fixed

### 1. Non-breaking spaces (U+00A0) breaking formula delimiters

**Root cause:** Habr pages contain non-breaking space characters (U+00A0) in the HTML. GitHub's math renderer does not recognize `\xa0` as a word boundary for inline math `$...$` delimiters. This caused formulas like `text\xa0$L$` to appear as raw `$L$` text instead of rendered math.

**Fix:** Replace all U+00A0 with regular spaces in `postProcessMarkdown()`:
```js
result = result.replace(/\u00A0/g, ' ');
```

**Affected formulas:** `$A$`, `$(L, L)$`, `$l ∈ L$`, `$\{anetv^n\}$`, `$n \in \mathbb{N}_0$`, and many more inline formulas across all articles.

### 2. Missing space before `$` after closing parentheses

**Root cause:** When a markdown link like `[text](url)` is immediately followed by an inline formula `$...$` without a space, GitHub does not recognize the `$` as a math delimiter. The `postProcessMarkdown()` formula-spacing logic handles most cases but the `)` from markdown link syntax `](url))$` was a boundary case.

**Fix:** The formula spacing tokenizer in `postProcessMarkdown()` already includes `)` in its regex pattern `/[a-zA-Zа-яА-ЯёЁ,:;»)\]]$/`, but the article files needed to be regenerated after this fix was added.

**Specific instances fixed:**
- `[relation](...))$\mathbf{R}$` → `[relation](...)) $\mathbf{R}$`
- `[expression](...))$\mathbf{S_n}$` → `[expression](...)) $\mathbf{S_n}$`

### 3. Percent sign (`%`) treated as LaTeX comment

**Root cause:** GitHub's KaTeX renderer treats `%` as a LaTeX comment character, stripping everything after it on the same line. So `$100\%$` renders as just "100" with no percent sign.

**Fix:** Use `\\%` (double backslash + percent) which GitHub's markdown preprocessor converts to `\%` before passing to KaTeX.

**Reference:** [GitHub Community Discussion #31812](https://github.com/orgs/community/discussions/31812)

```js
result = result.replace(/\$(\d+)\\+%\$/g, '$$$1\\\\%$$');
result = result.replace(/\$(\d+)\\text\{%\}\$/g, '$$$1\\\\%$$');
```

### 4. Centered blockquote formulas instead of left-aligned

**Root cause:** GitHub renders `$$...$$` as display math which is always centered. The original Habr articles show formulas left-aligned within blockquotes.

**Fix:** Use `$\displaystyle ...$` (inline math with displaystyle command) instead of `$$...$$` for blockquote formulas. The `\displaystyle` ensures full-size rendering (same visual quality as block math), while `$...$` inline math stays left-aligned.

```js
// Single formula in blockquote
lines.push('> $\\displaystyle ' + element.content + '$');

// Multiple formulas grouped in blockquote
for (let fi = 0; fi < element.formulas.length; fi++) {
  lines.push('> $\\displaystyle ' + element.formulas[fi] + '$');
  if (fi < element.formulas.length - 1) {
    lines.push('>');  // blank line within blockquote keeps it connected
  }
}
```

### 5. Split blockquotes that should be grouped

**Root cause:** The original articles have blockquotes with multiple formula paragraphs (e.g., `1→(1,1)`, `2→(2,2)`, `3→(1,2)` as one blockquote). The script generated separate blockquote blocks for each formula.

**Fix:** Added `blockquote-math-group` element type. When all children of a blockquote are formula-only, they are grouped into a single continuous blockquote with `>` on blank lines between formulas.

### 6. Bold marker spacing issues

**Root cause:** HTML extraction from Habr produces bold text with trailing spaces like `**Figure 11. **` (space before closing `**`), which is invalid markdown. Also, empty bold markers `****` appear from certain HTML structures.

**Fix:** Two-stage bold fixing in `postProcessMarkdown()`:
1. Remove empty bold markers (`****` and `** **`)
2. Line-by-line bold pair processing: trim content inside `**...**` and ensure proper spacing around bold pairs

### 7. Missing metadata at article top and bottom

**Root cause:** The original script only extracted basic metadata (title, date). The issue requested metadata spacing (separate paragraphs), tags, hubs, votes, views, bookmarks, author info, and karma.

**Fix:**
- Added `formatMetadataBlock()` with blank lines between each metadata field (so GitHub renders them as separate paragraphs)
- Added `formatFooterBlock()` that appends tags (with links), hubs (with links), votes, views, bookmarks, and author info at the end of each article

## Timeline

1. **Initial script development** — Download script created to extract articles from Habr using Playwright
2. **Issue #30 opened** — Multiple formatting discrepancies identified via screenshots comparing original Habr pages with GitHub-rendered markdown
3. **Root cause analysis** — Non-breaking spaces identified as the primary cause of formula rendering failures; percent sign, bold spacing, and blockquote centering identified as secondary causes
4. **Script fixes applied** — All 7 root causes fixed in `download-article.mjs` and `verify.mjs`
5. **Articles re-downloaded** — All 3 article files re-downloaded as `article.md` (Note: `downloaded.md` files were later removed in issue #32 as redundant)
6. **Visual verification** — Playwright browser automation confirmed 0 unrendered formulas across all articles on GitHub

## Verification Results

All articles pass 100% verification:
- `archive/0.0.0/article.md` — 35/35 checks pass
- `archive/0.0.1/article.md` — 92/92 checks pass
- `archive/0.0.2/article.md` — 95/95 checks pass
- Total: **222/222 checks pass (100%)**

DOM inspection via Playwright confirmed **0 unrendered `$...$` formulas** on any article page on GitHub.

## Affected Articles

All three articles were re-processed:
- `archive/0.0.0/` — Math introduction to Deep Theory (`article.md`)
- `archive/0.0.1/` — Глубокая Теория Связей 0.0.1 (`article.md`)
- `archive/0.0.2/` — The Links Theory 0.0.2 (`article.md`)

## Key Technical Insights

1. **GitHub's inline math requires regular spaces around `$` delimiters.** Non-breaking spaces (U+00A0) are not recognized as word boundaries. This is the most impactful finding — a single invisible character can break formula rendering across an entire document.

2. **GitHub's KaTeX treats `%` as a LaTeX comment.** The workaround `\\%` (double backslash) is needed because GitHub's markdown preprocessor strips one backslash before passing to KaTeX.

3. **`$\displaystyle ...$` provides left-aligned block-quality math.** This is the correct approach for formulas in blockquotes where `$$...$$` would force centering.

4. **Markdown bold markers are whitespace-sensitive.** `**text **` (trailing space) is invalid — the closing `**` must immediately follow non-whitespace content.
