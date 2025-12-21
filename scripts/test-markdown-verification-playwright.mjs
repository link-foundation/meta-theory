import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Extracts content elements from the Habr article page
 */
async function extractPageContent(page) {
  return await page.evaluate(() => {
    const content = document.querySelector('.tm-article-presenter__content');
    if (!content) throw new Error('Article content not found');

    const elements = [];

    // Helper to clean text
    const cleanText = (text) => text?.trim().replace(/\s+/g, ' ') || '';

    // Extract all major content elements
    const contentNodes = content.querySelectorAll('h1, h2, h3, h4, p, pre, blockquote, img, ul, ol');

    contentNodes.forEach((node) => {
      const tagName = node.tagName.toLowerCase();

      if (tagName.match(/^h[1-6]$/)) {
        elements.push({
          type: 'heading',
          level: parseInt(tagName[1]),
          text: cleanText(node.textContent)
        });
      } else if (tagName === 'p') {
        const text = cleanText(node.textContent);
        if (text) {
          // Check if contains math formula indicators
          const hasMath = text.includes('$') || node.querySelector('.MathJax, .katex, math');
          elements.push({
            type: 'paragraph',
            text: text,
            hasMath: hasMath
          });
        }
      } else if (tagName === 'pre') {
        const code = node.querySelector('code');
        elements.push({
          type: 'code',
          text: cleanText(code ? code.textContent : node.textContent),
          language: code?.className.match(/language-(\w+)/)?.[1] || 'text'
        });
      } else if (tagName === 'blockquote') {
        const text = cleanText(node.textContent);
        if (text) {
          elements.push({
            type: 'blockquote',
            text: text
          });
        }
      } else if (tagName === 'img') {
        const src = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || '';
        const width = node.naturalWidth || node.width || 0;
        const height = node.naturalHeight || node.height || 0;
        // Only count large images from habrastorage (article images), not icons/avatars
        if (src && src.includes('habrastorage.org') && width > 100 && height > 100) {
          elements.push({
            type: 'image',
            src: src,
            alt: cleanText(alt)
          });
        }
      } else if (tagName === 'ul' || tagName === 'ol') {
        const items = Array.from(node.querySelectorAll('li')).map(li => cleanText(li.textContent));
        if (items.length > 0) {
          elements.push({
            type: 'list',
            ordered: tagName === 'ol',
            items: items
          });
        }
      }
    });

    return {
      title: document.querySelector('.tm-title')?.textContent.trim() || '',
      elements: elements
    };
  });
}

/**
 * Parses the markdown file to extract content elements
 */
