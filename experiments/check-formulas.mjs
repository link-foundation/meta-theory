#!/usr/bin/env node
import { chromium } from 'playwright';

async function checkFormulas() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Test with the 0.0.0 article (English, has $$...$$ formulas)
  await page.goto('https://habr.com/en/articles/658705/', {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });
  
  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const content = await page.evaluate(() => {
    const article = document.querySelector('.article-formatted-body');
    if (!article) return null;
    
    // Get all paragraphs and their structure
    const paragraphs = [];
    const ps = article.querySelectorAll('p');
    for (const p of ps) {
      const text = p.innerText.trim();
      if (text.length > 0) {
        paragraphs.push({
          text: text.substring(0, 200),
          html: p.innerHTML.substring(0, 300)
        });
      }
    }
    
    // Get all images
    const images = [];
    const imgs = article.querySelectorAll('img');
    for (const img of imgs) {
      images.push({
        alt: img.alt,
        src: img.src.substring(0, 100)
      });
    }
    
    // Get headings
    const headings = [];
    const hs = article.querySelectorAll('h1, h2, h3, h4');
    for (const h of hs) {
      headings.push({
        tag: h.tagName,
        text: h.innerText
      });
    }
    
    // Get blockquotes
    const blockquotes = [];
    const bqs = article.querySelectorAll('blockquote');
    for (const bq of bqs) {
      blockquotes.push({
        text: bq.innerText.substring(0, 200),
        html: bq.innerHTML.substring(0, 300)
      });
    }
    
    return { paragraphs, images, headings, blockquotes };
  });
  
  await browser.close();
  
  console.log('=== HEADINGS ===');
  for (const h of content.headings) {
    console.log(`${h.tag}: ${h.text}`);
  }
  
  console.log('\n=== BLOCKQUOTES ===');
  for (const bq of content.blockquotes) {
    console.log(`Text: ${bq.text}`);
    console.log(`HTML: ${bq.html}`);
    console.log('---');
  }
  
  console.log('\n=== FIRST 5 PARAGRAPHS ===');
  for (let i = 0; i < Math.min(5, content.paragraphs.length); i++) {
    console.log(`[${i}] Text: ${content.paragraphs[i].text}`);
    console.log(`[${i}] HTML: ${content.paragraphs[i].html}`);
    console.log('---');
  }
  
  console.log('\n=== IMAGES (first 5) ===');
  for (let i = 0; i < Math.min(5, content.images.length); i++) {
    console.log(`[${i}] Alt: ${content.images[i].alt}`);
    console.log(`[${i}] Src: ${content.images[i].src}`);
    console.log('---');
  }
}

checkFormulas().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
