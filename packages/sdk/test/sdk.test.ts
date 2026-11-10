import { describe, expect, it } from 'vitest';
import { bytesToHex, deriveStealth, generateKeys } from '../src/crypto.js';
import {
  deriveKeysFromNep413,
  exportViewKey,
  nep413Message,
  relinkWarning,
  VeilClient,
  type VeilAnnouncement,
} from '../src/sdk.js';

const signature = new Uint8Array(64).map((_, index) => index + 1);
const keys = deriveKeysFromNep413(signature, 'alice.near');

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
    expect(client.buildSendNear('alice.near', 5n, 17n)).toMatchObject({ methodName: 'send_near', deposit: 5n });
    const ft = client.buildSendFt('alice.near', 'usdc.testnet', 12n, 19n);
    expect(ft.map((action) => action.methodName)).toEqual(['storage_deposit', 'ft_transfer', 'announce']);
    expect(ft[1]?.args.amount).toBe('12');
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
