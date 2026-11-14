# Veil

[![CI](https://github.com/willy264/veil/actions/workflows/ci.yml/badge.svg)](https://github.com/willy264/veil/actions/workflows/ci.yml)

**Private receiving for NEAR names.** People pay `alice.testnet` as usual, but each payment lands in a fresh one-time account that only Alice can find and spend. Testnet prototype, built at NEAR HACKATHON.

## The problem

A `.near` name is a public ledger. Anyone who knows your name can open an explorer and see every payment you receive, who sent it, how much, and your balance. Sharing your name to get paid shares your financial history. See the [public visibility table](research/02-problem-evidence.md).

## How it works

```
 Alice (receiver)                Sender                           NEAR testnet
 ────────────────                ──────                           ────────────
 signs one NEAR wallet message
 → spend key s, view key v
 registers S = s·G, V = v·G ───────────────────────────────────► registry2
                                 looks up alice.testnet ◄──────── registry2
                                 derives a one-time key
                                 P = S + h·G (h from r·V)
                                 send_near(P, R, tag) + NEAR ───► router2 ─┬─► pays account hex(P)
                                                                           └─► announcement (R, tag, P)
 scans announcements ◄────────────────────────────────────────── router2
 view tag skips ~255/256; recomputes P → "this one is mine"
 spends from P with p = s + h ─────────────────────────────────► NEAR RPC
```

- **Each one-time account is an ordinary NEAR implicit account.** Its account ID is the hex of an Ed25519 public key, so `P` *is* an account and `p` signs for it directly. There is no new account type and no contract wallet.
- **The view key works as an auditor key.** It finds incoming payments but cannot spend them.
- **Specification:** exact hashes, byte layouts and test vectors are in the [NEP draft](docs/NEP-DRAFT-stealth-meta-address.md). The [architecture](docs/ARCHITECTURE.md) and [threat model](docs/THREAT_MODEL.md) cover the rest.

## Try it in 30 seconds, no wallet

The demo receiver `veil-judge-recv.testnet` has received three private payments. Its auditor key is published here on purpose: it can find the payments but cannot spend them.

1. Open **https://veil-eta-khaki.vercel.app** and scroll to **Auditor**.
2. Enter **Registered name** `veil-judge-recv.testnet` and **Auditor key** `865df8cb1b16beb1face316a6c6b0dfc05443b2e6d47f56f1c22bda8a6646d0c`.
3. Press **Scan as auditor**. You see "Found 3 payments for veil-judge-recv.testnet. Read-only access." and three receiving accounts holding 0.0200, 0.0300 and 0.0500 NEAR. There is no Spend button.
4. Open [veil-judge-recv.testnet on NearBlocks](https://testnet.nearblocks.io/address/veil-judge-recv.testnet). Its public history shows the account's creation and its Veil registration, but none of the three payments.

The payments were sent on 14 November 2026 by [`scripts/judge-demo.ts`](scripts/judge-demo.ts); the transaction links are in the [judge demo evidence](results/judge-demo-20261114014907.json).

## Try it with a wallet

You need a testnet wallet that supports NEP-413 message signing through the wallet selector.

1. **Receive.** Connect wallet → **Enable Veil**: sign one message, which makes no payment and keeps keys in your browser. → **Register name**: 0.01 NEAR storage deposit, excess refunded.
2. **Send** (from another account). Enter the registered name, leave the field to check it, enter an amount, then **Send privately**. The receipt shows a fresh receiving account.
3. **Scan.** Back as the receiver, press **Scan payments**. The payment appears with its balance.
4. **Spend.** Choose a destination and an amount, or **Send all** (which closes the receiving account), then press **Spend** after the re-link warning.

The team's automated runs drive this flow with a scripted Node signer through the same hosted app. Browser-wallet approval screens have not been exercised by those runs.

## Run it locally

Requirements: Node 20+, pnpm 10+, Rust (`wasm32-unknown-unknown` target) for the contracts.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test            # 48 tests: crypto, SDK, scheme vectors, web flow with simulated wallet and RPC
pnpm test:v1         # 10,000 random sends: no false negatives, no false positives
pnpm --dir apps/web build   # writes config.js and bundles @noble into vendor/noble.js
pnpm web:dev                # serves apps/web on http://127.0.0.1:4173
```

```bash
cd contracts
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo build --workspace --target wasm32-unknown-unknown --release
```

The testnet demo scripts send real testnet transactions:

- `pnpm exec tsx scripts/judge-demo.ts` sets up the judge path. It reads keys from near-cli credential files and never prints them.
- `pnpm demo:all` and `pnpm demo:dao` read keys from process environment variables.

## NEAR features used

- **Implicit accounts** as one-time receiving accounts.
- **NEP-413** signed messages for wallet-bound key derivation. The request names the Veil app as recipient.
- **NEP-141** forwarding in the router (FT path; see the known issues below).
- **Sputnik DAO** for a private DAO payout through the router.
- **Contract event logs:** `meta_registered` and `stealth_sent`.
- **near-connect** as the wallet selector.

## Evidence

| What | Where |
|---|---|
| Contracts | Registry `registry2.veil-williams.testnet`, router `router2.veil-williams.testnet`, mock six-decimal FT `mockft.veil-williams.testnet` ([deployment evidence](results/deploy-20261111.json)) |
| Judge path, 14 Nov 2026 | [Registration](https://testnet.nearblocks.io/txns/D1VZR6UDdnPFsWK7ux6ZkTSKdojjhWdKqPCN4aWJmgup) under the current key message, three private sends ([0.02](https://testnet.nearblocks.io/txns/CA2KEYmAxhEL6TaP8byJo4SRzFytvinyeCWEeJ6N5Cmv), [0.03](https://testnet.nearblocks.io/txns/EPA9T69gQmemgznZQ7Gb3YUu6mPaasTK18vFjoVRdusu), [0.05](https://testnet.nearblocks.io/txns/QXkMZRkThs11tLGzADsEarGj1TwxMAjHCzY5QXfTrrc) NEAR), each adding 259 bytes of router storage, all found by the receiver's keys ([evidence](results/judge-demo-20261114014907.json)) |
| Router storage top-up, 14 Nov 2026 | [4 testnet NEAR](https://testnet.nearblocks.io/txns/3GXt3n5cd3k9FEfgoEiCmdB8wEW4jzH6wTgnzTR6F2di) to `router2`, leaving about 1,600 announcements of spare storage |
| Hosted signed flow, 13 Nov 2026 (earlier key message) | `veil-demo-recv.testnet` registered, received 0.0500 NEAR, scanned it, spent 0.0010 NEAR, auditor found it. Scripted test signer, not a browser wallet. [Registration](https://testnet.nearblocks.io/txns/8ojP7xQ2DpLpAXjzyEdo5hmEnMBf8sfsWSMyanpWhSKA), [payment](https://testnet.nearblocks.io/txns/GU7Yg8hhdNDBHNvvxuXomaneKzJmPMBevzfrHjrL9ojz), [spend](https://testnet.nearblocks.io/txns/CVVXiD2TVSqyY8vGYARKH2XQqmjAasKbMqmdUXCyQZq8), [full evidence](results/hosted-wallet-20261113T191343566Z.json) |
| Scripted demo, 11 Nov 2026 | Registered Alice with keys from a fixed test signature, sent three private payments through `router2`, scanned all three, spent one ([evidence](results/demo-20261111221900.json)) |
| DAO payout, 11 Nov 2026 | A sole-council Sputnik DAO approved a private router payout, and the recipient's scan found it ([evidence](results/demo-dao-20261111220608.json)) |
| Browser QA and performance, 13 Nov 2026 build | Keyboard paths, empty and error states, 320–1920 px, normal and reduced motion ([QA](results/ui-polish/final-pass/results.json)). Mobile Lighthouse lab scores 98 / 100 / 100 / 100, LCP 1.59 s, CLS 0 ([report](results/ui-polish/lighthouse-final-mobile.json)). Not re-run after the 14 November changes. |
| Screenshots, 13 Nov 2026 UI | [Receive](docs/screenshots/receive-desktop.png), [Send receipt](docs/screenshots/send-mobile.png), [Spend](docs/screenshots/spend-desktop.png), [Auditor](docs/screenshots/auditor-desktop.png) |
| Verified sources and links | [docs/VERIFIED.md](docs/VERIFIED.md) |

Vercel deploys `main` from the repository root. [vercel.json](vercel.json) runs `pnpm --dir apps/web build` and serves `apps/web`. The build reads only the network, RPC URL and contract IDs from its environment ([build.mjs](apps/web/build.mjs)). No private key belongs in hosting configuration.

## Design and research

Veil follows the stealth-address pattern of [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) and [ERC-6538](https://eips.ethereum.org/EIPS/eip-6538), with lessons from [Umbra](https://github.com/ScopeLift/umbra-protocol), [Fluidkey](https://docs.fluidkey.com/), [Monero](https://web.getmonero.org/resources/moneropedia/stealthaddress.html) and the [Nervos CCC extension](https://talk.nervos.org/t/introducing-a-stealth-address-extension-for-ccc/10802). The NEAR-specific basis is the [implicit-account model](https://github.com/near/nearcore/blob/master/docs/DataStructures/Account.md). No finalised stealth-address NEP was found in the [NEP repository](https://github.com/near/NEPs) during research. See the [prior-art review](research/01-prior-art.md).

## Honest limits

- **What stays public.** Amounts, timing, senders and token contracts. Any spend links the receiving account to its destination, and sending several payments to one destination links them together.
- **Testnet only.** It has not touched mainnet, and it has not been audited.
- **Scan window.** Senders derive with the router's announcement count read before wallet approval, and concurrent sends can store the announcement later. The inbox checks the stored index and the 32 before it. A gap of more than 32 announcements needs a wider rescan.
- **Same signing key.** Re-deriving keys requires the same wallet signing key.
- **Key message change.** Since 14 November 2026 the key message names the Veil app as its NEP-413 recipient. Names registered with the earlier message open their old payments from **Earlier inbox**, and can register new keys after a confirmation ([threat model](docs/THREAT_MODEL.md#key-derivation)).
- **CDN code.** The wallet connector and `near-api-js` still load from esm.sh. The `@noble` crypto is bundled.
- **Dependency alerts.** Seven remain, [documented](docs/DEPENDABOT.md).

### Known contract issues (not redeployed)

The deployed router has three known issues. The fixes are described in the [threat model](docs/THREAT_MODEL.md#known-contract-issues-on-the-deployed-router) and are not deployed.

1. **FT forward refund.** `on_ft_forward_complete` returns nothing, which NEP-141 reads as "full amount unused". Overlapping FT sends can therefore refund one sender from another sender's tokens.
   - *Fix:* return `U128(0)` on success and `U128(amount)` on failure, and drop the manual refund.
   - *Exposure:* the web app sends NEAR only, and no FT payment has gone through `router2`.
2. **Storage spam on `send_near`.** Any deposit above zero is accepted, and announcement storage is paid from the router's own balance.
   - *Fix:* charge a storage fee from the attached deposit, as `announce()` does.
3. **Lost announcements when router storage runs out.** The payment arrives, but its announcement callback fails, so the recipient cannot find it.
   - *Mitigation:* `router2` was topped up on 14 November 2026 and has about 1,600 announcements of room. Spam can still use it up.
   - *Recovery:* re-announce the public `send_near` arguments with `announce()`.

## Team and contributions

Veil was built for NEAR HACKATHON by the Veil team, starting 9 November 2026.

- All commits up to `ff3dd2d` were pushed through the `willy264` GitHub account.
- On 14 November 2026, a teammate committed fixes from a separate GitHub account after a judge-style code review. These were the license, scan window, SDK alignment, key-message binding, local crypto bundle, spend controls, disclosures, scheme vectors and this README.
- The team's planning documents and agent briefs are kept in [docs/internal](docs/internal/README.md). They describe plans, not shipped features.

## Related projects

This repository is hosted by the `willy264` GitHub account, which also hosts two other NEAR HACKATHON projects: [FRONTIER](https://github.com/willy264/frontier) and an [invoice-clearing project](https://github.com/willy264/near). Each is a separate submission with its own repository.

## AI and tools disclosure

- **AI tools.** Codex assisted with implementation, review, research and test orchestration. Claude Code assisted with the 14 November 2026 review fixes, tests, documentation and the judge demo.
- **Libraries and references.** [near-api-js](https://github.com/near/near-api-js), [noble-curves](https://github.com/paulmillr/noble-curves), [noble-hashes](https://github.com/paulmillr/noble-hashes), [near-sdk-rs](https://github.com/near/near-sdk-rs), [curve25519-dalek](https://github.com/dalek-cryptography/curve25519-dalek), [near-connect](https://github.com/hot-dao/near-selector), [NEAR docs](https://docs.near.org/) and the [Sputnik README](https://github.com/near-daos/sputnik-dao-contract#setup).
- **Demo keys.** Testnet keys live in git-ignored `.env` files or near-cli credential files, and are never printed or committed.
- **Video.** The narrated video uses synthetic speech and Playwright/FFmpeg editing, with the scripted-signer scope disclosed.

## License

[MIT](LICENSE)
