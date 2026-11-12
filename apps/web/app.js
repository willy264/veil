import { NearConnector } from 'https://esm.sh/@hot-labs/near-connect@0.12.0';
import { ed25519 } from 'https://esm.sh/@noble/curves@1.9.7/ed25519';
import { hkdf } from 'https://esm.sh/@noble/hashes@1.8.0/hkdf';
import { sha256 } from 'https://esm.sh/@noble/hashes@1.8.0/sha256';
import { sha512 } from 'https://esm.sh/@noble/hashes@1.8.0/sha512';
import { JsonRpcProvider, PublicKey, Signer, actions, baseDecode, baseEncode, createTransaction } from 'https://esm.sh/near-api-js@7.4.0';

const CONFIG = window.VEIL_CONFIG ?? {};
const RPC = CONFIG.rpcUrl ?? 'https://rpc.testnet.fastnear.com';
const REGISTRY = CONFIG.registryId ?? 'registry2.veil-williams.testnet';
const ROUTER = CONFIG.routerId ?? 'router2.veil-williams.testnet';
const ORDER = ed25519.CURVE.n;
const text = new TextEncoder();
const connector = new NearConnector({ network: 'testnet', features: { testnet: true, signMessage: true } });
let wallet;
let accountId;
let keys;
let payments = [];
let registeredName;
let sessionVersion = 0;
let scanVersion = 0;
let actionPending = false;

const $ = (id) => document.getElementById(id);
function show(id, value, isError = false) {
  $(id).textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const status = $(`${id}-status`);
  if (status) {
    status.textContent = typeof value === 'string' ? value : value?.message ?? value?.status ?? (id === 'resolve-output' ? (value ? 'This name is registered with Veil.' : 'This name has not enabled Veil.') : id === 'scan-output' ? `${value.announcements} announcements checked. ${value.owned} owned payments found.` : id === 'auditor-output' ? `${value.incoming.length} incoming payments found. Read-only access.` : 'Done.');
    status.dataset.error = String(isError);
  }
  const link = $(`${id}-link`);
  if (link) {
    const tx = value?.transaction;
    const hash = typeof tx === 'string' ? tx : tx?.transaction?.hash ?? tx?.transaction_outcome?.id;
    link.hidden = !hash;
    if (hash) link.href = `https://testnet.nearblocks.io/txns/${encodeURIComponent(hash)}`;
  }
}
const shortAccount = (value) => `${value.slice(0, 8)}…${value.slice(-8)}`;
function formatNear(value) {
  const n = BigInt(value), unit = 10n ** 24n;
  const fraction = (n % unit).toString().padStart(24, '0').replace(/0+$/, '');
  return `${n / unit}${fraction ? `.${fraction}` : ''}`;
}
function displayNear(value) {
  const exact = formatNear(value);
  if (BigInt(value) > 0n && BigInt(value) < 10n ** 18n) return '<0.000001';
  const [whole, fraction] = exact.split('.');
  return fraction ? `${whole}.${fraction.slice(0, 6).replace(/0+$/, '')}`.replace(/\.$/, '') : whole;
}
function selectAction(name, focus = false) {
  for (const action of ['send', 'receive', 'transfer']) {
    const selected = action === name;
    $(`tab-${action}`).setAttribute('aria-selected', String(selected));
    $(`tab-${action}`).tabIndex = selected ? 0 : -1;
    $(`panel-${action}`).hidden = !selected;
  }
  if (focus) $(`tab-${name}`).focus();
}
async function runAction(buttonId, outputId, task, pending) {
  if (actionPending) return;
  actionPending = true;
  const button = $(buttonId), label = button.innerHTML;
  const controls = ['connect', 'enable', 'register', 'send', 'transfer', 'refresh', 'resolve', 'audit', 'export-view', 'copy-name'];
  const disabled = controls.map((id) => $(id).disabled);
  controls.forEach((id) => { $(id).disabled = true; });
  button.setAttribute('aria-busy', 'true'); button.textContent = pending;
  show(outputId, pending);
  try { await task(); }
  catch (error) { show(outputId, error.message || 'The action could not finish. Please try again.', true); }
  finally {
    controls.forEach((id, i) => { $(id).disabled = disabled[i]; });
    $('copy-name').disabled = !registeredName;
    button.innerHTML = label; button.removeAttribute('aria-busy'); actionPending = false;
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

async function view(contractId, methodName, args) {
  const response = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: contractId, method_name: methodName, args_base64: base64(text.encode(JSON.stringify(args))) } }) });
  if (!response.ok) throw new Error(`Testnet RPC HTTP ${response.status}`);
  const payload = await response.json(); if (payload.error) throw new Error(payload.error.message ?? 'RPC error');
  if (payload.result?.error) throw new Error(payload.result.error);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(payload.result.result)));
}

