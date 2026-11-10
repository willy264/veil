# Veil handoff

Updated 2026-11-10 08:12 UTC. Approximately 111.79 hours remain until the 2026-11-14 23:59 UTC deadline.

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
- WSL2 Ubuntu full gate now passes: fmt, clippy with `-D warnings`, workspace tests, sandbox test, and release WASM build for registry, router, and mock FT.
- V4 router coverage now passes: 6 unit tests plus 1 sandbox test covering NEAR, FT, failed-transfer refund, malformed FT refund, and pagination.
- Fine stipend sweep now passes with `0.03092 NEAR` as the lowest tested success. `0.03090` and `0.03091` fail against the exact `0.030919537863328 NEAR` preflight requirement. Each account uses 182 bytes (`0.00182 NEAR` nominal storage footprint); actual FT spend burn is `0.000031263713664 NEAR`.
- SDK flows are implemented in `packages/sdk/src/sdk.ts` and exported from `packages/sdk/src/index.ts`; `pnpm typecheck` and `pnpm test` pass with 10 tests.

## Exact next action

The registry and router contracts are implemented and deployed to `registry.veil-williams.testnet`. The full Ubuntu Rust gate and V4 behavior coverage pass.

## Blockers

- Host-side Rust verification is complete in WSL2 Ubuntu; the Windows GNU native linker remains unsupported for sandbox tests.

## Resume command

Next: add committed V3/V5 vectors, malformed meta-address/input tests, wrong-key tests, and explicit view-key-no-spend tests.

After that gate, add V4 router tests for NEAR/FT/refund/pagination, then continue SDK flows and V3/V5 vectors. The web app, demo, NEP draft, README/video plan, submission JSON/X draft, and `hackathon-submission` tag are not started.
