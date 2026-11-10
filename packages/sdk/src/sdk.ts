import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import {
  bytesToHex,
  deriveStealth,
  generateKeys,
  scanAnnouncement,
  scalarToBytes,
  type Announcement,
  type StealthKeys,
  ORDER,
} from './crypto.js';

const NEP_413_DOMAIN = 'near-veiled-keys-v1';
const NEP_413_MESSAGE = 'Veil key derivation v1: derive private receiving keys for this NEAR account.';
const MIN_REGISTRY_DEPOSIT = 1_000_000_000_000_000_000_000n;
const DEFAULT_GAS = 30_000_000_000_000n;

export type VeilMeta = {
  spend_pub_hex: string;
  view_pub_hex: string;
  scheme_id: 1;
};

export type VeilAnnouncement = Announcement & {
  index: number;
  block_height: number;
  token: string;
  amount?: string;
  stealth_account?: string;
  ephemeral_pub_hex?: string;
  view_tag?: number;
};

export type CallAction = {
  contractId: string;
  methodName: string;
  args: Record<string, unknown>;
  gas: bigint;
  deposit: bigint;
};

export type TransferAction = {
  receiverId: string;
  amount: bigint;
};

export type VeilView = {
  viewFunction(contractId: string, methodName: string, args: Record<string, unknown>): Promise<unknown>;
};

export type VeilKeys = StealthKeys & { nep413Message: string };

export type OwnedPayment = {
  announcement: VeilAnnouncement;
  privateScalar: bigint;
};

function normalizeSignature(signature: Uint8Array | string): Uint8Array {
  const bytes = typeof signature === 'string'
    ? Uint8Array.from(signature.match(/.{2}/g) ?? [], (part) => Number.parseInt(part, 16))
    : signature;
  if (bytes.length !== 64) throw new Error('NEP-413 signature must be 64 bytes');
  return bytes;
}

function scalarFromBytes(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let index = bytes.length - 1; index >= 0; index -= 1) value = (value << 8n) | BigInt(bytes[index]!);
  return value;
}

function scalarFromKeyMaterial(bytes: Uint8Array): bigint {
  const scalar = scalarFromBytes(bytes) % ORDER;
  return scalar === 0n ? 1n : scalar;
}

export function nep413Message(accountId: string): string {
  return `${NEP_413_MESSAGE}\nAccount: ${accountId}`;
}

export function deriveKeysFromNep413(signature: Uint8Array | string, accountId: string): VeilKeys {
  const signatureBytes = normalizeSignature(signature);
  const context = new TextEncoder().encode(`${NEP_413_DOMAIN}\n${accountId}`);
  const material = hkdf(sha256, signatureBytes, context, new TextEncoder().encode('spend-and-view'), 64);
  const spend = scalarFromKeyMaterial(material.slice(0, 32));
  const view = scalarFromKeyMaterial(material.slice(32));
  return { ...generateKeys(spend, view), nep413Message: nep413Message(accountId) };
}

export function exportViewKey(keys: Pick<VeilKeys, 'view'>): string {
  return bytesToHex(scalarToBytes(keys.view));
}

export function relinkWarning(destination: string, payments: readonly OwnedPayment[]): string | null {
  if (payments.length < 2) return null;
  const accounts = new Set(payments.map(({ announcement }) => announcement.stealthAccount));
  if (accounts.size < 2) return null;
  return `Sending ${payments.length} stealth balances to ${destination} will link them on-chain.`;
}

export function buildRegistryRegister(registryId: string, keys: Pick<VeilKeys, 'spendPublicKey' | 'viewPublicKey'>): CallAction {
  return {
    contractId: registryId,
    methodName: 'register',
    args: {
      spend_pub_hex: bytesToHex(keys.spendPublicKey),
      view_pub_hex: bytesToHex(keys.viewPublicKey),
      scheme_id: 1,
    },
    gas: DEFAULT_GAS,
    deposit: MIN_REGISTRY_DEPOSIT,
  };
}