async function signMessage() {
  if (!wallet || !accountId) throw new Error('Connect a testnet wallet first');
  const version = sessionVersion;
  const signed = await wallet.signMessage({ message: `Veil key derivation v1: derive private receiving keys for this NEAR account.\nAccount: ${accountId}`, recipient: accountId, nonce: sha256(text.encode(`veil-key-derivation:testnet:v1:${accountId}`)) });
  const signature = signed.signature ?? signed; const bytes = typeof signature === 'string' ? decodeBase64(signature) : Uint8Array.from(signature);
  if (bytes.length !== 64) throw new Error('Wallet returned an unexpected NEP-413 signature');
  if (version !== sessionVersion) throw new Error('Wallet account changed. Enable Veil again.');
  keys = deriveKeys(bytes); show('identity-output', { accountId, status: 'keys derived in memory', spendPublicKey: hex(keys.spendPublicKey), viewPublicKey: hex(keys.viewPublicKey) });
  $('balance-hint').textContent = 'Keys ready. Scan your inbox to read current balances.';
}

async function callWallet(receiverId, methodName, args, deposit = '0', gas = '30000000000000') {
  if (!wallet) throw new Error('Connect a testnet wallet first');
  const result = await wallet.signAndSendTransaction({ receiverId, actions: [{ type: 'FunctionCall', params: { methodName, args, gas, deposit } }] });
  assertSuccess(result);
  return result;
}

function assertSuccess(result) {
  if (!result) throw new Error('Wallet returned no transaction result');
  if (result.status?.Failure || result.receipts_outcome?.some((r) => r.outcome?.status?.Failure)) throw new Error('Transaction failed; inspect its receipt on testnet NearBlocks');
}

async function connect() {
  await connector.connect();
}

async function enable() { await signMessage(); }
async function register() {
  if (!keys) await enable();
  const existing = await view(REGISTRY, 'get_meta', { account_id: accountId });
  if (existing && (existing.spend_pub_hex !== hex(keys.spendPublicKey) || existing.view_pub_hex !== hex(keys.viewPublicKey))) throw new Error('This name uses different Veil keys. Use its original wallet/key setup or a new testnet recipient; overwriting could lose access to old payments.');
  const tx = await callWallet(REGISTRY, 'register', { spend_pub_hex: hex(keys.spendPublicKey), view_pub_hex: hex(keys.viewPublicKey), scheme_id: 1 }, yocto('0.01').toString());
  registeredName = accountId; $('receive-name').textContent = accountId; $('copy-name').disabled = false;
  show('identity-output', { status: 'registered', transaction: tx });
}
async function resolve() { const name = $('name').value.trim(); show('resolve-output', await view(REGISTRY, 'get_meta', { account_id: name })); $('public-history').href = `https://testnet.nearblocks.io/address/${name}`; }

async function sendPrivate() {
  if (!wallet) throw new Error('Connect a testnet wallet first'); const name = $('recipient').value.trim(); const meta = await view(REGISTRY, 'get_meta', { account_id: name }); if (!meta) throw new Error('Recipient has not enabled Veil');
  if (meta.scheme_id !== 1) throw new Error('Unsupported Veil scheme');
  const outputIndex = Number(await view(ROUTER, 'total_announcements', {}));
  const derived = deriveStealth(fromHex(meta.spend_pub_hex), fromHex(meta.view_pub_hex), randomScalar(), outputIndex);
  const tx = await callWallet(ROUTER, 'send_near', { stealth_account: derived.stealthAccount, ephemeral_pub_hex: hex(derived.ephemeralPublicKey), view_tag: derived.viewTag }, yocto($('amount').value).toString());
  show('send-output', { status: 'private payment submitted', stealthAccount: derived.stealthAccount, transaction: tx, note: 'Wait for finality, then scan. V1 requires sequential sends; concurrent sends can change the derivation index.' });
}

