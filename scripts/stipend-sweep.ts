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
import { deriveStealth, generateKeys, scanAnnouncement, signWithScalar } from '../packages/sdk/src/crypto.js';
import { mkdir, writeFile } from 'node:fs/promises';

const RPC_URL = 'https://rpc.testnet.fastnear.com';
const SENDER_ID = 'sender1.veil-williams.testnet';
const TOKEN_ID = 'mockft.veil-williams.testnet';
const RESULTS_DIR = new URL('../results/', import.meta.url);
const FT_STORAGE = 1_250_000_000_000_000_000_000n;
const FT_GAS = 30_000_000_000_000n;
const STIPENDS = ['0.03090', '0.03091', '0.03092', '0.03093', '0.03095', '0.03100'];
const nextNonces = new Map<string, bigint>();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required and must not be committed`);
  return value;
}

function explorerUrl(hash: string): string {
  return `https://testnet.nearblocks.io/txns/${hash}`;
}

function responseHash(response: any): string | undefined {
  return response.transaction?.hash ?? response.transaction_outcome?.id;
}

function isSuccess(response: any): boolean {
  return Boolean(response.status && ('SuccessValue' in response.status || 'SuccessReceiptId' in response.status));
}

async function viewAccountAfterFinality(provider: JsonRpcProvider, accountId: string): Promise<any> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await provider.viewAccount({ accountId, finalityQuery: { finality: 'final' } });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
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

async function execute(
  provider: JsonRpcProvider,
  signerId: string,
  receiverId: string,
  signer: Signer,
  methodName: string,
  args: Record<string, unknown>,
  deposit: bigint,
  gas = 30_000_000_000_000n,
): Promise<Record<string, unknown>> {
  const publicKey = await signer.getPublicKey();
  const nonceKey = `${signerId}:${publicKey.toString()}`;
  const nonce = nextNonces.has(nonceKey)
    ? nextNonces.get(nonceKey)! + 1n
    : (await provider.viewAccessKey({
        accountId: signerId,
        publicKey: publicKey.toString(),
        finalityQuery: { finality: 'final' },
      })).nonce + 1n;
  nextNonces.set(nonceKey, nonce);
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
  try {
    const response = await provider.sendTransaction(signedTransaction);
    const hash = responseHash(response);
    return {
      ok: isSuccess(response),
      hash,
      explorerUrl: hash ? explorerUrl(hash) : undefined,
      signerId,
      receiverId,
      methodName,
      rawResponse: response,
    };
  } catch (error) {
    return {
      ok: false,
      signerId,
      receiverId,
      methodName,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    };
  }
}

