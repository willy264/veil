import {
  JsonRpcProvider,
  KeyPair,
  KeyPairSigner,
  PublicKey,
  Signer,
  actions,
  baseDecode,
  baseEncode,
  createTransaction,
  nearToYocto,
} from 'near-api-js';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  bytesToHex,
  deriveStealth,
  scanAnnouncement,
  signWithScalar,
  type StealthKeys,
} from '../packages/sdk/src/crypto.js';
import { deriveKeysFromNep413 } from '../packages/sdk/src/sdk.js';

const RPC_URL = 'https://rpc.testnet.fastnear.com';
const REGISTRY_ID = 'registry2.veil-williams.testnet';
const ROUTER_ID = 'router2.veil-williams.testnet';
const ALICE_ID = 'alice.veil-williams.testnet';
const SENDERS = ['veil-demo1.testnet', 'veil-demo2.testnet', 'veil-demo3.testnet'];
const DAO_FACTORY = 'sputnikv2.testnet';
const RESULTS_DIR = new URL('../results/', import.meta.url);
const NONCES = new Map<string, bigint>();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required and must not be committed`);
  return value;
}

function explorerUrl(hash: string): string {
  return `https://testnet.nearblocks.io/txns/${hash}`;
}

function hashOf(response: any): string {
  const hash = response.transaction?.hash ?? response.transaction_outcome?.id;
  if (!hash) throw new Error(`transaction hash missing: ${JSON.stringify(response)}`);
  return hash;
}

class ScalarSigner extends Signer {
  private readonly publicKey: PublicKey;

  constructor(private readonly scalar: bigint, publicKeyBytes: Uint8Array) {
    super();
    this.publicKey = PublicKey.fromString(`ed25519:${baseEncode(publicKeyBytes)}`);
  }

  async getPublicKey(): Promise<PublicKey> {
    return this.publicKey;
  }

  protected async signBytes(bytes: Uint8Array): Promise<Uint8Array> {
    return signWithScalar(this.scalar, bytes, new Uint8Array(32).fill(0x56));
  }
}

async function submit(
  provider: JsonRpcProvider,
  signerId: string,
  receiverId: string,
  signer: Signer,
  methodName: string,
  args: Record<string, unknown>,
  deposit: bigint,
  gas = 30_000_000_000_000n,
): Promise<{ hash: string; explorerUrl: string; raw: unknown }> {
  const publicKey = await signer.getPublicKey();
  const nonceKey = `${signerId}:${publicKey.toString()}`;
  const nonce = NONCES.has(nonceKey)
    ? NONCES.get(nonceKey)! + 1n
    : (await provider.viewAccessKey({ accountId: signerId, publicKey: publicKey.toString(), finalityQuery: { finality: 'final' } })).nonce + 1n;
  NONCES.set(nonceKey, nonce);
  const block = await provider.viewBlock({ finality: 'final' });
  const transaction = createTransaction(
    signerId,
    publicKey,
    receiverId,
    nonce,
    [actions.functionCall(methodName, new TextEncoder().encode(JSON.stringify(args)), gas, deposit)],
    baseDecode(block.header.hash),
  );
  const { signedTransaction } = await signer.signTransaction(transaction);
  const raw = await provider.sendTransaction(signedTransaction);
  const hash = hashOf(raw);
  if (!('SuccessValue' in (raw.status ?? {})) && !('SuccessReceiptId' in (raw.status ?? {}))) {
    throw new Error(`demo call failed: ${JSON.stringify(raw)}`);
  }
  return { hash, explorerUrl: explorerUrl(hash), raw };
}

async function transfer(provider: JsonRpcProvider, signerId: string, recipient: string, signer: Signer, amount: string) {
  const publicKey = await signer.getPublicKey();
  const nonceKey = `${signerId}:${publicKey.toString()}`;
  const nonce = NONCES.has(nonceKey)
    ? NONCES.get(nonceKey)! + 1n
    : (await provider.viewAccessKey({ accountId: signerId, publicKey: publicKey.toString(), finalityQuery: { finality: 'final' } })).nonce + 1n;
  NONCES.set(nonceKey, nonce);
  const block = await provider.viewBlock({ finality: 'final' });
  const transaction = createTransaction(signerId, publicKey, recipient, nonce, [actions.transfer(BigInt(nearToYocto(amount)))], baseDecode(block.header.hash));
  const { signedTransaction } = await signer.signTransaction(transaction);
  const raw = await provider.sendTransaction(signedTransaction);
  const hash = hashOf(raw);
  return { hash, explorerUrl: explorerUrl(hash), raw };
}

