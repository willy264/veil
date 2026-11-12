// Read-only browser check. Real wallet approvals remain a separate recording step.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
const { chromium } = createRequire(import.meta.url)(process.env.VEIL_PLAYWRIGHT_MODULE || 'playwright');
const local = process.argv.includes('--local');
const allowed = new Map([['/', 'index.html'], ['/index.html','index.html'], ['/app.js','app.js'], ['/config.js','config.js'], ['/styles.css','styles.css']]);
let server;
if (local) {
  server = createServer(async (req, res) => {
    const name = allowed.get(new URL(req.url, 'http://localhost').pathname);
    if (!name) { res.writeHead(404).end(); return; }
    try { const body = await readFile(new URL(`../apps/web/${name}`, import.meta.url)); res.setHeader('content-type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html'); res.end(body); } catch { res.writeHead(500).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}
const url = local ? `http://127.0.0.1:${server.address().port}` : process.argv[2];
if (!url) throw new Error('Supply the public URL or --local');
const report = { checkedAt: new Date().toISOString(), url, scope: local ? 'LOCAL_BROWSER_LIVE_TESTNET_READS' : 'PUBLIC_BROWSER_LIVE_TESTNET_READS', walletTransactionsSubmitted: false, checks: [], pageErrors: [] };
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', (err) => report.pageErrors.push(err.message));
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  report.httpStatus = response.status(); report.finalUrl = page.url();
  if (!response.ok() || new URL(page.url()).hostname !== new URL(url).hostname || await page.title() !== 'Veil | Private receiving for NEAR') throw new Error('PUBLIC_ACCESS_BLOCKED_OR_WRONG_APP');
  await page.waitForFunction(() => document.querySelector('#scan-output')?.textContent !== 'No scan yet.', null, { timeout: 45000 });
  report.config = await page.evaluate(() => window.VEIL_CONFIG);
  if (report.config.network !== 'testnet' || report.config.registryId !== 'registry2.veil-williams.testnet' || report.config.routerId !== 'router2.veil-williams.testnet') throw new Error('Unexpected contract configuration');
  for (const asset of [...(local ? [] : ['index','index.html']), 'app.js','config.js','styles.css']) {
    const r = await page.request.get(new URL(asset, url + '/').href); if (!r.ok()) throw new Error(`Asset failed: ${asset}`);
    if (new URL(r.url()).hostname !== new URL(url).hostname) throw new Error(`Asset redirected away from the app: ${asset}`);
    report.checks.push({ asset, status: r.status() });
  }
  await page.locator('#resolve').click();
  await page.waitForFunction(() => document.querySelector('#resolve-output').textContent.includes('spend_pub_hex'));
  report.checks.push({ registryResolve: 'PASS', account: 'alice.veil-williams.testnet' });
  const scan = JSON.parse(await page.locator('#scan-output').textContent());
  if (typeof scan.announcements !== 'number') throw new Error('Router scan failed');
  report.checks.push({ routerRead: 'PASS', announcements: scan.announcements });
  report.sections = await page.locator('h3').allTextContents();
  await page.locator('#connect').click();
  await page.waitForTimeout(3000);
  report.walletChooserVisible = await page.getByText('Select wallet', { exact: false }).count() > 0;
  if (!report.walletChooserVisible) throw new Error('Wallet chooser did not open');
  if (report.pageErrors.length) throw new Error('Browser runtime errors');
  report.status = 'PASS_READ_ONLY';
} catch (err) { report.status = 'BLOCKED_OR_FAILED'; report.error = err.message; process.exitCode = 1; }
finally {
  await browser.close(); if (server) await new Promise((resolve) => server.close(resolve));
  const path = new URL(`../results/${local ? 'local-browser' : 'hosted-check'}-${Date.now()}.json`, import.meta.url);
  await writeFile(path, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