async function announcements() {
  const rows = [];
  for (let start = 0; ; start += 100) { const batch = await view(ROUTER, 'get_announcements', { from_index: start, limit: 100 }); rows.push(...batch); if (batch.length < 100) return rows; }
}

async function refresh() {
  const version = sessionVersion, scanId = ++scanVersion, scanKeys = keys;
  const rows = await announcements();
  const owned = scanKeys ? rows.map((row) => scan(scanKeys, row)).filter(Boolean) : [];
  const balances = await Promise.all(owned.map(async (payment) => {
    try {
      const response = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: payment.stealth_account } }) });
      if (!response.ok) throw new Error(`Testnet RPC HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.error || !/^\d+$/.test(payload.result?.amount)) throw new Error('Balance unavailable');
      return { ...payment, balance: payload.result.amount };
    } catch { return { ...payment, balance: null }; }
  }));
  if (version !== sessionVersion || scanId !== scanVersion || scanKeys !== keys) return;
  payments = balances;
  renderInbox();
  show('scan-output', { announcements: rows.length, owned: balances.length, unavailableBalances: balances.filter((p) => p.balance === null).length, ...(!keys ? { message: `${rows.length} public announcements available. Enable Veil to find your payments.` } : {}) });
}

function renderInbox() {
  const unknown = payments.some((p) => p.balance === null);
  const total = payments.reduce((sum, p) => sum + BigInt(p.balance ?? '0'), 0n);
  $('total-balance').textContent = keys && !unknown ? displayNear(total) : '—';
  $('total-balance').title = keys && !unknown ? `${formatNear(total)} NEAR (includes storage reserve)` : '';
  $('payment-count').textContent = keys ? String(payments.length) : '—';
  $('balance-hint').textContent = !keys ? 'Connect and enable Veil to see your private balance.' : unknown ? 'Some balances are unavailable. Scan again to retry.' : 'Total across your scanned accounts, including storage reserves. Gas costs extra.';
  $('inbox').innerHTML = payments.length ? payments.map((row) => `<tr><td>#${Number(row.index)}</td><td><a href="https://testnet.nearblocks.io/address/${row.stealth_account}" target="_blank" rel="noreferrer" title="${row.stealth_account}">${shortAccount(row.stealth_account)}</a></td><td title="${row.balance === null ? 'Balance unavailable' : formatNear(row.balance) + ' NEAR'}">${row.balance === null ? 'Unavailable' : displayNear(row.balance).replace('<', '&lt;')}</td><td><button class="secondary" data-spend="${Number(row.index)}">Transfer</button></td></tr>`).join('') : `<tr><td colspan="4" class="empty-cell"><svg class="empty-icon" aria-hidden="true"><use href="#i-receive"/></svg><strong>${keys ? 'No payments found yet' : 'Your payments appear here'}</strong><p>${keys ? 'Share your registered name, then scan after the payment confirms.' : 'Connect a wallet, enable Veil, then scan your inbox.'}</p></td></tr>`;
  $('inbox').querySelectorAll('[data-spend]').forEach((button) => button.addEventListener('click', () => {
    selectAction('transfer', true); $('transfer-source').value = button.dataset.spend; updateTransferBalance();
    $('panel-transfer').scrollIntoView({ block: 'center' });
  }));
  const previous = $('transfer-source').value;
  $('transfer-source').innerHTML = '<option value="">Choose an owned account</option>' + payments.map((p) => `<option value="${Number(p.index)}">#${Number(p.index)} · ${shortAccount(p.stealth_account)} · ${p.balance === null ? 'Unavailable' : displayNear(p.balance).replace('<', '&lt;') + ' NEAR'}</option>`).join('');
  if (payments.some((p) => String(p.index) === previous)) $('transfer-source').value = previous;
  updateTransferBalance();
}
function updateTransferBalance() {
  const p = payments.find((row) => String(row.index) === $('transfer-source').value);
  $('transfer-balance').textContent = p ? p.balance === null ? 'Balance unavailable. Scan again to retry.' : `Balance: ${formatNear(p.balance)} NEAR, including storage reserve.` : 'No account selected.';
}

