#!/usr/bin/env node
/*
 * Scripted testnet signer demo; this is NOT a browser-wallet integration test.
 * Parent/editor must retain this disclosure in README and the final video.
 * No argument: print instructions, without opening credentials or a browser.
 * --preflight: read authorized credentials, verify testnet/FullAccess/0.2 NEAR,
 *              append missing entries to ignored .env, then stop without signing.
 * --execute: the same preflight, then the real hosted-app flow, once per mutation.
 * --local [--url http://localhost:4173]: use local app, still real NEAR testnet.
 * Assumptions: polished DOM IDs below, unchanged deterministic NEP-413 message,
 * 0.0100 registration, 0.05 payment, existing native-confirm 0.001 spend behavior.
 * Never enable Playwright tracing, HAR, protocol logging or persistent profiles.
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  REPO, HOSTED, RPC, REGISTRY, ROUTER, RECEIVER, SENDER, CONNECTOR_IMPORT, CONNECTOR_MODULE,
  PublicError, check, publicError, redact, rememberSecret, validateSource, provider, loadCredentials,
  preflight, createTestSigner, explorer, successful, transactionHash,
} from './test-signer.mjs';

const WEB_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REQUIRED_IDS = ['connect-receive', 'enable', 'register', 'tab-send', 'recipient', 'amount', 'send',
  'send-receipt', 'refresh', 'inbox', 'export-view', 'view-key', 'auditor-name', 'audit', 'auditor-results', 'spend-output'];
const DISCLOSURE = 'Real NEAR testnet transactions driven by a scripted Node test signer. This is not a browser wallet approval demonstration.';
const USAGE = `${DISCLOSURE}
Usage: node apps/web/demo-hosted.mjs [--preflight | --execute] [--local] [--url URL] [--headed]
Default: no credential access, no browser, no signing, no transactions.
--preflight checks both known accounts and appends missing keys to ignored .env only.
--execute records the receiver, sender and unsigned auditor flow; no mutation retries.
--local without --url serves apps/web on an ephemeral localhost port.
Optional VEIL_PLAYWRIGHT_MODULE: existing Playwright package path (no installs).
Evidence: results/hosted-wallet-<timestamp>.json
Screenshots, raw videos and timing markers: results/video-assets/product-polish/<timestamp>/
Final README/video must disclose the scripted signer; these scripts do not edit them.
`;

export function parseArgs(argv) {
  const options = { execute: false, preflight: false, local: false, headed: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (['--execute', '--preflight', '--local', '--headed', '--help'].includes(arg)) options[arg.slice(2)] = true;
    else if (arg === '--url') { check(argv[i + 1] && !options.url, 'Supply exactly one source URL.'); options.url = argv[++i]; }
    else throw new PublicError('Unknown option. Use --help; credentials are never accepted as CLI arguments.');
  }
  check(!(options.execute && options.preflight), 'Choose --execute or --preflight, not both.');
  if (options.url) options.url = validateSource(options.url, options.local);
  return options;
}

async function startLocalServer() {
  const files = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/app.js', 'app.js'], ['/styles.css', 'styles.css'], ['/config.js', 'config.js']]);
  const server = createServer(async (request, response) => {
    const file = files.get(new URL(request.url, 'http://localhost').pathname);
    if (request.method !== 'GET' || !file) { response.writeHead(404).end(); return; }
    try {
      const body = await readFile(path.join(WEB_ROOT, file));
      response.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server;
}
function playwright() {
  const require = createRequire(import.meta.url);
  const choices = process.env.VEIL_PLAYWRIGHT_MODULE ? [process.env.VEIL_PLAYWRIGHT_MODULE] : [
    'playwright', path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Temp', 'veil-video-tools', 'node_modules', 'playwright'),
  ];
  for (const name of choices) {
    try { return require(name); } catch { /* No install or module diagnostic dump. */ }
  }
  throw new PublicError('Playwright is unavailable. Point VEIL_PLAYWRIGHT_MODULE at an existing installation.');
}
function noDebugLogging() {
  check(!['DEBUG', 'DEBUG_FILE', 'PWDEBUG', 'NODE_DEBUG', 'NODE_DEBUG_NATIVE'].some((name) => process.env[name]),
    'Unset DEBUG, DEBUG_FILE, PWDEBUG and NODE_DEBUG logging before using credentials.');
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help || (!options.execute && !options.preflight)) { process.stdout.write(USAGE); return; }
  noDebugLogging();
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
  const output = path.join(REPO, 'results', 'video-assets', 'product-polish', timestamp);
  const evidencePath = path.join(REPO, 'results', `hosted-wallet-${timestamp}.json`);
  // Explicit public allowlist: no error text, signatures, keys, RPC objects,
  // request bodies, clipboard content, DOM snapshots, or browser console logs.
  const evidence = {
    sourceUrl: options.url || (options.local ? 'http://localhost/' : `${HOSTED}/`),
    scriptedSigner: true, browserWallet: false,
    accountIds: { receiver: RECEIVER, sender: SENDER, registry: REGISTRY, router: ROUTER },
    nearAmounts: { registration: '0.01', payment: '0.05', spend: '0.001' },
    transactions: {},
    checks: { preflight: false, executeRequested: options.execute, receiverConnected: false, receiverEnabled: false,
      receiverRegistered: false, senderConnected: false, recipientResolved: false, deliveredPrivately: false,
      receiverFoundPayment: false, spendConfirmed: false, spendCompleted: false, auditorFoundPayment: false,
      auditorUnsigned: false, auditorCannotSpend: false, completed: false },
  };
  const markers = { disclosure: DISCLOSURE, suggestedFinalDurationSeconds: 117,
    clock: 'Monotonic offsets from run start; per-page offsets approximate raw video start at page creation.', videos: {}, events: [] };
  const runStart = performance.now();
  const contexts = [];
  const pageStarts = new Map();
  let browser, server, source, signer;
  let clipboardKey;
  let clipboardArmed = false;
  let fatal;
  let unsafeCapture = false;
  function fail(error) { if (!fatal) fatal = error instanceof PublicError ? error : new PublicError('Browser operation failed; sensitive diagnostics withheld. No mutation is retried.'); }
  function healthy() { if (fatal) throw fatal; }
  function mark(role, step, edge = 'point') {
    const at = performance.now();
    markers.events.push({ role, step, edge, runSeconds: Number(((at - runStart) / 1000).toFixed(3)),
      videoSeconds: pageStarts.has(role) ? Number(((at - pageStarts.get(role)) / 1000).toFixed(3)) : null });
  }
  async function step(role, name, work) {
    healthy(); mark(role, name, 'start');
    process.stdout.write(`${role}: ${name}\n`); // Fixed labels, never browser/credential values.
    try { const result = await work(); healthy(); mark(role, name, 'end'); return result; }
    catch (error) { mark(role, name, 'failed'); throw error instanceof PublicError ? error : new PublicError(`Step ${name} failed; sensitive browser diagnostics withheld. No mutation is retried.`); }
  }
  async function waitText(page, selector, pattern, timeout = 90_000) {
    await page.waitForFunction(({ selector, pattern }) => new RegExp(pattern, 'i').test(document.querySelector(selector)?.textContent || ''),
      { selector, pattern }, { timeout });
    healthy();
  }
  async function waitSuccess(page, selector, timeout = 90_000) {
    await page.waitForFunction((selector) => ['success', 'error'].includes(document.querySelector(selector)?.dataset.state), selector, { timeout });
    healthy();
    check(await page.locator(selector).getAttribute('data-state') === 'success', 'App reported an unsuccessful step. No mutation is retried.');
  }
  function bindSource(binding, page) {
    check(binding.page === page && binding.frame === page.mainFrame() && validateSource(binding.frame.url(), options.local) === source,
      'Signer binding refused an unexpected page or frame.');
  }
  async function assertSecretFree(page) {
    const safe = await page.evaluate((key) => {
      const input = document.getElementById('view-key');
      const visible = document.body.innerText;
      return (!input?.value || input.type === 'password') && (!key || !visible.includes(key))
        && !/ed25519:[1-9A-HJ-NP-Za-km-z]{80,}/.test(visible);
    }, clipboardKey || null);
    // Inspect text only in Node memory; never log it or write a DOM snapshot.
    // This also catches a known signature accidentally rendered by the app.
    const text = await page.locator('body').innerText();
    if (!safe || redact(text) !== text) unsafeCapture = true;
    check(!unsafeCapture, 'Refusing capture: sensitive text is visible. Raw videos will be discarded.');
  }
  async function screenshots(page, role, state, focus) {
    healthy();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      if (focus) await page.locator(focus).scrollIntoViewIfNeeded();
      await assertSecretFree(page);
      await page.screenshot({ path: path.join(output, `${role}-${state}-${width}.png`), fullPage: true });
      mark(role, `screenshot-${state}-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    if (focus) await page.locator(focus).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200); // A short edit handle in the real browser video.
  }
  async function createPage(role, accountId) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 },
      recordVideo: { dir: output, size: { width: 1440, height: 900 } }, serviceWorkers: 'block', acceptDownloads: false });
    const entry = { context, role };
    contexts.push(entry);
    let page;
    let connectorSeen = false;
    await context.route('**/*', async (route) => {
      try {
        const request = route.request();
        const url = new URL(request.url());
        if (request.isNavigationRequest()) {
          check(request.frame() === page?.mainFrame() && validateSource(url.href, options.local) === source, 'Unexpected browser navigation blocked.');
        }
        if (request.url() === CONNECTOR_IMPORT) {
          check(request.method() === 'GET', 'Unexpected connector request.');
          connectorSeen = true;
          await route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: CONNECTOR_MODULE });
          return;
        }
        check(!clipboardKey || !(request.url() + (request.postData() || '')).includes(clipboardKey), 'Auditor key must never leave the browser via network.');
        if (url.origin === new URL(RPC).origin) {
          check(url.href === `${RPC}/` || url.href === RPC, 'Unexpected RPC URL.');
          if (request.method() === 'OPTIONS') { await route.continue(); return; }
          check(request.method() === 'POST', 'Unexpected RPC HTTP method.');
          const payload = request.postDataJSON();
          const reads = ['query', 'block', 'status', 'tx', 'EXPERIMENTAL_tx_status'];
          if (!reads.includes(payload?.method)) {
            check(role === 'receiver' && options.execute, 'This context cannot broadcast transactions.');
            signer.authorizeBrowserSpend(payload);
            // Forward the REAL request once; reject RPC errors rather than expose
            // a provider error containing its signed request to screenshots/video.
            const response = await route.fetch({ maxRetries: 0, maxRedirects: 0, timeout: 90_000 });
            const body = await response.json();
            check(response.ok() && !body.error, 'Spend outcome is uncertain; inspect the recorded hash before another run.');
            successful(body.result);
            check(transactionHash(body.result) === signer.spendHash, 'Unexpected spend hash in RPC response.');
            await route.fulfill({ response }); // Unchanged real RPC response; no mocks.
            return;
          }
          await route.continue(); return;
        }
        const appAsset = url.origin === new URL(source).origin && ['/', '/index.html', '/app.js', '/config.js', '/styles.css', '/favicon.ico'].includes(url.pathname);
        const dependency = url.origin === 'https://esm.sh';
        const publicHistory = url.origin === 'https://api-testnet.nearblocks.io';
        check(request.method() === 'GET' && (appAsset || dependency || publicHistory), 'Unexpected outbound browser request blocked.');
        await route.continue();
      } catch (error) { fail(error); await route.abort('blockedbyclient').catch(() => {}); }
    });
    pageStarts.set(role, performance.now());
    page = await context.newPage();
    entry.page = page;
    page.setDefaultTimeout(30_000);
    page.on('pageerror', () => fail(new PublicError('Hosted app runtime error; raw browser errors withheld.')));
    // No console/request/error payload logging, tracing, HAR or storageState.
    await page.exposeBinding('__veilDemoAccounts', (binding) => {
      bindSource(binding, page);
      check(accountId === RECEIVER || accountId === SENDER, 'Unsigned auditor has no signing account.');
      return [{ accountId }];
    });
    await page.exposeBinding('__veilSignMessage', async (binding, params) => {
      try { bindSource(binding, page); return await signer.signMessage(accountId, params); }
      catch (error) { fail(error); throw new Error(publicError(error)); }
    });
    await page.exposeBinding('__veilSendTransaction', async (binding, params) => {
      try { bindSource(binding, page); return await signer.signAndSendTransaction(accountId, params); }
      catch (error) { fail(error); throw new Error(publicError(error)); }
    });
    await page.exposeBinding('__veilCaptureClipboard', (binding, value) => {
      bindSource(binding, page);
      check(role === 'receiver' && clipboardArmed && typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value), 'Unexpected clipboard operation.');
      clipboardArmed = false;
      clipboardKey = value;
      rememberSecret(value);
    });
    await page.addInitScript(() => {
      // Isolated clipboard: no OS clipboard, no visible textarea/fallback, no
      // global variable containing clipboard data and no clipboard read API.
      Object.defineProperty(navigator, 'clipboard', { configurable: false, value: Object.freeze({
        writeText: (value) => window.__veilCaptureClipboard(value),
        readText: () => Promise.reject(new Error('Clipboard reads disabled in scripted demo')),
      }) });
    });
    page.on('dialog', async (dialog) => {
      try {
        check(role === 'receiver' && entry.confirmArmed && dialog.type() === 'confirm'
          && dialog.message().includes(RECEIVER) && /0\.001(?:0)?\s+(?:testnet\s+)?NEAR/i.test(dialog.message()), 'Unexpected native confirmation; dismissed.');
        entry.confirmArmed = false;
        evidence.checks.spendConfirmed = true;
        mark(role, 'native-spend-confirm');
        await dialog.accept();
      } catch (error) { fail(error); await dialog.dismiss().catch(() => {}); }
    });
    const response = await page.goto(source, { waitUntil: 'networkidle', timeout: 60_000 });
    check(response?.ok() && validateSource(page.url(), options.local) === source, 'App failed to load at the approved source URL.');
    const schema = await page.evaluate((ids) => {
      const config = window.VEIL_CONFIG || {};
      return { ids: ids.every((id) => document.querySelectorAll(`[id="${id}"]`).length === 1),
        empty: ['recipient', 'amount', 'view-key', 'auditor-name'].every((id) => document.getElementById(id)?.value === ''),
        password: document.getElementById('view-key')?.type === 'password',
        exportInDetails: !!document.querySelector('.auditor-access #export-view'),
        network: config.network, registry: config.registryId, router: config.routerId, rpc: config.rpcUrl };
    }, REQUIRED_IDS);
    check(connectorSeen && schema.ids && schema.empty && schema.password && schema.exportInDetails, 'Hosted app schema is not ready: require polished IDs, empty inputs and masked auditor input.');
    check(schema.network === 'testnet' && schema.registry === REGISTRY && schema.router === ROUTER && schema.rpc === RPC, 'Hosted app testnet configuration does not match the approved contracts/RPC.');
    healthy(); mark(role, 'page-ready');
    return entry;
  }

  try {
    const rpc = provider();
    const credentials = await loadCredentials();
    evidence.nearAmounts.preflightBalances = await preflight(rpc, credentials.loaded);
    evidence.checks.preflight = true;
    await credentials.persist();
    process.stdout.write('Preflight passed: both testnet accounts have FullAccess and at least 0.2 NEAR.\n');
    if (!options.execute) { evidence.checks.completed = true; return; }
    if (options.local && !options.url) server = await startLocalServer();
    source = validateSource(options.url || (server ? `http://127.0.0.1:${server.address().port}/` : HOSTED), options.local);
    evidence.sourceUrl = source;
    await mkdir(output, { recursive: true });
    signer = createTestSigner({ rpc, credentials: credentials.loaded, execute: options.execute,
      onTransaction(operation, tx) {
        evidence.transactions[operation] = { accountId: tx.accountId, receiverId: tx.receiverId, hash: tx.hash, nearAmount: tx.amount, explorerUrl: explorer(tx.hash) };
        if (tx.stealthAccount) evidence.accountIds.stealth = tx.stealthAccount;
        mark(operation === 'send' ? 'sender' : 'receiver', `${operation}-signed`);
      } });
    // Named account credentials stay in this Node process, never Chromium's env.
    const browserEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/PRIVATE|SECRET|TOKEN|PASSWORD|CREDENTIAL|^VEIL_/i.test(name)));
    browser = await playwright().chromium.launch({ headless: !options.headed, env: browserEnv });
    const receiver = await createPage('receiver', RECEIVER);
    const sender = await createPage('sender', SENDER);
    const auditor = await createPage('auditor', undefined);
    await screenshots(receiver.page, 'receiver', 'initial', '#connect-receive');
    await step('receiver', 'connect', async () => {
      await receiver.page.locator('#connect-receive').click();
      await waitText(receiver.page, '#wallet-status', RECEIVER.replaceAll('.', '\\.'));
      evidence.checks.receiverConnected = true;
    });
    await step('receiver', 'enable', async () => {
      signer.arm('message');
      await receiver.page.locator('#enable').click();
      await receiver.page.waitForFunction(() => !document.getElementById('export-view')?.disabled && !document.getElementById('refresh')?.disabled);
      await waitSuccess(receiver.page, '#identity-output');
      check(await receiver.page.locator('#register-output').getAttribute('data-state') !== 'error', 'Receiver registration lookup failed or uses different Veil keys.');
      check(signer.messageSigned, 'Enable did not request the expected NEP-413 signature.');
      evidence.checks.receiverEnabled = true;
    });
    await step('receiver', 'register', async () => {
      const alreadyRegistered = await receiver.page.locator('#register').isDisabled()
        && /Name registered/i.test(await receiver.page.locator('#register').innerText())
        && (await receiver.page.locator('#share-name').innerText()).trim() === RECEIVER;
      evidence.checks.receiverRegistrationAlreadyPresent = alreadyRegistered;
      if (alreadyRegistered) { evidence.checks.receiverRegistered = true; return; }
      signer.arm('register');
      await receiver.page.locator('#register').click();
      await waitSuccess(receiver.page, '#register-output');
      await waitText(receiver.page, '#register-output', 'registered|ready for private payments|ready to receive|registration confirmed');
      check(evidence.transactions.register, 'Registration did not produce a transaction.');
      evidence.checks.receiverRegistered = true;
    });
    await screenshots(receiver.page, 'receiver', 'registered', '#register-output');
    await step('sender', 'connect-and-fill', async () => {
      await sender.page.locator('#connect-receive').click();
      await waitText(sender.page, '#wallet-status', SENDER.replaceAll('.', '\\.'));
      evidence.checks.senderConnected = true;
      await sender.page.locator('#tab-send').click();
      await sender.page.locator('#recipient').fill(RECEIVER);
      await sender.page.locator('#amount').fill('0.05'); // Focus change triggers recipient blur.
      await sender.page.locator('#amount').blur();
      await waitSuccess(sender.page, '#resolve-output');
      await waitText(sender.page, '#resolve-output', 'Veil enabled');
      evidence.checks.recipientResolved = true;
    });
    await screenshots(sender.page, 'sender', 'ready', '#send');
    await step('sender', 'send', async () => {
      signer.arm('send');
      await sender.page.locator('#send').click();
      await sender.page.locator('#send-receipt .receipt').waitFor({ state: 'visible', timeout: 90_000 });
      await waitText(sender.page, '#send-receipt', 'Delivered privately');
      await waitText(sender.page, '#send-form', '0\\.0?5(?:00)?\\s*NEAR');
      check(evidence.transactions.send && signer.stealthAccount, 'Delivery did not produce a public transaction hash.');
      evidence.checks.deliveredPrivately = true;
    });
    await screenshots(sender.page, 'sender', 'delivered', '#send-receipt');
    let owned;
    await step('receiver', 'scan', async () => {
      await receiver.page.locator('#refresh').click();
      owned = receiver.page.locator('#inbox tr').filter({ has: receiver.page.locator(`a[href="https://testnet.nearblocks.io/address/${signer.stealthAccount}"]`) });
      await owned.waitFor({ state: 'visible', timeout: 90_000 });
      check(await owned.count() === 1 && /0\.0500/.test(await owned.innerText()), 'Receiver inbox must show this exact destination and 0.0500 NEAR.');
      check(await owned.locator('[data-spend]').count() === 1, 'Owned payment has no spend action.');
      evidence.checks.receiverFoundPayment = true;
    });
    await screenshots(receiver.page, 'receiver', 'received', '#inbox');
    await step('receiver', 'spend', async () => {
      receiver.confirmArmed = true;
      signer.arm('spend');
      await owned.locator('[data-spend]').click();
      await waitSuccess(receiver.page, '#spend-output');
      await waitText(receiver.page, '#spend-output[data-state="success"]', 'completed|Sent 0\\.0010 NEAR');
      check(evidence.checks.spendConfirmed && signer.spendHash, 'Native spend confirmation or broadcast was absent.');
      const text = await receiver.page.locator('#spend-output').innerText();
      const links = await receiver.page.locator('#spend-output a').evaluateAll((elements) => elements.map((el) => el.href));
      check(text.includes(signer.spendHash) || links.includes(explorer(signer.spendHash)), 'Spend receipt does not contain the completed transaction hash.');
      const final = await rpc.sendJsonRpc('tx', { tx_hash: signer.spendHash, sender_account_id: signer.stealthAccount, wait_until: 'FINAL' });
      successful(final);
      check(final.final_execution_status === 'FINAL' && transactionHash(final) === signer.spendHash, 'Spend is not final at the expected hash.');
      evidence.checks.spendCompleted = true;
    });
    await screenshots(receiver.page, 'receiver', 'spent', '#spend-output');
    await step('receiver', 'copy-auditor-key', async () => {
      await receiver.page.locator('.auditor-access > summary').click();
      clipboardArmed = true;
      await receiver.page.locator('#export-view').click();
      await waitSuccess(receiver.page, '#export-output');
      check(clipboardKey && !clipboardArmed, 'Auditor key was not captured by the isolated memory clipboard.');
      await assertSecretFree(receiver.page);
      await receiver.page.locator('.auditor-access > summary').click();
    });
    await step('auditor', 'scan-read-only', async () => {
      await auditor.page.locator('#auditor-name').fill(RECEIVER);
      check(await auditor.page.locator('#view-key').getAttribute('type') === 'password', 'Auditor input must remain masked.');
      await auditor.page.locator('#view-key').fill(clipboardKey);
      await auditor.page.locator('#audit').click();
      await waitSuccess(auditor.page, '#auditor-output');
      const row = auditor.page.locator('#auditor-results tr').filter({ has: auditor.page.locator(`a[href="https://testnet.nearblocks.io/address/${signer.stealthAccount}"]`) });
      await row.waitFor({ state: 'visible', timeout: 90_000 });
      check(await row.count() === 1, 'Auditor did not find this payment.');
      check(await auditor.page.locator('#auditor-results [data-spend], #auditor-results button').count() === 0, 'Auditor results must have no Spend controls.');
      check(/not connected|disconnected/i.test(await auditor.page.locator('#wallet-status').innerText()), 'Auditor context must remain unsigned.');
      evidence.checks.auditorFoundPayment = true;
      evidence.checks.auditorUnsigned = true;
      evidence.checks.auditorCannotSpend = true;
    });
    await screenshots(auditor.page, 'auditor', 'read-only', '#auditor-results');
    await auditor.page.locator('#view-key').fill('');
    healthy(); evidence.checks.completed = true;
  } finally {
    // Context.close flushes raw videos; no signed state is persisted.
    // If an app regression renders sensitive material, discard ALL raw videos.
    for (const entry of contexts) {
      if (!entry.page || entry.page.isClosed()) continue;
      try { await assertSecretFree(entry.page); }
      catch { unsafeCapture = true; evidence.checks.completed = false; }
    }
    clipboardKey = undefined;
    for (const entry of contexts) {
      try {
        await entry.context.close();
        if (entry.page?.video()) {
          if (unsafeCapture) await entry.page.video().delete();
          else {
            const name = `${entry.role}-raw.webm`;
            await entry.page.video().saveAs(path.join(output, name));
            markers.videos[entry.role] = name;
          }
        }
      } catch { evidence.checks.completed = false; }
    }
    if (browser) await browser.close().catch(() => { evidence.checks.completed = false; });
    if (server) await new Promise((resolve) => server.close(resolve));
    if (fatal) evidence.checks.completed = false;
    if (options.execute && contexts.length) evidence.checks.capturesSafe = !unsafeCapture;
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
    if (options.execute && contexts.length) {
      await writeFile(path.join(output, 'timing-markers.json'), `${JSON.stringify(markers, null, 2)}\n`, { flag: 'wx' });
    }
    process.stdout.write(`${DISCLOSURE}\nPublic evidence: ${evidencePath}\n`);
    if (!evidence.checks.completed) process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${publicError(error)}\n`); process.exitCode = 1; });
}
