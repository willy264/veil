import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/HP/AppData/Local/Temp/veil-video-tools/node_modules/playwright');

const output = fileURLToPath(new URL('../results/video-assets/', import.meta.url));
const appUrl = process.env.VEIL_VIDEO_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: output, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
await page.goto(appUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
await page.locator('#resolve').click();
await page.waitForTimeout(8000);
await page.locator('#refresh').click();
await page.waitForTimeout(8000);
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' }));
await page.waitForTimeout(8000);
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
await page.waitForTimeout(8000);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await page.waitForTimeout(8000);
await page.goto('https://testnet.nearblocks.io/txns/EY8L8AHEMQ4n26ZyrXsFUi1uhR4HoW3oBrUAtaFQ9n8d', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(10000);
await page.goto(appUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(38000);
await context.close();
await browser.close();
console.log('recorded hosted Veil demo');
