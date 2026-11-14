# Architecture

Veil has three runtime layers and one shared scheme. The scheme is specified in [the NEP draft](NEP-DRAFT-stealth-meta-address.md) and pinned by [test vectors](../verification/scheme1-vectors.json).

```
            receiver's browser                          testnet
 wallet ──NEP-413 signature──► apps/web ──register(S, V)──► registry2.veil-williams.testnet
                               keys in memory

            sender's browser
 apps/web ──get_meta(name)──────────────────────────────► registry2
          ──total_announcements──────────────────────────► router2.veil-williams.testnet
          derives P = S + h·G, wallet signs
          ──send_near(P, R, tag) + NEAR──────────────────► router2 ──transfer──► implicit account P
                                                                    └─callback─► announcement #n

            receiver's browser
 apps/web ──get_announcements (100 per page)─────────────► router2
          view tag filter, recompute P, read balances
          spend: signs with p = s + h ───────────────────► RPC (transfer or DeleteAccount from P)
```

## Components

| Path | What it is |
|---|---|
| `contracts/registry` | Maps a named account to its public spend and view keys. Rejects identity and small-order points. Holds a storage deposit per record. |
| `contracts/router` | `send_near` pays the receiving account and appends an announcement in a callback. `announce` records payments made elsewhere and charges storage. `ft_on_transfer` forwards allow-listed tokens. Pages of at most 100. |
| `contracts/mock-ft` | Six-decimal NEP-141 test token used by the FT scripts. |
| `packages/sdk` | Scheme 1 in TypeScript: key derivation from a NEP-413 signature, send derivation from a recipient's registered keys, scanning with the 32-index window, scalar signing. A cross-test runs the same inputs through `apps/web/app.js` and checks identical results. |
| `apps/web` | Static HTML, CSS and ES modules. `build.mjs` writes `config.js` and bundles `@noble` into `vendor/noble.js`. The wallet connector and `near-api-js` still load from esm.sh (see the [threat model](THREAT_MODEL.md)). |
| `scripts` | Testnet demo and evidence scripts. They read keys from the process environment or near-cli credential files and page announcements 100 at a time. |
| `verification` | Test vectors and the test report. |

## Design decisions

- **Implicit accounts as receiving accounts.** Each one-time key `P` is an ordinary NEAR implicit account (the account ID is the hex of the Ed25519 public key), created when NEAR arrives. No contract wallet or new account type is needed, and `p = s + h` signs for it directly.
- **On-chain announcement log.** Scanning needs only RPC view calls, no indexer.
- **Router index in the derivation.** It is bound into `h`, and scanners tolerate it moving later by up to 32 positions.
- **Keys from a wallet signature.** Keys are recoverable from the same wallet signing key without storing secrets. The cost is the phishing risk described in the [threat model](THREAT_MODEL.md).
