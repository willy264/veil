import { ed25519 } from 'https://esm.sh/@noble/curves@1.9.7/ed25519';
import { hkdf } from 'https://esm.sh/@noble/hashes@1.8.0/hkdf';
import { sha256 } from 'https://esm.sh/@noble/hashes@1.8.0/sha256';
import { sha512 } from 'https://esm.sh/@noble/hashes@1.8.0/sha512';

const CONFIG = window.VEIL_CONFIG ?? {};
const RPC = CONFIG.rpcUrl ?? 'https://rpc.testnet.near.org';
const REGISTRY = CONFIG.registryId ?? 'registry2.veil-williams.testnet';
const ROUTER = CONFIG.routerId ?? 'router2.veil-williams.testnet';
const ORDER = ed25519.CURVE.n;
const text = new TextEncoder();
let connector;
let connectorPromise;
let wallet;
let accountId;
let keys;
let payments = [];


const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const explorer = 'https://testnet.nearblocks.io';
const busy = new Set();
let registered = false;
let sessionVersion = 0;
let resolveVersion = 0;
let auditVersion = 0;
let proofRequest = 0;
let resolvedName = '';
let resolvedMeta = null;
let lastBalances = [];
let scanComplete = false;
let sentReceipt = null;
let uncertainSend = false;
let knownPayments = new Set();