export class VeilClient {
  constructor(
    private readonly accountId: string,
    private readonly registryId: string,
    private readonly routerId: string,
    private readonly view: VeilView,
    private readonly keys: VeilKeys,
  ) {}

  register(): CallAction {
    return buildRegistryRegister(this.registryId, this.keys);
  }

  async resolve(name: string): Promise<VeilMeta | null> {
    return await this.view.viewFunction(this.registryId, 'get_meta', { account_id: name }) as VeilMeta | null;
  }

  buildSendNear(to: string, amount: bigint, ephemeralScalar: bigint): CallAction {
    void to;
    const derived = deriveStealth(this.keys.spendPublicKey, this.keys.viewPublicKey, ephemeralScalar);
    return {
      contractId: this.routerId,
      methodName: 'send_near',
      args: {
        stealth_account: derived.stealthAccount,
        ephemeral_pub_hex: bytesToHex(derived.ephemeralPublicKey),
        view_tag: derived.viewTag,
      },
      gas: DEFAULT_GAS,
      deposit: amount,
    };
  }

  buildSendFt(to: string, tokenId: string, amount: bigint, ephemeralScalar: bigint): CallAction[] {
    void to;
    const derived = deriveStealth(this.keys.spendPublicKey, this.keys.viewPublicKey, ephemeralScalar);
    return [
      {
        contractId: tokenId,
        methodName: 'storage_deposit',
        args: { account_id: derived.stealthAccount, registration_only: true },
        gas: DEFAULT_GAS,
        deposit: 1_250_000_000_000_000_000_000n,
      },
      {
        contractId: tokenId,
        methodName: 'ft_transfer',
        args: { receiver_id: derived.stealthAccount, amount: amount.toString(), memo: 'veil-private-send' },
        gas: DEFAULT_GAS,
        deposit: 1n,
      },
      {
        contractId: this.routerId,
        methodName: 'announce',
        args: {
          token: tokenId,
          stealth_account: derived.stealthAccount,
          ephemeral_pub_hex: bytesToHex(derived.ephemeralPublicKey),
          view_tag: derived.viewTag,
          amount: amount.toString(),
        },
        gas: DEFAULT_GAS,
        deposit: 1n,
      },
    ];
  }

  async scan(fromIndex = 0, limit = 100): Promise<OwnedPayment[]> {
    const raw = await this.view.viewFunction(this.routerId, 'get_announcements', { from_index: fromIndex, limit });
    const announcements = raw as VeilAnnouncement[];
    return announcements.flatMap((rawAnnouncement) => {
      const announcement: VeilAnnouncement = {
        ...rawAnnouncement,
        stealthAccount: rawAnnouncement.stealthAccount ?? rawAnnouncement.stealth_account ?? '',
        ephemeralPublicKey: rawAnnouncement.ephemeralPublicKey instanceof Uint8Array
          ? rawAnnouncement.ephemeralPublicKey
          : hexToBytes(rawAnnouncement.ephemeral_pub_hex ?? ''),
        viewTag: rawAnnouncement.viewTag ?? rawAnnouncement.view_tag ?? 0,
      };
      const found = scanAnnouncement(this.keys, announcement);
      return found.owned ? [{ announcement, privateScalar: found.privateScalar }] : [];
    });
  }

  buildSpend(payment: OwnedPayment, action: Omit<CallAction, 'contractId'> & { contractId?: string }): CallAction & { signerScalar: bigint } {
    return {
      ...action,
      contractId: action.contractId ?? payment.announcement.stealthAccount,
      signerScalar: payment.privateScalar,
    };
  }

  viewKeyForAuditor(): string {
    return exportViewKey(this.keys);
  }

  get ownerId(): string {
    return this.accountId;
  }
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('announcement ephemeral key must be 32-byte hex');
  return Uint8Array.from(hex.match(/.{2}/g)!, (part) => Number.parseInt(part, 16));
}

export { NEP_413_MESSAGE };
