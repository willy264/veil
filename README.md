# Veil

[![CI](https://github.com/willy264/veil/actions/workflows/ci.yml/badge.svg)](https://github.com/willy264/veil/actions/workflows/ci.yml)

Private receiving for NEAR named accounts. Veil lets `ada.near` publish one reusable identity while senders derive a fresh Ed25519 implicit account for every payment.

## Status

The V1 registry and router contracts are deployed on NEAR testnet; receipts are listed in [verified evidence](docs/VERIFIED.md):

- Registry: `registry2.veil-williams.testnet`
- Router: `router2.veil-williams.testnet`
- Mock six-decimal FT: `mockft.veil-williams.testnet`

Fresh registry/router creation, funding, deployment, initialization, WASM sizes, and view checks are recorded in [deployment evidence](results/deploy-20261111.json) and [verified links](docs/VERIFIED.md). The verified DAO payout is recorded in [DAO evidence](results/demo-dao-20261111220608.json).

The Ubuntu gate passes Rust formatting, clippy with warnings denied, workspace tests, sandbox tests, release WASM builds and the web build; see the [green release run](https://github.com/willy264/veil/actions/runs/43533851015). There are [24 passing tests](packages/sdk/test), including ten web-flow regressions with simulated wallet/RPC responses. The standalone 10,000-send property test also passes in CI. A [fresh clone](results/fresh-clone-20261114.json) passed frozen installation, typecheck, all 24 tests, the property test and web build without copying credentials. The separate [hosted demo evidence](results/hosted-wallet-20261113T191343566Z.json) records real signed testnet transactions through the app.

## Try it

Requirements: Node 20+, pnpm 10+, Rust, WSL2 Ubuntu for sandbox tests, and a NEAR testnet account. Never commit a private key or publish it in hosting configuration.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm test:v1
```

Run the web surface:

```bash
pnpm --dir apps/web build
pnpm web:dev
```

Open `http://127.0.0.1:4173`. The app reads `registry2.veil-williams.testnet` and `router2.veil-williams.testnet` through final testnet RPC, connects a testnet wallet with near-connect, derives keys in memory from a NEP-413 signature, and never sends private keys to a server.

### Vercel deployment

Open [Veil on testnet](https://veil-eta-khaki.vercel.app). Choose **Receive** to connect, enable Veil, register and share your name. Choose **Send** to enter a registered name and amount, then approve the private payment. The name resolves when you leave the field. The inbox and read-only Auditor section appear below; technical details are in disclosures.

The hosted run registered `veil-demo-recv.testnet`, sent **0.0500 NEAR** from `veil-demo-send.testnet`, found it in the inbox, spent **0.0010 NEAR**, and found the same payment from an unsigned auditor context. It uses a **scripted test signer, not a browser wallet**. The hosted app performs derivation, scanning and spending; the runner substitutes the connector with a local Node signer. Browser-extension approval screens are not verified by this run. [Registration](https://testnet.nearblocks.io/txns/8ojP7xQ2DpLpAXjzyEdo5hmEnMBf8sfsWSMyanpWhSKA), [private payment](https://testnet.nearblocks.io/txns/GU7Yg8hhdNDBHNvvxuXomaneKzJmPMBevzfrHjrL9ojz), [spend](https://testnet.nearblocks.io/txns/CVVXiD2TVSqyY8vGYARKH2XQqmjAasKbMqmdUXCyQZq8), [full evidence](results/hosted-wallet-20261113T191343566Z.json).

Public access, keyboard paths, empty/error states and both tabs passed checks across 320–1920px in normal/reduced motion. [Browser QA](results/ui-polish/final-pass/results.json). The production mobile Lighthouse run scored **98 performance / 100 accessibility / 100 best practices / 100 SEO**, with **1.59s LCP and 0 CLS**; these are lab measurements, not field p75 claims. [Lighthouse evidence](results/ui-polish/lighthouse-final-mobile.json).

The final [public hosted check](results/hosted-check-1794615996906.json) confirms unauthenticated page/assets access, the wallet chooser, name resolution through registry2 and five announcements from router2. It is a read-only check; the separate signed-flow record above covers the actual payment.

Current screenshots from the signed hosted run: [Receive, 1440px](docs/screenshots/receive-desktop.png), [Send receipt, 390px](docs/screenshots/send-mobile.png), [Spend](docs/screenshots/spend-desktop.png), [Auditor](docs/screenshots/auditor-desktop.png).

Vercel project `veil` uses repository root `.`. The root [vercel.json](vercel.json) runs `pnpm --dir apps/web build` and serves `apps/web`. `veil.vercel.app` was unavailable; use the verified production alias above. Environment: `VEIL_NETWORK=testnet`, `VEIL_RPC_URL=https://rpc.testnet.near.org`, `VEIL_REGISTRY_ID=registry2.veil-williams.testnet`, `VEIL_ROUTER_ID=router2.veil-williams.testnet`. The official testnet RPC replaced Fastnear after reproducible HTTP 429 responses. No private keys belong in Vercel configuration.

The new [1:57 narrated product demo](docs/NARRATED-TOUR.md) records the polished UI completing the signed hosted flow above. It has synthetic voiceover and captions, with the scripted-signer disclosure throughout. Local export: `results/veil-demo-product.mp4`; [timing](results/product-video-timing.json), [media verification](results/product-video-verification.json), [frame review](results/product-video-review.json). The DAO scene is clearly labelled separate evidence from 11 November 2026. This replaces both older videos after the UI change. Public upload remains pending; a [shot list](docs/VIDEO-PLAN.md) is provided for optional browser-wallet approval footage.

Run the scripted testnet demo with process-only key variables:

```powershell
$env:VEIL_ALICE_PRIVATE_KEY = "ed25519:..."
$env:VEIL_SENDER1_PRIVATE_KEY = "ed25519:..."
$env:VEIL_SENDER2_PRIVATE_KEY = "ed25519:..."
$env:VEIL_SENDER3_PRIVATE_KEY = "ed25519:..."
pnpm demo:all
```

The fresh-contract demo is committed as [demo evidence](results/demo-20261111221900.json): it registered Alice, sent three private payments through `router2`, scanned all three, and spent one. The committed DAO run separately created a sole-council Sputnik DAO, approved a private router payout, and verified the recipient scan in [DAO evidence](results/demo-dao-20261111220608.json).

For Rust and sandbox verification in WSL2 Ubuntu:

```bash
cd contracts
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo build --workspace --target wasm32-unknown-unknown --release
```

## Design

Alice registers a viewing public key and spending public key in the registry. A sender uses an ephemeral scalar and Alice's public keys to derive a one-time implicit account, pays that account, and announces the ephemeral public key plus view tag through the router. Alice scans announcements, skips almost all with the view tag, and derives the private scalar only for owned outputs.

The SDK uses a NEP-413 signature as wallet-bound key material. `exportViewKey` supports selective disclosure; a view key cannot spend. See `docs/NEP-DRAFT-stealth-meta-address.md`, `docs/ARCHITECTURE.md`, and `docs/THREAT_MODEL.md`.

## Research

Veil follows the stealth-address pattern established by [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) and [ERC-6538](https://eips.ethereum.org/EIPS/eip-6538), with lessons from [Umbra](https://github.com/ScopeLift/umbra-protocol), [Fluidkey](https://docs.fluidkey.com/), [Monero](https://web.getmonero.org/resources/moneropedia/stealthaddress.html), and the [Nervos CCC extension](https://talk.nervos.org/t/introducing-a-stealth-address-extension-for-ccc/10802). NEAR-specific grounding is its [implicit-account model](https://github.com/near/nearcore/blob/master/docs/DataStructures/Account.md); no finalized stealth-address NEP was found in the [NEP repository](https://github.com/near/NEPs) during this research pass. See the full [prior-art review](research/01-prior-art.md) and [public visibility table](research/02-problem-evidence.md).

## Related projects

Veil is independent; no second hackathon project is being submitted under this team.

## AI and tools disclosure

Codex assisted with implementation, review, research, and test orchestration. References and dependencies include [NEAR docs](https://docs.near.org/), [near-api-js](https://github.com/near/near-api-js), [noble-hashes](https://github.com/paulmillr/noble-hashes), and the [Sputnik README](https://github.com/near-daos/sputnik-dao-contract#setup). The user authorized two testnet demo keys, loaded locally into an ignored `.env` and the Node signer; key values were not printed or committed. The narrated video uses synthetic Windows speech and Playwright/FFmpeg editing, with the scripted-signer scope disclosed on screen and in narration.

## Honest limits

Amounts, timing, sender identities, and token contracts remain public. Sweeping multiple stealth balances to one destination links them. The project is testnet-only and has not touched mainnet; transaction-level limits and receipts are in [verified evidence](docs/VERIFIED.md).

Senders derive with the router's announcement count read before wallet approval; concurrent sends can store the announcement later, so the inbox checks the stored index and the 32 before it. More than 32 announcements in that gap needs a wider rescan. Re-derivation requires the same wallet signing key. Since 14 November 2026 the key message names the Veil app as its NEP-413 recipient; names registered with the earlier message open their old payments from **Earlier inbox** and can register new keys after a confirmation ([threat model](docs/THREAT_MODEL.md#key-derivation)). Spend sends a chosen amount, or the full balance by closing the receiving account, to a chosen destination, and warns that the destination becomes publicly linked. The wallet connector and `near-api-js` still load from esm.sh; `@noble` crypto is bundled. Seven dependency alerts remain [documented](docs/DEPENDABOT.md), as requested.

### Known contract issues (not redeployed)

The deployed router has three known issues. The fixes are described in the [threat model](docs/THREAT_MODEL.md#known-contract-issues-on-the-deployed-router) and are not deployed:

1. **FT forward refund.** `on_ft_forward_complete` returns nothing, which NEP-141 reads as "full amount unused", so overlapping FT sends can refund one sender from another sender's tokens. Fix: return `U128(0)` on success and `U128(amount)` on failure, and drop the manual refund. The web app sends NEAR only, and no FT payment has gone through `router2`.
2. **Storage spam on `send_near`.** Any deposit above zero is accepted, and announcement storage is paid from the router's own balance. Fix: charge a storage fee from the attached deposit, as `announce()` does.
3. **Lost announcements when router storage runs out.** The payment arrives but its announcement callback fails, so the recipient cannot find it. On 14 November 2026 `router2` had about 0.16 NEAR of spare storage balance. Mitigation: top up the router. Recovery: re-announce the public `send_near` arguments with `announce()`.
