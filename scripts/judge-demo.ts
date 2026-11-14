// Sets up the no-wallet judge path on testnet. It registers a demo receiver under the current (v2)
// NEP-413 key request, sends private payments to it from a demo sender through router2, finds them
// with the SDK, and writes public evidence, including the receiver's auditor key, to
// results/judge-demo-<timestamp>.json. Private keys come from near-cli legacy credential files
// (~/.near-credentials/testnet/<account>.json) and are never printed or written.
//
// Run: pnpm exec tsx scripts/judge-demo.ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JsonRpcProvider, KeyPair, KeyPairSigner, actions, baseDecode, createTransaction, type Signer } from 'near-api-js';
import { ORDER, scanAnnouncement } from '../packages/sdk/src/crypto.js';
import { VeilClient, deriveKeysFromNep413, exportViewKey, nep413Request, type VeilMeta } from '../packages/sdk/src/sdk.js';
import { allAnnouncements, totalAnnouncements } from './router-pages.js';

const RPC_URL = 'https://rpc.testnet.near.org';
const REGISTRY_ID = 'registry2.veil-williams.testnet';
const ROUTER_ID = 'router2.veil-williams.testnet';
const RECEIVER = process.env.VEIL_JUDGE_RECEIVER ?? 'veil-judge-recv.testnet';
const SENDER = process.env.VEIL_JUDGE_SENDER ?? 'veil-judge-send.testnet';
const AMOUNTS = ['0.02', '0.03', '0.05'];
const YOCTO = 10n ** 24n;
const explorer = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

function yocto(near: string): bigint {
  const [whole, fraction = ''] = near.split('.');
  return BigInt(whole!) * YOCTO + BigInt(fraction.padEnd(24, '0'));
}

async function signerFor(accountId: string): Promise<KeyPairSigner> {
  const file = path.join(os.homedir(), '.near-credentials', 'testnet', `${accountId}.json`);
  const record = JSON.parse(await readFile(file, 'utf8')) as { private_key?: string; secret_key?: string };
  const secret = record.private_key ?? record.secret_key;
  if (!secret?.startsWith('ed25519:')) throw new Error(`no ed25519 key for ${accountId}`);
  return new KeyPairSigner(KeyPair.fromString(secret as `ed25519:${string}`));
}

async function call(provider: JsonRpcProvider, signerId: string, signer: Signer, receiverId: string, method: string, args: object, deposit: bigint) {
  const publicKey = await signer.getPublicKey();
  const access = await provider.viewAccessKey({ accountId: signerId, publicKey: publicKey.toString(), finalityQuery: { finality: 'final' } });
  const block = await provider.viewBlock({ finality: 'final' });
  const tx = createTransaction(signerId, publicKey, receiverId, BigInt(access.nonce) + 1n,
    [actions.functionCall(method, new TextEncoder().encode(JSON.stringify(args)), 30_000_000_000_000n, deposit)], baseDecode(block.header.hash));
  const { signedTransaction } = await signer.signTransaction(tx);
  const raw: any = await provider.sendTransaction(signedTransaction);
  const failed = raw.status?.Failure || raw.receipts_outcome?.some((r: any) => r.outcome?.status?.Failure);
  if (failed) throw new Error(`${method} failed: ${JSON.stringify(raw.status)}`);
  const hash = raw.transaction?.hash ?? raw.transaction_outcome?.id;
  return { hash, explorerUrl: explorer(hash) };
}

async function routerStorage(provider: JsonRpcProvider): Promise<number> {
  return Number((await provider.viewAccount({ accountId: ROUTER_ID, blockQuery: { finality: 'final' } } as any) as any).storage_usage);
}

function randomScalar(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytes.reduceRight((value, byte) => (value << 8n) | BigInt(byte), 0n) % (ORDER - 1n) + 1n;
}

async function main(): Promise<void> {
  const provider = new JsonRpcProvider({ url: RPC_URL });
  const view = { viewFunction: (contractId: string, method: string, args: Record<string, unknown>) =>
    provider.callFunction({ contractId, method, args, blockQuery: { finality: 'final' } }) };
  const receiverSigner = await signerFor(RECEIVER);
  const senderSigner = await signerFor(SENDER);

  // The same NEP-413 request a wallet signs in the app, so the app derives the same keys.
  const request = nep413Request(RECEIVER);
  const signed = await receiverSigner.signNep413Message(RECEIVER, request);
  const keys = deriveKeysFromNep413(signed.signature, RECEIVER);
  const receiver = new VeilClient(RECEIVER, REGISTRY_ID, ROUTER_ID, view, keys);
  const meta: VeilMeta = { spend_pub_hex: hex(keys.spendPublicKey), view_pub_hex: hex(keys.viewPublicKey), scheme_id: 1 };

  const existing = await receiver.resolve(RECEIVER);
  let registration: unknown = 'already registered with these keys';
  if (!existing) {
    const action = receiver.register();
    registration = await call(provider, RECEIVER, receiverSigner, action.contractId, action.methodName, action.args, action.deposit);
  } else if (existing.spend_pub_hex !== meta.spend_pub_hex || existing.view_pub_hex !== meta.view_pub_hex) {
    throw new Error(`${RECEIVER} is registered with different keys; refusing to replace them`);
  }

  const sender = new VeilClient(SENDER, REGISTRY_ID, ROUTER_ID, view);
  const recipientMeta = await sender.resolve(RECEIVER);
  if (!recipientMeta) throw new Error('receiver registration not visible yet');
  const sends = [];
  for (const amount of AMOUNTS) {
    const before = await routerStorage(provider);
    const derivationIndex = await sender.nextOutputIndex();
    const action = sender.buildSendNear(recipientMeta, yocto(amount), randomScalar(), derivationIndex);
    const tx = await call(provider, SENDER, senderSigner, action.contractId, action.methodName, action.args, action.deposit);
    const after = await routerStorage(provider);
    sends.push({ amount, derivationIndex, stealthAccount: action.args.stealth_account, routerStorageBytes: after - before, ...tx });
  }

  const rows = await allAnnouncements(provider, ROUTER_ID);
  const found = [];
  for (const row of rows) {
    const owned = scanAnnouncement(keys, {
      stealthAccount: row.stealth_account,
      ephemeralPublicKey: Uint8Array.from(Buffer.from(row.ephemeral_pub_hex, 'hex')),
      viewTag: Number(row.view_tag),
      outputIndex: Number(row.index),
    });
    if (!owned.owned) continue;
    const account: any = await provider.viewAccount({ accountId: row.stealth_account, blockQuery: { finality: 'final' } } as any);
    found.push({ storedIndex: row.index, stealthAccount: row.stealth_account, balanceYocto: String(account.amount) });
  }

  const result = {
    status: sends.every((send) => found.some((row) => row.stealthAccount === send.stealthAccount)) ? 'PASS' : 'FAIL',
    network: 'testnet',
    registry: REGISTRY_ID,
    router: ROUTER_ID,
    receiver: RECEIVER,
    sender: SENDER,
    keyRequest: { message: request.message, recipient: request.recipient, version: 'v2' },
    auditorKey: exportViewKey(keys),
    auditorKeyNote: 'Published on purpose for the judge path. It finds incoming payments for this demo receiver and cannot spend them.',
    registration,
    sends,
    scan: { announcementsRead: rows.length, found },
  };
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  await mkdir(new URL('../results/', import.meta.url), { recursive: true });
  await writeFile(new URL(`../results/judge-demo-${stamp}.json`, import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
