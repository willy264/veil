// Records the frames for the narrated product video against the hosted app, with real testnet
// transactions. Only the wallet connector module is replaced: a Node signer (near-api-js, keys from
// near-cli credential files) signs the NEP-413 key message, the registration and the private send.
// The hosted app still derives keys, scans, and signs the spend itself. Keys are never printed.
//
// Run: VEIL_PLAYWRIGHT_MODULE=<playwright> VEIL_CHROMIUM=<chrome binary> node apps/web/record-video.mjs <out-dir>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { JsonRpcProvider, KeyPair, KeyPairSigner, actions, baseDecode, createTransaction } from 'near-api-js';
import { CONNECTOR_IMPORT, CONNECTOR_MODULE, HOSTED, REGISTRY, ROUTER, RPC } from './test-signer.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.VEIL_PLAYWRIGHT_MODULE || 'playwright');
const RECEIVER = process.env.VEIL_FILM_RECEIVER ?? 'veil-film-recv.testnet';
const SENDER = process.env.VEIL_FILM_SENDER ?? 'veil-judge-send.testnet';
const SEND_AMOUNT = '0.05';
const SPEND_AMOUNT = '0.01';
const OUT = path.resolve(process.argv[2] ?? 'video-frames');
// A narrow viewport at device scale 2 gives 1920x1080 frames with large, readable text.
const VIEWPORT = { width: 960, height: 540 };
// The only transactions the Node signer will sign for this recording.
const ALLOWED = new Map([[RECEIVER, { receiverId: REGISTRY, methodName: 'register' }], [SENDER, { receiverId: ROUTER, methodName: 'send_near' }]]);

const provider = new JsonRpcProvider({ url: RPC });
const log = { hosted: HOSTED, receiver: RECEIVER, sender: SENDER, transactions: [], dialogs: [], frames: [] };

async function keySigner(accountId) {
  const file = path.join(os.homedir(), '.near-credentials', 'testnet', `${accountId}.json`);
  const record = JSON.parse(await readFile(file, 'utf8'));
  return new KeyPairSigner(KeyPair.fromString(record.private_key ?? record.secret_key));
}

async function session(accountId) {
  const context = await browserPromise.then((b) => b.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' }));
  await context.route(CONNECTOR_IMPORT, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: CONNECTOR_MODULE }));
  if (accountId) {
    const signer = await keySigner(accountId);
    await context.exposeFunction('__veilDemoAccounts', () => [{ accountId }]);
    await context.exposeFunction('__veilSignMessage', async (p) => {
      const signed = await signer.signNep413Message(accountId, { message: p.message, recipient: p.recipient, nonce: Uint8Array.from(p.nonce) });
      return { accountId, signature: Buffer.from(signed.signature).toString('base64') };
    });
    await context.exposeFunction('__veilSendTransaction', async (p) => {
      const call = p.actions?.[0]?.params;
      const allowed = ALLOWED.get(accountId);
      if (p.actions?.length !== 1 || p.receiverId !== allowed.receiverId || call?.methodName !== allowed.methodName) throw new Error('Unexpected transaction for this recording');
      const publicKey = await signer.getPublicKey();
      const access = await provider.viewAccessKey({ accountId, publicKey: publicKey.toString(), finalityQuery: { finality: 'final' } });
      const block = await provider.viewBlock({ finality: 'final' });
      const tx = createTransaction(accountId, publicKey, p.receiverId, BigInt(access.nonce) + 1n,
        [actions.functionCall(call.methodName, new TextEncoder().encode(JSON.stringify(call.args)), BigInt(call.gas), BigInt(call.deposit))], baseDecode(block.header.hash));
      const { signedTransaction } = await signer.signTransaction(tx);
      const raw = await provider.sendTransaction(signedTransaction);
      log.transactions.push({ signer: accountId, method: call.methodName, hash: raw.transaction?.hash ?? raw.transaction_outcome?.id });
      return JSON.parse(JSON.stringify(raw, (_, value) => (typeof value === 'bigint' ? value.toString() : value)));
    });
  }
  const page = await context.newPage();
  page.on('dialog', async (dialog) => { log.dialogs.push(dialog.message()); await dialog.accept(); });
  page.on('pageerror', (error) => log.dialogs.push(`page error: ${error.message}`));
  await page.goto(HOSTED, { waitUntil: 'networkidle' });
  return { context, page };
}

