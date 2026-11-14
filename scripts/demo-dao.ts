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
import { bytesToHex, deriveStealth, scanAnnouncement } from '../packages/sdk/src/crypto.js';
import { deriveKeysFromNep413 } from '../packages/sdk/src/sdk.js';
import { allAnnouncements, totalAnnouncements } from './router-pages.js';

const RPC_URL = 'https://rpc.testnet.fastnear.com';
const FACTORY_ID = 'sputnikv2.testnet';
const OWNER_ID = 'veil-williams.testnet';
const ROUTER_ID = 'router2.veil-williams.testnet';
const RESULTS_DIR = new URL('../results/', import.meta.url);
const NONCES = new Map<string, bigint>();

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required and must not be committed`);
  if (!/^ed25519:[1-9A-HJ-NP-Za-km-z]+$/.test(value)) {
    throw new Error(`${name} must be an ed25519 private key in near-api-js format`);
  }
  return value;
}

function hashOf(response: any): string {
  const hash = response.transaction?.hash ?? response.transaction_outcome?.id;
  if (!hash) throw new Error(`transaction hash missing: ${JSON.stringify(response)}`);
  return hash;
}

function explorerUrl(hash: string): string {
  return `https://testnet.nearblocks.io/txns/${hash}`;
}

class ScalarSigner extends Signer {
  private readonly publicKey: PublicKey;

  constructor(private readonly scalar: bigint, publicKeyBytes: Uint8Array) {
    super();
    this.publicKey = PublicKey.fromString(`ed25519:${baseEncode(publicKeyBytes)}`);
  }

  async getPublicKey(): Promise<PublicKey> { return this.publicKey; }

  protected async signBytes(bytes: Uint8Array): Promise<Uint8Array> {
    const { signWithScalar } = await import('../packages/sdk/src/crypto.js');
    return signWithScalar(this.scalar, bytes, new Uint8Array(32).fill(0x56));
  }
}

async function call(
  provider: JsonRpcProvider,
  signerId: string,
  receiverId: string,
  signer: Signer,
  methodName: string,
  args: Record<string, unknown>,
  deposit: bigint,
  gas: bigint,
): Promise<{ hash: string; explorerUrl: string; raw: any }> {
  const publicKey = await signer.getPublicKey();
  const key = `${signerId}:${publicKey.toString()}`;
  const nonce = (NONCES.get(key) ?? (await provider.viewAccessKey({
    accountId: signerId,
    publicKey: publicKey.toString(),
    finalityQuery: { finality: 'final' },
  })).nonce) + 1n;
  NONCES.set(key, nonce);
  const block = await provider.viewBlock({ finality: 'final' });
  const tx = createTransaction(
    signerId,
    publicKey,
    receiverId,
    nonce,
    [actions.functionCall(methodName, new TextEncoder().encode(JSON.stringify(args)), gas, deposit)],
    baseDecode(block.header.hash),
  );
  const { signedTransaction } = await signer.signTransaction(tx);
  const raw = await provider.sendTransaction(signedTransaction);
  if (!('SuccessValue' in (raw.status ?? {})) && !('SuccessReceiptId' in (raw.status ?? {}))) {
    throw new Error(`transaction failed: ${JSON.stringify(raw)}`);
  }
  const hash = hashOf(raw);
  return { hash, explorerUrl: explorerUrl(hash), raw };
}

function returnValue(raw: any): string | undefined {
  const encoded = raw.status?.SuccessValue;
  return typeof encoded === 'string' ? Buffer.from(encoded, 'base64').toString('utf8') : undefined;
}

