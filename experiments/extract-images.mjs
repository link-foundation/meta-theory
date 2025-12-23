#!/usr/bin/env node

/**
 * Script to extract all images from the article for analysis
 */

import { chromium } from 'playwright';

const ARTICLE_URL = 'https://habr.com/en/articles/895896';

async function extractImages() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to article...');
  await page.goto(ARTICLE_URL, {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  // Scroll to load all content
  console.log('Scrolling to load lazy images...');
  await page.evaluate(async () => {
    const scrollHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const scrollSteps = Math.ceil(scrollHeight / viewportHeight);
    for (let i = 0; i < scrollSteps; i++) {
      window.scrollTo(0, i * viewportHeight);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    window.scrollTo(0, 0);
  });

  await page.waitForTimeout(2000);

  // Extract all images from article-formatted-body
  console.log('Extracting images...');
  const images = await page.$$eval('.article-formatted-body img', elements =>
    elements.map(img => ({
      src: img.src,
      alt: img.alt,
      title: img.title,
      parentFigure: img.closest('figure') ? true : false,
      figCaption: img.closest('figure')?.querySelector('figcaption')?.innerText || '',
      width: img.naturalWidth,
      height: img.naturalHeight
    }))
  );

  // Separate formula images from figure images
  const formulaImages = images.filter(img =>
    img.src.includes('latex') ||
    img.src.includes('math') ||
    img.src.includes('formula') ||
    img.src.includes('tex') ||
    img.alt.includes('\\') ||
    img.alt.includes('mathbf') ||
    img.width < 300
  );

  const figureImages = images.filter(img =>
    img.parentFigure ||
    img.figCaption.includes('Figure') ||
    img.figCaption.includes('Рис.')
  );

  const otherImages = images.filter(img =>
    !formulaImages.includes(img) && !figureImages.includes(img)
  );

  console.log('\n=== FORMULA/MATH IMAGES ===');
  console.log(`Total: ${formulaImages.length}`);
  formulaImages.slice(0, 10).forEach((img, i) => {
    console.log(`\n[${i}] alt: "${img.alt.substring(0, 50)}..."`);
    console.log(`    src: ${img.src.substring(0, 100)}...`);
  });

  console.log('\n=== FIGURE IMAGES (with captions) ===');
  console.log(`Total: ${figureImages.length}`);
  figureImages.forEach((img, i) => {
    console.log(`\n[${i}] caption: "${img.figCaption.substring(0, 80)}..."`);
    console.log(`    alt: "${img.alt.substring(0, 80)}..."`);
    console.log(`    src: ${img.src}`);
    console.log(`    size: ${img.width}x${img.height}`);
  });

  console.log('\n=== OTHER IMAGES ===');
  console.log(`Total: ${otherImages.length}`);
  otherImages.forEach((img, i) => {
    console.log(`\n[${i}] alt: "${img.alt.substring(0, 80)}..."`);
    console.log(`    src: ${img.src}`);
    console.log(`    size: ${img.width}x${img.height}`);
  });

  await browser.close();

  return { formulaImages, figureImages, otherImages };
}

extractImages()
  .then(result => {
    console.log('\n=== SUMMARY ===');
    console.log(`Formula images: ${result.formulaImages.length}`);
    console.log(`Figure images: ${result.figureImages.length}`);
    console.log(`Other images: ${result.otherImages.length}`);
  })
  .catch(console.error);
