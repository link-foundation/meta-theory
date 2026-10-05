// Run existing Playwright checks when browser downloads are unavailable locally.
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const script = process.argv[2];
if (!script) throw new Error('Usage: node experiments/issue-59/use-system-browser.mjs scripts/verify.mjs --all');
const launch = chromium.launch.bind(chromium);
chromium.launch = (options) => launch({ ...options, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/opt/google/chrome/chrome' });
process.argv.splice(1, 2, resolve(script));
await import(pathToFileURL(resolve(script)).href);
