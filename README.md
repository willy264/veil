# Veil

[![CI](https://github.com/willy264/veil/actions/workflows/ci.yml/badge.svg)](https://github.com/willy264/veil/actions/workflows/ci.yml)

Private receiving for NEAR named accounts. Veil lets `ada.near` publish one reusable identity while senders derive a fresh Ed25519 implicit account for every payment.

## Status

The V1 registry and router contracts are deployed on NEAR testnet; receipts are listed in [verified evidence](docs/VERIFIED.md):

- Registry: `registry2.veil-williams.testnet`
- Router: `router2.veil-williams.testnet`
- Mock six-decimal FT: `mockft.veil-williams.testnet`

Fresh registry/router creation, funding, deployment, initialization, WASM sizes, and view checks are recorded in [deployment evidence](results/deploy-20261111.json) and [verified links](docs/VERIFIED.md). The verified DAO payout is recorded in [DAO evidence](results/demo-dao-20261111220608.json).

The Ubuntu gate passes Rust formatting, clippy with warnings denied, workspace tests, sandbox tests, release WASM builds and the web build; see the [green run](https://github.com/willy264/veil/actions/runs/43171196000). There are [21 passing tests](packages/sdk/test), including seven web-flow regressions with simulated wallet/RPC responses. The standalone 10,000-send property test also passes in CI. Simulated wallet tests are not hosted transaction receipts.

## Try it

Requirements: Node 20+, pnpm 10+, Rust, WSL2 Ubuntu for sandbox tests, and a NEAR testnet account. Never put a private key in the repository.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm test:v1
```

Run the web surface:

```bash
pnpm web:dev
```

Open `http://127.0.0.1:4173`. The app reads `registry2.veil-williams.testnet` and `router2.veil-williams.testnet` through final testnet RPC, connects a testnet wallet with near-connect, derives keys in memory from a NEP-413 signature, and never sends keys to a server.

### Vercel deployment

Open [Veil on testnet](https://veil-eta-khaki.vercel.app). Anonymous access to the page, index aliases and assets, all six panels, the wallet chooser and real registry2/router2 reads passed on 12 Nov: [hosted evidence](results/hosted-check-1794466492403.json). Actual hosted wallet approvals still need the human recording session; prior scripted receipts are linked below.

Vercel project `veil` uses repository root `.`. The root [vercel.json](vercel.json) runs `pnpm --dir apps/web build` and serves `apps/web`. This corrects the old empty-root deployment. `veil.vercel.app` was unavailable; use the verified production alias above, not the protected generated deployment URLs. Environment: `VEIL_NETWORK=testnet`, `VEIL_RPC_URL=https://rpc.testnet.fastnear.com`, `VEIL_REGISTRY_ID=registry2.veil-williams.testnet`, `VEIL_ROUTER_ID=router2.veil-williams.testnet`. No private keys belong in Vercel configuration.

For the recording, follow the [1:57 wallet shot list](docs/VIDEO-PLAN.md) and [narration script](docs/VIDEO-SCRIPT.md). The generated local track is `results/video-assets/voiceover-final.wav`; [timing checks](results/video-narration-timing.json) confirm complete speech within every scene. Human wallet footage, final editing and video upload remain pending; the older MP4 is a draft.

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

Codex assisted with implementation, review, research, and test orchestration. References and dependencies include [NEAR docs](https://docs.near.org/), [near-api-js](https://github.com/near/near-api-js), [noble-hashes](https://github.com/paulmillr/noble-hashes), and the [Sputnik README](https://github.com/near-daos/sputnik-dao-contract#setup). Wallet keys were never supplied to AI tools or committed.

## Honest limits

Amounts, timing, sender identities, and token contracts remain public. Sweeping multiple stealth balances to one destination links them. The project is testnet-only and has not touched mainnet; transaction-level limits and receipts are in [verified evidence](docs/VERIFIED.md).

V1 sends must be sequential: [browser derivation](apps/web/app.js) uses the next router index, so concurrent sends can change that index and prevent normal discovery. Re-derivation requires the same wallet signing key; older random-nonce registrations or a different signing key cannot be assumed recoverable. The current Spend control sends 0.001 NEAR to the connected named account and warns about that public link. Seven dependency alerts remain [documented](docs/DEPENDABOT.md), as requested.
