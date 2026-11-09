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

const NETWORK = 'testnet';
const RPC_URL = 'https://rpc.testnet.fastnear.com';
const SENDER_ID = 'sender1.veil-williams.testnet';
const RESULTS_DIR = new URL('../results/', import.meta.url);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required and must not be committed`);
  return value;
}

function explorerUrl(hash: string): string {
  return `https://explorer.testnet.near.org/transactions/${hash}`;
}

function responseHash(response: any): string {
  return response.transaction?.hash ?? response.transaction_outcome?.id ?? response.transaction?.hash?.toString();
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

type TransactionResult = {
  hash: string;
  explorerUrl: string;
  receiverId: string;
  signerId: string;
  nonce: string;
  rawResponse: unknown;
};

async function sendTransfer(
  provider: JsonRpcProvider,
  signerId: string,
  receiverId: string,
  amountNear: string,
  signer: Signer,
): Promise<TransactionResult> {
  const publicKey = await signer.getPublicKey();
  const accessKey = await provider.viewAccessKey({
    accountId: signerId,
    publicKey: publicKey.toString(),
    finalityQuery: { finality: 'final' },
  });
  const block = await provider.viewBlock({ finality: 'final' });
  const nonce = accessKey.nonce + 1n;
  const transaction = createTransaction(
    signerId,
    publicKey,
    receiverId,
    nonce,
    [actions.transfer(BigInt(nearToYocto(amountNear)))],
    baseDecode(block.header.hash),
  );
  const { signedTransaction } = await signer.signTransaction(transaction);
  const response = await provider.sendTransaction(signedTransaction);
  const hash = responseHash(response);
  if (!hash) throw new Error(`RPC response did not include a transaction hash: ${JSON.stringify(response)}`);
  return {
    hash,
    explorerUrl: explorerUrl(hash),
    receiverId,
    signerId,
    nonce: nonce.toString(),
    rawResponse: response,
  };
}

async function main(): Promise<void> {
  const senderPrivateKey = requireEnv('VEIL_SENDER1_PRIVATE_KEY');
  const provider = new JsonRpcProvider({ url: RPC_URL });
  const senderSigner = new KeyPairSigner(KeyPair.fromString(senderPrivateKey));

  const spendScalar = 0x123456789abcdef123456789abcdefn;
  const viewScalar = 0x23456789abcdef123456789abcdefn;
  const ephemeralScalar = 0x3456789abcdef123456789abcdefn;
  const recipientKeys = generateKeys(spendScalar, viewScalar);
  const derived = deriveStealth(
    recipientKeys.spendPublicKey,
    recipientKeys.viewPublicKey,
    ephemeralScalar,
  );
  const found = scanAnnouncement(recipientKeys, derived);
  if (!found.owned) throw new Error('local stealth derivation failed before any transaction was sent');

  const stealthSigner = new ScalarSigner(found.privateScalar, hexToBytes(derived.stealthAccount));
  const funding = await sendTransfer(provider, SENDER_ID, derived.stealthAccount, '0.05', senderSigner);
  const spend = await sendTransfer(provider, derived.stealthAccount, SENDER_ID, '0.01', stealthSigner);
  const result = {
    status: 'PASS',
    network: NETWORK,
    rpcUrl: RPC_URL,
    recipient: {
      stealthAccount: derived.stealthAccount,
      ephemeralPublicKey: toHex(derived.ephemeralPublicKey),
      viewTag: derived.viewTag,
    },
    funding,
    spend,
    notes: [
      'The spend transaction was built from the stealth account public key and view_access_key nonce.',
      'The spending signature used the raw derived scalar through ScalarSigner.',
      'The account used test-only fixed key material; this is not a user key-generation flow.',
    ],
  };
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const output = JSON.stringify(result, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
  await import('node:fs/promises').then(({ mkdir, writeFile }) =>
    mkdir(RESULTS_DIR, { recursive: true }).then(() => writeFile(new URL(`gate-r-${timestamp}.json`, RESULTS_DIR), output)),
  );
  console.log(output);
  console.log(`Funding explorer: ${funding.explorerUrl}`);
  console.log(`Spend explorer: ${spend.explorerUrl}`);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error(`expected 32-byte hex public key, got ${hex}`);
  return Uint8Array.from(hex.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

main().catch((error) => {
  console.error('GATE_R_ERROR');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
