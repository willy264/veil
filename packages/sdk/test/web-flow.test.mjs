// Simulated wallet/RPC integration tests. These do not submit testnet transactions.
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import * as near from 'near-api-js';

const source = readFileSync(new URL('../../../apps/web/app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
function harness() {
  const elements = new Map();
  const element = (id) => { if (!elements.has(id)) elements.set(id, { value: '', textContent: '', addEventListener() {}, querySelectorAll: () => [] }); return elements.get(id); };
  const state = { rows: [], calls: [], meta: null, copied: '', httpStatus: 200, providerResult: { status: { SuccessValue: '' }, transaction: { hash: 'simulated-spend' } } };
  class Provider {
    async viewAccessKey() { return { nonce: 1 }; }
    async viewBlock() { return { header: { hash: near.baseEncode(new Uint8Array(32)) } }; }
    async sendTransaction(tx) { state.signed = tx; return state.providerResult; }
  }
  const ctx = createContext({ ...near, JsonRpcProvider: Provider, ed25519, hkdf, sha256, sha512, Uint8Array, DataView, TextEncoder, TextDecoder, crypto: webcrypto, btoa, atob,
    window: {}, document: { getElementById: element }, confirm: () => true,
    navigator: { clipboard: { writeText: async (v) => { state.copied = v; } } },
    NearConnector: class { on() {} },
    fetch: async (_, options) => {
      const { params } = JSON.parse(options.body);
      if (params.request_type === 'view_account') return { json: async () => ({ result: { amount: '10000000000000000000000' } }) };
      const args = JSON.parse(Buffer.from(params.args_base64, 'base64'));
      const value = params.method_name === 'get_meta' ? state.meta : params.method_name === 'total_announcements' ? state.rows.length : state.rows.slice(args.from_index, args.from_index + args.limit);
      return { ok: state.httpStatus === 200, status: state.httpStatus, json: async () => ({ result: { result: [...new TextEncoder().encode(JSON.stringify(value))] } }) };
    },
  });
  runInContext(source + `\nglobalThis.api = {deriveKeys, deriveStealth, scan, signMessage, register, sendPrivate, refresh, spend, auditorScan, copyViewKey, yocto}; globalThis.session = (w, k) => { wallet=w; accountId='recipient.testnet'; keys=k; };`, ctx);
  const wallet = {
    async signMessage(args) { state.message = args; return { signature: btoa(String.fromCharCode(...ed25519.sign(args.nonce, new Uint8Array(32).fill(17)))) }; },
    async signAndSendTransaction(tx) { state.calls.push(tx); return { status: { SuccessValue: '' } }; },
  };
  ctx.session(wallet);
  const keys = ctx.api.deriveKeys(new Uint8Array(64).fill(4));
  const hex = (bytes) => Buffer.from(bytes).toString('hex');
  state.meta = { spend_pub_hex: hex(keys.spendPublicKey), view_pub_hex: hex(keys.viewPublicKey), scheme_id: 1 };
  const row = (index) => { const d = ctx.api.deriveStealth(keys.spendPublicKey, keys.viewPublicKey, 10n + BigInt(index), index); return { index, stealth_account: d.stealthAccount, ephemeral_pub_hex: hex(d.ephemeralPublicKey), view_tag: d.viewTag }; };
  return { api: ctx.api, state, element, keys, row, wallet, session: ctx.session };
}

describe('web flow with simulated wallet and RPC', () => {
  it('registers on registry2 with an integer yocto deposit; prevents accidental key replacement', async () => {
    const h = harness(); h.session(h.wallet, h.keys); await h.api.register();
    expect(h.state.calls[0].receiverId).toBe('registry2.veil-williams.testnet');
    expect(h.state.calls[0].actions[0].params.deposit).toBe('10000000000000000000000');
    h.state.meta.spend_pub_hex = '00'.repeat(32);
    await expect(h.api.register()).rejects.toThrow('different Veil keys');
    expect(h.state.calls).toHaveLength(1);
  });
  it('re-derives the same identity with the same wallet signing key', async () => {
    const h = harness(); await h.api.signMessage(); const first = h.element('identity-output').textContent;
    await h.api.signMessage(); expect(h.element('identity-output').textContent).toBe(first);
    expect(h.state.message.nonce.length).toBe(32);
  });
  it('sends through router2 at a nonzero index without asking the sender to derive recipient keys', async () => {
    const h = harness(); h.state.rows = Array.from({ length: 4 }, (_, i) => h.row(i));
    h.element('recipient').value = 'recipient.testnet'; h.element('amount').value = '0.01';
    await h.api.sendPrivate(); const tx = h.state.calls[0]; const args = tx.actions[0].params.args;
    expect(tx.receiverId).toBe('router2.veil-williams.testnet');
    expect(h.api.scan(h.keys, { ...args, index: 4 })).not.toBeNull();
    expect(h.state.message).toBeUndefined();
  });
  it('auditor finds owned payments without a spending scalar and scans beyond 100 announcements', async () => {
    const h = harness(); const decoy = h.row(0);
    h.state.rows = [...Array.from({ length: 100 }, (_, index) => ({ ...decoy, index, view_tag: decoy.view_tag ^ 255 })), h.row(100)];
    h.session(h.wallet, h.keys); await h.api.copyViewKey();
    h.element('view-key').value = h.state.copied; h.element('auditor-name').value = 'recipient.testnet';
    await h.api.auditorScan(); const audit = JSON.parse(h.element('auditor-output').textContent);
    expect(audit.incoming).toHaveLength(1);
    expect(audit.incoming[0].index).toBe(100);
    expect(audit.incoming.every((row) => !('privateScalar' in row))).toBe(true);
    expect(h.state.calls).toHaveLength(0);
  }, 30000);
  it('signs a real serialized spend transaction and preserves the receipt after refreshing', async () => {
    const h = harness(); h.session(h.wallet, h.keys); h.state.rows = [h.row(0)]; await h.api.refresh(); await h.api.spend(0);
    expect(h.state.signed.transaction.signerId).toBe(h.state.rows[0].stealth_account);
    expect(h.state.signed.transaction.receiverId).toBe('recipient.testnet');
    expect(h.element('scan-output').textContent).toContain('simulated-spend');
  });
  it('does not report success on failed receipts or HTTP errors', async () => {
    const h = harness(); h.session(h.wallet, h.keys); h.state.rows = [h.row(0)]; await h.api.refresh();
    h.state.providerResult = { status: { Failure: {} } }; await expect(h.api.spend(0)).rejects.toThrow('Transaction failed');
    h.state.httpStatus = 503; await expect(h.api.refresh()).rejects.toThrow('HTTP 503');
  });
  it('rejects malformed points, identity, torsion and invalid amounts', () => {
    const h = harness();
    for (const bad of ['01' + '00'.repeat(31), '00'.repeat(32), 'zz'.repeat(32)]) expect(() => h.api.scan(h.keys, { ...h.row(0), ephemeral_pub_hex: bad })).toThrow();
    for (const bad of ['-1', '0', '1e-3', 'NaN', '0.' + '1'.repeat(25)]) expect(() => h.api.yocto(bad)).toThrow();
  });
});
