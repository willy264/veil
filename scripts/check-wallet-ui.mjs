// Browser QA only: live testnet reads, no wallet signatures or transactions.
// Install playwright and @axe-core/playwright separately or provide module paths.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.VEIL_PLAYWRIGHT_MODULE || 'playwright');
const AxeBuilder = require(process.env.VEIL_AXE_MODULE || '@axe-core/playwright').default;
const assets = ['index.html', 'app.js', 'config.js', 'styles.css', 'logo.svg', 'favicon.svg', 'fonts/geist-latin.woff2'];
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', woff2: 'font/woff2' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (!assets.includes(file)) return res.writeHead(404).end();
  try { res.setHeader('content-type', types[file.split('.').at(-1)]); res.end(await readFile(new URL(`../apps/web/${file}`, import.meta.url))); }
  catch { res.writeHead(500).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const report = { checkedAt: new Date().toISOString(), walletTransactionsSubmitted: false, viewports: [], keyboard: {}, violations: [], pageErrors: [] };
try {
  const context = await browser.newContext(); const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#scan-output').textContent !== 'No scan yet.');
  for (const reducedMotion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion });
    for (const width of [320, 375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const action of ['send', 'receive', 'transfer']) {
        await page.locator(`#tab-${action}`).click();
        const layout = await page.evaluate(() => {
          const targets = [...document.querySelectorAll('button, input, select, summary, a[href]')].filter((el) => el.getClientRects().length);
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            smallTargets: targets.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 24; }).map((el) => el.id || el.textContent.trim()),
            visiblePanels: [...document.querySelectorAll('[role="tabpanel"]')].filter((p) => !p.hidden).map((p) => p.id),
            fontLoaded: document.fonts.check('16px Geist'),
          };
        });
        report.viewports.push({ width, reducedMotion, action, ...layout });
        if (width === 375 || width === 1440) {
          const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
          report.violations.push(...axe.violations.map((v) => ({ width, reducedMotion, action, id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })));
        }
        if (width === 1440 && reducedMotion === 'no-preference') await page.locator('.action-card').screenshot({ path: new URL(`../results/ui-wallet-${action}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1') });
      }
      if (reducedMotion === 'no-preference' && [320, 1440].includes(width)) {
        await page.locator('#tab-send').click(); await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: new URL(`../results/ui-wallet-${width}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
      }
    }
  }
  await page.locator('#tab-send').focus(); await page.keyboard.press('ArrowRight');
  report.keyboard.rightArrowSelectsReceive = await page.locator('#tab-receive').getAttribute('aria-selected') === 'true';
  await page.keyboard.press('End'); report.keyboard.endSelectsTransfer = await page.locator('#tab-transfer').getAttribute('aria-selected') === 'true';
  await page.keyboard.press('Home'); report.keyboard.homeSelectsSend = await page.locator('#tab-send').getAttribute('aria-selected') === 'true';
  await page.locator('#send').click();
  await page.waitForFunction(() => document.querySelector('#send-output-status').textContent.includes('Connect a testnet wallet first'));
  report.disconnectedSendErrorVisible = await page.locator('#send-output-status').isVisible();
  report.status = report.violations.length || report.pageErrors.length || report.viewports.some((v) => v.overflow || v.smallTargets.length || v.visiblePanels.length !== 1 || !v.fontLoaded) || Object.values(report.keyboard).some((v) => !v) ? 'FAIL' : 'PASS';
  if (report.status === 'FAIL') process.exitCode = 1;
} catch (error) { report.status = 'FAIL'; report.error = error.message; process.exitCode = 1; }
finally {
  await browser.close(); await new Promise((resolve) => server.close(resolve));
  const file = `results/wallet-ui-${Date.now()}.json`;
  await writeFile(file, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ file, ...report }, null, 2));
}
