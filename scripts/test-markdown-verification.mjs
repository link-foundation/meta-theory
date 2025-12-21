/**
 * Combined test runner for markdown verification
 * Runs both Playwright and Puppeteer tests
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runTest(scriptPath, name) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Running ${name} test...`);
    console.log('='.repeat(60));

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${name} test passed!`);
        resolve(true);
      } else {
        console.log(`\n❌ ${name} test failed with code ${code}!`);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.error(`\n❌ ${name} test error:`, error);
      reject(error);
    });
  });
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 MARKDOWN VERIFICATION TEST SUITE');
  console.log('='.repeat(60));
  console.log('\nThis test suite verifies that the markdown archive file');
  console.log('contains all content elements from the original Habr article.\n');

  const playwrightPath = join(__dirname, 'test-markdown-verification-playwright.mjs');
  const puppeteerPath = join(__dirname, 'test-markdown-verification-puppeteer.mjs');

  try {
    const playwrightResult = await runTest(playwrightPath, 'Playwright');
    const puppeteerResult = await runTest(puppeteerPath, 'Puppeteer');

    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`Playwright: ${playwrightResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Puppeteer:  ${puppeteerResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('='.repeat(60));

    if (playwrightResult && puppeteerResult) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    process.exit(1);
  }
}

runAllTests();
