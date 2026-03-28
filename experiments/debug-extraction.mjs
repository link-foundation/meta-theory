#!/usr/bin/env node
/**
 * Debug: run the actual extraction and inspect the elements produced
 */
import { chromium } from 'playwright';

const ARTICLE_URL = 'https://habr.com/en/articles/895896/';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(ARTICLE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // Run the same extraction logic as the script but return raw elements
  const elements = await page.evaluate(() => {
    const articleBody = document.querySelector('.article-formatted-body');
    if (!articleBody) return [];

    function nodeToMarkdown(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = node.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'svg'].includes(tag)) return '';
      if (tag === 'a') {
        const href = node.getAttribute('href');
        const text = nodeToMarkdownChildren(node);
        return href && text ? `[${text}](${href})` : text;
      }
      if (tag === 'strong' || tag === 'b') { const t = nodeToMarkdownChildren(node); return t ? `**${t}**` : ''; }
      if (tag === 'em' || tag === 'i') { const t = nodeToMarkdownChildren(node); return t ? `*${t}*` : ''; }
      if (tag === 'code' && !node.closest('pre')) { return `\`${node.textContent}\``; }
      if (tag === 'br') return '\n';
      if (tag === 'img' && node.classList.contains('formula')) {
        const source = node.getAttribute('source');
        if (source) return `$${source.trim()}$`;
        const alt = node.getAttribute('alt');
        if (alt) return `$${alt.trim()}$`;
        return '';
      }
      if (tag === 'span') return nodeToMarkdownChildren(node);
      return nodeToMarkdownChildren(node);
    }

    function nodeToMarkdownChildren(node) {
      let result = '';
      for (const child of node.childNodes) result += nodeToMarkdown(child);
      return result;
    }

    // Find blockquotes and show how they're processed
    const results = [];
    const blockquotes = articleBody.querySelectorAll('blockquote');

    for (const bq of blockquotes) {
      const childParagraphs = Array.from(bq.querySelectorAll(':scope > p, :scope > div > p'));
      const childContents = childParagraphs.length > 0
        ? childParagraphs.map(p => nodeToMarkdownChildren(p).trim()).filter(Boolean)
        : [nodeToMarkdownChildren(bq).trim()];

      const formulaPattern = /^\s*\$([^$]+)\$\s*$/;
      const allFormulas = childContents.every(c => formulaPattern.test(c));

      results.push({
        childParagraphCount: childParagraphs.length,
        childContents,
        allFormulas,
        formulaMatches: childContents.map(c => {
          const m = c.match(formulaPattern);
          return m ? m[1] : null;
        })
      });
    }

    return results;
  });

  // Print only blockquotes with multiple children (the interesting ones)
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.childParagraphCount > 1 || !el.allFormulas) {
      console.log(`\nBlockquote ${i} (${el.childParagraphCount} paragraphs, allFormulas=${el.allFormulas}):`);
      for (let j = 0; j < el.childContents.length; j++) {
        console.log(`  [${j}] "${el.childContents[j]}" -> match: ${el.formulaMatches[j]}`);
      }
    }
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
