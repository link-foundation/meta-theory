# Case Study: Issue #21 - Article Metadata Extraction

## Problem Statement

The automated article download script (`scripts/download-article.mjs`) successfully extracted article body content (headings, paragraphs, code blocks, formulas, figures, etc.) but did not extract the article's metadata. This metadata is prominently displayed on the Habr article pages above the body content and provides important context about the article.

## Timeline

1. **Issue reported**: The article download script produces markdown files that differ significantly from the original web page appearance. Specifically, metadata visible on the Habr page (author, date, reading time, difficulty, hubs, tags) was not being captured.

2. **Investigation**: Examination of the Habr article page HTML structure revealed metadata is rendered in a header area above the article body, using specific CSS classes:
   - `.tm-user-info__username` - Author username
   - `time[datetime]` - Publication date (ISO 8601 format in `datetime` attribute)
   - `.tm-article-reading-time__label` - Reading time
   - `.tm-article-complexity__label` - Difficulty level
   - `.tm-icon-counter__value` - View count
   - `.tm-publication-hub__link` - Hub/category links
   - `meta[name="keywords"]` - Tags (from HTML meta tags)
   - `.tm-article-presenter__origin` - Translation/original author info
   - `script[type="application/ld+json"]` - Structured data with additional metadata

3. **Fix implemented**: Added metadata extraction to `extractArticleContent()` in `download-article.mjs` and a new `formatMetadataBlock()` function to render metadata as markdown.

4. **Translation badge fix**: The "Original author" line was identified as a translation badge/panel that also contains a link to the original article. Updated extraction to use `.tm-publication-label_variant-translation` for article type detection and `.tm-article-presenter__origin-link` for the original article URL and author names.

5. **Screenshot improvements**: Updated `scripts/download.mjs` to capture screenshots in both light and dark themes using Playwright's `colorScheme` context option, with automatic popup/overlay closing via `closePopups()` function.

## Root Cause

The original `download-article.mjs` script used `page.evaluate()` to extract content only from the `.article-formatted-body` element, which is the article body container. The metadata (author, date, difficulty, hubs, tags) lives in the `.tm-article-presenter__header` area, which is a sibling element above the body - not inside it. The script simply never looked at this header area.

## Solution

### Changes to `scripts/download-article.mjs`

1. **New metadata extraction block** - Added a separate `page.evaluate()` call before the content extraction that queries metadata selectors in the page header area. This extracts:
   - Author name and profile URL (via `.tm-user-info__username`)
   - Author full name (from LD+JSON structured data)
   - Publication date (from `time[datetime]`)
   - Date modified (from LD+JSON)
   - Reading time, difficulty level, view count
   - Hubs/categories, tags/keywords
   - Original author info (for translated articles)

2. **New `formatMetadataBlock()` function** - Converts the extracted metadata object into formatted markdown lines that appear between the title and the article body, separated by a horizontal rule (`---`).

3. **Metadata attached to content** - The metadata object is added to the content return value so `contentToMarkdown()` can render it.

### Output Format

The metadata block is rendered as:

```markdown
# Article Title

**Author:** [Full Name (Username)](profile-url)
**Type:** Translation (if translation)
**Original article:** [Author1, Author2, ...](original-article-url) (if translation)
**Published:** Month Day, Year (updated Month Day, Year)
**Reading time: Xmin | Difficulty: Level | Views: Count**
**Hubs:** Hub1, Hub2, Hub3
**Tags:** tag1, tag2, tag3

---

Article body content...
```

### Screenshot Themes

Each article now has three screenshot files:
- `article-light.png` — captured with `colorScheme: 'light'` Playwright context
- `article-dark.png` — captured with `colorScheme: 'dark'` Playwright context
- `article.png` — default (copy of light theme, for backward compatibility)

Popups and overlays are automatically closed before screenshot capture using common Habr CSS selectors (cookie banners, modals, notifications).

## Data Collected

### Metadata extracted per article

| Field | 0.0.0 | 0.0.1 | 0.0.2 |
|-------|-------|-------|-------|
| Author | IvanSGlazunov | Konard | Konard |
| Full Name | Ivan Sergeevich Glazunov | Konstantin Diachenko | Konstantin Diachenko |
| Published | Apr 1, 2022 | Apr 1, 2024 | Apr 1, 2025 |
| Modified | Apr 1, 2024 | Mar 30, 2025 | Aug 10, 2025 |
| Reading Time | 4 min | 24 min | 27 min |
| Difficulty | Hard | Complex | Medium |
| Views | 4,792 | 10,526 | 5,164 |
| Hubs | 4 | 5 | 5 |
| Tags | 7 | 10 | 10 |
| Is Translation | No | Yes | Yes |

### Habr CSS Selectors Reference

| Metadata | Selector | Notes |
|----------|----------|-------|
| Author username | `.tm-user-info__username` | Username with link |
| Author full name | LD+JSON `author.name` | From structured data |
| Publish date | `time[datetime]` | ISO 8601 in `datetime` attr |
| Modified date | LD+JSON `dateModified` | From structured data |
| Reading time | `.tm-article-reading-time__label` | Text like "27 min" |
| Difficulty | `.tm-article-complexity__label` | "Easy", "Medium", "Hard" |
| Views | `.tm-icon-counter__value` | Count in `title` attribute |
| Hubs | `.tm-publication-hub__link span:first-child` | Hub name spans |
| Tags | `meta[name="keywords"]` | Comma-separated in content |
| Translation type | `.tm-publication-label_variant-translation` | "Translation"/"Перевод" |
| Original article | `.tm-article-presenter__origin-link` | Link + author names |

## Verification

All three articles were successfully downloaded with metadata and verified:
- 0.0.0: 7.2 KB with metadata, 100% verification pass rate
- 0.0.1: 45.5 KB with metadata, 94.6% verification pass rate
- 0.0.2: 57.0 KB with metadata, 94.7% verification pass rate

Light and dark themed screenshots generated for all 3 articles with no popup overlays.
