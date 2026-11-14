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

const source = readFileSync(new URL('../../../apps/web/app.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace("await import('https://esm.sh/near-api-js@7.4.0')", 'globalThis')
  .replace("await import('https://esm.sh/@hot-labs/near-connect@0.12.0')", 'globalThis');
function harness() {
  const elements = new Map();
  const selectorDataKey = (selector) => selector.match(/^\[data-([\w-]+)\]$/)?.[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  class FakeElement {
    constructor(id = '') {
      this.id = id;
      this.value = '';
      this.href = '';
      this.hidden = false;
      this.disabled = false;
      this.dataset = {};
      this.attributes = new Map();
      this.listeners = new Map();
      this.children = [];
      this._className = '';
      this._innerHTML = '';
      this._textContent = '';
      this.classList = {
        add: (...names) => { for (const name of names) this._setClass(name, true); },
        remove: (...names) => { for (const name of names) this._setClass(name, false); },
        contains: (name) => this._className.split(/\s+/).includes(name),
        toggle: (name, force) => {
          const enabled = force === undefined ? !this.classList.contains(name) : Boolean(force);
          this._setClass(name, enabled);
          return enabled;
        },
      };
    }
    _setClass(name, enabled) {
      const names = new Set(this._className.split(/\s+/).filter(Boolean));
      if (enabled) names.add(name); else names.delete(name);
      this._className = [...names].join(' ');
    }
    set className(value) { this._className = String(value); }
    get className() { return this._className; }
    set textContent(value) { this._textContent = String(value ?? ''); this._innerHTML = ''; this.children = []; }
    get textContent() { return this._textContent; }
    set innerHTML(value) {
      this._innerHTML = String(value ?? '');
      this._textContent = this._innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      this.children = [...this._innerHTML.matchAll(/<([a-z][\w-]*)([^>]*)>/gi)].map((match) => {
        const child = new FakeElement();
        for (const attribute of match[2].matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
          child.setAttribute(attribute[1], attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
        }
        return child;
      });
    }
    get innerHTML() { return this._innerHTML; }
    setAttribute(name, value) {
      const normalized = String(value);
      this.attributes.set(name, normalized);
      if (name === 'class') this.className = normalized;
      if (name === 'hidden') this.hidden = true;
      if (name === 'disabled') this.disabled = true;
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = normalized;
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name === 'hidden') this.hidden = false;
      if (name === 'disabled') this.disabled = false;
    }
    toggleAttribute(name, force) {
      const enabled = force === undefined ? !this.hasAttribute(name) : Boolean(force);
      if (enabled) this.setAttribute(name, ''); else this.removeAttribute(name);
      return enabled;
    }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    async dispatchEvent(event) {
      event.target ??= this;
      event.currentTarget = this;
      event.preventDefault ??= () => {};
      for (const listener of this.listeners.get(event.type) ?? []) await listener(event);
      return true;
    }
    click() { return this.dispatchEvent({ type: 'click' }); }
    focus() {}
    matches(selector) {
      if (selector.startsWith('#')) return this.id === selector.slice(1);
      const key = selectorDataKey(selector);
      return key ? Object.hasOwn(this.dataset, key) : false;
    }
    querySelectorAll(selector) { return this.children.filter((child) => child.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  }
  const element = (id) => { if (!elements.has(id)) elements.set(id, new FakeElement(id)); return elements.get(id); };
  const state = {
    rows: [], calls: [], meta: null, copied: '', httpStatus: 200, connectorCalls: [],
    walletResult: { final_execution_status: 'FINAL', status: { SuccessValue: '' }, transaction: { hash: '11111111111111111111111111111111' } },
    providerResult: { final_execution_status: 'FINAL', status: { SuccessValue: '' }, transaction: { hash: '22222222222222222222222222222222' } },
  };
  class Provider {
    async viewAccessKey() { return { nonce: 1 }; }
    async viewBlock() { return { header: { hash: near.baseEncode(new Uint8Array(32)) } }; }
    async sendTransaction(tx) { state.signed = tx; return state.providerResult; }
  }
  class FakeConnector {
    constructor() { this.listeners = new Map(); state.connector = this; }
    on(event, listener) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(listener);
      return () => this.listeners.set(event, (this.listeners.get(event) ?? []).filter((item) => item !== listener));
    }
    async emit(event, payload) { for (const listener of this.listeners.get(event) ?? []) await listener(payload); }
    async connect() { state.connectorCalls.push('connect'); }
    async disconnect() { state.connectorCalls.push('disconnect'); await this.emit('wallet:signOut'); }
    async wallet() { return state.connectorWallet; }
  }
  const document = {
    getElementById: element,
    querySelectorAll: (selector) => selector.split(',').flatMap((part) => {
      const normalized = part.trim();
      const id = normalized.match(/^#([\w-]+)$/)?.[1];
      return id ? [element(id)] : [...elements.values()].filter((item) => item.matches(normalized));
    }),
    querySelector: (selector) => document.querySelectorAll(selector)[0] ?? null,
  };
  const ctx = createContext({ ...near, JsonRpcProvider: Provider, ed25519, hkdf, sha256, sha512, Uint8Array, DataView, TextEncoder, TextDecoder, AbortSignal, crypto: webcrypto, btoa, atob,
    window: {}, document, confirm: () => true,
    navigator: { clipboard: { writeText: async (v) => { state.copied = v; } } },
    NearConnector: FakeConnector,
    fetch: async (url, options = {}) => {
      if (!options.body) return { ok: true, status: 200, json: async () => ({ txns: [] }) };
      const { params } = JSON.parse(options.body);
      if (params.request_type === 'view_account') return { ok: true, status: 200, json: async () => ({ result: { amount: '10000000000000000000000' } }) };
      const args = JSON.parse(Buffer.from(params.args_base64, 'base64'));
      const value = params.method_name === 'get_meta' ? state.meta : params.method_name === 'total_announcements' ? state.rows.length : state.rows.slice(args.from_index, args.from_index + args.limit);
      return { ok: state.httpStatus === 200, status: state.httpStatus, json: async () => ({ result: { result: [...new TextEncoder().encode(JSON.stringify(value))] } }) };
    },
  });
  runInContext(source + `\nglobalThis.api = {deriveKeys, deriveStealth, scan, signMessage, register, sendPrivate, refresh, spend, auditorScan, copyViewKey, yocto}; globalThis.session = (w, k) => { wallet=w; accountId='recipient.testnet'; keys=k; };`, ctx);
  const wallet = {
    async signMessage(args) { state.message = args; return { signature: btoa(String.fromCharCode(...ed25519.sign(args.nonce, new Uint8Array(32).fill(17)))) }; },
    async signAndSendTransaction(tx) { state.calls.push(tx); return state.walletResult; },
  };
  state.connectorWallet = wallet;
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
    const h = harness(); const signature = new Uint8Array(64).fill(23);
    const first = h.api.deriveKeys(signature); const second = h.api.deriveKeys(signature);
    expect(Buffer.from(second.spendPublicKey)).toEqual(Buffer.from(first.spendPublicKey));
    expect(Buffer.from(second.viewPublicKey)).toEqual(Buffer.from(first.viewPublicKey));
    expect(second.spend).toBe(first.spend);
    expect(second.view).toBe(first.view);
  });
  it('sends through router2 at a nonzero index without asking the sender to derive recipient keys', async () => {
    const h = harness(); h.state.rows = Array.from({ length: 4 }, (_, i) => h.row(i));
    h.element('recipient').value = 'recipient.testnet'; h.element('amount').value = '0.01';
    await h.api.sendPrivate(); const tx = h.state.calls[0]; const args = tx.actions[0].params.args;
    expect(tx.receiverId).toBe('router2.veil-williams.testnet');
    expect(h.api.scan(h.keys, { ...args, index: 4 })).not.toBeNull();
    expect(h.state.message).toBeUndefined();
  });
  it.each([1, 2, 3, 4, 5])('finds a payment the router stored %i index(es) after the index the sender derived with', async (shift) => {
    const h = harness(); h.state.rows = Array.from({ length: 3 }, (_, i) => h.row(i));
    h.element('recipient').value = 'recipient.testnet'; h.element('amount').value = '0.01';
    await h.api.sendPrivate();
    const args = h.state.calls[0].actions[0].params.args;
    // Concurrent sends from other people land first and take indexes 3..3+shift-1.
    const decoy = h.row(0);
    const concurrent = Array.from({ length: shift }, (_, j) => ({ ...decoy, index: 3 + j, view_tag: decoy.view_tag ^ 255 }));
    h.state.rows = [...h.state.rows, ...concurrent, { ...args, index: 3 + shift, token: 'router2.veil-williams.testnet', amount: '10000000000000000000000' }];
    h.session(h.wallet, h.keys);
    const found = (await h.api.refresh()).find((row) => row.stealth_account === args.stealth_account);
    expect(found).toBeDefined();
    expect(Buffer.from(ed25519.Point.BASE.multiply(found.privateScalar).toBytes()).toString('hex')).toBe(args.stealth_account);
    h.element('view-key').value = Buffer.from(new Uint8Array(32).map((_, i) => Number((h.keys.view >> BigInt(8 * i)) & 255n))).toString('hex');
    h.element('auditor-name').value = 'recipient.testnet';
    expect((await h.api.auditorScan()).map((row) => row.stealth_account)).toContain(args.stealth_account);
  });
  it('auditor finds owned payments without a spending scalar and scans beyond 100 announcements', async () => {
    const h = harness(); const decoy = h.row(0);
    h.state.rows = [...Array.from({ length: 100 }, (_, index) => ({ ...decoy, index, view_tag: decoy.view_tag ^ 255 })), h.row(100)];
    h.session(h.wallet, h.keys); await h.api.copyViewKey();
    h.element('view-key').value = h.state.copied; h.element('auditor-name').value = 'recipient.testnet';
    const audit = await h.api.auditorScan();
    expect(audit).toHaveLength(1);
    expect(audit[0].index).toBe(100);
    expect(audit.every((row) => !('privateScalar' in row))).toBe(true);
    expect(h.state.calls).toHaveLength(0);
  }, 30000);
  it('signs a real serialized spend transaction and preserves the receipt after refreshing', async () => {
    const h = harness(); h.session(h.wallet, h.keys); h.state.rows = [h.row(0)]; await h.api.refresh(); await h.api.spend(0);
    expect(h.state.signed.transaction.signerId).toBe(h.state.rows[0].stealth_account);
    expect(h.state.signed.transaction.receiverId).toBe('recipient.testnet');
    expect(h.element('spend-output').innerHTML).toContain('22222222222222222222222222222222');
  });
  it.each([
    ['pending execution', { status: { SuccessReceiptId: 'pending-receipt' } }],
    ['unknown status', { final_execution_status: 'FINAL', status: { Unknown: '' } }],
    ['failed nested receipt', { final_execution_status: 'FINAL', status: { SuccessValue: '' }, receipts_outcome: [{ outcome: { status: { Failure: { error_message: 'receiver failed' } } } }] }],
  ])('does not render delivery success for %s', async (_, result) => {
    const h = harness(); h.element('recipient').value = 'recipient.testnet'; h.element('amount').value = '0.01'; h.state.walletResult = result;
    await expect(h.api.sendPrivate()).rejects.toThrow();
    expect(h.element('send-receipt').innerHTML).not.toContain('Delivered privately');
  });
  it('does not report success on failed spend receipts or HTTP errors', async () => {
    const h = harness(); h.session(h.wallet, h.keys); h.state.rows = [h.row(0)]; await h.api.refresh();
    h.state.providerResult = { final_execution_status: 'FINAL', status: { Failure: {} } }; await expect(h.api.spend(0)).rejects.toThrow('Transaction failed');
    h.state.httpStatus = 503; await expect(h.api.refresh()).rejects.toThrow('HTTP 503');
  });
  it('rejects malformed points, identity, torsion and invalid amounts', () => {
    const h = harness();
    for (const bad of ['01' + '00'.repeat(31), '00'.repeat(32), 'zz'.repeat(32)]) expect(() => h.api.scan(h.keys, { ...h.row(0), ephemeral_pub_hex: bad })).toThrow();
    for (const bad of ['-1', '0', '1e-3', 'NaN', '0.' + '1'.repeat(25)]) expect(() => h.api.yocto(bad)).toThrow();
  });
});
