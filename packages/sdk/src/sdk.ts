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

// HKDF salt prefix. It must match apps/web/app.js so a wallet signature opens the same inbox in both.
const NEP_413_DOMAIN = 'veil-nep413-v1';
const NEP_413_MESSAGE = 'Veil key derivation v2: derive private receiving keys for this NEAR account.';
const NEP_413_EARLIER_MESSAGE = 'Veil key derivation v1: derive private receiving keys for this NEAR account.';
// NEP-413 recipient for the current key message: the Veil app, not the signer's own account, so a
// wallet shows which app the key-deriving signature is for.
export const NEP_413_RECIPIENT = 'veil-eta-khaki.vercel.app';
const MIN_REGISTRY_DEPOSIT = 1_000_000_000_000_000_000_000n;
const DEFAULT_GAS = 30_000_000_000_000n;

export const DEFAULT_REGISTRY_ID = 'registry2.veil-williams.testnet';
export const DEFAULT_ROUTER_ID = 'router2.veil-williams.testnet';

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

export type Nep413Request = { message: string; recipient: string; nonce: Uint8Array };

// The exact NEP-413 payload to sign. 'earlier' is the v1 request used before 14 Nov 2026: it set
// the recipient to the signer's own account and opens inboxes registered with that request.
export function nep413Request(accountId: string, version: 'current' | 'earlier' = 'current'): Nep413Request {
  const earlier = version === 'earlier';
  return {
    message: `${earlier ? NEP_413_EARLIER_MESSAGE : NEP_413_MESSAGE}\nAccount: ${accountId}`,
    recipient: earlier ? accountId : NEP_413_RECIPIENT,
    nonce: sha256(new TextEncoder().encode(`veil-key-derivation:testnet:${earlier ? 'v1' : 'v2'}:${accountId}`)),
  };
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

function deriveForRecipient(recipient: VeilMeta, ephemeralScalar: bigint, outputIndex: number) {
  if (recipient.scheme_id !== 1) throw new Error('unsupported Veil scheme');
  if (!Number.isSafeInteger(outputIndex) || outputIndex < 0 || outputIndex > 0xffffffff) throw new Error('invalid output index');
  return deriveStealth(hexToBytes(recipient.spend_pub_hex), hexToBytes(recipient.view_pub_hex), ephemeralScalar, outputIndex);
}

// Index rule (same as the web app): derive with the router's total_announcements read just before
// sending. Recipients scan the stored index and the SCAN_WINDOW indexes before it.
export class VeilClient {
  constructor(
    private readonly accountId: string,
    private readonly registryId: string,
    private readonly routerId: string,
    private readonly view: VeilView,
    private readonly keys?: VeilKeys,
  ) {}

  private ownKeys(): VeilKeys {
    if (!this.keys) throw new Error('this action needs the account owner Veil keys');
    return this.keys;
  }

  register(): CallAction {
    return buildRegistryRegister(this.registryId, this.ownKeys());
  }

  async resolve(name: string): Promise<VeilMeta | null> {
    return await this.view.viewFunction(this.registryId, 'get_meta', { account_id: name }) as VeilMeta | null;
  }

  async nextOutputIndex(): Promise<number> {
    return Number(await this.view.viewFunction(this.routerId, 'total_announcements', {}));
  }

  buildSendNear(recipient: VeilMeta, amount: bigint, ephemeralScalar: bigint, outputIndex: number): CallAction {
    const derived = deriveForRecipient(recipient, ephemeralScalar, outputIndex);
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

  buildSendFt(recipient: VeilMeta, tokenId: string, amount: bigint, ephemeralScalar: bigint, outputIndex: number): CallAction[] {
    const derived = deriveForRecipient(recipient, ephemeralScalar, outputIndex);
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
    const keys = this.ownKeys();
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
        outputIndex: rawAnnouncement.outputIndex ?? rawAnnouncement.index,
      };
      const found = scanAnnouncement(keys, announcement);
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
    return exportViewKey(this.ownKeys());
  }

  get ownerId(): string {
    return this.accountId;
  }
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Veil key must be 32-byte hex');
  return Uint8Array.from(hex.match(/.{2}/g)!, (part) => Number.parseInt(part, 16));
}

export { NEP_413_MESSAGE };
