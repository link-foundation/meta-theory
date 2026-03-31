# Case Study: Issue #30 — Properly format metadata and minimize difference from original articles

## Issue Summary

**Issue:** [#30](https://github.com/link-foundation/meta-theory/issues/30)
**Type:** Bug / Enhancement
**Status:** In Progress
**Date:** 2026-03-31

## Problem Description

The downloaded markdown articles have several formatting discrepancies compared to the original Habr articles. These issues reduce the accuracy of the archived versions.

## Detailed Task Breakdown (from screenshots and issue description)

### 1. Missing empty lines between metadata fields (Screenshot 1)

**Problem:** In the rendered markdown on GitHub, the metadata block at the top of each article shows all metadata lines crammed together without visual separation. The metadata lines (Author, Type, Original article, Published, Reading time, Hubs, Tags) are on consecutive lines with no blank lines between them, causing GitHub to render them as a single continuous paragraph.

**Expected:** Each metadata line should be visually separated, matching the original article's spacing.

**Root cause:** The `formatMetadataBlock()` function in `download-article.mjs` adds metadata lines without blank lines between them. In GitHub markdown, consecutive lines without blank lines are rendered as a single paragraph.

### 2. `$100\%$` formula rendering issue (Screenshot 1)

**Problem:** The text "everything is $100\%$ serious" renders as "everything is 100 serious" on GitHub — the `%` sign is lost because `$100\%$` is not properly rendered as a LaTeX formula on GitHub.

**Expected:** Should show "100%" as rendered formula or plain text.

**Root cause:** GitHub's math rendering has issues with `\%` in inline LaTeX. The `%` is a comment character in LaTeX. While `$100\%$` is valid LaTeX, GitHub's renderer may not handle it correctly.

**Solution:** Use `$100\\%$` or simply write `100%` as plain text since it doesn't need to be a formula.

### 3. Blockquote formulas centered instead of left-aligned (Screenshots 2, 3)

**Problem:** In the original Habr article, formulas within blockquotes are left-aligned. In the markdown, blockquote formulas using `> $$...$$` are centered by GitHub's renderer.

**Expected:** Formulas in blockquotes should be left-aligned as in the original.

**Root cause:** GitHub renders `$$...$$` as display math (centered). The original uses inline-style formulas that happen to be on their own line, left-aligned within blockquotes.

**Solution:** For blockquote formulas that should be left-aligned, use `> $\mathbf{...}$` (inline math with bold) instead of `> $$...$$`. Adding a non-breaking space or text after the formula can also force left-alignment. Alternatively, group multi-formula blockquotes into a single blockquote block.

### 4. Split blockquotes should be grouped (Screenshot 2)

**Problem:** In the original, a blockquote with multiple formulas (e.g., Example with `1→(1,1)`, `2→(2,2)`, `3→(1,2)`) is a single continuous blockquote. In the markdown, they are split into separate blockquotes with gaps between them.

**Expected:** Multiple formulas in a single blockquote should remain as one continuous blockquote.

**Root cause:** The script generates separate `> $$...$$` blocks for each formula instead of grouping them in one blockquote.

### 5. Bold formatting broken on Figure captions (Screenshot 6)

**Problem:** Figure 11 and Figure 12 captions have broken bold formatting:
- `**Figure 11. **In this image...` — space before closing `**` breaks the bold
- `**Figure 12. **Link blueprint designer...:** **[link]...` — same issue plus extra bold markers

**Expected:** `**Figure 11.** In this image...` — no space before closing `**`

**Root cause:** The `nodeToMarkdown` function produces `**text **` with a trailing space inside the bold markers when the source HTML has a space after the text within the `<strong>` element.

### 6. Inline formulas appearing as raw text (Screenshot 5)

**Problem:** Several formulas in the "links theory definitions" section appear as raw text instead of rendered formulas:
- `$\{anetv^n\}$` — curly braces cause issues
- `$l ∈ L$` — Unicode math symbols instead of LaTeX commands
- `$(L, L)$` — appears as raw text
- `$n ∈ ℕ_0$` — Unicode symbols
- `** n**` — bold formatting broken (space before text)

**Expected:** These should render as proper inline math formulas.

**Root cause:** Multiple issues:
1. Habr uses Unicode math symbols (∈, ℕ, ⊆, ∪) which GitHub LaTeX may not fully support
2. Curly braces `{}` in formulas may need escaping for GitHub
3. Bold markers with leading spaces (`** n**`) are invalid markdown

### 7. Missing tags, hubs, and author info at article end (Screenshot 7)

**Problem:** The original Habr article shows tags, hubs, karma, and author info at the bottom of the article. The markdown version doesn't include this information at the end.

**Expected:** Tags and hubs should be repeated at the end of the article (as they appear on the original page). Author metadata (karma, comments, bookmarks) should be included if available without login.

**Root cause:** The script only extracts metadata for the header block but doesn't add it to the footer.

## Affected Articles

All three articles are affected:
- `archive/0.0.0/article.md` — Math introduction to Deep Theory
- `archive/0.0.1/article.md` — Глубокая Теория Связей 0.0.1
- `archive/0.0.2/article.md` — The Links Theory 0.0.2

## Solution Plan

1. Fix `formatMetadataBlock()` to add blank lines between metadata fields
2. Fix `$100\%$` rendering — use plain text `100%` instead
3. Change blockquote formulas from `$$...$$` to left-aligned format using `$\mathbf{...}$`
4. Group multi-formula blockquotes into single continuous blockquotes
5. Fix bold formatting: trim trailing spaces inside `**...**` markers
6. Fix Unicode math symbols in formulas — convert to LaTeX equivalents
7. Add footer section with tags, hubs, and available author metadata
8. Re-download all articles with the updated script
9. Verify all articles pass verification