async function transfer() {
  const source = $('transfer-source').value;
  if (source === '') throw new Error('Scan your inbox and choose an account first');
  const result = await spend(Number(source), $('transfer-to').value.trim(), $('transfer-amount').value);
  show('transfer-output', result ?? 'Transfer cancelled. No transaction submitted.');
}

async function spend(index, destination = accountId, amount = '0.001') {
  const payment = payments.find((row) => Number(row.index) === index); if (!payment) throw new Error('Payment not found');
  if (!accountId || !keys) throw new Error('Connect and derive the recipient keys first');
  if (!/^(?:[a-z0-9]+(?:[-_][a-z0-9]+)*\.)*testnet$/.test(destination) && !/^[0-9a-f]{64}$/.test(destination)) throw new Error('Enter a testnet account name or a 64-character implicit account');
  if (destination.length > 64 || destination === payment.stealth_account) throw new Error('Choose a different valid destination');
  const amountYocto = yocto(amount);
  if (payment.balance === null) throw new Error('Balance unavailable. Scan again before transferring.');
  if (amountYocto >= BigInt(payment.balance)) throw new Error('Amount exceeds the balance or leaves no NEAR for storage and gas');
  const version = sessionVersion;
  if (!confirm(`Transfer ${formatNear(amountYocto)} testnet NEAR from ${payment.stealth_account} to ${destination}? This creates a public link to the destination. Sending several accounts here also links them together. Network fees apply.`)) return;
  const provider = new JsonRpcProvider({ url: RPC }); const publicKey = PublicKey.fromString(`ed25519:${baseEncode(fromHex(payment.stealth_account))}`);
  const access = await provider.viewAccessKey({ accountId: payment.stealth_account, publicKey: publicKey.toString(), finalityQuery: { finality: 'final' } }); const block = await provider.viewBlock({ finality: 'final' });
  if (version !== sessionVersion) throw new Error('Wallet account changed. Scan again before transferring.');
  const tx = createTransaction(payment.stealth_account, publicKey, destination, BigInt(access.nonce) + 1n, [actions.transfer(amountYocto)], baseDecode(block.header.hash));
  class ScalarSigner extends Signer { async getPublicKey() { return publicKey; } async signBytes(bytes) { return signScalar(payment.privateScalar, bytes); } }
  const signer = new ScalarSigner();
  const signed = await signer.signTransaction(tx); const result = await provider.sendTransaction(signed.signedTransaction); assertSuccess(result);
  const receipt = { status: 'Transfer confirmed.', transaction: result.transaction?.hash ?? result.transaction_outcome?.id, destination, amount: formatNear(amountYocto), warning: 'This spend links the stealth account to the destination.' };
  try { await refresh(); } catch { receipt.message = 'Transfer confirmed. Balance refresh failed; scan again. Do not resend.'; }
  show('scan-output', receipt); return receipt;
}

function signScalar(privateScalar, message) { const publicKey = point(privateScalar).toBytes(); const nonce = scalar(sha512(concat(text.encode('veil-ed25519-nonce-v1'), scalarBytes(privateScalar), message, new Uint8Array(32).fill(0x56)))) % ORDER; const r = point(nonce).toBytes(); const challenge = scalar(sha512(concat(r, publicKey, message))) % ORDER; return concat(r, scalarBytes((nonce + challenge * privateScalar) % ORDER)); }
async function auditorScan() {
  const value = $('view-key').value.trim(); const name = $('auditor-name').value.trim();
  if (!/^[0-9a-f]{64}$/i.test(value) || !name) { show('auditor-output', 'Enter a name and a 32-byte hex view key.'); return; }
  const meta = await view(REGISTRY, 'get_meta', { account_id: name });
  if (!meta) { show('auditor-output', 'That name has no registered Veil meta-address.'); return; }
  const viewOnly = { view: scalar(fromHex(value)), spendPublicKey: fromHex(meta.spend_pub_hex) };
  if (viewOnly.view <= 0n || viewOnly.view >= ORDER) throw new Error('Invalid view scalar');
  const rows = await announcements();
  const owned = rows.map((row) => scan(viewOnly, row)).filter(Boolean).map(({ privateScalar, ...row }) => row);
  show('auditor-output', { name, incoming: owned, warning: 'Read-only mode; no spending key is retained.' });
}