async function transfer(
  provider: JsonRpcProvider,
  signerId: string,
  receiverId: string,
  signer: Signer,
  amountNear: string,
): Promise<Record<string, unknown>> {
  const publicKey = await signer.getPublicKey();
  const nonceKey = `${signerId}:${publicKey.toString()}`;
  const nonce = nextNonces.has(nonceKey)
    ? nextNonces.get(nonceKey)! + 1n
    : (await provider.viewAccessKey({
        accountId: signerId,
        publicKey: publicKey.toString(),
        finalityQuery: { finality: 'final' },
      })).nonce + 1n;
  nextNonces.set(nonceKey, nonce);
  const block = await provider.viewBlock({ finality: 'final' });
  const transaction = createTransaction(
    signerId,
    publicKey,
    receiverId,
    nonce,
    [actions.transfer(BigInt(nearToYocto(amountNear)))],
    baseDecode(block.header.hash),
  );
  try {
    const { signedTransaction } = await signer.signTransaction(transaction);
    const response = await provider.sendTransaction(signedTransaction);
    const hash = responseHash(response);
    return {
      ok: isSuccess(response),
      hash,
      explorerUrl: hash ? explorerUrl(hash) : undefined,
      signerId,
      receiverId,
      amountNear,
      rawResponse: response,
    };
  } catch (error) {
    return {
      ok: false,
      signerId,
      receiverId,
      amountNear,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const provider = new JsonRpcProvider({ url: RPC_URL });
  const senderSigner = new KeyPairSigner(KeyPair.fromString(requireEnv('VEIL_SENDER1_PRIVATE_KEY')));
  const recipientKeys = generateKeys(0x123456789abcdef123456789abcdefn, 0x23456789abcdef123456789abcdefn);
  const sweepSalt = BigInt(process.env.VEIL_SWEEP_SALT ?? Date.now());
  const rows: Record<string, unknown>[] = [];

  for (let index = 0; index < STIPENDS.length; index += 1) {
    const ephemeral = 0x3456789abcdef123456789abcdefn + sweepSalt + BigInt(index);
    const derived = deriveStealth(recipientKeys.spendPublicKey, recipientKeys.viewPublicKey, ephemeral);
    const found = scanAnnouncement(recipientKeys, derived);
    if (!found.owned) throw new Error('local derivation failed');
    const stealthSigner = new ScalarSigner(found.privateScalar, hexToBytes(derived.stealthAccount));
    const funding = await transfer(provider, SENDER_ID, derived.stealthAccount, senderSigner, STIPENDS[index]!);
    if (!funding.ok) {
      rows.push({
        index,
        stipendNear: STIPENDS[index],
        stealthAccount: derived.stealthAccount,
        funding,
        minimumCandidate: false,
        note: 'Funding failed, so the implicit account had no spendable access key for the FT transfer.',
      });
      continue;
    }
    const account = await viewAccountAfterFinality(provider, derived.stealthAccount);
    const storageUsage = BigInt(account.storage_usage);
    const accountStorageCostYocto = storageUsage * 10_000_000_000_000_000_000n;
    const storage = await execute(
      provider,
      SENDER_ID,
      TOKEN_ID,
      senderSigner,
      'storage_deposit',
      { account_id: derived.stealthAccount, registration_only: true },
      FT_STORAGE,
    );
    const ftTransfer = await execute(
      provider,
      SENDER_ID,
      TOKEN_ID,
      senderSigner,
      'ft_transfer',
      { receiver_id: derived.stealthAccount, amount: '1', memo: `stipend-${index}` },
      1n,
    );
    const spendBack = await execute(
      provider,
      derived.stealthAccount,
      TOKEN_ID,
      stealthSigner,
      'ft_transfer',
      { receiver_id: SENDER_ID, amount: '1', memo: `stipend-sweep-${index}` },
      1n,
      FT_GAS,
    );
    rows.push({
      index,
      stipendNear: STIPENDS[index],
      stealthAccount: derived.stealthAccount,
      funding,
      storage,
      ftTransfer,
      spendBack,
      storageUsageBytes: storageUsage.toString(),
      accountStorageCostYocto: accountStorageCostYocto.toString(),
      spendGasBurnt: spendBack.rawResponse?.transaction_outcome?.outcome?.gas_burnt,
      spendTokensBurntYocto: spendBack.rawResponse?.transaction_outcome?.outcome?.tokens_burnt,
      minimumCandidate: Boolean(spendBack.ok),
    });
  }

  const successful = rows.filter((row) => row.minimumCandidate).map((row) => row.stipendNear as string);
  const result = {
    status: successful.length > 0 ? 'PASS' : 'FAIL',
    network: 'testnet',
    rpcUrl: RPC_URL,
    token: TOKEN_ID,
    sender: SENDER_ID,
    storageDepositYocto: FT_STORAGE.toString(),
    testedStipendsNear: STIPENDS,
    sweepSalt: sweepSalt.toString(),
    minimumSuccessfulTestedStipendNear: successful[0] ?? null,
    note: 'This is an empirical threshold sweep over fresh implicit accounts; the true minimum may lie between tested values.',
    rows,
  };
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  await mkdir(RESULTS_DIR, { recursive: true });
  const output = JSON.stringify(result, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
  await writeFile(new URL(`stipend-sweep-${timestamp}.json`, RESULTS_DIR), output);
  console.log(output);
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
