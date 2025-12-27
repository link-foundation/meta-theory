#!/usr/bin/env node
/**
 * Experiment to extract LaTeX formulas from Habr articles
 *
 * Discovery: Habr formula images have a `source` attribute containing the LaTeX!
 * Example: <img class="formula inline" source="L \to L^2" alt="L \to L^2" ...>
 */
import { chromium } from 'playwright';

async function extractLatexFormulas(url) {
  console.log(`\n=== Extracting LaTeX from: ${url} ===\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });

  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });
  await page.waitForTimeout(3000);

  // Extract all formulas with their LaTeX source
  const formulas = await page.evaluate(() => {
    const article = document.querySelector('.article-formatted-body');
    if (!article) return { error: 'No article body found' };

    const result = [];

    // Find all formula images
    const formulaImgs = article.querySelectorAll('img.formula');
    console.log('Found formula images:', formulaImgs.length);

    formulaImgs.forEach((img, i) => {
      const sourceAttr = img.getAttribute('source');
      const altAttr = img.getAttribute('alt');
      const classAttr = img.className;
      const isInline = classAttr.includes('inline');

      result.push({
        index: i,
        source: sourceAttr,  // This is the LaTeX!
        alt: altAttr,
        isInline: isInline,
        class: classAttr,
        src: img.getAttribute('src')?.substring(0, 100)
      });
    });

    return result;
  });

  await browser.close();

  return formulas;
}

async function main() {
  // Test all three article URLs
  const urls = [
    { name: '0.0.0', url: 'https://habr.com/en/articles/658705/' },
    { name: '0.0.1', url: 'https://habr.com/ru/companies/deepfoundation/articles/804617/' },
    { name: '0.0.2', url: 'https://habr.com/en/articles/756654/' }
  ];

  console.log('========================================');
  console.log('LATEX FORMULA EXTRACTION RESULTS');
  console.log('========================================');

  for (const { name, url } of urls) {
    try {
      const formulas = await extractLatexFormulas(url);

      console.log(`\n--- Article ${name} ---`);

      if (formulas.error) {
        console.log('ERROR:', formulas.error);
        continue;
      }

      console.log(`Found ${formulas.length} formula(s) with source attribute`);

      formulas.forEach((f, i) => {
        console.log(`\n  [${i}] LaTeX: ${f.source || '(none)'}`);
        console.log(`       inline: ${f.isInline}`);
        if (f.source !== f.alt) {
          console.log(`       alt differs: ${f.alt}`);
        }
      });
    } catch (err) {
      console.log(`ERROR processing ${name}:`, err.message);
    }
  }

  console.log('\n========================================');
  console.log('CONCLUSION:');
  console.log('========================================');
  console.log('We CAN extract LaTeX formulas automatically!');
  console.log('The `source` attribute on img.formula elements contains the LaTeX source.');
  console.log('We need to update download-article.mjs to extract this.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