async function copyViewKey() { if (!keys) throw new Error('Derive recipient keys first'); await navigator.clipboard.writeText(hex(scalarBytes(keys.view))); show('identity-output', 'View key copied for your auditor. It reveals incoming payments; it cannot spend.'); }

function clearSession() {
  sessionVersion += 1; wallet = undefined; accountId = undefined; keys = undefined; payments = []; registeredName = undefined;
  $('wallet-status').textContent = 'Wallet disconnected'; $('receive-name').textContent = 'Connect a wallet first';
  $('copy-name').disabled = true; $('transfer-to').value = ''; $('view-key').value = '';
  renderInbox();
  show('identity-output', 'Connect a testnet wallet to begin.'); show('scan-output', 'Connect and enable Veil before scanning.');
  show('transfer-output', 'Enable Veil and scan before choosing an account.'); show('auditor-output', 'The view key stays in this browser.');
}
connector.on('wallet:signIn', async ({ accounts }) => {
  clearSession(); const version = sessionVersion, connected = accounts[0]?.accountId;
  try {
    const connectedWallet = await connector.wallet(); if (version !== sessionVersion || !connected) return;
    wallet = connectedWallet; accountId = connected;
    $('wallet-status').textContent = accountId; $('receive-name').textContent = accountId;
    $('transfer-to').value = accountId; $('name').value = accountId;
    show('identity-output', 'Wallet connected. Derive keys to enable private receiving.');
    show('send-output', 'Wallet connected. Enter a registered recipient and amount.');
  } catch (error) { show('identity-output', error.message, true); }
});
connector.on('wallet:signOut', clearSession);
const actionsByTab = ['send', 'receive', 'transfer'];
actionsByTab.forEach((name, index) => {
  $(`tab-${name}`).addEventListener('click', () => selectAction(name));
  $(`tab-${name}`).addEventListener('keydown', (event) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
    if (next !== -1) { event.preventDefault(); selectAction(actionsByTab[next], true); }
  });
});
document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => { selectAction(button.dataset.action, true); $(`panel-${button.dataset.action}`).scrollIntoView({ block: 'center' }); }));
$('connect').addEventListener('click', () => { selectAction('receive'); runAction('connect', 'identity-output', connect, 'Opening wallet…'); });
for (const [id, output, task, pending] of [['enable', 'identity-output', enable, 'Approve message…'], ['register', 'identity-output', register, 'Registering…'], ['refresh', 'scan-output', refresh, 'Scanning…'], ['export-view', 'identity-output', copyViewKey, 'Copying…'], ['copy-name', 'identity-output', async () => { if (!registeredName) throw new Error('Register your name first'); await navigator.clipboard.writeText(registeredName); show('identity-output', 'Name copied. Ask the sender to use it in Veil’s Send tab.'); }, 'Copying…']]) {
  $(id).addEventListener('click', () => runAction(id, output, task, pending));
}
for (const [id, output, task, pending] of [['send', 'send-output', sendPrivate, 'Approve payment…'], ['transfer', 'transfer-output', transfer, 'Reviewing transfer…'], ['resolve', 'resolve-output', resolve, 'Looking up…'], ['audit', 'auditor-output', auditorScan, 'Scanning…']]) {
  $(`${id}-form`).addEventListener('submit', (event) => { event.preventDefault(); runAction(id, output, task, pending); });
}
$('transfer-source').addEventListener('change', updateTransferBalance);
$('registry-id').textContent = REGISTRY;
$('router-id').textContent = ROUTER;
$('registry-id').href = `https://testnet.nearblocks.io/address/${REGISTRY}`;
$('router-id').href = `https://testnet.nearblocks.io/address/${ROUTER}`;
$('comparison-link').href = `https://testnet.nearblocks.io/address/${REGISTRY}`;
refresh().catch((error) => show('scan-output', error.message, true));
