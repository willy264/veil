import { readFileSync } from 'node:fs';
import { ed25519 } from '@noble/curves/ed25519';
import { describe, expect, it } from 'vitest';
import {
  bytesToHex,
  deriveStealth,
  generateKeys,
  publicKeyFromScalar,
  scanAnnouncement,
  signWithScalar,
  ORDER,
} from '../src/crypto.js';

type Vector = {
  spend: string;
  view: string;
  ephemeral: string;
  spendPublicKey: string;
  viewPublicKey: string;
  stealthAccount: string;
  ephemeralPublicKey: string;
  viewTag: number;
  privateScalar: string;
  hashScalar: string;
  message: string;
  signature: string;
};

const vector = JSON.parse(
  readFileSync(new URL('../../../verification/v3-v5-vectors.json', import.meta.url), 'utf8'),
) as Vector;
const bytes = (hex: string) => Uint8Array.from(hex.match(/.{2}/g)!, (part) => Number.parseInt(part, 16));

describe('V3/V5 vectors and malformed inputs', () => {
  it('V3: recovers the committed spend scalar and rejects view-only signing', () => {
    const keys = generateKeys(BigInt(`0x${vector.spend}`), BigInt(`0x${vector.view}`));
    const announcement = {
      stealthAccount: vector.stealthAccount,
      ephemeralPublicKey: bytes(vector.ephemeralPublicKey),
      viewTag: vector.viewTag,
    };
    const found = scanAnnouncement(keys, announcement);
    expect(found).toMatchObject({ owned: true });
    if (!found.owned) return;
    expect(found.privateScalar.toString(16)).toBe(vector.privateScalar);
    const message = new TextEncoder().encode(vector.message);
    const viewOnlySignature = signWithScalar(keys.view, message, new Uint8Array(32).fill(7));
    expect(ed25519.verify(viewOnlySignature, message, bytes(vector.stealthAccount))).toBe(false);
  });

  it('V5: reproduces the committed scalar signature and standard verification', () => {
    const signature = signWithScalar(BigInt(`0x${vector.privateScalar}`), new TextEncoder().encode(vector.message), new Uint8Array(32).fill(7));
    expect(bytesToHex(signature)).toBe(vector.signature);
    const spendScalar = BigInt(`0x${vector.privateScalar}`) % ORDER;
    expect(ed25519.verify(signature, new TextEncoder().encode(vector.message), publicKeyFromScalar(spendScalar))).toBe(true);
  });

  it('rejects zero scalars and malformed points', () => {
    expect(() => generateKeys(0n, 1n)).toThrow(/scalar/);
    expect(() => generateKeys(1n, ORDER)).toThrow(/scalar/);
    const keys = generateKeys(1n, 2n);
    expect(() => deriveStealth(new Uint8Array(31), keys.viewPublicKey, 3n)).toThrow();
    expect(() => scanAnnouncement(keys, {
      stealthAccount: 'not-an-account',
      ephemeralPublicKey: new Uint8Array(31),
      viewTag: 0,
    })).toThrow();
  });

  it('rejects a valid announcement owned by another recipient', () => {
    const recipient = generateKeys(5n, 7n);
    const other = generateKeys(11n, 13n);
    const announcement = deriveStealth(other.spendPublicKey, other.viewPublicKey, 17n);
    expect(scanAnnouncement(recipient, announcement)).toEqual({ owned: false });
  });
});
