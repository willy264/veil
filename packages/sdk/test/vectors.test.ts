import { readFileSync } from 'node:fs';
import { ed25519 } from '@noble/curves/ed25519';
import { describe, expect, it } from 'vitest';
import { bytesToHex, deriveStealth, scalarToBytes, scanAnnouncement, signWithScalar } from '../src/crypto.js';
import { deriveKeysFromNep413, nep413Request } from '../src/sdk.js';

// The published vectors in docs/NEP-DRAFT-stealth-meta-address.md must stay reproducible from the SDK.
const v = JSON.parse(readFileSync(new URL('../../../verification/scheme1-vectors.json', import.meta.url), 'utf8'));
const bytes = (hex: string) => Uint8Array.from(hex.match(/.{2}/g)!, (part) => Number.parseInt(part, 16));
const scalar = (hex: string) => bytes(hex).reduceRight((value, byte) => (value << 8n) | BigInt(byte), 0n);
const le = (value: bigint) => bytesToHex(scalarToBytes(value));

describe('scheme 1 vectors', () => {
  it('reproduces the NEP-413 request and the derived keys', () => {
    const request = nep413Request(v.accountId);
    expect({ message: request.message, recipient: request.recipient, nonce: bytesToHex(request.nonce) }).toEqual(v.nep413);
    const keys = deriveKeysFromNep413(bytes(v.walletSignature), v.accountId);
    expect(le(keys.spend)).toBe(v.keys.spendScalar);
    expect(le(keys.view)).toBe(v.keys.viewScalar);
    expect(bytesToHex(keys.spendPublicKey)).toBe(v.keys.spendPublicKey);
    expect(bytesToHex(keys.viewPublicKey)).toBe(v.keys.viewPublicKey);
  });

  it('reproduces the send, the scan at a later stored index and the spend signature', () => {
    const sent = deriveStealth(bytes(v.keys.spendPublicKey), bytes(v.keys.viewPublicKey), scalar(v.send.ephemeralScalar), v.send.derivationIndex);
    expect(bytesToHex(sent.ephemeralPublicKey)).toBe(v.send.ephemeralPublicKey);
    expect(bytesToHex(ed25519.Point.fromHex(v.keys.viewPublicKey).multiply(scalar(v.send.ephemeralScalar)).toBytes())).toBe(v.send.sharedPoint);
    expect(le(sent.privateScalar)).toBe(v.send.hashScalar);
    expect(sent.stealthAccount).toBe(v.send.stealthAccount);
    expect(sent.viewTag).toBe(v.send.viewTag);
    const keys = deriveKeysFromNep413(bytes(v.walletSignature), v.accountId);
    const found = scanAnnouncement(keys, { ...sent, outputIndex: v.scan.storedIndex });
    expect(found.owned).toBe(true);
    if (!found.owned) return;
    expect(le(found.privateScalar)).toBe(v.scan.privateScalar);
    const message = new TextEncoder().encode(v.spend.message);
    expect(bytesToHex(signWithScalar(found.privateScalar, message, bytes(v.spend.random)))).toBe(v.spend.signature);
    expect(ed25519.verify(bytes(v.spend.signature), message, bytes(v.send.stealthAccount))).toBe(true);
  });
});
