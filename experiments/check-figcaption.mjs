import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://habr.com/en/articles/895896/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.article-formatted-body', { timeout: 30000 });

// Check figcaption HTML for figures 11 and 12
const captions = await page.$$eval('figcaption', els => els.map((el, i) => ({
  index: i + 1,
  html: el.innerHTML.substring(0, 300),
  text: el.innerText.substring(0, 200)
})));

for (const cap of captions) {
  if (cap.index >= 11) {
    console.log(`\n=== Figure ${cap.index} ===`);
    console.log('HTML:', cap.html);
    console.log('Text:', cap.text);
  }
}

await browser.close();
