import { describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import {
  deriveStealth,
  generateKeys,
  scanAnnouncement,
  signWithScalar,
  ORDER,
} from '../src/crypto.js';

const spend = 0x123456789abcdef123456789abcdefn;
const view = 0x23456789abcdef123456789abcdefn;
const ephemeral = 0x3456789abcdef123456789abcdefn;

describe('Veil ed25519 stealth prototype', () => {
  it('finds an owned announcement and recovers the spend scalar', () => {
    const keys = generateKeys(spend, view);
    const derived = deriveStealth(keys.spendPublicKey, keys.viewPublicKey, ephemeral);
    const found = scanAnnouncement(keys, derived);
    expect(found.owned).toBe(true);
    if (found.owned) expect(found.privateScalar).toBe((spend + derived.privateScalar) % ORDER);
  });

  it('rejects an unrelated announcement after the view-tag fast path', () => {
    const recipient = generateKeys(spend, view);
    const other = generateKeys(spend + 1n, view + 1n);
    const derived = deriveStealth(other.spendPublicKey, other.viewPublicKey, ephemeral);
    expect(scanAnnouncement(recipient, derived)).toEqual({ owned: false });
  });

  it('produces a signature accepted by standard ed25519 verification', () => {
    const message = new TextEncoder().encode('veil scalar signer test');
    const signature = signWithScalar(spend, message, new Uint8Array(32).fill(7));
    expect(ed25519.verify(signature, message, generateKeys(spend, view).spendPublicKey)).toBe(true);
  });

  it('V2: announcements contain no recipient name or meta-address', () => {
    const recipient = generateKeys(spend, view);
    const first = deriveStealth(recipient.spendPublicKey, recipient.viewPublicKey, ephemeral, 0);
    const second = deriveStealth(recipient.spendPublicKey, recipient.viewPublicKey, ephemeral + 1n, 0);
    expect(first.stealthAccount).not.toBe(second.stealthAccount);
    const publicFields = [first.stealthAccount, first.ephemeralPublicKey, first.viewTag.toString()];
    const privateMeta = [recipient.spendPublicKey, recipient.viewPublicKey].map((key) =>
      Array.from(key, (byte) => byte.toString(16).padStart(2, '0')).join(''),
    );
    for (const field of publicFields) {
      for (const secret of privateMeta) expect(String(field)).not.toContain(secret);
    }
  });

  it('V3: view-only material cannot produce the derived spend signature', () => {
    const recipient = generateKeys(spend, view);
    const derived = deriveStealth(recipient.spendPublicKey, recipient.viewPublicKey, ephemeral);
    const message = new TextEncoder().encode('spend authority');
    const viewOnlySignature = signWithScalar(derived.privateScalar, message, new Uint8Array(32).fill(3));
    expect(ed25519.verify(viewOnlySignature, message, recipient.spendPublicKey)).toBe(false);
  });
});
