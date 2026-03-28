# Case Study: Issue #23 - Code Block Language Detection and Formula Rendering

## Overview

**Issue:** [#23 - Continue to reduce differences between original articles and downloaded/exported versions](https://github.com/link-foundation/meta-theory/issues/23)
**Pull Request:** [#24](https://github.com/link-foundation/meta-theory/pull/24)
**Date:** March 28, 2026
**Status:** Resolved

## Problem Statement

Two categories of differences were identified between the original Habr articles and the downloaded markdown versions:

1. **Missing code block language specifiers** - Code blocks in the markdown files used bare ` ``` ` fences without language identifiers, resulting in no syntax highlighting when rendered on GitHub.

2. **Broken formula rendering** - LaTeX math formulas had multiple rendering issues on GitHub:
   - Trailing spaces inside formula delimiters (e.g., `$L $` instead of `$L$`)
   - Leading spaces inside formula delimiters (e.g., `$ L \times L$` instead of `$L \times L$`)
   - Multi-formula blockquotes collapsed onto a single line
   - Missing spaces between formulas and adjacent text

## Timeline of Events

### Prior context
- **Issue #9** (Dec 2025): Initial formula extraction from Habr SVG/PNG images to LaTeX
- **Issue #21** (Mar 2026): Metadata extraction improvements
- **Issue #23** (Mar 2026): Reported remaining differences in code blocks and formulas

### Investigation (March 28, 2026)

1. **Screenshot analysis**: The issue screenshot showed a side-by-side comparison of GitHub (left) vs Habr (right) for the 0.0.2 article's "Duplets" section, revealing:
   - Code blocks on GitHub had no syntax highlighting
   - Formulas like `$L $` rendered as plain text instead of math

2. **HTML structure inspection**: Created experiment scripts to inspect the Habr page DOM:
   - `experiments/inspect-code-blocks.mjs` - Revealed code block class structure
   - `experiments/debug-blockquote-formulas.mjs` - Revealed blockquote paragraph structure
   - `experiments/debug-extraction.mjs` - Verified extraction logic

3. **Root cause identification**: Three distinct root causes found (see below)

4. **Fix implementation and verification**: All fixes applied, articles re-downloaded, 100% verification pass rate

## Root Cause Analysis

### Root Cause 1: Code Block Language Detection

**Problem:** The download script used the regex `/language-(\w+)/` to extract the programming language from `<code>` elements inside `<pre>` blocks.

**Finding:** Habr does NOT use the standard `language-xxx` CSS class pattern. Instead, it applies the language name directly as a bare class:
```html
<!-- What Habr actually uses: -->
<pre><code class="python">...</code></pre>

<!-- What the regex expected: -->
<pre><code class="language-python">...</code></pre>
```

**Evidence (from `inspect-code-blocks.mjs`):**
| Code Block | Habr Class | Content Type | Regex Result |
|-----------|------------|--------------|-------------|
| Block 0 | `"python"` | Set theory notation (L = {1, 2}) | `null` (no match) |
| Block 1 | `"python"` | Set theory notation (L x L x L) | `null` (no match) |
| Block 2 | `"matlab"` | Coq proof definitions | `null` (no match) |
| Block 3-6 | `"matlab"` | Coq proofs and lemmas | `null` (no match) |

**Additional finding:** Habr misidentifies Coq code as `matlab`. The Coq Proof Assistant has syntax that superficially resembles MATLAB to naive classifiers.

**Fix:**
1. Updated regex to also match bare class names: `codeEl?.className?.match(/^(\w+)$/)?.[1]`
2. Added content-based Coq detection: checks for keywords like `Require Import`, `Definition`, `Fixpoint`, `Lemma`, `Theorem`, `Proof`, `Qed`

### Root Cause 2: Formula Spacing (Post-Processing Regex Flaws)

**Problem:** The `postProcessMarkdown()` function used regex-based formulas spacing that fundamentally cannot distinguish between opening and closing `$` delimiters.

**Mechanism of failure:**

The regex `([a-zA-Z])(\$[^$\n]+\$)` (intended to add space before formulas) when applied to text like:
```
the set $L$ contains only $2$ references
```
Would match `L$ contains only $` as a "formula" (from the closing `$` of `$L$` to the opening `$` of `$2$`), producing:
```
the set $L $ contains only $2$ references
```

A second regex `\$\s+([^$\n]+?)\s+\$` (intended to trim whitespace inside formulas) used `\s+` which matches newlines, causing it to match from the `$` at the end of one line to the `$` at the start of another, collapsing separate blockquote formulas:
```
> $$1 \to (1, 1)$$        →    > $$1 \to (1, 1)$$>$$2 \to (2, 2)$$
                                (collapsed to single line!)
> $$2 \to (2, 2)$$
```

**Fix:** Replaced all regex-based formula spacing with a **token-based parser** that:
1. Scans each line left-to-right, tracking opening/closing `$` delimiters
2. Correctly identifies formula boundaries
3. Trims internal whitespace within identified formulas
4. Adds spaces between formulas and adjacent word characters

### Root Cause 3: Multi-Formula Blockquotes

**Problem:** Habr blockquotes with multiple formulas use separate `<p>` elements for each formula:
```html
<blockquote>
  <p><img class="formula" source="1 \to (1, 1)"></p>
  <p><img class="formula" source="2 \to (2, 2)"></p>
  <p><img class="formula" source="\mathbf{3 \to (1, 2)}"></p>
</blockquote>
```

The original code called `nodeToMarkdownChildren(blockquote)` which concatenated all content into one string, producing:
```
$1 \to (1, 1)$$2 \to (2, 2)$$\mathbf{3 \to (1, 2)}$
```

**Fix:** Process each `<p>` child of the blockquote individually using `querySelectorAll(':scope > p')`. Each formula-only paragraph produces its own `blockquote-math` element.

### Root Cause 4: Formula Source Attribute Whitespace

**Problem:** The `source` attribute on Habr's formula `<img>` elements sometimes contains leading/trailing whitespace (e.g., `source=" ⊆"`). This whitespace was preserved when wrapping in `$...$`, producing `$ ⊆$` which GitHub cannot render.

**Fix:** Added `.trim()` to all formula source extraction points.

## Habr Formula Architecture

Habr renders LaTeX formulas as SVG/PNG images with the following structure:

```html
<img class="formula inline"
     source="\mathbf{R \subseteq S_1 \times S_2}"  ← LaTeX source
     alt="\mathbf{R \subseteq S_1 \times S_2}"     ← Same as source
     src="https://habrastorage.org/.../formula.svg"  ← Rendered image
     width="..." height="...">
```

Key architectural facts:
- The LaTeX source is stored in a non-standard `source` attribute (not `data-source` or similar)
- The `alt` attribute duplicates the LaTeX source
- Formulas are always rendered as `<img>` elements with class `formula`
- Block formulas are wrapped in `<blockquote><p>` structures
- Inline formulas appear directly within `<p>` elements alongside text

## GitHub Math Rendering Requirements

GitHub's markdown math rendering (using MathJax) has specific requirements:
- **Inline math** (`$...$`): NO space allowed after opening `$` or before closing `$`
  - `$L$` renders correctly
  - `$L $` or `$ L$` does NOT render (shown as literal text)
- **Block math** (`$$...$$`): More forgiving with whitespace
- Block math in blockquotes: `> $$formula$$` works correctly

## Data Collected

### Experiment logs saved to repository

| File | Purpose |
|------|---------|
| `experiments/inspect-code-blocks.mjs` | Inspect Habr code block HTML structure |
| `experiments/debug-blockquote-formulas.mjs` | Inspect blockquote child structure |
| `experiments/debug-extraction.mjs` | Verify formula extraction logic |
| `experiments/test-postprocess4.mjs` | Unit tests for post-processing |

### Code block languages detected

| Article | Block | Habr Class | Detected Language | Content |
|---------|-------|------------|-------------------|---------|
| 0.0.0 | 1, 2 | `python` | `python` | Set theory notation |
| 0.0.1 | 1, 2 | `python` | `python` | Set theory notation |
| 0.0.1 | 3-7 | `matlab` | `coq` | Coq proof assistant |
| 0.0.2 | 1, 2 | `python` | `python` | Set theory notation |
| 0.0.2 | 3-7 | `matlab` | `coq` | Coq proof assistant |

### Formula issues fixed per article

| Article | Total Formulas | Spacing Fixed | Blockquote Fixed |
|---------|---------------|---------------|-----------------|
| 0.0.0 | ~10 | Minor | N/A |
| 0.0.1 | ~80 | Multiple | 3 multi-formula blockquotes |
| 0.0.2 | ~85 | Multiple | 3 multi-formula blockquotes |

## GitHub Math Rendering: Known Issues and Workarounds

GitHub's math rendering (MathJax-based) has several known limitations beyond the spacing issue we fixed:

| Issue | Description | Workaround |
|-------|-------------|------------|
| **Spacing** | `$L $` or `$ L$` won't render | Trim whitespace inside `$...$` (our fix) |
| **Markdown links** | `$[a+b](c+d)$` parsed as link | Use `$`\`...\``$` syntax |
| **Backticks** | Backticks inside `$...$` trigger code | Use `$`\`...\``$` syntax |
| **Underscores** | `$a_b$` may trigger italic | Escape or use `$`\`...\``$` |
| **Lists/tables** | Math may not render in lists | GitHub limitation, no workaround |
| **Dollar escaping** | `$\$4 + \$5$` fails | Known bug |

**Robust alternative:** GitHub supports `` $` `` ... `` `$ `` as a more robust inline math syntax, and ` ```math ` code blocks for display math. However, these are GitHub-specific and reduce portability.

**Sources:**
- [GitHub Docs: Writing mathematical expressions](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/writing-mathematical-expressions)
- [Math on GitHub: The Good, the Bad and the Ugly](https://nschloe.github.io/2022/05/20/math-on-github.html)
- [GitHub Community Discussion #19953](https://github.com/orgs/community/discussions/19953)

## Existing Tools and Libraries

### HTML to Markdown with Math Support

| Tool | Approach | LaTeX Support | Notes |
|------|----------|--------------|-------|
| **[Turndown](https://github.com/mixmark-io/turndown)** | DOM-based HTML→MD | Plugin-based | Popular, supports custom rules via `addRule()`, but no built-in formula support |
| **[Pandoc](https://pandoc.org)** | Haskell-based converter | Native | Excellent math support with `--mathjax` and `-t markdown+tex_math_dollars`, but doesn't handle Habr's custom `source` attribute |
| **[rehype-katex](https://github.com/remarkjs/remark-math) / remark-math** | unified.js ecosystem | Native | For markdown-to-HTML rendering, NOT HTML-to-markdown extraction |
| **[markdown-habr](https://github.com/andrienko/markdown-habr)** | Markdown→Habr HTML | N/A | Converts markdown TO Habr format (opposite direction) |

### Code Language Detection

| Tool | Approach | Notes |
|------|----------|-------|
| **[highlight.js](https://github.com/highlightjs/highlight.js)** | Keyword/pattern heuristics | `highlightAuto()` detects from 180+ languages. Best fit for snippet-level detection. |
| **[@vscode/vscode-languagedetection](https://github.com/microsoft/vscode-languagedetection)** | ML (TensorFlow.js) | More accurate but heavier dependency |
| **[lang-detector](https://github.com/ts95/lang-detector)** | Lightweight heuristics | Fast but limited language support |
| **[linguist](https://github.com/github-linguist/linguist)** | GitHub's classifier | File-level detection, not suitable for code snippets |

**Recommendation:** `highlight.js` with `highlightAuto()` could replace/supplement the current manual Coq detection logic for more robust language identification.

### Habr-Specific Considerations

No known open-source tools specifically handle Habr's formula `source` attribute extraction. This is a custom implementation requirement because:
1. Habr uses a non-standard `source` attribute (not a standard HTML5 data attribute)
2. The formulas are rendered as images, not as MathML or KaTeX HTML
3. The CSS class `formula` and `inline` are Habr-specific
4. The Habr Markdown help page does not document formula/LaTeX support at all — formulas appear to be an editor feature using proprietary HTML markup

### Potential Upstream Issues

**Habr's language misidentification**: The Habr platform labels Coq code as `matlab`. This could be reported as a bug to Habr, but:
- Habr may intentionally use a limited set of language classifiers
- The code highlighting on Habr itself uses generic span classes (`ͼ5`, `ͼ6`, etc.) suggesting a custom highlighting system
- Content-based correction at the extraction level (our approach) is more reliable

## Verification Results

After applying all fixes, verification passes 100% across all articles:

| Article | Checks | Pass Rate |
|---------|--------|-----------|
| 0.0.0 | 35/35 | 100% |
| 0.0.1 | 92/92 | 100% |
| 0.0.2 | 95/95 | 100% |

## Solution Summary

### Changes to `scripts/download-article.mjs`

1. **Code block language detection** (line ~358):
   - Added fallback regex for bare CSS class names
   - Added content-based Coq language detection

2. **Formula source trimming** (line ~280):
   - Added `.trim()` to all `source` attribute reads

3. **Blockquote processing** (line ~383):
   - Process `<p>` children individually with `querySelectorAll(':scope > p')`
   - Each formula-only paragraph produces its own element

4. **Post-processing rewrite** (line ~555):
   - Replaced regex-based formula spacing with token-based parser
   - Correctly tracks opening/closing `$` delimiters
   - Handles inline whitespace trimming without crossing line boundaries

### Articles re-downloaded
All three articles (0.0.0, 0.0.1, 0.0.2) re-downloaded as both `article.md` and `downloaded.md` with all fixes applied.
