#!/usr/bin/env node

/**
 * Experiment: Inspect code blocks and formulas on Habr article page
 * to understand HTML structure and identify language classes
 */

import { chromium } from 'playwright';

const ARTICLE_URL = 'https://habr.com/en/articles/895896/';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  await page.goto(ARTICLE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // Inspect code blocks
  const codeBlocks = await page.evaluate(() => {
    const articleBody = document.querySelector('.article-formatted-body');
    if (!articleBody) return [];

    const pres = articleBody.querySelectorAll('pre');
    return Array.from(pres).map((pre, i) => {
      const codeEl = pre.querySelector('code');
      return {
        index: i,
        preClasses: pre.className,
        codeClasses: codeEl ? codeEl.className : null,
        codeDataLang: codeEl ? codeEl.getAttribute('data-lang') : null,
        preDataLang: pre.getAttribute('data-lang'),
        preDataCode: pre.getAttribute('data-code'),
        languageMatch: codeEl?.className?.match(/language-(\w+)/)?.[1] || null,
        firstLine: (codeEl || pre).textContent.split('\n')[0].substring(0, 80),
        fullHTML: pre.outerHTML.substring(0, 500)
      };
    });
  });

  console.log('\n=== CODE BLOCKS ===');
  for (const cb of codeBlocks) {
    console.log(`\nCode block ${cb.index}:`);
    console.log(`  pre classes: "${cb.preClasses}"`);
    console.log(`  code classes: "${cb.codeClasses}"`);
    console.log(`  code data-lang: "${cb.codeDataLang}"`);
    console.log(`  pre data-lang: "${cb.preDataLang}"`);
    console.log(`  pre data-code: "${cb.preDataCode}"`);
    console.log(`  language match: "${cb.languageMatch}"`);
    console.log(`  first line: "${cb.firstLine}"`);
    console.log(`  html: ${cb.fullHTML}`);
  }

  // Inspect formulas - look at formula images and their source attributes
  const formulas = await page.evaluate(() => {
    const articleBody = document.querySelector('.article-formatted-body');
    if (!articleBody) return [];

    const formulaImgs = articleBody.querySelectorAll('img.formula');
    return Array.from(formulaImgs).map((img, i) => {
      const parent = img.parentElement;
      const grandparent = parent?.parentElement;
      return {
        index: i,
        source: img.getAttribute('source'),
        alt: img.getAttribute('alt'),
        className: img.className,
        parentTag: parent?.tagName,
        parentClass: parent?.className,
        grandparentTag: grandparent?.tagName,
        grandparentClass: grandparent?.className,
        isInBlockquote: !!img.closest('blockquote'),
        isInParagraph: !!img.closest('p'),
        isStandalone: parent?.tagName === 'DIV' || parent?.tagName === 'P',
        prevSiblingText: img.previousSibling?.textContent?.slice(-30) || null,
        nextSiblingText: img.nextSibling?.textContent?.slice(0, 30) || null
      };
    });
  });

  console.log('\n=== FORMULAS ===');
  for (const f of formulas) {
    console.log(`\nFormula ${f.index}:`);
    console.log(`  source: "${f.source}"`);
    console.log(`  parent: ${f.parentTag}.${f.parentClass}`);
    console.log(`  grandparent: ${f.grandparentTag}.${f.grandparentClass}`);
    console.log(`  in blockquote: ${f.isInBlockquote}`);
    console.log(`  in paragraph: ${f.isInParagraph}`);
    console.log(`  standalone: ${f.isStandalone}`);
    console.log(`  prev sibling text: "${f.prevSiblingText}"`);
    console.log(`  next sibling text: "${f.nextSiblingText}"`);
  }

  // Also check: are there paragraphs that contain ONLY formula images (these should be block formulas)
  const formulaParagraphs = await page.evaluate(() => {
    const articleBody = document.querySelector('.article-formatted-body');
    if (!articleBody) return [];

    const paragraphs = articleBody.querySelectorAll('p');
    const results = [];
    for (const p of paragraphs) {
      const formulas = p.querySelectorAll('img.formula');
      if (formulas.length === 0) continue;

      // Check if paragraph has mostly formula content
      const textContent = p.textContent.trim();
      const formulaSources = Array.from(formulas).map(f => f.getAttribute('source'));

      results.push({
        textContent: textContent.substring(0, 100),
        formulaCount: formulas.length,
        formulaSources,
        childNodeCount: p.childNodes.length,
        childTypes: Array.from(p.childNodes).map(n =>
          n.nodeType === 3 ? `TEXT:"${n.textContent.substring(0,30)}"` : n.tagName + (n.className ? '.' + n.className : '')
        )
      });
    }
    return results;
  });

  console.log('\n=== PARAGRAPHS WITH FORMULAS ===');
  for (const p of formulaParagraphs) {
    console.log(`\nParagraph (${p.formulaCount} formulas, ${p.childNodeCount} children):`);
    console.log(`  text: "${p.textContent}"`);
    console.log(`  formulas: ${JSON.stringify(p.formulaSources)}`);
    console.log(`  children: ${JSON.stringify(p.childTypes)}`);
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