async function main(): Promise<void> {
  const provider = new JsonRpcProvider({ url: RPC_URL });
  const aliceSigner = new KeyPairSigner(KeyPair.fromString(requireEnv('VEIL_ALICE_PRIVATE_KEY')));
  const senderSigners = SENDERS.map((accountId, index) => ({
    accountId,
    signer: new KeyPairSigner(KeyPair.fromString(requireEnv(`VEIL_SENDER${index + 1}_PRIVATE_KEY`))),
  }));
  const walletSignature = new Uint8Array(64).map((_, index) => index + 1);
  const keys = deriveKeysFromNep413(walletSignature, ALICE_ID);
  const register = await submit(provider, ALICE_ID, REGISTRY_ID, aliceSigner, 'register', {
    spend_pub_hex: bytesToHex(keys.spendPublicKey),
    view_pub_hex: bytesToHex(keys.viewPublicKey),
    scheme_id: 1,
  }, 1_000_000_000_000_000_000_000n);

  const existingAnnouncements = await provider.callFunction({
    contractId: ROUTER_ID,
    method: 'get_announcements',
    args: { from_index: 0, limit: 10_000 },
    blockQuery: { finality: 'final' },
  }) as Array<Record<string, unknown>>;
  const firstOutputIndex = existingAnnouncements.length;

  const sends = [] as Array<Record<string, unknown>>;
  const announcements = [] as Array<Record<string, unknown>>;
  for (let index = 0; index < senderSigners.length; index += 1) {
    const derived = deriveStealth(keys.spendPublicKey, keys.viewPublicKey, 0x500n + BigInt(index), firstOutputIndex + index);
    const send = await submit(provider, senderSigners[index]!.accountId, ROUTER_ID, senderSigners[index]!.signer, 'send_near', {
      stealth_account: derived.stealthAccount,
      ephemeral_pub_hex: bytesToHex(derived.ephemeralPublicKey),
      view_tag: derived.viewTag,
    }, BigInt(nearToYocto('0.01')));
    sends.push({ sender: senderSigners[index]!.accountId, stealthAccount: derived.stealthAccount, ...send });
  }

  let rawAnnouncements: Array<Record<string, unknown>> = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    rawAnnouncements = await provider.callFunction({
      contractId: ROUTER_ID,
      method: 'get_announcements',
      args: { from_index: 0, limit: 100 },
      blockQuery: { finality: 'final' },
    }) as Array<Record<string, unknown>>;
    if (rawAnnouncements.length >= firstOutputIndex + senderSigners.length) break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  for (const raw of rawAnnouncements) {
    if (Number(raw.index) < firstOutputIndex) continue;
    const announcement = {
      stealthAccount: String(raw.stealth_account),
      ephemeralPublicKey: hexToBytes(String(raw.ephemeral_pub_hex)),
      viewTag: Number(raw.view_tag),
      outputIndex: Number(raw.index),
    };
    const found = scanAnnouncement(keys, announcement);
    if (found.owned) announcements.push({
      ...raw,
      stealthAccount: announcement.stealthAccount,
      ephemeralPublicKey: String(raw.ephemeral_pub_hex),
      outputIndex: announcement.outputIndex,
      owned: true,
      privateScalar: found.privateScalar.toString(16),
    });
  }

  let spend: Record<string, unknown> | null = null;
  const first = announcements[0] as { stealthAccount: string; privateScalar: string } | undefined;
  if (first) {
    const privateScalar = BigInt(`0x${first.privateScalar}`);
    const signer = new ScalarSigner(privateScalar, hexToBytes(first.stealthAccount));
    spend = await transfer(provider, first.stealthAccount, SENDERS[0]!, signer, '0.001');
  }

  let dao: Record<string, unknown>;
  try {
    const account = await provider.viewAccount({ accountId: DAO_FACTORY, finalityQuery: { finality: 'final' } });
    dao = { status: 'FACTORY_VISIBLE_NO_PAYOUT_SUBMITTED', accountId: DAO_FACTORY, account, note: 'Sputnik proposal execution requires an existing DAO and its owner approvals; no mainnet or unapproved DAO creation was attempted.' };
  } catch (error) {
    dao = { status: 'FACTORY_VIEW_FAILED', accountId: DAO_FACTORY, error: error instanceof Error ? error.message : String(error) };
  }

  const result = {
    status: announcements.length >= 3 && spend ? 'PASS_WITH_DAO_PREREQUISITE' : 'FAIL',
    network: 'testnet',
    rpcUrl: RPC_URL,
    alice: ALICE_ID,
    registry: REGISTRY_ID,
    router: ROUTER_ID,
    register,
    sends,
    scan: {
      found: announcements.length,
      announcements: announcements.map(({ privateScalar: _privateScalar, ...publicAnnouncement }) => publicAnnouncement),
    },
    spend,
    dao,
    limitations: ['Sputnik DAO payout is recorded as a prerequisite probe, not a completed proposal execution.', 'Amounts, timing, sender identities, and token contracts remain public.'],
  };
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(new URL(`demo-${timestamp}.json`, RESULTS_DIR), JSON.stringify(result, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  console.log(JSON.stringify(result, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
