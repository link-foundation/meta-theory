# The Links Theory 0.0.2 - Article Archive

This directory contains the archived version of "The Links Theory 0.0.2" article originally published at https://habr.com/en/articles/895896

## Contents

- **article.md** - Complete markdown reproduction of the article with GitHub-compatible math formulas
- **article.png** - Full-page screenshot of the original web article (1920×37510px, 7.5MB)
- **images/** - Directory containing all 13 figure images from the article:
  - `figure-1.png` through `figure-13.jpg` - All figures referenced in the article
  - `metadata.json` - Metadata about downloaded images (figure number, filename, caption)

## Verification

The markdown article has been verified against the original web page using automated tests to ensure all content has been accurately reproduced.

### Running Tests

The repository includes automated verification scripts using both Playwright and Puppeteer:

```bash
# Run all tests (both Playwright and Puppeteer)
npm test

# Run Playwright verification only
npm run test:playwright

# Run Puppeteer verification only
npm run test:puppeteer
```

### Test Scripts

The verification scripts are located in `./scripts/`:

- **verify-article-playwright.mjs** - Playwright-based verification
- **verify-article-puppeteer.mjs** - Puppeteer-based verification (alternative)
- **debug-selectors.mjs** - Debug utility for HTML selector development

### How Verification Works

The automated tests:

1. **Load the web page** using Playwright or Puppeteer with proper wait conditions
2. **Extract content** from the original article:
   - Headings (h1, h2, h3, h4)
   - Paragraphs
   - Code blocks
   - Math formulas
   - List items
   - Links
3. **Filter out non-article content** (navigation, ads, cookie consent dialogs, etc.)
4. **Compare with markdown** using fuzzy matching to account for formatting differences
5. **Generate report** with pass/fail results

### Test Criteria

- Tests verify a representative sample of content (headings, first/last paragraphs, code blocks, list items)
- Pass threshold: **85%** match rate
- Code blocks use fuzzy matching (80% of lines must match) to account for whitespace differences
- Navigation elements and dynamic content are excluded from verification

### Test Output Example

```
🚀 Starting article verification with Playwright

================================================================================
🌐 Loading web page: https://habr.com/en/articles/895896
✅ Extracted content from web page:
   - Title: "The Links Theory 0.0.2"
   - 33 headings
   - 108 paragraphs
   - 14 code blocks
   - 0 formulas
   - 25 list items
   - 148 links

📖 Reading markdown file: ./archive/0.0.2/article.md
✅ Loaded markdown file (57202 characters, 897 lines)

🔍 Verifying markdown content...

📌 Checking article title...
   ✅ Title found: "The Links Theory 0.0.2"

📌 Checking headings...
📄 Checking sample paragraphs (first 5 and last 5)...
💻 Checking code blocks...
📋 Checking sample list items (first 10)...
🖼️ Checking figure images...
   ✅ All 13 figure images found in markdown

================================================================================
📊 VERIFICATION RESULTS
================================================================================
✅ Passed: 69/69 checks (100.0%)
❌ Failed: 0/69 checks

🎉 SUCCESS! All checked content from the web page exists in the markdown file.
```

## Math Formula Conversion

All mathematical formulas have been converted from the original HTML/Unicode format to GitHub-compatible LaTeX:

- Block formulas: Wrapped in `$$...$$`
- Inline formulas: Using LaTeX syntax within backticks
- Unicode symbols (→, ×, ⊆, ℕ, ²) converted to LaTeX equivalents

### Examples

Original (Unicode): `L → L²`

Markdown (LaTeX): `$$L \to L^2$$`

## Maintenance

To update the article or re-verify:

1. Edit `article.md` with any changes
2. Run `npm run test:verify` to ensure content integrity
3. Optionally regenerate screenshot using `node scripts/capture-full-page.mjs` or `node scripts/capture-full-page-v2.mjs`

## Archive Metadata

- **Original URL**: https://habr.com/en/articles/895896
- **Original Authors**: Vasily Solopov, Roman Vertushkin, Ivan Glazunov, Konstantin Diachenko
- **Archive Date**: December 2024
- **Format**: Markdown with GitHub-compatible LaTeX
- **Verification**: Automated Playwright/Puppeteer tests
- **Screenshot**: Full-page capture at 1920px width
