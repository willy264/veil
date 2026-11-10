import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';

const textEncoder = new TextEncoder();
const ORDER = ed25519.CURVE.n;

export type StealthKeys = {
  spend: bigint;
  view: bigint;
  spendPublicKey: Uint8Array;
  viewPublicKey: Uint8Array;
};

export type Announcement = {
  stealthAccount: string;
  ephemeralPublicKey: Uint8Array;
  viewTag: number;
  outputIndex?: number;
};

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function utf8(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function scalarFromBytes(bytes: Uint8Array): bigint {
  let result = 0n;
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    result = (result << 8n) | BigInt(bytes[index]!);
  }
  return result;
}

export function scalarToBytes(value: bigint): Uint8Array {
  const result = new Uint8Array(32);
  let remaining = value;
  for (let index = 0; index < 32; index += 1) {
    result[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return result;
}

function hashToScalar(...parts: Uint8Array[]): bigint {
  return scalarFromBytes(sha256(concat(...parts))) % ORDER;
}

function hashToNonce(...parts: Uint8Array[]): bigint {
  return scalarFromBytes(sha512(concat(...parts))) % ORDER;
}

function pointFromScalar(scalar: bigint): typeof ed25519.Point.BASE {
  return ed25519.Point.BASE.multiply(scalar);
}

export function publicKeyFromScalar(scalar: bigint): Uint8Array {
  return pointFromScalar(scalar).toBytes();
}

export function generateKeys(spend: bigint, view: bigint): StealthKeys {
  if (spend <= 0n || spend >= ORDER || view <= 0n || view >= ORDER) {
    throw new Error('key scalar must be in the ed25519 prime-order range');
  }
  return {
    spend,
    view,
    spendPublicKey: publicKeyFromScalar(spend),
    viewPublicKey: publicKeyFromScalar(view),
  };
}

export function deriveStealth(
  spendPublicKey: Uint8Array,
  viewPublicKey: Uint8Array,
  ephemeralScalar: bigint,
  outputIndex = 0,
): Announcement & { privateScalar: bigint } {
  const spendPoint = ed25519.Point.fromHex(spendPublicKey);
  const viewPoint = ed25519.Point.fromHex(viewPublicKey);
  const ephemeralPoint = pointFromScalar(ephemeralScalar);
  const sharedPoint = viewPoint.multiply(ephemeralScalar);
  const sharedBytes = sharedPoint.toBytes();
  const indexBytes = new Uint8Array(4);
  new DataView(indexBytes.buffer).setUint32(0, outputIndex, false);
  const h = hashToScalar(utf8('veil-v1'), sharedBytes, indexBytes);
  const stealthPoint = spendPoint.add(pointFromScalar(h));
  const viewTag = sha256(concat(utf8('veil-tag'), sharedBytes))[0]!;
  return {
    stealthAccount: bytesToHex(stealthPoint.toBytes()),
    ephemeralPublicKey: ephemeralPoint.toBytes(),
    viewTag,
    outputIndex,
    privateScalar: h,
  };
}

export function scanAnnouncement(
  keys: Pick<StealthKeys, 'spend' | 'view' | 'spendPublicKey'>,
  announcement: Announcement,
): { owned: true; privateScalar: bigint } | { owned: false } {
  const ephemeralPoint = ed25519.Point.fromHex(announcement.ephemeralPublicKey);
  const sharedPoint = ephemeralPoint.multiply(keys.view);
  const sharedBytes = sharedPoint.toBytes();
  const expectedTag = sha256(concat(utf8('veil-tag'), sharedBytes))[0]!;
  if (expectedTag !== announcement.viewTag) return { owned: false };

  const indexBytes = new Uint8Array(4);
  new DataView(indexBytes.buffer).setUint32(0, announcement.outputIndex ?? 0, false);
  const h = hashToScalar(utf8('veil-v1'), sharedBytes, indexBytes);
  const expectedAccount = bytesToHex(
    ed25519.Point.fromHex(keys.spendPublicKey).add(pointFromScalar(h)).toBytes(),
  );
  if (expectedAccount !== announcement.stealthAccount.toLowerCase()) return { owned: false };
  return { owned: true, privateScalar: (keys.spend + h) % ORDER };
}

export function signWithScalar(privateScalar: bigint, message: Uint8Array, random = new Uint8Array(32)) {
  if (privateScalar <= 0n || privateScalar >= ORDER) throw new Error('invalid signing scalar');
  const publicKey = publicKeyFromScalar(privateScalar);
  const nonce = hashToNonce(utf8('veil-ed25519-nonce-v1'), scalarToBytes(privateScalar), message, random);
  const r = pointFromScalar(nonce).toBytes();
  const challenge = hashToNonce(r, publicKey, message);
  const s = (nonce + challenge * privateScalar) % ORDER;
  return concat(r, scalarToBytes(s));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export { ORDER };
