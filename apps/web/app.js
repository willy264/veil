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

const $ = (id) => document.getElementById(id);
const show = (id, value) => { $(id).textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function formatNear(value) {
  if (value === null || value === undefined) return 'Unavailable';
  const units = (BigInt(value) + 5n * 10n ** 19n) / 10n ** 20n;
  return `${(units / 10000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${(units % 10000n).toString().padStart(4, '0')}`;
}
let proofRequest = 0;
function resetProof() {
  proofRequest++;
  $('proof-mode').textContent = 'Example';
  $('proof-caption').textContent = 'An illustration of private receiving. These are not live account records.';
  $('proof-public-title').textContent = 'What anyone sees for alice.near';
  $('proof-private-title').textContent = 'What Alice sees';
  $('proof-public-list').innerHTML = '<p class="proof-empty">No new payments to this name in this example.</p>';
  $('proof-private-list').innerHTML = ['0.0100', '0.0250', '0.0400'].map((amount, i) => `<p><span>Payment 0${i + 1}</span><strong class="money">${amount} NEAR</strong></p>`).join('');
  $('proof-public-link').href = '#how-it-works';
  $('proof-public-link').textContent = 'See how receiving works';
}
async function updateProof(balances = []) {
  if (!keys || !accountId) return;
  const request = ++proofRequest;
  const name = accountId;
  $('proof-mode').textContent = 'Live testnet';
  $('proof-caption').textContent = 'Public history beside payments found in this browser. Amounts and senders remain public.';
  $('proof-public-title').textContent = `What anyone sees for ${name}`;
  $('proof-private-title').textContent = 'What you see';
  $('proof-private-list').innerHTML = balances.length ? balances.slice(0, 3).map((row, i) => `<p><span>Payment ${String(i + 1).padStart(2, '0')}</span><strong class="money">${formatNear(row.balance)}${row.balance == null ? '' : ' NEAR'}</strong></p>`).join('') : '<p class="proof-empty">Scan your inbox to find incoming payments.</p>';
  $('proof-public-link').textContent = 'Open public activity on NearBlocks';
  $('proof-public-link').href = `https://testnet.nearblocks.io/address/${encodeURIComponent(name)}`;
  $('proof-public-list').textContent = 'Loading public activity…';
  try {
    const response = await fetch(`https://api-testnet.nearblocks.io/v1/account/${encodeURIComponent(name)}/txns?page=1&per_page=3&order=desc`);
    if (!response.ok) throw new Error('Public activity unavailable');
    const data = await response.json();
    if (request !== proofRequest || accountId !== name || !keys) return;
    if (!Array.isArray(data.txns)) throw new Error('Public activity unavailable');
    const seen = new Set();
    const rows = data.txns.filter((row) => /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(row.transaction_hash) && !seen.has(row.transaction_hash) && seen.add(row.transaction_hash));
    $('proof-public-list').innerHTML = rows.length ? rows.map((row) => `<a href="https://testnet.nearblocks.io/txns/${row.transaction_hash}" target="_blank" rel="noreferrer"><span>Public transaction</span><span>${row.transaction_hash.slice(0, 8)}…</span></a>`).join('') : '<p class="proof-empty">No public transactions were returned for this name.</p>';
  } catch {
    if (request === proofRequest) $('proof-public-list').textContent = 'Public activity could not load. Open NearBlocks to check the account.';
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
  const signed = await wallet.signMessage({ message: `Veil key derivation v1: derive private receiving keys for this NEAR account.\nAccount: ${accountId}`, recipient: accountId, nonce: sha256(text.encode(`veil-key-derivation:testnet:v1:${accountId}`)) });
  const signature = signed.signature ?? signed; const bytes = typeof signature === 'string' ? decodeBase64(signature) : Uint8Array.from(signature);
  if (bytes.length !== 64) throw new Error('Wallet returned an unexpected NEP-413 signature');
  keys = deriveKeys(bytes); show('identity-output', { accountId, status: 'keys derived in memory', spendPublicKey: hex(keys.spendPublicKey), viewPublicKey: hex(keys.viewPublicKey) });
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
  connector.on('wallet:signIn', async ({ accounts }) => { accountId = accounts[0]?.accountId; wallet = await connector.wallet(); $('wallet-status').textContent = accountId ? `Connected: ${accountId}` : 'Wallet connected'; });
  await connector.connect();
}

async function enable() { await signMessage(); await refresh(); }
async function register() {
  if (!keys) await enable();
  const existing = await view(REGISTRY, 'get_meta', { account_id: accountId });
  if (existing && (existing.spend_pub_hex !== hex(keys.spendPublicKey) || existing.view_pub_hex !== hex(keys.viewPublicKey))) throw new Error('This name uses different Veil keys. Use its original wallet/key setup or a new testnet recipient; overwriting could lose access to old payments.');
  const tx = await callWallet(REGISTRY, 'register', { spend_pub_hex: hex(keys.spendPublicKey), view_pub_hex: hex(keys.viewPublicKey), scheme_id: 1 }, yocto('0.01').toString());
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
  const rows = await announcements();
  payments = keys ? rows.map((row) => scan(keys, row)).filter(Boolean) : [];
  const balances = await Promise.all(payments.map(async (payment) => { try { const response = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: payment.stealth_account } }) }); const payload = await response.json(); return { ...payment, balance: payload.result?.amount ?? '0' }; } catch { return { ...payment, balance: '0' }; } }));
  $('inbox').innerHTML = balances.length ? balances.map((row) => `<tr><td>${row.index}</td><td>${row.stealth_account}</td><td class="money">${formatNear(row.balance)}</td><td><button data-spend="${row.index}">Spend</button></td></tr>`).join('') : '<tr><td colspan="4">Enable Veil, then scan for private payments.</td></tr>';
  $('inbox').querySelectorAll('[data-spend]').forEach((button) => button.addEventListener('click', () => spend(Number(button.dataset.spend)).catch((error) => show('scan-output', error.message))));
  show('scan-output', { announcements: rows.length, owned: balances.length });
  void updateProof(balances);
}

