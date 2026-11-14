// Writes verification/scheme1-vectors.json: end-to-end test vectors for Veil scheme 1
// (key request -> keys -> send -> scan -> spend signature). Run in packages/sdk: pnpm exec tsx scripts/vectors.ts
// The signature input is a fixed test value, not a real wallet signature.
import { writeFile } from 'node:fs/promises';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, deriveStealth, scalarToBytes, scanAnnouncement, signWithScalar } from '../src/crypto.js';
import { deriveKeysFromNep413, nep413Request } from '../src/sdk.js';

const accountId = 'alice.testnet';
const request = nep413Request(accountId);
const walletSignature = Uint8Array.from({ length: 64 }, (_, i) => (i * 3 + 1) & 255);
const keys = deriveKeysFromNep413(walletSignature, accountId);
const ephemeral = 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefn;
const derivationIndex = 7;
const storedIndex = 9;
const sent = deriveStealth(keys.spendPublicKey, keys.viewPublicKey, ephemeral, derivationIndex);
const sharedPoint = ed25519.Point.fromHex(keys.viewPublicKey).multiply(ephemeral).toBytes();
const found = scanAnnouncement(keys, { ...sent, outputIndex: storedIndex });
if (!found.owned) throw new Error('vector payment not found');
const message = new TextEncoder().encode('veil-scheme1-vector');
const signature = signWithScalar(found.privateScalar, message);
if (!ed25519.verify(signature, message, sent.stealthAccount)) throw new Error('vector signature does not verify');
const le = (value: bigint) => bytesToHex(scalarToBytes(value));

const vectors = {
  description: 'Veil scheme 1 end-to-end vectors. Scalars are 32-byte little-endian hex; points are RFC 8032 compressed Edwards hex.',
  accountId,
  nep413: { message: request.message, recipient: request.recipient, nonce: bytesToHex(request.nonce) },
  walletSignature: bytesToHex(walletSignature),
  keys: {
    hkdfSalt: `veil-nep413-v1\n${accountId}`,
    hkdfInfo: 'spend-and-view',
    spendScalar: le(keys.spend),
    viewScalar: le(keys.view),
    spendPublicKey: bytesToHex(keys.spendPublicKey),
    viewPublicKey: bytesToHex(keys.viewPublicKey),
  },
  send: {
    ephemeralScalar: le(ephemeral),
    derivationIndex,
    ephemeralPublicKey: bytesToHex(sent.ephemeralPublicKey),
    sharedPoint: bytesToHex(sharedPoint),
    hashScalar: le(sent.privateScalar),
    stealthAccount: sent.stealthAccount,
    viewTag: sent.viewTag,
  },
  scan: { storedIndex, privateScalar: le(found.privateScalar) },
  spend: { message: 'veil-scheme1-vector', random: '00'.repeat(32), signature: bytesToHex(signature) },
};
await writeFile(new URL('../../../verification/scheme1-vectors.json', import.meta.url), `${JSON.stringify(vectors, null, 2)}\n`);
console.log(JSON.stringify(vectors, null, 2));
