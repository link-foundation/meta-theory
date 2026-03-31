#!/usr/bin/env node

/**
 * Experiment: Detect and analyze consent modals on Habr pages
 *
 * This script navigates to a Habr article, waits for consent modals to appear,
 * and captures information about all visible overlays, modals, and consent forms.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ARTICLE_URL = 'https://habr.com/en/articles/895896/';

async function main() {
  console.log('🔍 Detecting consent modals on Habr...');
  console.log(`   URL: ${ARTICLE_URL}\n`);

  const browser = await chromium.launch({ headless: true });

  for (const theme of ['dark', 'light']) {
    console.log(`\n=== ${theme.toUpperCase()} THEME ===`);

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      colorScheme: theme,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    await page.goto(ARTICLE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    await page.waitForSelector('.article-formatted-body', { timeout: 30000 });

    // Wait for potential popups to appear
    await page.waitForTimeout(3000);

    // Take a screenshot before any popup dismissal
    const beforePath = join(__dirname, `consent-before-${theme}.png`);
    await page.screenshot({ path: beforePath, fullPage: false });
    console.log(`   📸 Before screenshot: ${beforePath}`);

    // Analyze all fixed/absolute positioned overlays
    const overlays = await page.evaluate(() => {
      const results = [];
      const allEls = document.querySelectorAll('*');

      for (const el of allEls) {
        const style = getComputedStyle(el);
        if ((style.position === 'fixed' || style.position === 'sticky') &&
            el.offsetParent !== null) {
          const rect = el.getBoundingClientRect();
          if (rect.height > 50) {
            results.push({
              tag: el.tagName,
              id: el.id || '',
              className: el.className?.toString()?.substring(0, 200) || '',
              position: style.position,
              zIndex: style.zIndex,
              rect: {
                top: Math.round(rect.top),
                left: Math.round(rect.left),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              innerText: el.innerText?.substring(0, 300) || '',
              childCount: el.childElementCount,
              hasCloseButton: !!el.querySelector('[aria-label="Close"], [aria-label="Закрыть"], button.close, .close, [class*="close"]'),
              hasConsentText: /consent|cookie|privacy|accept|agree|согласи|принять|куки/i.test(el.innerText || ''),
              dataTestIds: Array.from(el.querySelectorAll('[data-testid]')).map(e => e.getAttribute('data-testid'))
            });
          }
        }
      }
      return results;
    });

    console.log(`\n   Found ${overlays.length} fixed/sticky overlays:`);
    for (const overlay of overlays) {
      console.log(`\n   --- Overlay ---`);
      console.log(`   Tag: ${overlay.tag}, ID: "${overlay.id}"`);
      console.log(`   Class: ${overlay.className}`);
      console.log(`   Position: ${overlay.position}, Z-Index: ${overlay.zIndex}`);
      console.log(`   Rect: ${JSON.stringify(overlay.rect)}`);
      console.log(`   Has close button: ${overlay.hasCloseButton}`);
      console.log(`   Has consent text: ${overlay.hasConsentText}`);
      console.log(`   Data-testids: ${JSON.stringify(overlay.dataTestIds)}`);
      console.log(`   Text preview: "${overlay.innerText.substring(0, 150)}"`);
    }

    // Also look for specific consent-related elements anywhere in DOM
    const consentElements = await page.evaluate(() => {
      const selectors = [
        // Consent-related selectors
        '[class*="consent"]', '[class*="cookie"]', '[class*="privacy"]',
        '[class*="gdpr"]', '[class*="banner"]', '[class*="modal"]',
        '[data-testid*="consent"]', '[data-testid*="cookie"]',
        // FC (Funding Choices / Google consent) related
        '[class*="fc-"]', '#fc-consent-root', '.fc-dialog',
        // CMP (Consent Management Platform) related
        '[class*="cmp"]', '#cmpbox', '#cmpbox2',
        // IAB related
        '[id*="sp_message"]', '#sp_message_container',
        // Generic overlays
        '.tm-base-modal', '.tm-popup',
        // Iframe-based consent
        'iframe[src*="consent"]', 'iframe[src*="cookie"]', 'iframe[src*="cmp"]'
      ];

      const results = [];
      for (const selector of selectors) {
        try {
          const els = document.querySelectorAll(selector);
          for (const el of els) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0) {
              results.push({
                selector,
                tag: el.tagName,
                id: el.id,
                className: el.className?.toString()?.substring(0, 200) || '',
                rect: {
                  top: Math.round(rect.top),
                  left: Math.round(rect.left),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                },
                visible: getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden',
                innerText: el.innerText?.substring(0, 200) || '',
                src: el.src || ''
              });
            }
          }
        } catch (e) { /* ignore selector errors */ }
      }
      return results;
    });

    console.log(`\n   Found ${consentElements.length} consent-related elements:`);
    for (const el of consentElements) {
      console.log(`\n   --- Consent Element ---`);
      console.log(`   Matched selector: ${el.selector}`);
      console.log(`   Tag: ${el.tag}, ID: "${el.id}"`);
      console.log(`   Class: ${el.className}`);
      console.log(`   Visible: ${el.visible}`);
      console.log(`   Rect: ${JSON.stringify(el.rect)}`);
      if (el.src) console.log(`   Src: ${el.src}`);
      console.log(`   Text: "${el.innerText.substring(0, 150)}"`);
    }

    await context.close();
  }

  await browser.close();
  console.log('\n✅ Done!');
}

main().catch(console.error);