const icon = (name) => '<svg class="icon" aria-hidden="true"><use href="#icon-' + name + '" /></svg>';
const empty = (message) => '<div class="empty-state">' + icon('inbox') + '<p>' + escapeHtml(message) + '</p></div>';
function state(id, kind, message, retry) {
  const el = $(id);
  el.dataset.state = kind;
  el.setAttribute('aria-busy', String(kind === 'loading'));
  el.innerHTML = message ? '<div class="state-line">' + (kind === 'loading' ? '<span class="spinner" aria-hidden="true"></span>' : icon(kind === 'success' ? 'check' : kind === 'empty' ? 'inbox' : 'info')) + '<span>' + escapeHtml(message) + '</span></div>' : '';
  if (retry) {
    el.innerHTML += '<button type="button" class="quiet" data-retry>Try again</button>';
    el.querySelector('[data-retry]')?.addEventListener('click', retry);
  }
}
function friendlyError(error) {
  const message = String(error?.message || '');
  if (/reject|cancel|declin/i.test(message)) return 'The wallet request was cancelled. You can try again when you are ready.';
  if (/different Veil keys/.test(message)) return 'This name uses different Veil keys. Open the original wallet signing key to keep access to its payments.';
  if (/insufficient|not enough|balance.*exceed/i.test(message)) return 'There is not enough testnet NEAR for this action and its fee. Top up the account, then try again.';
  if (/HTTP|fetch|network|timeout|RPC/i.test(message)) return 'Testnet could not be reached. Check your connection, then try again.';
  if (/Transaction failed/.test(message)) return 'The transaction failed. Check your wallet activity on NearBlocks before trying again.';
  // Only our own fixed messages may reach the UI. Wallet errors can contain signing data.
  const allowed = [
    'Connect a testnet wallet first', 'Enable Veil before scanning your payments.',
    'Enter a valid testnet account name.', 'Recipient has not enabled Veil',
    'This recipient uses a version this app cannot send to.',
    'Enter a positive NEAR amount with at most 24 decimals', 'Amount must be positive',
    'Enter the auditor key shared by the recipient.', 'That name is not on Veil yet.',
    'That auditor key does not match this registered name.',
    'No matching private payment was found.', 'Connect and enable Veil before spending.',
    'The wallet changed. Start this step again.', 'The wallet returned an unexpected signature.',
    'Copying was blocked. Allow clipboard access in your browser, then try again.',
    'A payment is already in progress.', 'This payment is awaiting confirmation. Check its account before sending again.',
    'Transaction confirmation is unavailable. Check your wallet activity on NearBlocks.',
    'Only testnet accounts are supported.', 'Registration could not be confirmed. Check the registry before trying again.'
  ];
  return allowed.includes(message) ? message : 'This step could not finish. Check your wallet and connection, then try again.';
}
async function run(name, output, loading, fn, retry = true) {
  if (busy.has(name)) return;
  const version = sessionVersion;
  busy.add(name);
  state(output, 'loading', loading);
  syncControls();
  try { return await fn(); }
  catch (error) {
    if (version === sessionVersion || name === 'connect') state(output, 'error', friendlyError(error), retry ? () => run(name, output, loading, fn, retry) : undefined);
  } finally { busy.delete(name); syncControls(); }
}
function formatNear(value) {
  if (value === null || value === undefined) return 'Unavailable';
  const units = (BigInt(value) + 5n * 10n ** 19n) / 10n ** 20n;
  return (units / 10000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + (units % 10000n).toString().padStart(4, '0');
}
function validName(value) {
  return value.length >= 2 && value.length <= 64 && /^[a-z0-9]+(?:[-_.][a-z0-9]+)*\.testnet$/.test(value);
}
function requireName(value) { if (!validName(value)) throw new Error('Enter a valid testnet account name.'); return value; }
function validAmount() { try { yocto($('amount').value.trim()); return true; } catch { return false; } }
function syncControls() {
  const working = busy.has('enable') || busy.has('register') || busy.has('send') || busy.has('spend');
  $('connect').hidden = !!accountId;
  $('disconnect').hidden = !accountId;
  $('disconnect').disabled = working;
  ['connect', 'connect-receive', 'connect-send'].forEach((id) => { $(id).disabled = busy.has('connect') || working || !!accountId; });
  $('connect-send').hidden = !!accountId;
  $('enable').disabled = !accountId || !!keys || working;
  $('register').disabled = !keys || registered || working;
  $('share').disabled = !registered || busy.has('share');
  $('export-view').disabled = !keys || busy.has('export');
  $('refresh').disabled = !keys || busy.has('refresh') || working;
  $('audit').disabled = busy.has('audit');
  $('send').disabled = !wallet || !resolvedMeta || resolvedName !== $('recipient').value.trim() || !validAmount() || working || uncertainSend;
  $('recipient').disabled = busy.has('send');
  $('amount').disabled = busy.has('send');
  const current = !accountId ? 1 : !keys ? 2 : !registered ? 3 : 4;
  ['connect-receive', 'enable', 'register', 'share'].forEach((id, i) => {
    $('receive-step-' + (i + 1)).classList.toggle('is-current', current === i + 1);
    $('receive-step-' + (i + 1)).classList.toggle('is-complete', current > i + 1);
    $(id).classList.toggle('secondary', current !== i + 1);
  });
  $('connect-receive').textContent = accountId ? 'Wallet connected' : 'Connect wallet';
  $('enable').textContent = keys ? 'Veil enabled' : 'Enable Veil';
  $('register').textContent = registered ? 'Name registered' : 'Register name';
  const sendStep = sentReceipt ? 4 : !resolvedMeta ? 1 : !validAmount() ? 2 : 3;
  $('send-path').querySelectorAll('.step').forEach((el, i) => el.classList.toggle('is-current', sendStep === i + 1));
  $('inbox').querySelectorAll('[data-spend]').forEach((button) => { button.disabled = working || button.dataset.unavailable === 'true'; });
}
function choosePath(path, focus = false) {
  ['receive', 'send'].forEach((name) => {
    const selected = name === path;
    $('tab-' + name).setAttribute('aria-selected', String(selected));
    $('tab-' + name).tabIndex = selected ? 0 : -1;
    $(name + '-path').hidden = !selected;
  });
  if (focus) $('tab-' + path).focus();
}
function clearAuditor() {
  auditVersion++;
  $('view-key').value = '';
  $('auditor-name').value = '';
  $('view-key').removeAttribute('aria-invalid');
  $('auditor-name').removeAttribute('aria-invalid');
  $('auditor-results').innerHTML = '';
  $('auditor-results').hidden = true;
  state('auditor-output', 'empty', 'Enter a registered name and auditor key to see incoming payments.');
}
function resetSession() {
  sessionVersion++;
  wallet = undefined; accountId = undefined; keys = undefined; payments = [];
  registered = false; lastBalances = []; scanComplete = false; knownPayments = new Set();
  $('inbox').innerHTML = ''; $('inbox-table').hidden = true;
  $('wallet-status').textContent = 'Wallet not connected';
  $('share-name').textContent = 'Your registered name will appear here.';
  state('connect-output', 'empty', '');
  state('identity-output', 'empty', 'Connect your wallet to continue.');
  state('register-output', 'empty', 'Enable Veil before registering.');
  ['share-output', 'export-output', 'spend-output'].forEach((id) => state(id, 'empty', ''));
  state('scan-output', 'empty', 'Enable Veil to find payments sent to you.');
  clearAuditor(); resetProof(); syncControls();
}
function resetProof() {
  proofRequest++;
  $('proof-mode').textContent = 'Example';
  $('proof-caption').textContent = 'An illustration of private receiving. These are not live account records.';
  $('proof-public-title').textContent = 'What anyone sees for alice.near';
  $('proof-private-title').textContent = 'What Alice sees';
  $('proof-public-list').innerHTML = empty('No new payments to this name in this example.');
  $('proof-private-list').innerHTML = ['0.0100', '0.0250', '0.0400'].map((amount, i) => '<p><span>Payment 0' + (i + 1) + '</span><strong class="money">' + amount + ' NEAR</strong></p>').join('');
  $('proof-public-link').href = '#how-it-works';
  $('proof-public-link').textContent = 'See how receiving works';
}
async function updateProof(balances = lastBalances) {
  if (!keys || !accountId) return;
  const request = ++proofRequest;
  const name = accountId;
  $('proof-mode').textContent = 'Live testnet';
  $('proof-caption').textContent = 'Public history beside available private balances found in this browser. Amounts and senders remain public.';
  $('proof-public-title').textContent = 'What anyone sees for ' + name;
  $('proof-private-title').textContent = 'What you see';
  $('proof-private-list').innerHTML = balances.length ? balances.slice(0, 3).map((row, i) => '<p><span>Payment ' + String(i + 1).padStart(2, '0') + '</span><strong class="money">' + formatNear(row.balance) + (row.balance == null ? '' : ' NEAR') + '</strong></p>').join('') : empty(scanComplete ? 'No incoming payments found. Share your registered name to receive one.' : 'Scan your inbox to find incoming payments.');
  $('proof-public-link').textContent = 'Open public activity on NearBlocks';
  $('proof-public-link').href = explorer + '/address/' + encodeURIComponent(name);
  state('proof-public-list', 'loading', 'Loading public activity.');
  try {
    const response = await fetch('https://api-testnet.nearblocks.io/v1/account/' + encodeURIComponent(name) + '/txns?page=1&per_page=3&order=desc', { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Public activity unavailable');
    const data = await response.json();
    if (request !== proofRequest || accountId !== name || !keys) return;
    if (!Array.isArray(data.txns)) throw new Error('Public activity unavailable');
    const seen = new Set();
    const rows = data.txns.filter((row) => /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(row.transaction_hash) && !seen.has(row.transaction_hash) && seen.add(row.transaction_hash));
    $('proof-public-list').setAttribute('aria-busy', 'false');
    $('proof-public-list').innerHTML = rows.length ? rows.map((row) => '<a href="' + explorer + '/txns/' + row.transaction_hash + '" target="_blank" rel="noreferrer"><span>Public transaction</span><span>' + row.transaction_hash.slice(0, 8) + '…</span></a>').join('') : empty('No public transactions were returned for this name.');
  } catch {
    if (request === proofRequest) state('proof-public-list', 'error', 'Public activity could not load. Open NearBlocks or try again.', () => updateProof());
  }
}
const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const fromHex = (value) => { if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Expected 32-byte hex'); return Uint8Array.from(value.match(/.{2}/g), (part) => Number.parseInt(part, 16)); };
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; };
const scalarBytes = (value) => { const out = new Uint8Array(32); for (let i = 0; i < 32; i += 1) { out[i] = Number(value & 255n); value >>= 8n; } return out; };
const scalar = (bytes) => { let value = 0n; for (let i = bytes.length - 1; i >= 0; i -= 1) value = (value << 8n) | BigInt(bytes[i]); return value; };
const point = (value) => ed25519.Point.BASE.multiply(value);
function validPoint(bytes) { const p = ed25519.Point.fromHex(bytes); if (p.is0() || !p.isTorsionFree()) throw new Error('Invalid or unsafe Edwards point'); return p; }

function deriveKeys(signature) {
  const material = hkdf(sha256, signature, text.encode(`veil-nep413-v1\n${accountId}`), text.encode('spend-and-view'), 64);
  const spend = scalar(material.slice(0, 32)) % ORDER || 1n;
  const view = scalar(material.slice(32)) % ORDER || 1n;
  return { spend, view, spendPublicKey: point(spend).toBytes(), viewPublicKey: point(view).toBytes() };
}

function hashScalar(...parts) { return scalar(sha256(concat(...parts))) % ORDER; }
function deriveStealth(spendPublicKey, viewPublicKey, ephemeralScalar, outputIndex = 0) {
  const sharedPoint = validPoint(viewPublicKey).multiply(ephemeralScalar);
  const sharedBytes = sharedPoint.toBytes();
  const index = new Uint8Array(4); new DataView(index.buffer).setUint32(0, outputIndex, false);
  const h = hashScalar(text.encode('veil-v1'), sharedBytes, index);
  const stealthPoint = validPoint(spendPublicKey).add(ed25519.Point.BASE.multiplyUnsafe(h));
  validPoint(stealthPoint.toBytes());
  return { stealthAccount: hex(stealthPoint.toBytes()), ephemeralPublicKey: point(ephemeralScalar).toBytes(), viewTag: sha256(concat(text.encode('veil-tag'), sharedBytes))[0], privateScalar: h };
}

function scan(keysForScan, row) {
  const ephemeral = validPoint(fromHex(row.ephemeral_pub_hex));
  const shared = ephemeral.multiply(keysForScan.view).toBytes();
  if (sha256(concat(text.encode('veil-tag'), shared))[0] !== Number(row.view_tag)) return null;
  const index = new Uint8Array(4); new DataView(index.buffer).setUint32(0, Number(row.index), false);
  const h = hashScalar(text.encode('veil-v1'), shared, index);
  const expected = hex(validPoint(validPoint(keysForScan.spendPublicKey).add(ed25519.Point.BASE.multiplyUnsafe(h)).toBytes()).toBytes());
  if (expected !== row.stealth_account) return null;
  return keysForScan.spend === undefined ? { ...row } : { ...row, privateScalar: (keysForScan.spend + h) % ORDER };
}

function randomScalar() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return scalar(bytes) % (ORDER - 1n) + 1n; }
function base64(bytes) { let result = ''; for (const byte of bytes) result += String.fromCharCode(byte); return btoa(result); }
function decodeBase64(value) { const binary = atob(value); return Uint8Array.from(binary, (char) => char.charCodeAt(0)); }
function yocto(value) { if (!/^\d+(\.\d{1,24})?$/.test(String(value))) throw new Error('Enter a positive NEAR amount with at most 24 decimals'); const [whole, fraction = ''] = String(value).split('.'); const amount = BigInt(whole) * 10n ** 24n + BigInt(fraction.padEnd(24, '0')); if (amount <= 0n) throw new Error('Amount must be positive'); return amount; }


async function rpcQuery(params) {
  const response = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000), body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'query', params }) });
  if (!response.ok) throw new Error('Testnet RPC HTTP ' + response.status);
  const payload = await response.json();
  if (payload.error || payload.result?.error) throw new Error('Testnet RPC could not complete this request.');
  return payload.result;
}
async function view(contractId, methodName, args) {
  const result = await rpcQuery({ request_type: 'call_function', finality: 'final', account_id: contractId, method_name: methodName, args_base64: base64(text.encode(JSON.stringify(args))) });
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(result.result)));
}
async function signMessage() {
  if (!wallet || !accountId) throw new Error('Connect a testnet wallet first');
  const version = sessionVersion;
  const signed = await wallet.signMessage({ message: 'Veil key derivation v1: derive private receiving keys for this NEAR account.\nAccount: ' + accountId, recipient: accountId, nonce: sha256(text.encode('veil-key-derivation:testnet:v1:' + accountId)) });
  if (version !== sessionVersion) throw new Error('The wallet changed. Start this step again.');
  const signature = signed.signature ?? signed;
  const bytes = typeof signature === 'string' ? decodeBase64(signature) : Uint8Array.from(signature);
  if (bytes.length !== 64) throw new Error('The wallet returned an unexpected signature.');
  keys = deriveKeys(bytes);
  state('identity-output', 'success', 'Veil enabled. Your receiving keys are held in this browser.');
  state('register-output', 'empty', 'Register your name so people can pay you privately.');
  syncControls(); void updateProof();
}
async function callWallet(receiverId, methodName, args, deposit = '0', gas = '30000000000000') {
  if (!wallet) throw new Error('Connect a testnet wallet first');
  const result = await wallet.signAndSendTransaction({ receiverId, actions: [{ type: 'FunctionCall', params: { methodName, args, gas, deposit } }] });
  assertSuccess(result); return result;
}
function assertSuccess(result) {
  if (!result) throw new Error('Transaction confirmation is unavailable. Check your wallet activity on NearBlocks.');
  if (result.status?.Failure || result.receipts_outcome?.some((r) => r.outcome?.status?.Failure)) throw new Error('Transaction failed; inspect its receipt on testnet NearBlocks');
  if (!result.status || !Object.prototype.hasOwnProperty.call(result.status, 'SuccessValue')) throw new Error('Transaction confirmation is unavailable. Check your wallet activity on NearBlocks.');
}
function transactionHash(tx) { return tx?.transaction?.hash || tx?.transaction_outcome?.id || ''; }
function transactionLink(tx) {
  const hash = transactionHash(tx);
  return /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(hash) ? '<a href="' + explorer + '/txns/' + hash + '" target="_blank" rel="noreferrer">View transaction on NearBlocks</a>' : '';
}
async function getConnector() {
  if (!connectorPromise) connectorPromise = (async () => {
    const { NearConnector } = await import('https://esm.sh/@hot-labs/near-connect@0.12.0');
    connector = new NearConnector({ network: 'testnet', features: { testnet: true, signMessage: true } });
    connector.on('wallet:signIn', acceptWallet);
    connector.on('wallet:signOut', resetSession);
    return connector;
  })().catch((error) => { connectorPromise = undefined; throw error; });
  return connectorPromise;
}
async function connect() { await (await getConnector()).connect(); }
async function acceptWallet({ accounts }) {
  try {
    const id = accounts[0]?.accountId;
    if (!id || !validName(id)) throw new Error('Only testnet accounts are supported.');
    const connected = await connector.wallet();
    if (id !== accountId) resetSession();
    accountId = id; wallet = connected;
    $('wallet-status').textContent = id;
    state('connect-output', 'success', 'Connected to ' + id + '.');
    state('identity-output', 'empty', 'Enable Veil to open your private inbox.'); syncControls();
  } catch (error) { resetSession(); state('connect-output', 'error', friendlyError(error), connectAction); }
}
function sameKeys(meta, current) { return meta?.scheme_id === 1 && meta.spend_pub_hex === hex(current.spendPublicKey) && meta.view_pub_hex === hex(current.viewPublicKey); }
function markRegistered(tx) {
  registered = true; $('share-name').textContent = accountId;
  state('register-output', 'success', 'Your name is ready for private payments.');
  if (tx) $('register-output').innerHTML += transactionLink(tx);
  syncControls();
}
async function enable() {
  await signMessage(); const version = sessionVersion;
  await run('lookup', 'register-output', 'Checking your registered name.', async () => {
    const meta = await view(REGISTRY, 'get_meta', { account_id: accountId });
    if (version !== sessionVersion) return;
    if (sameKeys(meta, keys)) markRegistered();
    else if (meta) throw new Error('This name uses different Veil keys.');
    else state('register-output', 'empty', 'Register your name so people can pay you privately.');
  });
  await run('refresh', 'scan-output', 'Scanning for your private payments.', refresh);
}
async function register() {
  if (!keys) throw new Error('Enable Veil before registering your name.');
  const version = sessionVersion;
  const existing = await view(REGISTRY, 'get_meta', { account_id: accountId });
  if (version !== sessionVersion) throw new Error('The wallet changed. Start this step again.');
  if (existing && !sameKeys(existing, keys)) throw new Error('This name uses different Veil keys.');
  const tx = await callWallet(REGISTRY, 'register', { spend_pub_hex: hex(keys.spendPublicKey), view_pub_hex: hex(keys.viewPublicKey), scheme_id: 1 }, yocto('0.01').toString());
  if (version !== sessionVersion) return;
  markRegistered(tx); return tx;
}
function invalidateRecipient() {
  resolveVersion++; resolvedName = ''; resolvedMeta = null;
  $('recipient').removeAttribute('aria-invalid'); state('resolve-output', 'empty', 'Leave this field to check the name.');
  if (!uncertainSend) { sentReceipt = null; $('send-receipt').innerHTML = empty('Your receipt will appear after the payment is confirmed.'); }
  syncControls();
}
async function resolve() {
  const name = $('recipient').value.trim(); const request = ++resolveVersion;
  resolvedMeta = null; resolvedName = ''; syncControls();
  if (!validName(name)) {
    $('recipient').setAttribute('aria-invalid', 'true');
    state('resolve-output', 'error', 'Enter a valid testnet account name, such as alice.testnet.'); return;
  }
  state('resolve-output', 'loading', 'Checking whether this name uses Veil.');
  try {
    const meta = await view(REGISTRY, 'get_meta', { account_id: name });
    if (request !== resolveVersion || $('recipient').value.trim() !== name) return;
    if (!meta) { $('recipient').setAttribute('aria-invalid', 'true'); state('resolve-output', 'error', 'Not on Veil yet. Ask the recipient to enable Veil and register this name.'); return; }
    if (meta.scheme_id !== 1) throw new Error('This recipient uses a version this app cannot send to.');
    validPoint(fromHex(meta.spend_pub_hex)); validPoint(fromHex(meta.view_pub_hex));
    resolvedName = name; resolvedMeta = meta;
    $('recipient').removeAttribute('aria-invalid'); state('resolve-output', 'success', 'Veil enabled');
  } catch (error) { if (request === resolveVersion) state('resolve-output', 'error', friendlyError(error), resolve); }
  finally { if (request === resolveVersion) syncControls(); }
}
function checkAmount() {
  try { yocto($('amount').value.trim()); $('amount').removeAttribute('aria-invalid'); state('amount-output', 'empty', ''); }
  catch { $('amount').setAttribute('aria-invalid', 'true'); state('amount-output', 'error', 'Enter a NEAR amount greater than zero, such as 0.0100.'); }
  syncControls();
}
function renderSendReceipt(receipt) {
  sentReceipt = receipt; uncertainSend = false;
  state('send-output', 'success', 'Payment confirmed on testnet.');
  $('send-receipt').innerHTML = '<div class="receipt"><p class="money"><strong>' + formatNear(receipt.amount) + ' NEAR</strong></p><p class="state-line">' + icon('check') + '<strong>Delivered privately</strong></p><p class="muted">Sent to a separate receiving account for ' + escapeHtml(receipt.name) + '.</p><div class="receipt-links"><a href="' + explorer + '/address/' + receipt.account + '" target="_blank" rel="noreferrer">View receiving account on NearBlocks</a>' + transactionLink(receipt.tx) + '<button type="button" class="secondary" data-copy-receipt>Copy receipt</button></div><div class="state-box" data-copy-status role="status"></div></div>';
  $('send-receipt').querySelector('[data-copy-receipt]')?.addEventListener('click', async () => {
    const status = $('send-receipt').querySelector('[data-copy-status]');
    try { await navigator.clipboard.writeText(formatNear(receipt.amount) + ' NEAR delivered privately on NEAR testnet.\n' + explorer + '/address/' + receipt.account); status.textContent = 'Receipt copied.'; }
    catch { status.textContent = 'Copying was blocked. Use the receiving account link above.'; }
  });
  syncControls();
}
async function sendPrivate() {
  if (!wallet) throw new Error('Connect a testnet wallet first');
  if (uncertainSend) throw new Error('This payment is awaiting confirmation. Check its account before sending again.');
  const version = sessionVersion;
  const name = requireName($('recipient').value.trim()); const amount = yocto($('amount').value.trim());
  const meta = await view(REGISTRY, 'get_meta', { account_id: name });
  if (!meta) throw new Error('Recipient has not enabled Veil');
  if (meta.scheme_id !== 1) throw new Error('This recipient uses a version this app cannot send to.');
  const outputIndex = Number(await view(ROUTER, 'total_announcements', {}));
  if (!Number.isSafeInteger(outputIndex) || outputIndex < 0 || outputIndex > 0xffffffff) throw new Error('Invalid announcement index');
  const derived = deriveStealth(fromHex(meta.spend_pub_hex), fromHex(meta.view_pub_hex), randomScalar(), outputIndex);
  if (version !== sessionVersion) throw new Error('The wallet changed. Start this step again.');
  const receipt = { name, amount: amount.toString(), account: derived.stealthAccount, index: outputIndex };
  try {
    // Never retry a payment automatically after handing control to the wallet.
    uncertainSend = true; syncControls();
    receipt.tx = await callWallet(ROUTER, 'send_near', { stealth_account: derived.stealthAccount, ephemeral_pub_hex: hex(derived.ephemeralPublicKey), view_tag: derived.viewTag }, amount.toString());
    renderSendReceipt(receipt); return receipt;
  } catch (error) {
    if (/reject|cancel|declin|Transaction failed|insufficient/i.test(String(error.message))) uncertainSend = false;
    if (uncertainSend) {
      $('send-receipt').innerHTML = '<div class="receipt"><p>Confirmation is unavailable. Check this account before sending another payment.</p><div class="receipt-links"><a href="' + explorer + '/address/' + receipt.account + '" target="_blank" rel="noreferrer">Check receiving account</a><button type="button" class="secondary" data-check-delivery>Check delivery</button></div></div>';
      $('send-receipt').querySelector('[data-check-delivery]')?.addEventListener('click', () => run('check', 'send-output', 'Checking delivery without sending again.', async () => {
        const rows = await announcements();
        const found = rows.find((row) => row.stealth_account === receipt.account && row.amount === receipt.amount && row.token === ROUTER);
        if (!found) { state('send-output', 'error', 'No confirmed payment was found yet. Check your wallet activity before sending again.'); return; }
        renderSendReceipt(receipt);
      }));
    }
    throw error;
  } finally { syncControls(); }
}
async function announcements() {
  const rows = [];
  for (let start = 0; ; start += 100) {
    const batch = await view(ROUTER, 'get_announcements', { from_index: start, limit: 100 });
    if (!Array.isArray(batch)) throw new Error('Invalid RPC response');
    rows.push(...batch); if (batch.length < 100) return rows;
  }
}
function matchingPayments(keySet, rows) {
  return rows.flatMap((row) => { try { const found = scan(keySet, row); return found ? [found] : []; } catch { return []; } });
}
async function balancesFor(rows) {
  return Promise.all(rows.map(async (row) => {
    try {
      const result = await rpcQuery({ request_type: 'view_account', finality: 'final', account_id: row.stealth_account });
      if (!/^\d+$/.test(result?.amount)) throw new Error('Balance unavailable');
      return { ...row, balance: result.amount };
    } catch { return { ...row, balance: null }; }
  }));
}
function accountLink(account) {
  return '<a class="account-link" href="' + explorer + '/address/' + account + '" target="_blank" rel="noreferrer" aria-label="View receiving account ' + account + ' on NearBlocks">' + account.slice(0, 12) + '…' + account.slice(-8) + '</a>';
}
async function refresh() {
  if (!keys) throw new Error('Enable Veil before scanning your payments.');
  const version = sessionVersion; const snapshot = keys;
  const owned = matchingPayments(snapshot, await announcements());
  const balances = await balancesFor(owned);
  if (version !== sessionVersion || keys !== snapshot) return;
  payments = owned; lastBalances = balances; scanComplete = true;
  $('inbox').innerHTML = balances.map((row, i) => {
    const fresh = !knownPayments.has(row.stealth_account);
    const unavailable = row.balance === null || BigInt(row.balance) <= yocto('0.001');
    return '<tr' + (fresh ? ' class="is-new"' : '') + '><td>Payment ' + String(i + 1).padStart(2, '0') + (fresh ? '<span class="new-label">New</span>' : '') + '</td><td>' + accountLink(row.stealth_account) + '</td><td class="amount-cell money">' + formatNear(row.balance) + '</td><td><button class="secondary" data-spend="' + Number(row.index) + '" data-unavailable="' + unavailable + '"' + (unavailable ? ' disabled' : '') + '>Spend</button></td></tr>';
  }).join('');
  knownPayments = new Set(owned.map((row) => row.stealth_account));
  $('inbox-table').hidden = !balances.length;
  $('inbox').querySelectorAll('[data-spend]').forEach((button) => button.addEventListener('click', () => run('spend', 'spend-output', 'Preparing your spend. Check the public-link warning.', () => spend(Number(button.dataset.spend)), false)));
  const missing = balances.filter((row) => row.balance === null).length;
  state('scan-output', balances.length ? 'success' : 'empty', balances.length ? 'Found ' + balances.length + (balances.length === 1 ? ' private payment.' : ' private payments.') + (missing ? ' Some balances could not load. Scan again to retry.' : '') : 'No incoming payments found. Share your registered name to receive one.');
  void updateProof(balances); syncControls(); return balances;
}
async function spend(index) {
  const payment = payments.find((row) => Number(row.index) === index);
  if (!payment) throw new Error('No matching private payment was found.');
  if (!accountId || !keys || payment.privateScalar === undefined) throw new Error('Connect and enable Veil before spending.');
  const destination = accountId; const version = sessionVersion;
  if (!confirm('Send 0.0010 testnet NEAR to ' + destination + '? This publicly links this payment account to your name. Combining several payments here links them together too.')) {
    state('spend-output', 'empty', 'Spend cancelled. No transaction was sent.'); return;
  }
  const { JsonRpcProvider, PublicKey, Signer, actions, baseDecode, baseEncode, createTransaction } = await import('https://esm.sh/near-api-js@7.4.0');
  const provider = new JsonRpcProvider({ url: RPC });
  const publicKey = PublicKey.fromString('ed25519:' + baseEncode(fromHex(payment.stealth_account)));
  const access = await provider.viewAccessKey({ accountId: payment.stealth_account, publicKey: publicKey.toString(), finalityQuery: { finality: 'final' } });
  const block = await provider.viewBlock({ finality: 'final' });
  if (version !== sessionVersion) throw new Error('The wallet changed. Start this step again.');
  const tx = createTransaction(payment.stealth_account, publicKey, destination, BigInt(access.nonce) + 1n, [actions.transfer(yocto('0.001'))], baseDecode(block.header.hash));
  class ScalarSigner extends Signer {
    async getPublicKey() { return publicKey; }
    async signBytes(bytes) { return signScalar(payment.privateScalar, bytes); }
  }
  const signed = await new ScalarSigner().signTransaction(tx);
  const result = await provider.sendTransaction(signed.signedTransaction);
  assertSuccess(result);
  state('spend-output', 'success', 'Sent 0.0010 NEAR to ' + destination + '. This spend publicly links the receiving account to that name.');
  $('spend-output').innerHTML += transactionLink(result);
  await run('refresh', 'scan-output', 'Updating your private balances.', refresh);
  return result;
}
function signScalar(privateScalar, message) {
  const publicKey = point(privateScalar).toBytes();
  const nonce = scalar(sha512(concat(text.encode('veil-ed25519-nonce-v1'), scalarBytes(privateScalar), message, new Uint8Array(32).fill(0x56)))) % ORDER;
  const r = point(nonce).toBytes();
  const challenge = scalar(sha512(concat(r, publicKey, message))) % ORDER;
  return concat(r, scalarBytes((nonce + challenge * privateScalar) % ORDER));
}
async function auditorScan() {
  const version = ++auditVersion; const value = $('view-key').value.trim(); const name = $('auditor-name').value.trim();
  $('auditor-results').hidden = true;
  if (!validName(name)) { $('auditor-name').setAttribute('aria-invalid', 'true'); throw new Error('Enter a valid testnet account name.'); }
  $('auditor-name').removeAttribute('aria-invalid');
  if (!/^[0-9a-f]{64}$/i.test(value)) { $('view-key').setAttribute('aria-invalid', 'true'); throw new Error('Enter the auditor key shared by the recipient.'); }
  const meta = await view(REGISTRY, 'get_meta', { account_id: name });
  if (!meta) throw new Error('That name is not on Veil yet.');
  const viewOnly = { view: scalar(fromHex(value)), spendPublicKey: fromHex(meta.spend_pub_hex) };
  if (viewOnly.view <= 0n || viewOnly.view >= ORDER || hex(point(viewOnly.view).toBytes()) !== meta.view_pub_hex || meta.scheme_id !== 1) {
    $('view-key').setAttribute('aria-invalid', 'true'); throw new Error('That auditor key does not match this registered name.');
  }
  $('view-key').removeAttribute('aria-invalid');
  const owned = matchingPayments(viewOnly, await announcements()).map(({ privateScalar, ...row }) => row);
  const balances = await balancesFor(owned);
  if (version !== auditVersion) return [];
  state('auditor-output', balances.length ? 'success' : 'empty', balances.length ? 'Found ' + balances.length + (balances.length === 1 ? ' payment' : ' payments') + ' for ' + name + '. Read-only access.' : 'No incoming payments found for this name and auditor key.');
  $('auditor-results').innerHTML = '<table><caption class="sr-only">Read-only private payment balances</caption><thead><tr><th scope="col">Payment</th><th scope="col">Receiving account</th><th scope="col" class="amount-cell">Available NEAR</th></tr></thead><tbody>' + balances.map((row, i) => '<tr><td>Payment ' + String(i + 1).padStart(2, '0') + '</td><td>' + accountLink(row.stealth_account) + '</td><td class="amount-cell money">' + formatNear(row.balance) + '</td></tr>').join('') + '</tbody></table>';
  $('auditor-results').hidden = !balances.length; return owned;
}
async function copyViewKey() {
  if (!keys) throw new Error('Enable Veil before scanning your payments.');
  try { await navigator.clipboard.writeText(hex(scalarBytes(keys.view))); }
  catch { throw new Error('Copying was blocked. Allow clipboard access in your browser, then try again.'); }
  state('export-output', 'success', 'Auditor key copied. It reveals incoming payments and cannot spend them.');
}
const connectAction = () => run('connect', 'connect-output', 'Choose a testnet wallet to connect.', connect);
['connect', 'connect-receive', 'connect-send'].forEach((id) => $(id).addEventListener('click', connectAction));
$('disconnect').addEventListener('click', () => run('disconnect', 'connect-output', 'Disconnecting your wallet.', async () => { await connector.disconnect(); resetSession(); }));
$('enable').addEventListener('click', () => run('enable', 'identity-output', 'Sign the message in your wallet to enable Veil.', enable));
$('register').addEventListener('click', () => run('register', 'register-output', 'Approve registration in your wallet.', register, false));
$('share').addEventListener('click', () => run('share', 'share-output', 'Copying your registered name.', async () => { await navigator.clipboard.writeText(accountId); state('share-output', 'success', 'Name copied. Share it with someone who wants to pay you.'); }));
$('export-view').addEventListener('click', () => run('export', 'export-output', 'Copying auditor access.', copyViewKey));
$('recipient').addEventListener('input', invalidateRecipient);
$('recipient').addEventListener('blur', resolve);
$('amount').addEventListener('blur', checkAmount);
$('amount').addEventListener('input', () => { if (!uncertainSend) sentReceipt = null; $('amount').removeAttribute('aria-invalid'); state('amount-output', 'empty', ''); syncControls(); });
$('send-form').addEventListener('submit', (event) => { event.preventDefault(); if (!validAmount()) { checkAmount(); $('amount').focus(); return; } void run('send', 'send-output', 'Approve the payment in your wallet. Waiting for confirmation.', sendPrivate, false); });
$('refresh').addEventListener('click', () => run('refresh', 'scan-output', 'Scanning for your private payments.', refresh));
$('audit-form').addEventListener('submit', (event) => { event.preventDefault(); void run('audit', 'auditor-output', 'Finding payments with read-only access.', auditorScan); });
$('clear-auditor').addEventListener('click', clearAuditor);
['view-key', 'auditor-name'].forEach((id) => $(id).addEventListener('input', () => { auditVersion++; $('auditor-results').hidden = true; state('auditor-output', 'empty', 'Scan again to check the updated auditor details.'); }));
['receive', 'send'].forEach((path) => {
  $('tab-' + path).addEventListener('click', () => choosePath(path));
  $('tab-' + path).addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); choosePath(event.key === 'Home' ? 'receive' : event.key === 'End' ? 'send' : path === 'receive' ? 'send' : 'receive', true);
    }
  });
});
$('registry-id').textContent = REGISTRY;
$('router-id').textContent = ROUTER;
syncControls();
