// Read-only browser check. Real wallet approvals remain a separate recording step.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const report = {
  checkedAt: new Date().toISOString(), url,
  scope: local ? 'LOCAL_BROWSER_LIVE_TESTNET_READS' : 'PUBLIC_BROWSER_LIVE_TESTNET_READS',
  walletTransactionsSubmitted: false,
  walletVerification: 'Chooser only. Real wallet connection, message signing and transaction approvals remain pending human verification.',
  checks: [], pageErrors: [],
};
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', (err) => report.pageErrors.push(err.message));
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  report.httpStatus = response?.status(); report.finalUrl = page.url();
  if (!response?.ok() || new URL(page.url()).hostname !== new URL(url).hostname || await page.title() !== 'Veil | Private receiving for NEAR') throw new Error('PUBLIC_ACCESS_BLOCKED_OR_WRONG_APP');
  // syncControls disables scanning until keys exist; no automatic inbox RPC read is expected.
  await page.waitForFunction(() => document.querySelector('#refresh')?.disabled === true && document.querySelector('#send')?.disabled === true, null, { timeout: 45000 });
  report.config = await page.evaluate(() => window.VEIL_CONFIG);
  if (report.config?.network !== 'testnet' || report.config.registryId !== 'registry2.veil-williams.testnet' || report.config.routerId !== 'router2.veil-williams.testnet' || !report.config.rpcUrl) throw new Error('Unexpected contract configuration');
  for (const asset of [...(local ? [] : ['index','index.html']), 'app.js','config.js','styles.css']) {
    const r = await page.request.get(new URL(asset, url + '/').href); if (!r.ok()) throw new Error(`Asset failed: ${asset}`);
    if (new URL(r.url()).hostname !== new URL(url).hostname) throw new Error(`Asset redirected away from the app: ${asset}`);
    report.checks.push({ asset, status: r.status() });
  }
  report.freshState = await page.evaluate(() => {
    const ids = ['identity-output', 'resolve-output', 'send-output', 'scan-output', 'auditor-output'];
    return {
      walletStatus: document.getElementById('wallet-status')?.textContent.trim(),
      receiveSelected: document.getElementById('tab-receive')?.getAttribute('aria-selected') === 'true',
      receiveVisible: document.getElementById('receive-path')?.hidden === false,
      sendHidden: document.getElementById('send-path')?.hidden === true,
      inboxHidden: document.getElementById('inbox-table')?.hidden === true,
      proofMode: document.getElementById('proof-mode')?.textContent.trim(),
      inputsEmpty: ['recipient', 'amount', 'auditor-name', 'view-key'].every((id) => document.getElementById(id)?.value === ''),
      preCount: document.querySelectorAll('pre').length,
      states: ids.map((id) => {
        const element = document.getElementById(id);
        return { id, text: element?.textContent.trim(), state: element?.dataset.state || 'initial', semanticStatus: element?.matches('.state-box[role="status"][aria-live="polite"]') === true };
      }),
    };
  });
  const fresh = report.freshState;
  if (fresh.walletStatus !== 'Wallet not connected' || !fresh.receiveSelected || !fresh.receiveVisible || !fresh.sendHidden || !fresh.inboxHidden || fresh.proofMode !== 'Example' || !fresh.inputsEmpty) throw new Error('Unexpected disconnected app state');
  if (fresh.preCount || fresh.states.some((state) => !state.semanticStatus || /^[\[{]/.test(state.text || ''))) throw new Error('Expected semantic status messages without raw JSON logs');
  if (fresh.states.find(({ id }) => id === 'scan-output')?.text !== 'Enable Veil to find payments sent to you.') throw new Error('Unexpected initial inbox message');
  report.checks.push({ freshAppState: 'PASS' });

  await page.locator('#tab-send').click();
  await page.locator('#send-path').waitFor({ state: 'visible' });
  if (await page.locator('#tab-send').getAttribute('aria-selected') !== 'true' || await page.locator('#receive-path').isVisible()) throw new Error('Send tab did not select its panel');
  const account = 'alice.veil-williams.testnet';
  const recipient = page.locator('#recipient');
  await recipient.fill(account);
  // Observe the UI's real registry lookup before blurring, rather than trusting copy alone.
  const [registryResponse] = await Promise.all([
    page.waitForResponse((candidate) => {
      if (candidate.url() !== new URL(report.config.rpcUrl).href || candidate.request().method() !== 'POST') return false;
      try {
        const request = candidate.request().postDataJSON();
        const params = request?.params;
        return request.method === 'query' && params?.request_type === 'call_function' && params.finality === 'final'
          && params.account_id === report.config.registryId && params.method_name === 'get_meta'
          && JSON.parse(Buffer.from(params.args_base64, 'base64').toString('utf8')).account_id === account;
      } catch { return false; }
    }),
    recipient.blur(),
  ]);
  if (!registryResponse.ok()) throw new Error(`Registry lookup HTTP ${registryResponse.status()}`);
  const registryPayload = await registryResponse.json();
  if (registryPayload.error || registryPayload.result?.error || !Array.isArray(registryPayload.result?.result)) throw new Error('Registry RPC lookup failed');
  const meta = JSON.parse(Buffer.from(registryPayload.result.result).toString('utf8'));
  if (meta?.scheme_id !== 1 || !/^[0-9a-f]{64}$/i.test(meta.spend_pub_hex) || !/^[0-9a-f]{64}$/i.test(meta.view_pub_hex)) throw new Error('Registry lookup did not return supported public receiving keys');
  await page.locator('#resolve-output[data-state="success"]').getByText('Veil enabled', { exact: true }).waitFor({ state: 'visible' });
  report.checks.push({
    registryResolve: 'PASS', account, rpcUrl: registryResponse.url(), status: registryResponse.status(),
    contract: report.config.registryId, method: 'get_meta', schemeId: meta.scheme_id,
    blockHeight: registryPayload.result.block_height, blockHash: registryPayload.result.block_hash,
    uiState: 'success', message: 'Veil enabled',
  });

  // These are public contract views in the browser. Do not derive keys or scan a private inbox.
  const routerReads = await page.evaluate(async ({ rpcUrl, routerId }) => {
    async function read(method, args) {
      const response = await fetch(rpcUrl, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ jsonrpc: '2.0', id: method, method: 'query', params: {
          request_type: 'call_function', finality: 'final', account_id: routerId,
          method_name: method, args_base64: btoa(JSON.stringify(args)),
        } }),
      });
      if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.error || payload.result?.error || !Array.isArray(payload.result?.result)) throw new Error(`${method} RPC read failed`);
      return {
        method, args, status: response.status, rpcUrl: response.url, contract: routerId,
        blockHeight: payload.result.block_height, blockHash: payload.result.block_hash,
        value: JSON.parse(new TextDecoder().decode(Uint8Array.from(payload.result.result))),
      };
    }
    const total = await read('total_announcements', {});
    const announcements = await read('get_announcements', { from_index: 0, limit: 100 });
    return { total, announcements };
  }, report.config);
  report.routerReads = routerReads;
  const total = routerReads.total.value;
  const rows = routerReads.announcements.value;
  if (!((typeof total === 'number' && Number.isSafeInteger(total) && total >= 0) || (typeof total === 'string' && /^\d+$/.test(total)))) throw new Error('Invalid router announcement total');
  if (!Array.isArray(rows) || rows.length > 100 || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Invalid router announcement page');
  if (BigInt(total) > 0n && rows.length === 0) throw new Error('Router returned an empty first page for a nonempty announcement log');
  report.checks.push({ routerRead: 'PASS', announcements: total, firstPageCount: rows.length });
  if (await page.locator('pre').count()) throw new Error('Raw preformatted logs appeared after lookup');
  report.sections = await page.locator('h2').allTextContents();
  await page.locator('#connect').click();
  const chooser = page.getByText('Select wallet', { exact: false }).first();
  await chooser.waitFor({ state: 'visible', timeout: 15000 });
  report.walletChooserVisible = await chooser.isVisible();
  if (!report.walletChooserVisible) throw new Error('Wallet chooser did not open');
  if (report.pageErrors.length) throw new Error('Browser runtime errors');
  report.status = 'PASS_READ_ONLY';
} catch (err) { report.status = 'BLOCKED_OR_FAILED'; report.error = err.message; process.exitCode = 1; }
finally {
  if (browser) await browser.close(); if (server) await new Promise((resolve) => server.close(resolve));
  await mkdir(new URL('../results/', import.meta.url), { recursive: true });
  const path = new URL(`../results/${local ? 'local-browser' : 'hosted-check'}-${Date.now()}.json`, import.meta.url);
  await writeFile(path, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
