// Node-only testnet signer. Never import this file from the hosted application.
import { execFile } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { lstat, open, readFile, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  JsonRpcProvider, KeyPair, KeyPairSigner, actions, baseDecode, baseEncode,
  createTransaction, decodeSignedTransaction, encodeTransaction,
} from 'near-api-js';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const HOSTED = 'https://veil-eta-khaki.vercel.app';
export const RPC = 'https://rpc.testnet.near.org';
export const REGISTRY = 'registry2.veil-williams.testnet';
export const ROUTER = 'router2.veil-williams.testnet';
export const RECEIVER = 'veil-demo-recv.testnet';
export const SENDER = 'veil-demo-send.testnet';
export const CONNECTOR_IMPORT = 'https://esm.sh/@hot-labs/near-connect@0.12.0';
export const YOCTO = 10n ** 24n;
const ENV_NAMES = new Map([[RECEIVER, 'VEIL_DEMO_RECEIVER_PRIVATE_KEY'], [SENDER, 'VEIL_DEMO_SENDER_PRIVATE_KEY']]);
const runFile = promisify(execFile);
const secrets = new Set();
const HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const HEX = /^[0-9a-f]{64}$/;

export class PublicError extends Error {}
export function check(ok, message) { if (!ok) throw new PublicError(message); }
export function rememberSecret(value) { if (typeof value === 'string' && value.length) secrets.add(value); }
export function redact(text) {
  let value = String(text);
  for (const secret of secrets) value = value.split(secret).join('[redacted]');
  return value.replace(/ed25519:[1-9A-HJ-NP-Za-km-z]{40,}/g, '[redacted]');
}
// Only our fixed public messages are eligible for output. Provider/Playwright errors
// can contain request bodies, signatures, input values and source snippets.
export function publicError(error) {
  return redact(error instanceof PublicError ? error.message : 'Operation failed; raw diagnostics withheld to protect signing material. No mutation is retried.');
}
export function explorer(hash) { check(HASH.test(hash), 'Invalid transaction hash.'); return `https://testnet.nearblocks.io/txns/${hash}`; }
export function near(amount) {
  const value = BigInt(amount);
  const fraction = (value % YOCTO).toString().padStart(24, '0').replace(/0+$/, '');
  return `${value / YOCTO}${fraction ? `.${fraction}` : ''}`;
}
export function validateSource(value, local = false) {
  let url;
  try { url = new URL(value); } catch { throw new PublicError('Invalid source URL.'); }
  const allowed = local
    ? url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    : url.origin === HOSTED;
  check(allowed && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/',
    'Source must be the exact hosted app origin, or a localhost HTTP root with --local.');
  return url.href;
}
export function provider() {
  // near-api-js 7.4.0 calls this option "retries", but it is the total attempts.
  return new JsonRpcProvider({ url: RPC }, { retries: 1, wait: 0 });
}