async function main(): Promise<void> {
  const provider = new JsonRpcProvider({ url: RPC_URL });
  const owner = new KeyPairSigner(KeyPair.fromString(env('VEIL_DAO_OWNER_PRIVATE_KEY')));
  const funder = owner;
  const keys = deriveKeysFromNep413(new Uint8Array(64).map((_, index) => index + 1), OWNER_ID);
  const existingDaoId = process.env.VEIL_DAO_ID;
  if (existingDaoId) {
    await finishExistingDao(provider, owner, funder, keys, existingDaoId);
    return;
  }
  const ephemeralScalar = 0x789abcdef123456789abcdef123456789n;
  const derived = deriveStealth(keys.spendPublicKey, keys.viewPublicKey, ephemeralScalar, 0);
  const daoName = `veildao${Date.now().toString().slice(-10)}`;
  const daoId = `${daoName}.${FACTORY_ID}`;
  const policy = [OWNER_ID];
  const factoryArgs = {
    name: daoName,
    args: Buffer.from(JSON.stringify({
      config: { name: daoName, purpose: 'Veil testnet payout demonstration', metadata: '' },
      policy,
    })).toString('base64'),
  };
  const factoryDeposit = 5_403_650_000_000_000_000_000_000n;
  const create = await call(provider, OWNER_ID, FACTORY_ID, owner, 'create', factoryArgs, factoryDeposit, 150_000_000_000_000n);
  let policyView: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      policyView = await provider.callFunction({ contractId: daoId, method: 'get_policy', args: {}, blockQuery: { finality: 'final' } });
      break;
    } catch (error) {
      if (attempt === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  const routerArgs = {
    stealth_account: derived.stealthAccount,
    ephemeral_pub_hex: bytesToHex(derived.ephemeralPublicKey),
    view_tag: derived.viewTag,
  };
  const proposal = await call(provider, OWNER_ID, daoId, owner, 'add_proposal', {
    proposal: {
      description: 'Veil private receiving DAO payout',
      kind: {
        FunctionCall: {
          receiver_id: ROUTER_ID,
          actions: [{
            method_name: 'send_near',
            args: Buffer.from(JSON.stringify(routerArgs)).toString('base64'),
            deposit: nearToYocto('0.04').toString(),
            gas: '30000000000000',
          }],
        },
      },
    },
  }, nearToYocto('1'), 100_000_000_000_000n);
  const proposalId = Number(returnValue(proposal.raw) ?? '0');
  const approveOwner = await call(provider, OWNER_ID, daoId, owner, 'act_proposal', { id: proposalId, action: 'VoteApprove' }, 0n, 100_000_000_000_000n);
  let announcements: any[] = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    announcements = await allAnnouncements(provider, ROUTER_ID);
    if (announcements.some((item) => item.stealth_account === derived.stealthAccount)) break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  const owned = announcements.filter((item) => item.stealth_account === derived.stealthAccount).map((item) => {
    const found = scanAnnouncement(keys, {
      stealthAccount: item.stealth_account,
      ephemeralPublicKey: Uint8Array.from(item.ephemeral_pub_hex.match(/.{2}/g), (part: string) => Number.parseInt(part, 16)),
      viewTag: Number(item.view_tag),
      outputIndex: Number(item.index),
    });
    return { index: item.index, amount: item.amount, owned: found.owned };
  });
  const result = {
    status: owned.some((item) => item.owned) ? 'PASS' : 'FAIL',
    network: 'testnet',
    factory: FACTORY_ID,
    daoId,
    council: policy,
    stealthAccount: derived.stealthAccount,
    create: { hash: create.hash, explorerUrl: create.explorerUrl },
    policyView,
    proposal: { id: proposalId, hash: proposal.hash, explorerUrl: proposal.explorerUrl },
    approvals: [approveOwner.explorerUrl],
    scan: { found: owned.length, owned },
    sources: ['https://github.com/near-daos/sputnik-dao-contract#setup'],
  };
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(new URL(`demo-dao-${timestamp}.json`, RESULTS_DIR), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

async function finishExistingDao(
  provider: JsonRpcProvider,
  owner: Signer,
  funder: Signer,
  keys: ReturnType<typeof deriveKeysFromNep413>,
  daoId: string,
): Promise<void> {
  const outputIndex = await totalAnnouncements(provider, ROUTER_ID);
  const derived = deriveStealth(keys.spendPublicKey, keys.viewPublicKey, 0x789abcdef123456789abcdef123456789n, outputIndex);
  const proposal = await call(provider, OWNER_ID, daoId, owner, 'add_proposal', {
    proposal: {
      description: 'Veil private receiving DAO payout with global output index',
      kind: { FunctionCall: { receiver_id: ROUTER_ID, actions: [{ method_name: 'send_near', args: Buffer.from(JSON.stringify({ stealth_account: derived.stealthAccount, ephemeral_pub_hex: bytesToHex(derived.ephemeralPublicKey), view_tag: derived.viewTag })).toString('base64'), deposit: nearToYocto('0.04').toString(), gas: '30000000000000' }] } },
    },
  }, nearToYocto('1'), 100_000_000_000_000n);
  const proposalId = Number(returnValue(proposal.raw) ?? '0');
  const approve = await call(provider, OWNER_ID, daoId, owner, 'act_proposal', { id: proposalId, action: 'VoteApprove' }, 0n, 100_000_000_000_000n);
  let announcements: any[] = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    announcements = await allAnnouncements(provider, ROUTER_ID);
    if (announcements.some((item) => item.stealth_account === derived.stealthAccount)) break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  const owned = announcements.filter((item) => item.stealth_account === derived.stealthAccount).map((item) => {
    const found = scanAnnouncement(keys, {
      stealthAccount: item.stealth_account,
      ephemeralPublicKey: Uint8Array.from(item.ephemeral_pub_hex.match(/.{2}/g), (part: string) => Number.parseInt(part, 16)),
      viewTag: Number(item.view_tag),
      outputIndex: Number(item.index),
    });
    return { index: item.index, amount: item.amount, owned: found.owned };
  });
  const result = { status: owned.some((item) => item.owned) ? 'PASS' : 'FAIL', network: 'testnet', factory: FACTORY_ID, daoId, proposalId, outputIndex, proposal: { hash: proposal.hash, explorerUrl: proposal.explorerUrl }, approvals: [approve.explorerUrl], stealthAccount: derived.stealthAccount, scan: { found: owned.length, owned }, sources: ['https://github.com/near-daos/sputnik-dao-contract#setup'] };
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(new URL(`demo-dao-${timestamp}.json`, RESULTS_DIR), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const result = {
    status: 'BLOCKED',
    network: 'testnet',
    factory: FACTORY_ID,
    attempted: 'create sole-council DAO, add and approve send_near FunctionCall, scan recipient',
    error: message,
    note: 'No DAO transaction was submitted. The failure occurred before signing or submission.',
    sources: ['https://github.com/near-daos/sputnik-dao-contract#setup'],
  };
  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(new URL(`demo-dao-${timestamp}.json`, RESULTS_DIR), JSON.stringify(result, null, 2));
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
});