function parseMarkdown(mdPath) {
  const content = readFileSync(mdPath, 'utf-8');
  const lines = content.split('\n');
  const elements = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      elements.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim()
      });
      i++;
      continue;
    }

    // Code blocks
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim() || 'text';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (codeLines.length > 0) {
        elements.push({
          type: 'code',
          text: codeLines.join('\n').trim().replace(/\s+/g, ' '),
          language: language
        });
      }
      i++; // skip closing ```
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().slice(1).trim());
        i++;
      }
      const text = quoteLines.join(' ').trim();
      if (text) {
        elements.push({
          type: 'blockquote',
          text: text
        });
      }
      continue;
    }

    // Images
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      elements.push({
        type: 'image',
        src: imageMatch[2],
        alt: imageMatch[1]
      });
      i++;
      continue;
    }

    // Lists
    if (trimmed.match(/^[-*]\s+/) || trimmed.match(/^\d+\.\s+/)) {
      const ordered = trimmed.match(/^\d+\.\s+/) !== null;
      const items = [];
      while (i < lines.length) {
        const listLine = lines[i].trim();
        if (ordered && listLine.match(/^\d+\.\s+/)) {
          items.push(listLine.replace(/^\d+\.\s+/, '').trim());
          i++;
        } else if (!ordered && listLine.match(/^[-*]\s+/)) {
          items.push(listLine.replace(/^[-*]\s+/, '').trim());
          i++;
        } else if (listLine === '') {
          i++;
          break;
        } else {
          break;
        }
      }
      if (items.length > 0) {
        elements.push({
          type: 'list',
          ordered: ordered,
          items: items
        });
      }
      continue;
    }

    // Paragraphs
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```') &&
        !trimmed.startsWith('>') && !trimmed.startsWith('!')) {
      const hasMath = trimmed.includes('$');
      elements.push({
        type: 'paragraph',
        text: trimmed,
        hasMath: hasMath
      });
    }

    i++;
  }

  return elements;
}

/**
 * Compares page content with markdown content
 */
function compareContent(pageContent, markdownElements) {
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
  };

  // Compare headings
  const pageHeadings = pageContent.elements.filter(e => e.type === 'heading');
  const mdHeadings = markdownElements.filter(e => e.type === 'heading');

  console.log(`\n📊 Headings: Page has ${pageHeadings.length}, Markdown has ${mdHeadings.length}`);

  pageHeadings.forEach((pageH, idx) => {
    const mdH = mdHeadings[idx];
    if (!mdH) {
      results.failed++;
      results.details.push(`❌ Missing heading: "${pageH.text}"`);
    } else if (pageH.text !== mdH.text) {
      results.warnings++;
      results.details.push(`⚠️  Heading text differs:\n   Page: "${pageH.text}"\n   MD:   "${mdH.text}"`);
    } else {
      results.passed++;
    }
  });

  // Compare images
  const pageImages = pageContent.elements.filter(e => e.type === 'image');
  const mdImages = markdownElements.filter(e => e.type === 'image');

  console.log(`\n🖼️  Images: Page has ${pageImages.length}, Markdown has ${mdImages.length}`);

  if (pageImages.length !== mdImages.length) {
    results.failed++;
    results.details.push(`❌ Image count mismatch: Page has ${pageImages.length}, Markdown has ${mdImages.length}`);
  } else {
    results.passed++;
  }

  // Compare code blocks
  const pageCode = pageContent.elements.filter(e => e.type === 'code');
  const mdCode = markdownElements.filter(e => e.type === 'code');

  console.log(`\n💻 Code blocks: Page has ${pageCode.length}, Markdown has ${mdCode.length}`);

  if (pageCode.length !== mdCode.length) {
    results.warnings++;
    results.details.push(`⚠️  Code block count differs: Page has ${pageCode.length}, Markdown has ${mdCode.length}`);
  } else {
    results.passed++;
  }

  // Compare math formulas (paragraphs with math)
  const pageMath = pageContent.elements.filter(e => e.type === 'paragraph' && e.hasMath);
  const mdMath = markdownElements.filter(e => e.type === 'paragraph' && e.hasMath);

  console.log(`\n📐 Math formulas: Page has ${pageMath.length}, Markdown has ${mdMath.length}`);

  if (Math.abs(pageMath.length - mdMath.length) > 5) {
    results.warnings++;
    results.details.push(`⚠️  Math formula count differs significantly: Page has ${pageMath.length}, Markdown has ${mdMath.length}`);
  } else {
    results.passed++;
  }

  // Title comparison
  const mdTitle = markdownElements.find(e => e.type === 'heading' && e.level === 1);
  if (mdTitle && pageContent.title) {
    if (pageContent.title.includes(mdTitle.text) || mdTitle.text.includes(pageContent.title)) {
      results.passed++;
      console.log(`\n✅ Title matches: "${mdTitle.text}"`);
    } else {
      results.warnings++;
      results.details.push(`⚠️  Title differs:\n   Page: "${pageContent.title}"\n   MD:   "${mdTitle.text}"`);
    }
  }

  return results;
}

async function runTest() {
  console.log('🧪 Starting Playwright markdown verification test...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    console.log('📄 Loading Habr article...');
    await page.goto('https://habr.com/ru/articles/804617', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await page.waitForSelector('.tm-article-presenter__content', { timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('🔍 Extracting page content...');
    const pageContent = await extractPageContent(page);

    console.log('📖 Parsing markdown file...');
    const mdPath = join(__dirname, '..', 'archive', '0.0.1', 'article.md');
    const markdownElements = parseMarkdown(mdPath);

    console.log('\n📋 Content Statistics:');
    console.log(`   Page elements: ${pageContent.elements.length}`);
    console.log(`   Markdown elements: ${markdownElements.length}`);

    console.log('\n🔬 Comparing content...');
    const results = compareContent(pageContent, markdownElements);

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS (Playwright)');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`⚠️  Warnings: ${results.warnings}`);
    console.log(`❌ Failed: ${results.failed}`);

    if (results.details.length > 0) {
      console.log('\n📝 Details:');
      results.details.forEach(detail => console.log(detail));
    }

    console.log('\n' + '='.repeat(60));

    if (results.failed === 0) {
      console.log('✅ All critical checks passed!');
      return 0;
    } else {
      console.log('❌ Some critical checks failed!');
      return 1;
    }

  } catch (error) {
    console.error('❌ Test error:', error);
    return 1;
  } finally {
    await browser.close();
  }
}

runTest().then(exitCode => process.exit(exitCode));
