# Archive 0.0.0 - Math introduction to Deep Theory

This directory contains an archived version of the Habr article "Math introduction to Deep Theory" by Ivan Sergeevich Glazunov.

## Files

- **`math_introduction_to_deep_theory.md`** - Complete markdown conversion of the article with:
  - All original content preserved
  - GitHub-supported LaTeX math expressions (using `$` and `$$` syntax)
  - All images referenced from original sources
  - Proper formatting and structure

- **`habr_article_full_page.png`** - Screenshot of the original article page for verification purposes

## Article Details

**Title:** Math introduction to Deep Theory
**Author:** Ivan Sergeevich Glazunov
**Published:** April 1, 2022
**Source:** https://habr.com/en/articles/658705/

## Content Summary

The article compares three fundamental data modeling approaches:

1. **Relational algebra** - Based on n-tuples and relations (tables)
2. **Directed graphs** - Based on vertices and edges (2-tuples)
3. **Associative theory** - Based on links as n-tuples of references to links

### Key Concepts

- **Doublets (2-tuples)**: Can link objects with properties AND link doublets together
- **Triplets (3-tuples)**: Useful for specifying types and values directly
- **Sequences (n-tuples)**: General case of variable-length tuples

### Key Insight

The associative model unifies SQL and NoSQL approaches, allowing representation of any data structure using just 2-3 columns plus IDs, while maintaining flexibility comparable to both relational and graph models.

## Technical Implementation

### Math Expressions

The markdown includes GitHub-supported LaTeX math expressions:

- **Inline math**: `$n \geq 2$` renders as: $n \geq 2$
- **Block math**:
  ```
  $$R \subseteq S_1 \times S_2 \times \ldots \times S_n$$
  ```

  Renders as:

  $$R \subseteq S_1 \times S_2 \times \ldots \times S_n$$

### Images

All diagrams and formulas are referenced from the original Habr storage:
- Relational algebra formula
- Directed graph formula
- Doublets diagrams and formulas
- Triplets diagrams and formulas
- Sequences formulas
- Comparison diagrams
- Reference images

## Screenshot Note

The screenshot `habr_article_full_page.png` was captured using Playwright MCP. While it may show some rendering artifacts (blank spaces) due to page loading timing, the complete content has been verified and is fully preserved in the markdown file. All text content, mathematical formulas, code examples, and image references are complete and accurate.

## Verification

To verify content completeness:
- 9 main sections (Introduction through References)
- 5 LaTeX math formula blocks
- 15 image references to original sources
- All code blocks with examples
- Complete text content including conclusions

## Scripts

Capture scripts are available in the `/scripts` directory:
- `capture_article.mjs` - Playwright-based capture script
- `capture_with_puppeteer.mjs` - Puppeteer-based capture script
- `capture_via_mcp.mjs` - MCP-compatible capture script

These scripts demonstrate different approaches to capturing web content, though they may encounter QRATOR DDoS protection when running outside of authenticated browser sessions.
