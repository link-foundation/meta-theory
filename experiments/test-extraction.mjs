#!/usr/bin/env node
import { chromium } from 'playwright';

async function testExtraction() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Test with the 0.0.1 article (Russian, lots of formulas)
  await page.goto('https://habr.com/ru/companies/deepfoundation/articles/804617/', {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });
  
  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Extract details about the page structure
  const analysis = await page.evaluate(() => {
    const article = document.querySelector('.article-formatted-body');
    if (!article) return { error: 'No article body found' };
    
    // 1. Find KaTeX elements
    const katexBlocks = article.querySelectorAll('.katex');
    const mathContainers = article.querySelectorAll('mjx-container');
    const mathSpans = article.querySelectorAll('.tm-article-body__math');
    
    // 2. Check for annotation elements (where LaTeX is stored)
    const annotations = article.querySelectorAll('annotation[encoding="application/x-tex"]');
    
    // 3. Sample a few elements
    const samples = [];
    
    // Sample code blocks
    const codeBlocks = article.querySelectorAll('pre');
    if (codeBlocks.length > 0) {
      const code = codeBlocks[0].querySelector('code');
      samples.push({
        type: 'code',
        outerHTML: codeBlocks[0].outerHTML.substring(0, 500),
        text: code ? code.textContent.substring(0, 200) : codeBlocks[0].textContent.substring(0, 200)
      });
    }
    
    // Sample headings
    const headings = article.querySelectorAll('h2, h3, h4');
    if (headings.length > 0) {
      samples.push({
        type: 'heading',
        tag: headings[0].tagName,
        text: headings[0].innerText
      });
    }
    
    // Sample math - try to find annotation
    if (annotations.length > 0) {
      samples.push({
        type: 'math-with-annotation',
        latex: annotations[0].textContent,
        parent: annotations[0].parentElement.outerHTML.substring(0, 300)
      });
    }
    
    // Check if math uses MathJax or KaTeX
    const hasMathJax = document.querySelector('mjx-container') !== null;
    const hasKaTeX = document.querySelector('.katex') !== null;
    
    // Sample a paragraph with inline math
    const paragraphs = article.querySelectorAll('p');
    for (const p of paragraphs) {
      if (p.querySelector('.katex, mjx-container, .tm-article-body__math')) {
        samples.push({
          type: 'paragraph-with-math',
          html: p.innerHTML.substring(0, 500),
          text: p.innerText.substring(0, 200)
        });
        break;
      }
    }
    
    // Sample lists
    const lists = article.querySelectorAll('ul, ol');
    if (lists.length > 0) {
      const items = lists[0].querySelectorAll('li');
      samples.push({
        type: 'list',
        tag: lists[0].tagName,
        items: Array.from(items).slice(0, 3).map(li => li.innerText.substring(0, 100))
      });
    }
    
    // Sample figures
    const figures = article.querySelectorAll('figure');
    if (figures.length > 0) {
      const fig = figures[0];
      const img = fig.querySelector('img');
      const caption = fig.querySelector('figcaption');
      samples.push({
        type: 'figure',
        imgSrc: img ? img.src.substring(0, 100) : null,
        caption: caption ? caption.innerText : null,
        html: fig.outerHTML.substring(0, 500)
      });
    }
    
    return {
      katexCount: katexBlocks.length,
      mathContainerCount: mathContainers.length,
      mathSpanCount: mathSpans.length,
      annotationCount: annotations.length,
      hasMathJax,
      hasKaTeX,
      samples
    };
  });
  
  await browser.close();
  
  console.log(JSON.stringify(analysis, null, 2));
}

testExtraction().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