async function spend(index) {
  const payment = payments.find((row) => Number(row.index) === index); if (!payment) throw new Error('Payment not found');
  if (!accountId || !keys) throw new Error('Connect and derive the recipient keys first');
  if (!confirm(`Send 0.001 testnet NEAR to ${accountId}? This links this stealth account to your named account. Sweeping several accounts here also links them together.`)) return;
  const provider = new JsonRpcProvider({ url: RPC }); const publicKey = PublicKey.fromString(`ed25519:${baseEncode(fromHex(payment.stealth_account))}`);
  const access = await provider.viewAccessKey({ accountId: payment.stealth_account, publicKey: publicKey.toString(), finalityQuery: { finality: 'final' } }); const block = await provider.viewBlock({ finality: 'final' });
  const tx = createTransaction(payment.stealth_account, publicKey, accountId, BigInt(access.nonce) + 1n, [actions.transfer(yocto('0.001'))], baseDecode(block.header.hash));
  class ScalarSigner extends Signer { async getPublicKey() { return publicKey; } async signBytes(bytes) { return signScalar(payment.privateScalar, bytes); } }
  const signer = new ScalarSigner();
  const signed = await signer.signTransaction(tx); const result = await provider.sendTransaction(signed.signedTransaction); assertSuccess(result); await refresh(); show('scan-output', { status: 'spent', transaction: result.transaction?.hash ?? result.transaction_outcome?.id, warning: 'This spend links the stealth account to the destination.' });
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

connector.on('wallet:signOut', () => { wallet = undefined; accountId = undefined; keys = undefined; payments = []; resetProof(); $('inbox').innerHTML = '<tr><td colspan="4">Enable Veil, then scan for private payments.</td></tr>'; $('wallet-status').textContent = 'Wallet disconnected'; });
$('connect').addEventListener('click', () => connect().catch((error) => show('identity-output', error.message)));
$('enable').addEventListener('click', () => enable().catch((error) => show('identity-output', error.message)));
$('register').addEventListener('click', () => register().catch((error) => show('identity-output', error.message)));
$('resolve').addEventListener('click', () => resolve().catch((error) => show('resolve-output', error.message)));
$('send').addEventListener('click', () => sendPrivate().catch((error) => show('send-output', error.message)));
$('refresh').addEventListener('click', () => refresh().catch((error) => show('scan-output', error.message)));
$('audit').addEventListener('click', () => auditorScan().catch((error) => show('auditor-output', error.message)));
$('export-view').addEventListener('click', () => copyViewKey().catch((error) => show('identity-output', error.message)));
$('registry-id').textContent = REGISTRY;
$('router-id').textContent = ROUTER;
$('comparison-link').href = `https://testnet.nearblocks.io/address/${REGISTRY}`;
refresh().catch((error) => show('scan-output', error.message));
