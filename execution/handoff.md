# Veil handoff

Updated 2026-11-09 06:25 UTC. Approximately 137.56 hours remain until the 2026-11-14 23:59 UTC deadline.

## Current state

The repository contains the research-first scaffolding and a working TypeScript crypto prototype in `packages/sdk`.

## Last completed action

`pnpm typecheck` and `pnpm test` both pass on 2026-11-08. Gate R also passed on testnet; see `docs/VERIFIED.md` and `results/gate-r-20261108224016.json`.

## Completed this milestone

- Corrected the six-decimal mock FT storage bound to `1250000000000000000000` yoctoNEAR = `0.00125 NEAR`.
- Added and ran `scripts/stipend-sweep.ts` with fresh implicit accounts at `0.01`, `0.02`, `0.04`, and `0.08 NEAR`.
- The minimum successful tested stipend is `0.04 NEAR`; the two lower candidates failed with exact `NotEnoughBalanceError` responses. Evidence: `results/stipend-sweep-20261109053830.json`.
- Converted evidence links in the verification documents and scripts to `testnet.nearblocks.io`.
- Added `.github/workflows/ci.yml`, `near-workspaces 0.24.0`, and `contracts/router/tests/sandbox_round.rs`.
- WSL2 Ubuntu results: router unit tests `2 passed`; router sandbox test `1 passed`.

## Exact next action

The registry and router contracts are implemented and deployed to `registry.veil-williams.testnet` and `router.veil-williams.testnet`. The Ubuntu router unit and sandbox tests pass. The full Rust gate is half-finished: it was stopped during clippy dependency checking before final clippy, workspace tests, and WASM build results.

## Blockers

- Full clippy/workspace/WASM verification is open because the pause interrupted it during clippy. Host-side Rust tests must run in WSL2 Ubuntu or GitHub Actions; the Windows GNU native linker is not an accepted test environment.

## Resume command

`cd contracts && cargo fmt --all -- --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace && rustup target add wasm32-unknown-unknown && cargo build --workspace --target wasm32-unknown-unknown --release`

After that gate, add V4 router tests for NEAR/FT/refund/pagination, then continue SDK flows and V3/V5 vectors. The web app, demo, NEP draft, README/video plan, submission JSON/X draft, and `hackathon-submission` tag are not started.
