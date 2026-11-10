# Veil

Private receiving for NEAR named accounts. Veil lets `ada.near` publish one reusable identity while senders derive a fresh Ed25519 implicit account for every payment.

## Status

The V1 registry and router contracts are deployed on NEAR testnet:

- Registry: `registry.veil-williams.testnet`
- Router: `router.veil-williams.testnet`
- Mock six-decimal FT: `mockft.veil-williams.testnet`

The WSL2 Ubuntu gate passes Rust formatting, clippy with warnings denied, workspace tests, sandbox tests, and release WASM builds. The SDK tests cover NEP-413 derivation, registry and router actions, scanning, spending, view-key export, relinking warnings, V3 vectors, and malformed inputs.

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

Open `http://127.0.0.1:4173`. It reads the deployed registry and router through final testnet RPC. Wallet signing is intentionally not embedded in the static demo.

Run the scripted testnet demo with process-only key variables:

```powershell
$env:VEIL_ALICE_PRIVATE_KEY = "ed25519:..."
$env:VEIL_SENDER1_PRIVATE_KEY = "ed25519:..."
$env:VEIL_SENDER2_PRIVATE_KEY = "ed25519:..."
$env:VEIL_SENDER3_PRIVATE_KEY = "ed25519:..."
pnpm demo:all
```

The demo writes `results/demo-<timestamp>.json`. The committed run registered Alice, sent three private payments, scanned all three, and spent one; its NearBlocks links are in `docs/VERIFIED.md`.

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

## Honest limits

Amounts, timing, sender identities, and token contracts remain public. Sweeping multiple stealth balances to one destination links them. The demo probes `sputnikv2.testnet`, but does not submit a DAO payout without an existing DAO and proposal authority. The project is testnet-only and has not touched mainnet.
