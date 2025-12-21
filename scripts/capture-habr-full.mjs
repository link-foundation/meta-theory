import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function captureHabrArticle() {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to Habr article...');
    await page.goto('https://habr.com/ru/articles/804617', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log('Waiting for main content to load...');
    await page.waitForSelector('.tm-article-presenter__content', { timeout: 30000 });

    console.log('Waiting for images to load...');
    // Wait for all images to load with timeout
    try {
      await Promise.race([
        page.evaluate(() => {
          return Promise.all(
            Array.from(document.images)
              .filter(img => !img.complete)
              .map(img => new Promise(resolve => {
                img.onload = img.onerror = resolve;
                // Timeout per image
                setTimeout(resolve, 5000);
              }))
          );
        }),
        new Promise(resolve => setTimeout(resolve, 10000)) // Overall timeout
      ]);
    } catch (error) {
      console.log('Some images may not have loaded completely:', error.message);
    }

    // Additional wait to ensure lazy-loaded content appears
    console.log('Waiting for lazy-loaded content...');
    await page.waitForTimeout(3000);

    // Scroll to bottom to trigger any lazy loading
    console.log('Scrolling to trigger lazy loading...');
    await page.evaluate(async () => {
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      for (let i = 0; i < document.body.scrollHeight; i += 100) {
        window.scrollTo(0, i);
        await delay(50);
      }
      // Scroll back to top
      window.scrollTo(0, 0);
      await delay(500);
    });

    // Wait a bit more for any animations
    await page.waitForTimeout(2000);

    console.log('Taking full page screenshot...');
    const outputPath = join(__dirname, '..', 'archive', '0.0.1', 'habr-article-full-page.png');
    await page.screenshot({
      path: outputPath,
      fullPage: true,
      animations: 'disabled',
      timeout: 60000
    });

    console.log(`Screenshot saved to: ${outputPath}`);

    // Get some stats about the page
    const stats = await page.evaluate(() => {
      return {
        imageCount: document.images.length,
        loadedImages: Array.from(document.images).filter(img => img.complete && img.naturalHeight > 0).length,
        bodyHeight: document.body.scrollHeight,
        title: document.title
      };
    });

    console.log('Page stats:', JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error('Error capturing page:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

captureHabrArticle().catch(error => {
  console.error('Failed:', error);
  process.exit(1);
});
