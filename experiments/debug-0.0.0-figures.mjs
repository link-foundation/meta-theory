#!/usr/bin/env node
import { chromium } from 'playwright';

async function debugFigures() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://habr.com/en/companies/deepfoundation/articles/658705/', {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  const figures = await page.$$eval('.article-formatted-body figure', elements =>
    elements.map(figure => {
      const img = figure.querySelector('img');
      const figcaption = figure.querySelector('figcaption');
      if (!img) return null;

      const captionText = figcaption?.innerText || '';
      const figureMatch = captionText.match(/(?:Figure|Рис\.?|Рисунок)\s*(\d+)/i);
      const figureNum = figureMatch ? parseInt(figureMatch[1]) : null;

      return {
        figureNum,
        src: img.src,
        isSvg: img.src.includes('.svg'),
        caption: captionText.substring(0, 80)
      };
    }).filter(f => f !== null)
  );

  console.log('Found figures:', figures.length);
  figures.forEach((f, i) => {
    console.log(`  [${i+1}] figureNum: ${f.figureNum}, isSvg: ${f.isSvg}`);
    console.log(`       src: ${f.src.substring(0, 80)}`);
    console.log(`       caption: ${f.caption}`);
  });

  await browser.close();
}

debugFigures().catch(console.error);
