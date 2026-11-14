import { describe, expect, it } from 'vitest';
import { bytesToHex, deriveStealth, generateKeys, publicKeyFromScalar, scanAnnouncement } from '../src/crypto.js';
import {
  deriveKeysFromNep413,
  exportViewKey,
  nep413Message,
  relinkWarning,
  VeilClient,
  type VeilAnnouncement,
  type VeilMeta,
} from '../src/sdk.js';

const signature = new Uint8Array(64).map((_, index) => index + 1);
const keys = deriveKeysFromNep413(signature, 'alice.near');
const metaOf = (recipient: Pick<typeof keys, 'spendPublicKey' | 'viewPublicKey'>): VeilMeta => ({
  spend_pub_hex: bytesToHex(recipient.spendPublicKey),
  view_pub_hex: bytesToHex(recipient.viewPublicKey),
  scheme_id: 1,
});
const hexToBytes = (hex: string) => Uint8Array.from(hex.match(/.{2}/g)!, (part) => Number.parseInt(part, 16));

function announcementFor(index: number, recipient: Pick<typeof keys, 'spend' | 'view' | 'spendPublicKey' | 'viewPublicKey'> = keys): VeilAnnouncement {
  const derived = deriveStealth(recipient.spendPublicKey, recipient.viewPublicKey, BigInt(index + 100));
  return {
    index,
    block_height: index,
    token: 'near',
    stealthAccount: derived.stealthAccount,
    ephemeralPublicKey: derived.ephemeralPublicKey,
    viewTag: derived.viewTag,
    amount: '100',
  };
}

describe('Veil SDK flows', () => {
  it('derives deterministic NEP-413 keys from the wallet signature and account', () => {
    const again = deriveKeysFromNep413(signature, 'alice.near');
    const other = deriveKeysFromNep413(signature, 'bob.near');
    expect(again.spend).toBe(keys.spend);
    expect(again.view).toBe(keys.view);
    expect(other.spend).not.toBe(keys.spend);
    expect(nep413Message('alice.near')).toContain('Account: alice.near');
  });

  it('rejects malformed NEP-413 signatures', () => {
    expect(() => deriveKeysFromNep413(new Uint8Array(63), 'alice.near')).toThrow(/64 bytes/);
  });

  it('builds register, native send, and FT send actions', () => {
    const client = new VeilClient('alice.near', 'registry.testnet', 'router.testnet', {
      viewFunction: async () => null,
    }, keys);
    expect(client.register()).toMatchObject({ methodName: 'register', deposit: 1_000_000_000_000_000_000_000n });
    expect(client.buildSendNear(metaOf(keys), 5n, 17n, 0)).toMatchObject({ methodName: 'send_near', deposit: 5n });
    const ft = client.buildSendFt(metaOf(keys), 'usdc.testnet', 12n, 19n, 0);
    expect(ft.map((action) => action.methodName)).toEqual(['storage_deposit', 'ft_transfer', 'announce']);
    expect(ft[1]?.args.amount).toBe('12');
  });

  it('derives sends from the recipient registered meta, not from the sender keys', () => {
    const bob = deriveKeysFromNep413(new Uint8Array(64).fill(9), 'bob.testnet');
    const sender = new VeilClient('alice.testnet', 'registry.testnet', 'router.testnet', { viewFunction: async () => null });
    const near = sender.buildSendNear(metaOf(bob), 5n, 17n, 4);
    const sent = {
      stealthAccount: String(near.args.stealth_account),
      ephemeralPublicKey: hexToBytes(String(near.args.ephemeral_pub_hex)),
      viewTag: Number(near.args.view_tag),
      outputIndex: 4,
    };
    expect(scanAnnouncement(bob, sent).owned).toBe(true);
    expect(scanAnnouncement(keys, sent).owned).toBe(false);
    const ft = sender.buildSendFt(metaOf(bob), 'usdc.testnet', 12n, 19n, 5);
    expect(ft[0]?.args.account_id).toBe(ft[2]?.args.stealth_account);
    expect(scanAnnouncement(bob, {
      stealthAccount: String(ft[2]?.args.stealth_account),
      ephemeralPublicKey: hexToBytes(String(ft[2]?.args.ephemeral_pub_hex)),
      viewTag: Number(ft[2]?.args.view_tag),
      outputIndex: 5,
    }).owned).toBe(true);
  });

  it('scans router rows using the router index stored on each announcement', async () => {
    const derived = deriveStealth(keys.spendPublicKey, keys.viewPublicKey, 77n, 6);
    const row = { index: 6, block_height: 1, token: 'router.testnet', stealth_account: derived.stealthAccount, ephemeral_pub_hex: bytesToHex(derived.ephemeralPublicKey), view_tag: derived.viewTag };
    const client = new VeilClient('alice.near', 'registry.testnet', 'router.testnet', { viewFunction: async () => [row] }, keys);
    const payments = await client.scan();
    expect(payments).toHaveLength(1);
    expect(bytesToHex(publicKeyFromScalar(payments[0]!.privateScalar))).toBe(derived.stealthAccount);
  });

  it('rejects identity and small-order registry keys before deriving a send', () => {
    const sender = new VeilClient('alice.testnet', 'registry.testnet', 'router.testnet', { viewFunction: async () => null });
    const identity = `01${'00'.repeat(31)}`;
    const orderTwo = `ec${'ff'.repeat(30)}7f`;
    for (const bad of [identity, orderTwo]) {
      expect(() => sender.buildSendNear({ ...metaOf(keys), view_pub_hex: bad }, 5n, 17n, 0)).toThrow(/point/);
      expect(() => sender.buildSendNear({ ...metaOf(keys), spend_pub_hex: bad }, 5n, 17n, 0)).toThrow(/point/);
    }
  });

  it('resolves registry metadata and scans owned announcements only', async () => {
    const owned = announcementFor(1);
    const otherKeys = generateKeys(17n, 19n);
    const unrelated = announcementFor(2, otherKeys);
    const client = new VeilClient('alice.near', 'registry.testnet', 'router.testnet', {
      viewFunction: async (_contract, method) => method === 'get_meta'
        ? { spend_pub_hex: bytesToHex(keys.spendPublicKey), view_pub_hex: bytesToHex(keys.viewPublicKey), scheme_id: 1 }
        : [owned, unrelated],
    }, keys);
    await expect(client.resolve('alice.near')).resolves.toMatchObject({ scheme_id: 1 });
    const payments = await client.scan();
    expect(payments).toHaveLength(1);
    expect(payments[0]?.announcement.index).toBe(1);
  });

  it('exports a view-only key, builds a spend with the derived scalar, and warns on re-linking', async () => {
    const first = announcementFor(3);
    const second = announcementFor(4);
    const client = new VeilClient('alice.near', 'registry.testnet', 'router.testnet', {
      viewFunction: async () => [first, second],
    }, keys);
    const payments = await client.scan();
    expect(exportViewKey(keys)).toMatch(/^[0-9a-f]{64}$/);
    expect(client.viewKeyForAuditor()).toBe(exportViewKey(keys));
    expect(client.buildSpend(payments[0]!, { methodName: 'transfer', args: {}, gas: 1n, deposit: 0n }).signerScalar).toBe(payments[0]!.privateScalar);
    expect(relinkWarning('alice.near', payments)).toContain('link them');
  });
});
