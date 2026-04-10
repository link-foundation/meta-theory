#!/usr/bin/env node

/**
 * Integration test for web-capture migration.
 *
 * Validates that all web-capture imports work correctly and the
 * migrated scripts maintain API compatibility.
 */

import { strict as assert } from 'assert';

// Test web-capture module imports
console.log('🧪 Testing web-capture integration...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`   ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`   ❌ ${name}: ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`   ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`   ❌ ${name}: ${err.message}`);
    failed++;
  }
}

// 1. Test web-capture lib imports
console.log('1. Core library imports');
await asyncTest('convertHtmlToMarkdownEnhanced import', async () => {
  const { convertHtmlToMarkdownEnhanced } = await import('@link-assistant/web-capture/src/lib.js');
  assert.equal(typeof convertHtmlToMarkdownEnhanced, 'function');
});

await asyncTest('fetchHtml import', async () => {
  const { fetchHtml } = await import('@link-assistant/web-capture/src/lib.js');
  assert.equal(typeof fetchHtml, 'function');
});

await asyncTest('convertHtmlToMarkdown import', async () => {
  const { convertHtmlToMarkdown } = await import('@link-assistant/web-capture/src/lib.js');
  assert.equal(typeof convertHtmlToMarkdown, 'function');
});

// 2. Test metadata module
console.log('\n2. Metadata module');
await asyncTest('extractMetadata import', async () => {
  const { extractMetadata } = await import('@link-assistant/web-capture/src/metadata.js');
  assert.equal(typeof extractMetadata, 'function');
});

await asyncTest('formatMetadataBlock import', async () => {
  const { formatMetadataBlock } = await import('@link-assistant/web-capture/src/metadata.js');
  assert.equal(typeof formatMetadataBlock, 'function');
  // Test with empty metadata
  const result = formatMetadataBlock({});
  assert.ok(Array.isArray(result));
});

await asyncTest('formatFooterBlock import', async () => {
  const { formatFooterBlock } = await import('@link-assistant/web-capture/src/metadata.js');
  assert.equal(typeof formatFooterBlock, 'function');
  const result = formatFooterBlock({ author: 'Test', votes: '42' });
  assert.ok(result.length > 0);
  assert.ok(result.some(l => l.includes('Test')));
});

// 3. Test postprocess module
console.log('\n3. Post-processing module');
await asyncTest('postProcessMarkdown import and basic usage', async () => {
  const { postProcessMarkdown } = await import('@link-assistant/web-capture/src/postprocess.js');
  assert.equal(typeof postProcessMarkdown, 'function');
  // Test unicode normalization
  const result = postProcessMarkdown('Hello\u00A0World');
  assert.equal(result, 'Hello World');
});

await asyncTest('applyLatexSpacingFixes import', async () => {
  const { applyLatexSpacingFixes } = await import('@link-assistant/web-capture/src/postprocess.js');
  assert.equal(typeof applyLatexSpacingFixes, 'function');
  // Test that formula spacing is fixed
  const result = applyLatexSpacingFixes('text$x$more');
  assert.ok(result.includes(' $x$ '));
});

// 4. Test localize-images module
console.log('\n4. Image localization module');
await asyncTest('localizeImages import', async () => {
  const { localizeImages } = await import('@link-assistant/web-capture/src/localize-images.js');
  assert.equal(typeof localizeImages, 'function');
});

await asyncTest('extractImageReferences import and usage', async () => {
  const { extractImageReferences } = await import('@link-assistant/web-capture/src/localize-images.js');
  assert.equal(typeof extractImageReferences, 'function');
  const refs = extractImageReferences('![alt](https://example.com/img.png)');
  assert.equal(refs.length, 1);
  assert.equal(refs[0].url, 'https://example.com/img.png');
  assert.equal(refs[0].altText, 'alt');
});

await asyncTest('localizeImages dry run', async () => {
  const { localizeImages } = await import('@link-assistant/web-capture/src/localize-images.js');
  const result = await localizeImages('![test](https://example.com/test.png)', {
    imagesDir: 'images',
    dryRun: true
  });
  assert.equal(result.total, 1);
  assert.ok(result.markdown.includes('images/'));
});

// 5. Test figures module
console.log('\n5. Figures module');
await asyncTest('extractFigures import', async () => {
  const { extractFigures } = await import('@link-assistant/web-capture/src/figures.js');
  assert.equal(typeof extractFigures, 'function');
  const figures = extractFigures('<figure><img src="test.png" alt="Fig 1"><figcaption>Figure 1</figcaption></figure>', 'https://example.com');
  assert.equal(figures.length, 1);
  assert.equal(figures[0].figureNum, 1);
});

// 6. Test themed-image module
console.log('\n6. Themed image module');
await asyncTest('captureDualThemeScreenshots import', async () => {
  const { captureDualThemeScreenshots } = await import('@link-assistant/web-capture/src/themed-image.js');
  assert.equal(typeof captureDualThemeScreenshots, 'function');
});

// 7. Test animation module
console.log('\n7. Animation module');
await asyncTest('captureAnimationFrames import', async () => {
  const { captureAnimationFrames } = await import('@link-assistant/web-capture/src/animation.js');
  assert.equal(typeof captureAnimationFrames, 'function');
});

await asyncTest('compareFrames import', async () => {
  const { compareFrames } = await import('@link-assistant/web-capture/src/animation.js');
  assert.equal(typeof compareFrames, 'function');
  // Test with identical buffers
  const buf = Buffer.from([1, 2, 3, 4]);
  assert.equal(compareFrames(buf, buf), 1);
});

// 8. Test batch module
console.log('\n8. Batch processing module');
await asyncTest('batch module imports', async () => {
  const { loadConfig, getAllArticles, validateConfig, createConfigFromUrls } = await import('@link-assistant/web-capture/src/batch.js');
  assert.equal(typeof loadConfig, 'function');
  assert.equal(typeof getAllArticles, 'function');
  assert.equal(typeof validateConfig, 'function');
  assert.equal(typeof createConfigFromUrls, 'function');
});

// 9. Test HTML-to-markdown enhanced conversion
console.log('\n9. Enhanced markdown conversion');
await asyncTest('convertHtmlToMarkdownEnhanced basic usage', async () => {
  const { convertHtmlToMarkdownEnhanced } = await import('@link-assistant/web-capture/src/lib.js');
  const html = `
    <html><head><meta name="keywords" content="test,tag1"></head>
    <body>
      <h1>Test Title</h1>
      <p>Hello world with <a href="https://example.com">a link</a></p>
      <pre><code class="language-python">print("hello")</code></pre>
    </body></html>
  `;
  const result = convertHtmlToMarkdownEnhanced(html, 'https://example.com', {
    extractLatex: true,
    extractMetadata: true,
    postProcess: true,
    detectCodeLanguage: true
  });
  assert.ok(result.markdown);
  assert.ok(result.markdown.includes('Test Title'));
  assert.ok(result.markdown.includes('Hello world'));
});

// 10. Test articles-config compatibility
console.log('\n10. Articles config compatibility');
await asyncTest('articles-config imports', async () => {
  const { getArticle, getAllVersions, getAllArticles } = await import('./articles-config.mjs');
  const article = getArticle('0.0.0');
  assert.equal(article.version, '0.0.0');
  assert.ok(article.url.includes('habr.com'));
  const versions = getAllVersions();
  assert.ok(versions.includes('0.0.0'));
  assert.ok(versions.includes('0.0.1'));
  assert.ok(versions.includes('0.0.2'));
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
