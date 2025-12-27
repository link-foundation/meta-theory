#!/usr/bin/env node
/**
 * Experiment to investigate if Habr formulas contain LaTeX source
 *
 * This script will inspect:
 * 1. The structure of formula elements (img, svg, katex, mathjax)
 * 2. Any annotations or data attributes that might contain LaTeX source
 * 3. SVG content and metadata
 * 4. Parent element attributes and classes
 */
import { chromium } from 'playwright';

async function investigateFormulas(url) {
  console.log(`\n=== Investigating formulas on: ${url} ===\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });

  await page.waitForSelector('.article-formatted-body', { timeout: 30000 });
  await page.waitForTimeout(3000);

  // Deep investigation of formula elements
  const analysis = await page.evaluate(() => {
    const article = document.querySelector('.article-formatted-body');
    if (!article) return { error: 'No article body found' };

    const result = {
      // Check for KaTeX
      katex: {
        found: false,
        elements: [],
        annotations: []
      },
      // Check for MathJax
      mathjax: {
        found: false,
        elements: [],
        annotations: []
      },
      // Check for SVG formulas
      svg: {
        found: false,
        elements: [],
        hasLatexSource: false
      },
      // Check for img-based formulas
      img: {
        found: false,
        elements: [],
        hasTitleOrAlt: false
      },
      // Check for any element with TeX-related attributes
      texElements: [],
      // Raw HTML samples
      samples: []
    };

    // 1. Check for KaTeX elements
    const katexElements = article.querySelectorAll('.katex, .katex-html, .katex-mathml');
    if (katexElements.length > 0) {
      result.katex.found = true;
      katexElements.forEach((el, i) => {
        if (i < 5) {
          result.katex.elements.push({
            class: el.className,
            html: el.outerHTML.substring(0, 500)
          });
        }
      });

      // Check for annotation elements (where LaTeX is stored in KaTeX)
      const annotations = article.querySelectorAll('annotation[encoding="application/x-tex"]');
      annotations.forEach((ann, i) => {
        if (i < 10) {
          result.katex.annotations.push(ann.textContent);
        }
      });
    }

    // 2. Check for MathJax elements
    const mjxElements = article.querySelectorAll('mjx-container, .MathJax, .MathJax_Display');
    if (mjxElements.length > 0) {
      result.mathjax.found = true;
      mjxElements.forEach((el, i) => {
        if (i < 5) {
          result.mathjax.elements.push({
            class: el.className,
            html: el.outerHTML.substring(0, 500)
          });
        }
      });

      // Check for MathJax annotations
      const mjAnnotations = article.querySelectorAll('annotation[encoding*="tex"], annotation[encoding*="TeX"]');
      mjAnnotations.forEach((ann, i) => {
        if (i < 10) {
          result.mathjax.annotations.push(ann.textContent);
        }
      });
    }

    // 3. Check for SVG formulas
    const svgElements = article.querySelectorAll('svg');
    if (svgElements.length > 0) {
      result.svg.found = true;
      svgElements.forEach((svg, i) => {
        if (i < 5) {
          const svgData = {
            width: svg.getAttribute('width'),
            height: svg.getAttribute('height'),
            classes: svg.className.baseVal || svg.className,
            hasTitle: !!svg.querySelector('title'),
            title: svg.querySelector('title')?.textContent,
            hasDesc: !!svg.querySelector('desc'),
            desc: svg.querySelector('desc')?.textContent,
            dataAttributes: {},
            parentClass: svg.parentElement?.className,
            parentDataAttributes: {}
          };

          // Check SVG data attributes
          for (const attr of svg.attributes) {
            if (attr.name.startsWith('data-')) {
              svgData.dataAttributes[attr.name] = attr.value.substring(0, 200);
            }
          }

          // Check parent data attributes
          if (svg.parentElement) {
            for (const attr of svg.parentElement.attributes) {
              if (attr.name.startsWith('data-')) {
                svgData.parentDataAttributes[attr.name] = attr.value.substring(0, 200);
              }
            }
          }

          // Check for annotation inside SVG
          const annInSvg = svg.querySelectorAll('annotation, desc, title, metadata');
          svgData.annotationElements = [];
          annInSvg.forEach(ann => {
            svgData.annotationElements.push({
              tag: ann.tagName,
              content: ann.textContent.substring(0, 200)
            });
          });

          result.svg.elements.push(svgData);
        }
      });
    }

    // 4. Check for img-based formulas
    const imgElements = article.querySelectorAll('img');
    imgElements.forEach((img, i) => {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      const title = img.getAttribute('title') || '';

      // Check if this might be a formula image
      const isFormula = src.includes('formula') ||
                        src.includes('math') ||
                        src.includes('tex') ||
                        src.includes('latex') ||
                        alt.includes('$') ||
                        title.includes('$') ||
                        img.parentElement?.className?.includes('formula') ||
                        img.parentElement?.className?.includes('math');

      if (isFormula || i < 5) {
        result.img.found = true;
        const imgData = {
          src: src.substring(0, 200),
          alt: alt,
          title: title,
          classes: img.className,
          parentClass: img.parentElement?.className,
          dataAttributes: {},
          parentDataAttributes: {}
        };

        // Check img data attributes
        for (const attr of img.attributes) {
          if (attr.name.startsWith('data-')) {
            imgData.dataAttributes[attr.name] = attr.value.substring(0, 200);
          }
        }

        // Check parent data attributes
        if (img.parentElement) {
          for (const attr of img.parentElement.attributes) {
            if (attr.name.startsWith('data-') || attr.name === 'title') {
              imgData.parentDataAttributes[attr.name] = attr.value.substring(0, 200);
            }
          }
        }

        if (alt || title) {
          result.img.hasTitleOrAlt = true;
        }

        result.img.elements.push(imgData);
      }
    });

    // 5. Search for any elements with TeX-related content or attributes
    const allElements = article.querySelectorAll('*');
    allElements.forEach((el, i) => {
      // Check for data-tex or similar
      for (const attr of el.attributes) {
        if (attr.name.toLowerCase().includes('tex') ||
            attr.name.toLowerCase().includes('latex') ||
            attr.name.toLowerCase().includes('math') ||
            attr.name.toLowerCase().includes('formula')) {
          result.texElements.push({
            tag: el.tagName,
            attribute: attr.name,
            value: attr.value.substring(0, 300),
            class: el.className
          });
        }
      }
    });

    // 6. Get some raw HTML samples of elements that look like formulas
    const allPs = article.querySelectorAll('p');
    allPs.forEach((p, i) => {
      const html = p.innerHTML;
      // Look for inline formulas or math-like content
      if (html.includes('$') || html.includes('\\(') || html.includes('\\[') ||
          html.includes('formula') || html.includes('math') ||
          p.querySelector('img, svg, .katex, mjx-container')) {
        if (result.samples.length < 10) {
          result.samples.push({
            index: i,
            html: html.substring(0, 800),
            text: p.innerText.substring(0, 200)
          });
        }
      }
    });

    return result;
  });

  await browser.close();

  return analysis;
}

async function main() {
  // Test all three article URLs
  const urls = [
    'https://habr.com/en/articles/658705/',
    'https://habr.com/ru/companies/deepfoundation/articles/804617/',
    'https://habr.com/en/articles/756654/'
  ];

  const results = {};

  for (const url of urls) {
    try {
      results[url] = await investigateFormulas(url);
    } catch (err) {
      results[url] = { error: err.message };
    }
  }

  // Output detailed results
  console.log('\n========================================');
  console.log('FORMULA INVESTIGATION RESULTS');
  console.log('========================================\n');

  for (const [url, result] of Object.entries(results)) {
    console.log(`\n--- ${url} ---`);

    if (result.error) {
      console.log('ERROR:', result.error);
      continue;
    }

    console.log('\nKaTeX:', result.katex.found ? 'FOUND' : 'NOT FOUND');
    if (result.katex.annotations.length > 0) {
      console.log('  LaTeX annotations found:');
      result.katex.annotations.forEach((ann, i) => {
        console.log(`    [${i}]: ${ann}`);
      });
    }

    console.log('\nMathJax:', result.mathjax.found ? 'FOUND' : 'NOT FOUND');
    if (result.mathjax.annotations.length > 0) {
      console.log('  LaTeX annotations found:');
      result.mathjax.annotations.forEach((ann, i) => {
        console.log(`    [${i}]: ${ann}`);
      });
    }

    console.log('\nSVG elements:', result.svg.found ? result.svg.elements.length : 0);
    if (result.svg.elements.length > 0) {
      result.svg.elements.forEach((svg, i) => {
        console.log(`  [${i}]: classes="${svg.classes}", parent="${svg.parentClass}"`);
        if (svg.title) console.log(`       title: ${svg.title}`);
        if (svg.desc) console.log(`       desc: ${svg.desc}`);
        if (Object.keys(svg.dataAttributes).length > 0) {
          console.log(`       data-attrs: ${JSON.stringify(svg.dataAttributes)}`);
        }
        if (Object.keys(svg.parentDataAttributes).length > 0) {
          console.log(`       parent data-attrs: ${JSON.stringify(svg.parentDataAttributes)}`);
        }
        if (svg.annotationElements.length > 0) {
          console.log(`       annotations:`, svg.annotationElements);
        }
      });
    }

    console.log('\nIMG elements (possible formulas):', result.img.elements.length);
    if (result.img.elements.length > 0) {
      result.img.elements.slice(0, 5).forEach((img, i) => {
        console.log(`  [${i}]: src="${img.src}"`);
        if (img.alt) console.log(`       alt: "${img.alt}"`);
        if (img.title) console.log(`       title: "${img.title}"`);
        if (Object.keys(img.dataAttributes).length > 0) {
          console.log(`       data-attrs: ${JSON.stringify(img.dataAttributes)}`);
        }
        if (Object.keys(img.parentDataAttributes).length > 0) {
          console.log(`       parent data-attrs: ${JSON.stringify(img.parentDataAttributes)}`);
        }
      });
    }

    console.log('\nTeX-related attributes found:', result.texElements.length);
    if (result.texElements.length > 0) {
      result.texElements.slice(0, 10).forEach((el, i) => {
        console.log(`  [${i}]: <${el.tag}> ${el.attribute}="${el.value}"`);
      });
    }

    console.log('\nSample paragraphs with potential formulas:', result.samples.length);
    if (result.samples.length > 0) {
      result.samples.slice(0, 3).forEach((s, i) => {
        console.log(`  [${i}]:`);
        console.log(`    HTML: ${s.html.substring(0, 300)}...`);
        console.log(`    Text: ${s.text}`);
      });
    }
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