async function waitText(page, selector, pattern, timeout = 90_000) {
  await page.waitForFunction(([s, p]) => new RegExp(p).test(document.querySelector(s)?.textContent ?? ''), [selector, pattern], { timeout });
}

async function frame(page, name, selector) {
  if (selector) await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  log.frames.push(name);
}

const browserPromise = chromium.launch({ executablePath: process.env.VEIL_CHROMIUM, args: ['--no-sandbox'] });

async function main() {
  await mkdir(OUT, { recursive: true });
  const receiver = await session(RECEIVER);
  await frame(receiver.page, '01-hero');

  await receiver.page.click('#connect-receive');
  await waitText(receiver.page, '#wallet-status', RECEIVER.replaceAll('.', '\\.'));
  await receiver.page.click('#enable');
  await waitText(receiver.page, '#identity-output', 'Veil enabled');
  await waitText(receiver.page, '#register-output', 'Register your name');
  await frame(receiver.page, '02-enabled', '#receive-step-2');
  await receiver.page.click('#register');
  await waitText(receiver.page, '#register-output', 'ready for private payments');
  await frame(receiver.page, '03-registered', '#receive-step-3');

  const sender = await session(SENDER);
  await sender.page.click('#tab-send');
  await sender.page.click('#connect-send');
  await waitText(sender.page, '#wallet-status', SENDER.replaceAll('.', '\\.'));
  await sender.page.fill('#recipient', RECEIVER);
  await sender.page.press('#recipient', 'Tab');
  await waitText(sender.page, '#resolve-output', 'Veil enabled');
  await sender.page.fill('#amount', SEND_AMOUNT);
  await sender.page.press('#amount', 'Tab');
  await frame(sender.page, '04-send-filled', '#send-path');
  await sender.page.click('#send');
  await waitText(sender.page, '#send-receipt', 'Delivered privately');
  await frame(sender.page, '05-send-receipt', '#send-receipt');

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await receiver.page.click('#refresh');
    await receiver.page.waitForFunction(() => document.getElementById('scan-output').getAttribute('aria-busy') === 'false');
    if (/Found 1 private payment/.test(await receiver.page.textContent('#scan-output'))) break;
    await receiver.page.waitForTimeout(5_000);
  }
  await waitText(receiver.page, '#scan-output', 'Found 1 private payment', 5_000);
  await frame(receiver.page, '06-inbox', '#private-payments');
  await waitText(receiver.page, '#proof-mode', 'Live testnet');
  await receiver.page.waitForFunction(() => document.getElementById('proof-public-list').getAttribute('aria-busy') === 'false', null, { timeout: 30_000 });
  await frame(receiver.page, '07-proof', '.hero-band');

  await receiver.page.fill('#spend-destination', SENDER);
  await receiver.page.fill('#spend-amount', SPEND_AMOUNT);
  await frame(receiver.page, '08-spend-form', '#spend-controls');
  await receiver.page.click('#inbox [data-spend]');
  await waitText(receiver.page, '#spend-output', 'Sent 0\\.0100 NEAR');
  log.spendLink = await receiver.page.locator('#spend-output a').first().getAttribute('href');
  await frame(receiver.page, '09-spent', '#spend-output');

  await receiver.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: HOSTED });
  await receiver.page.click('details.auditor-access summary');
  await receiver.page.click('#export-view');
  const auditorKey = await receiver.page.evaluate(() => navigator.clipboard.readText());
  const auditor = await session();
  await auditor.page.fill('#auditor-name', RECEIVER);
  await auditor.page.fill('#view-key', auditorKey);
  await auditor.page.click('#audit');
  await waitText(auditor.page, '#auditor-output', 'Found 1 payment');
  await frame(auditor.page, '10-auditor', '.auditor-section');

  log.recordedAt = new Date().toISOString();
  await writeFile(path.join(OUT, 'recording.json'), `${JSON.stringify(log, null, 2)}\n`);
  console.log(JSON.stringify(log, null, 2));
  await (await browserPromise).close();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error(JSON.stringify(log, null, 2));
  await (await browserPromise).close();
  process.exit(1);
});