async function requireIgnoredEnv() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/PRIVATE|SECRET|TOKEN|PASSWORD|CREDENTIAL|^VEIL_/i.test(name)));
  try { await runFile('git', ['check-ignore', '--quiet', '--', '.env'], { cwd: REPO, env }); }
  catch { throw new PublicError('Refusing credentials: repository .env must be untracked and git-ignored.'); }
}
async function regularFile(file, optional = false) {
  let info;
  try { info = await lstat(file); }
  catch (error) { if (optional && error.code === 'ENOENT') return false; throw new PublicError('Required credential file is unavailable.'); }
  check(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, 'Credential files must be regular, non-linked files.');
  check(path.resolve(await realpath(file)).toLowerCase() === path.resolve(file).toLowerCase(), 'Credential path must not resolve through a link.');
  return true;
}
function envValue(text, name) {
  const lines = text.split(/\r?\n/).filter((line) => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(line));
  check(lines.length <= 1, 'Duplicate demo credential entry in .env; resolve it manually.');
  if (!lines.length) return undefined;
  const raw = lines[0].slice(lines[0].indexOf('=') + 1).trim();
  const match = raw.match(/^(?:"(ed25519:[1-9A-HJ-NP-Za-km-z]+)"|'(ed25519:[1-9A-HJ-NP-Za-km-z]+)'|(ed25519:[1-9A-HJ-NP-Za-km-z]+))(?:\s+#.*)?$/);
  check(match, 'Existing demo credential entry is invalid; it will not be overwritten.');
  return match[1] || match[2] || match[3];
}

/** Called only for --preflight/--execute, never on import or default invocation.
 * Supports the two explicitly authorized near-cli account JSON files only; no
 * directory search or alternate credential store is attempted.
 */
export async function loadCredentials() {
  await requireIgnoredEnv(); // MUST precede reading .env or near-cli keyfiles.
  const envPath = path.join(REPO, '.env');
  const existed = await regularFile(envPath, true);
  const original = existed ? await readFile(envPath, 'utf8') : '';
  const loaded = new Map();
  const additions = [];
  for (const [accountId, name] of ENV_NAMES) {
    const stored = envValue(original, name);
    const inherited = process.env[name];
    if (inherited) rememberSecret(inherited);
    if (stored) rememberSecret(stored);
    check(!stored || !inherited || stored === inherited, 'Demo credential sources disagree; existing .env was preserved.');
    let secret = stored || inherited;
    let expectedPublic;
    if (!secret) {
      const file = path.join(os.homedir(), '.near-credentials', 'testnet', `${accountId}.json`);
      await regularFile(file);
      let record;
      try { record = JSON.parse(await readFile(file, 'utf8')); }
      catch { throw new PublicError(`Could not parse the authorized near-cli credential for ${accountId}.`); }
      // near-cli-rs autogenerated key files may omit account_id. The exact
      // user-authorized filename and on-chain access-key preflight bind it.
      check(record.account_id === undefined || record.account_id === accountId, `Credential account mismatch for ${accountId}.`);
      secret = record.private_key ?? record.secret_key;
      expectedPublic = record.public_key;
      check(!record.private_key || !record.secret_key || record.private_key === record.secret_key, 'Conflicting near-cli private key fields.');
    }
    rememberSecret(secret);
    check(typeof secret === 'string' && /^ed25519:[1-9A-HJ-NP-Za-km-z]{85,90}$/.test(secret), `Invalid ed25519 credential for ${accountId}.`);
    let signer;
    try { signer = new KeyPairSigner(KeyPair.fromString(secret)); }
    catch { throw new PublicError(`Invalid ed25519 credential for ${accountId}.`); }
    const publicKey = (await signer.getPublicKey()).toString();
    check(!expectedPublic || expectedPublic === publicKey, `Credential public key mismatch for ${accountId}.`);
    loaded.set(accountId, { signer, publicKey });
    if (!stored) additions.push(`${name}=${secret}`);
  }
  // Persist only after both accounts pass RPC preflight. Append missing entries;
  // never replace any bytes or unrelated environment entries. No secret backups.
  let persisted = false;
  async function persist() {
    check(!persisted, 'Credential persistence already attempted.');
    persisted = true;
    await requireIgnoredEnv();
    if (!additions.length) return;
    const nowExists = await regularFile(envPath, true);
    check(nowExists === existed, '.env changed during preflight; nothing was written.');
    const handle = await open(envPath, existed ? 'a+' : 'wx+', 0o600);
    try {
      const current = await handle.readFile('utf8');
      check(current === original, '.env changed during preflight; nothing was written.');
      const suffix = `${current && !current.endsWith('\n') ? '\n' : ''}${additions.join('\n')}\n`;
      // O_APPEND on an existing file means even a concurrent append cannot be
      // overwritten. A changed preflight snapshot is rejected above.
      await handle.write(suffix, null, 'utf8');
      await handle.sync();
    } finally { await handle.close(); }
  }
  return { loaded, persist };
}

export async function preflight(rpc, credentials) {
  let status;
  try { status = await rpc.viewNodeStatus(); } catch { throw new PublicError('Testnet RPC is unavailable; no signing occurred.'); }
  check(status.chain_id === 'testnet', 'RPC is not NEAR testnet; no signing occurred.');
  const balances = {};
  for (const accountId of [RECEIVER, SENDER]) {
    let access, account;
    try {
      access = await rpc.viewAccessKey({ accountId, publicKey: credentials.get(accountId).publicKey, finalityQuery: { finality: 'final' } });
      account = await rpc.viewAccount({ accountId, blockQuery: { finality: 'final' } });
    } catch { throw new PublicError(`Could not verify account and access key for ${accountId}; no signing occurred.`); }
    check(access.permission === 'FullAccess', `${accountId} requires a FullAccess key; no signing occurred.`);
    check(BigInt(account.amount) >= YOCTO / 5n, `${accountId} requires at least 0.2 NEAR; no signing occurred.`);
    balances[accountId] = near(account.amount);
  }
  for (const accountId of [REGISTRY, ROUTER]) {
    try { await rpc.viewAccount({ accountId, blockQuery: { finality: 'final' } }); }
    catch { throw new PublicError('Expected testnet registry/router is unavailable; no signing occurred.'); }
  }
  return balances;
}
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
export function successful(result) {
  check(result && Object.hasOwn(result.status ?? {}, 'SuccessValue')
    && !result.receipts_outcome?.some((row) => row.outcome?.status?.Failure), 'Transaction failed on testnet; inspect its public hash. No mutation is retried.');
}
export function transactionHash(result) {
  const hash = result?.transaction?.hash ?? result?.transaction_outcome?.id;
  check(typeof hash === 'string' && HASH.test(hash), 'RPC response lacks a valid transaction hash.');
  return hash;
}

// Inspection only. The original app derives the scalar and signs the spend.
export function inspectBrowserSpend(payload, expectedAccount) {
  check(payload?.method === 'send_tx' || payload?.method === 'broadcast_tx_commit', 'Unapproved browser mutation.');
  const encoded = payload.method === 'send_tx' ? payload.params?.signed_tx_base64 : payload.params?.[0];
  check(typeof encoded === 'string' && encoded.length < 4096, 'Invalid browser transaction envelope.');
  const signed = decodeSignedTransaction(Buffer.from(encoded, 'base64'));
  const tx = signed.transaction;
  check(expectedAccount && HEX.test(expectedAccount) && tx.signerId === expectedAccount && tx.receiverId === RECEIVER
    && tx.publicKey.keyType === 0 && Buffer.from(tx.publicKey.data).toString('hex') === expectedAccount
    && tx.actions.length === 1 && exactKeys(tx.actions[0], ['transfer'])
    && exactKeys(tx.actions[0].transfer, ['deposit']) && BigInt(tx.actions[0].transfer.deposit) === YOCTO / 1000n,
  'Browser spend must transfer exactly 0.001 NEAR from this payment to the receiver.');
  // Borsh decode returns a plain signature enum, not a Signature instance.
  const signature = signed.signature.ed25519Signature?.data;
  const digest = createHash('sha256').update(encodeTransaction(tx)).digest();
  check(signature?.length === 64 && tx.publicKey.verify(digest, Uint8Array.from(signature)), 'Invalid browser spend signature.');
  rememberSecret(encoded);
  rememberSecret(Buffer.from(signature).toString('base64'));
  return baseEncode(digest);
}

export function createTestSigner({ rpc, credentials, execute = false, onTransaction = () => {} }) {
  const attempted = new Set();
  let armed;
  let stealthAccount;
  let spendHash;
  function arm(operation) {
    check(execute === true && ['message', 'register', 'send', 'spend'].includes(operation), 'Signing requires --execute and a known step.');
    check(!armed && !attempted.has(operation), 'Signing step was already armed or attempted.');
    armed = operation;
  }
  function consume(operation) {
    check(execute === true && armed === operation && !attempted.has(operation), 'Signing is not authorized for this step.');
    attempted.add(operation); armed = undefined;
  }
  async function signMessage(accountId, params) {
    check(accountId === RECEIVER && exactKeys(params, ['message', 'recipient', 'nonce']), 'Unexpected NEP-413 signing request.');
    check(Array.isArray(params.nonce) && params.nonce.length === 32 && params.nonce.every((n) => Number.isInteger(n) && n >= 0 && n <= 255), 'Unexpected NEP-413 nonce.');
    // Only the two key requests the app makes: current (v2, recipient = the Veil app) and the
    // earlier-inbox request (v1, recipient = the signer). Mirrors nep413Request in @veil/sdk.
    const allowed = [['v2', 'veil-eta-khaki.vercel.app'], ['v1', accountId]].map(([v, recipient]) => ({
      message: `Veil key derivation ${v}: derive private receiving keys for this NEAR account.\nAccount: ${accountId}`,
      recipient,
      nonce: createHash('sha256').update(`veil-key-derivation:testnet:${v}:${accountId}`).digest(),
    }));
    check(allowed.some((request) => params.message === request.message && params.recipient === request.recipient
      && timingSafeEqual(Buffer.from(params.nonce), request.nonce)), 'NEP-413 message contract changed; refusing to sign.');
    consume('message');
    // Installed 7.4.0 signNep413Message uses serializeMessage: LE u32
    // 2147484061 + Borsh payload, SHA-256, then ed25519. No fake signature.
    const signed = await credentials.get(accountId).signer.signNep413Message(accountId, { ...params, nonce: Uint8Array.from(params.nonce) });
    const signature = Buffer.from(signed.signature).toString('base64');
    rememberSecret(signature);
    rememberSecret(Buffer.from(signed.signature).toString('hex'));
    return { accountId, publicKey: signed.publicKey.toString(), signature };
  }
  async function signAndSendTransaction(accountId, request) {
    check(exactKeys(request, ['receiverId', 'actions']) && Array.isArray(request.actions) && request.actions.length === 1, 'Only one approved wallet action is allowed.');
    const action = request.actions[0];
    check(exactKeys(action, ['type', 'params']) && action.type === 'FunctionCall'
      && exactKeys(action.params, ['methodName', 'args', 'gas', 'deposit']), 'Only typed FunctionCall actions are allowed.');
    const { methodName, args, gas, deposit } = action.params;
    check(gas === '30000000000000', 'Unexpected wallet gas allowance.');
    let operation;
    if (accountId === RECEIVER && request.receiverId === REGISTRY && methodName === 'register') {
      operation = 'register';
      check(deposit === (YOCTO / 100n).toString() && exactKeys(args, ['spend_pub_hex', 'view_pub_hex', 'scheme_id'])
        && HEX.test(args.spend_pub_hex) && HEX.test(args.view_pub_hex) && args.scheme_id === 1, 'Unexpected registry arguments or deposit.');
      const existing = await rpc.callFunction({ contractId: REGISTRY, method: 'get_meta', args: { account_id: RECEIVER }, blockQuery: { finality: 'final' } });
      check(!existing || (existing.spend_pub_hex === args.spend_pub_hex && existing.view_pub_hex === args.view_pub_hex && existing.scheme_id === 1), 'Existing receiver registration uses different keys; refusing to overwrite it.');
    } else if (accountId === SENDER && request.receiverId === ROUTER && methodName === 'send_near') {
      operation = 'send';
      check(deposit === (YOCTO / 20n).toString() && exactKeys(args, ['stealth_account', 'ephemeral_pub_hex', 'view_tag'])
        && HEX.test(args.stealth_account) && HEX.test(args.ephemeral_pub_hex)
        && Number.isInteger(args.view_tag) && args.view_tag >= 0 && args.view_tag <= 255, 'Unexpected router arguments or deposit.');
    } else { throw new PublicError('Account, contract, or method is outside the approved testnet flow.'); }
    consume(operation); // Burn the allowance before signing; never resubmit on failure.
    if (operation === 'send') stealthAccount = args.stealth_account;
    const { signer, publicKey } = credentials.get(accountId);
    const access = await rpc.viewAccessKey({ accountId, publicKey, finalityQuery: { finality: 'final' } });
    check(access.permission === 'FullAccess', 'Signing key is no longer FullAccess.');
    const block = await rpc.viewBlock({ finality: 'final' });
    const tx = createTransaction(accountId, await signer.getPublicKey(), request.receiverId, BigInt(access.nonce) + 1n,
      [actions.functionCall(methodName, new TextEncoder().encode(JSON.stringify(args)), BigInt(gas), BigInt(deposit))], baseDecode(block.header.hash));
    const { signedTransaction, txHash } = await signer.signTransaction(tx);
    const hash = baseEncode(txHash);
    // Record the known hash before submission: an RPC timeout is ambiguous.
    onTransaction(operation, { accountId, receiverId: request.receiverId, hash, amount: near(deposit), stealthAccount });
    let raw;
    try { raw = await rpc.sendTransactionUntil(signedTransaction, 'FINAL'); }
    catch { throw new PublicError('Transaction submission outcome is uncertain; inspect the recorded hash before any new run.'); }
    successful(raw);
    check(raw.final_execution_status === 'FINAL', 'Transaction is not final; inspect the recorded hash.');
    check(transactionHash(raw) === hash, 'RPC returned an unexpected transaction hash.');
    // Never return raw outcomes (which include signatures and logs) to the UI.
    return { final_execution_status: raw.final_execution_status, transaction: { hash, signer_id: accountId, receiver_id: request.receiverId }, transaction_outcome: { id: hash }, status: { SuccessValue: '' } };
  }
  function authorizeBrowserSpend(payload) {
    const hash = inspectBrowserSpend(payload, stealthAccount);
    consume('spend');
    spendHash = hash;
    onTransaction('spend', { accountId: stealthAccount, receiverId: RECEIVER, hash: spendHash, amount: '0.001' });
    return spendHash;
  }
  return { arm, signMessage, signAndSendTransaction, authorizeBrowserSpend,
    get stealthAccount() { return stealthAccount; }, get spendHash() { return spendHash; },
    get messageSigned() { return attempted.has('message'); } };
}

// This is the ONLY module substituted by Playwright. The hosted app still owns
// key derivation, random ephemeral scalars, scanning and raw-scalar spending.
export const CONNECTOR_MODULE = `
export class NearConnector {
  constructor(options) {
    if (options?.network !== 'testnet') throw new Error('Test signer is testnet-only');
    this.listeners = new Map();
    this.adapter = {
      signMessage: (p) => window.__veilSignMessage({ ...p, nonce: Array.from(p.nonce) }),
      signAndSendTransaction: (p) => window.__veilSendTransaction(p),
      getAccounts: () => window.__veilDemoAccounts(),
    };
  }
  on(event, listener) { const list = this.listeners.get(event) || []; list.push(listener); this.listeners.set(event, list); return this; }
  async connect() { const accounts = await window.__veilDemoAccounts(); for (const listener of this.listeners.get('wallet:signIn') || []) await listener({ accounts }); return accounts; }
  async wallet() { return this.adapter; }
  async disconnect() { for (const listener of this.listeners.get('wallet:signOut') || []) await listener(); }
}
`;
