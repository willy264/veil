# Threat model

Veil is a testnet prototype. It has not been audited. Updated 14 November 2026.

## Protected

- The link between a named NEAR account and each receiving account it is paid through.
- The recipient's ability to find and spend their receiving accounts.
- Read-only disclosure: the auditor (view) key finds incoming payments but cannot sign a spend.

## Public

- Sender identity, token, amount, timing and every announcement field.
- Network metadata, such as the RPC provider seeing which names and accounts a browser looks up.
- Any spend: it publicly links the receiving account to its destination, and paying several receiving accounts to one destination links them together. The app warns before every spend.

## Key derivation

Spend and view keys are derived with HKDF-SHA256 from a NEP-413 signature over a fixed request (see [the NEP draft](NEP-DRAFT-stealth-meta-address.md)). Anyone who obtains a signature over the same request, from the same wallet key, can derive the spend key.

- **Current request (v2, since 14 November 2026).** The NEP-413 `recipient` is `veil-eta-khaki.vercel.app`, so the wallet shows the Veil app as the party the signature is for. A phishing site can still ask for the same payload. Only sign the Veil key message on the Veil app. In the 14 November 2026 test, Meteor Wallet (Chrome extension) showed `veil-eta-khaki.vercel.app` on its Sign Message screen. That was both the requesting site and the `recipient` there, so the test cannot tell which of the two Meteor displays. Whether a wallet warns when another site sends the same `recipient` is not verified.
- **Earlier request (v1).** The `recipient` was the signer's own account, which told the user nothing about who asked. Keys from v1 and v2 are different.
- **Migration.** For a name registered with v1 keys, Enable Veil reports the mismatch instead of failing. *Earlier inbox* signs the v1 request to see and spend payments sent to v1 keys. *Register new keys* asks for confirmation, then registers v2 keys for future payments. Payments sent before re-registering stay reachable through *Earlier inbox* only, with the same wallet signing key.
- A different wallet signing key always derives different keys and opens a different inbox.

## Code supply chain

- `@noble/curves` and `@noble/hashes` are bundled from the lockfile into `apps/web/vendor/noble.js` at build time.
- Two modules still load from esm.sh at runtime, pinned to exact versions but without integrity checks: `@hot-labs/near-connect@0.12.0` (the wallet connector, which receives the key-deriving signature) and `near-api-js@7.4.0` (which builds spend transactions). A compromised CDN response for the connector could capture that signature. Fix: bundle both like `@noble`.

## Scanning

- The sender derives with the router's `total_announcements` read before the wallet approves. The router stores the announcement at its count when the transfer settles, so concurrent sends can move it later. The app and SDK check the stored index and the 32 before it.
- If more than 32 announcements land in that gap, the payment is not found automatically. It can be recovered by scanning a wider window with the same keys.
- Each scan reads every announcement, 100 per RPC call.

## Known contract issues on the deployed router

These are in `router2.veil-williams.testnet`. The contract source in this repository was not changed and the contracts were not redeployed after the 14 November 2026 review. The fixes below are described, not deployed.

### 1. FT forward callback can double-refund

`on_ft_forward_complete` returns nothing (`contracts/router/src/lib.rs`). In NEP-141, the token contract's `ft_resolve_transfer` reads the receiver's return value as the unused amount, and `near-contract-standards` 5.30.1 treats an unreadable value as "the whole amount is unused" (`fungible_token/core_impl.rs`, lines 178–183). It then refunds the sender from whatever balance of that token the router holds at that moment.

- **Effect:** when two FT sends overlap, one sender can receive both their payment and a refund drawn from the other sender's tokens, and the other forward then fails. After a failed forward, the router's own `ft_transfer` refund and the token's resolve refund both run.
- **Exposure:** the web app sends NEAR only. All five announcements on `router2` (checked 14 November 2026) are NEAR. Tokens must be allow-listed by the router owner.
- **Fix:** return `U128(0)` after a successful forward and `U128(amount)` after a failed one, delete the manual refund so the token contract makes the only refund, and add a sandbox test that goes through a real `ft_transfer_call`.

### 2. Storage spam on `send_near`

`send_near` accepts any deposit above zero, and the announcement's storage is paid from the router's own balance. Anyone can add announcements for the price of gas, draining that balance and growing the list every scanner reads.

- **Fix:** charge a fixed storage fee out of the attached deposit, as `announce()` already does, and reject deposits that do not cover it.

### 3. Announcements are lost when the router's storage balance runs out

When the router cannot pay for an announcement's storage, the callback that appends it fails after the NEAR transfer has already reached the receiving account. The payment arrives, but there is no announcement, so the recipient's scan never finds it. The FT callback fails the same way.

- **Measured cost:** each NEAR announcement adds 259 bytes of router storage, 0.00259 NEAR at 10⁻⁵ NEAR per byte (three sends in [judge demo evidence](../results/judge-demo-20261114014907.json)).
- **Margin:** on 14 November 2026, `router2` had 0.1615 NEAR spare, about 60 announcements. It was then topped up with 4 testnet NEAR ([transfer](https://testnet.nearblocks.io/txns/3GXt3n5cd3k9FEfgoEiCmdB8wEW4jzH6wTgnzTR6F2di)), leaving 4.1537 NEAR spare, about 1,600 announcements. Spam can still use this up; only the fee in issue 2 removes the risk.
- **Mitigation without a redeploy:** top up the router's balance with a plain transfer.
- **Recovery:** the original `send_near` arguments are public in its transaction, so anyone can re-announce them with `announce()`. The recipient finds it if fewer than 32 announcements were added in between.
- **Fix:** issue 2's storage fee removes the dependency on the router's own balance.

## Out of scope for the prototype

- Hiding amounts, senders or timing.
- Anonymous RPC access.
- Mainnet deployment or mainnet spending.
- A security audit.
