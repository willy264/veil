# Veil

[![CI](https://github.com/willy264/veil/actions/workflows/ci.yml/badge.svg)](https://github.com/willy264/veil/actions/workflows/ci.yml)

Private receiving for NEAR named accounts. Veil lets `ada.near` publish one reusable identity while senders derive a fresh Ed25519 implicit account for every payment.

## Status

The V1 registry and router contracts are deployed on NEAR testnet; receipts are listed in [verified evidence](docs/VERIFIED.md):

- Registry: `registry2.veil-williams.testnet`
- Router: `router2.veil-williams.testnet`
- Mock six-decimal FT: `mockft.veil-williams.testnet`

Fresh registry/router creation, funding, deployment, initialization, WASM sizes, and view checks are recorded in [deployment evidence](results/deploy-20261111.json) and [verified links](docs/VERIFIED.md). The verified DAO payout is recorded in [DAO evidence](results/demo-dao-20261111220608.json).

The WSL2 Ubuntu gate passes Rust formatting, clippy with warnings denied, workspace tests, sandbox tests, and release WASM builds; the checks are defined in [CI](.github/workflows/ci.yml). The SDK tests cover NEP-413 derivation, registry and router actions, scanning, spending, view-key export, relinking warnings, V3 vectors, and malformed inputs; [14 tests pass](packages/sdk/test).

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

Run `pnpm --dir apps/web build` locally to validate the static build. The Vercel project is named `veil`, uses `apps/web`, and is deployed at [veil-eta-khaki.vercel.app](https://veil-eta-khaki.vercel.app). `veil.vercel.app` was unavailable to this account, so Vercel assigned its unique production alias. The build uses `VEIL_NETWORK=testnet`, `VEIL_RPC_URL=https://rpc.testnet.fastnear.com`, `VEIL_REGISTRY_ID=registry2.veil-williams.testnet`, and `VEIL_ROUTER_ID=router2.veil-williams.testnet`; no private keys are configured.

Run the scripted testnet demo with process-only key variables:

```powershell
$env:VEIL_ALICE_PRIVATE_KEY = "ed25519:..."
$env:VEIL_SENDER1_PRIVATE_KEY = "ed25519:..."
$env:VEIL_SENDER2_PRIVATE_KEY = "ed25519:..."
$env:VEIL_SENDER3_PRIVATE_KEY = "ed25519:..."
pnpm demo:all
```

The demo writes `results/demo-<timestamp>.json`. The committed run registered Alice, sent three private payments, scanned all three, and spent one; its NearBlocks links are in [verified evidence](docs/VERIFIED.md). The committed DAO run also created a sole-council Sputnik DAO, approved a private router payout, and verified the recipient scan in [DAO evidence](results/demo-dao-20261111220608.json).

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
