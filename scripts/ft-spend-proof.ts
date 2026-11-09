import {
  JsonRpcProvider,
  PublicKey,
  Signer,
  actions,
  baseDecode,
  baseEncode,
  createTransaction,
} from 'near-api-js';
import { deriveStealth, generateKeys, scanAnnouncement, signWithScalar } from '../packages/sdk/src/crypto.js';
import { mkdir, writeFile } from 'node:fs/promises';

const rpcUrl = 'https://rpc.testnet.fastnear.com';
const stealthAccount = 'c33b272aab306099fd707466554ff15d6d8d854bb09ce0cf1916f9b9b1477b7f';
const tokenAccount = 'mockft.veil-williams.testnet';
const senderAccount = 'sender1.veil-williams.testnet';
const spend = 0x123456789abcdef123456789abcdefn;
const view = 0x23456789abcdef123456789abcdefn;
const ephemeral = 0x3456789abcdef123456789abcdefn;

class ScalarSigner extends Signer {
  constructor(private readonly scalar: bigint, private readonly publicKeyBytes: Uint8Array) {
    super();
  }
  async getPublicKey(): Promise<PublicKey> {
    return PublicKey.fromString(`ed25519:${baseEncode(this.publicKeyBytes)}`);
  }
  protected async signBytes(bytes: Uint8Array): Promise<Uint8Array> {
    return signWithScalar(this.scalar, bytes, new Uint8Array(32).fill(0x56));
  }
}

async function main() {
  const provider = new JsonRpcProvider({ url: rpcUrl });
  const keys = generateKeys(spend, view);
  const derived = deriveStealth(keys.spendPublicKey, keys.viewPublicKey, ephemeral);
  if (derived.stealthAccount !== stealthAccount) throw new Error('derived account does not match Gate R account');
  const found = scanAnnouncement(keys, derived);
  if (!found.owned) throw new Error('stealth account was not recovered locally');
  const signer = new ScalarSigner(found.privateScalar, hexToBytes(stealthAccount));
  const publicKey = await signer.getPublicKey();
  const accessKey = await provider.viewAccessKey({
    accountId: stealthAccount,
    publicKey: publicKey.toString(),
    finalityQuery: { finality: 'final' },
  });
  const block = await provider.viewBlock({ finality: 'final' });
  const args = new TextEncoder().encode(JSON.stringify({
    receiver_id: senderAccount,
    amount: '1',
    memo: 'veil-ft-spend-proof',
  }));
  const tx = createTransaction(
    stealthAccount,
    publicKey,
    tokenAccount,
    accessKey.nonce + 1n,
    [actions.functionCall('ft_transfer', args, 30_000_000_000_000n, 1n)],
    baseDecode(block.header.hash),
  );
  const { signedTransaction } = await signer.signTransaction(tx);
  const response = await provider.sendTransaction(signedTransaction);
  const result = {
    status: 'PASS',
    transactionHash: response.transaction?.hash,
    explorerUrl: `https://explorer.testnet.near.org/transactions/${response.transaction?.hash}`,
    signer: stealthAccount,
    token: tokenAccount,
    recipient: senderAccount,
    amountAtomic: '1',
    accessKeyNonce: (accessKey.nonce + 1n).toString(),
    finalExecutionStatus: response.final_execution_status,
    gasBurnt: response.transaction_outcome?.outcome?.gas_burnt,
    tokensBurntYocto: response.transaction_outcome?.outcome?.tokens_burnt,
    note: 'This is the observed cost of one FT transfer. A true minimum stipend still requires a fresh-account threshold sweep.',
  };
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  await mkdir(new URL('../results/', import.meta.url), { recursive: true });
  await writeFile(new URL(`ft-spend-${timestamp}.json`, new URL('../results/', import.meta.url)), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
