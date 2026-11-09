# Veil handoff

Updated 2026-11-09 05:39 UTC. Approximately 138.32 hours remain until the 2026-11-14 23:59 UTC deadline.

## Current state

The repository contains the research-first scaffolding and a working TypeScript crypto prototype in `packages/sdk`.

## Last completed action

`pnpm typecheck` and `pnpm test` both pass on 2026-11-08. Gate R also passed on testnet; see `docs/VERIFIED.md` and `results/gate-r-20261108224016.json`.

## Completed this milestone

- Corrected the six-decimal mock FT storage bound to `1250000000000000000000` yoctoNEAR = `0.00125 NEAR`.
- Added and ran `scripts/stipend-sweep.ts` with fresh implicit accounts at `0.01`, `0.02`, `0.04`, and `0.08 NEAR`.
- The minimum successful tested stipend is `0.04 NEAR`; the two lower candidates failed with exact `NotEnoughBalanceError` responses. Evidence: `results/stipend-sweep-20261109053830.json`.
- Converted evidence links in the verification documents and scripts to `testnet.nearblocks.io`.

## Exact next action

The registry and router contracts are implemented, pass formatting plus wasm-target checking, and are deployed to `registry.veil-williams.testnet` and `router.veil-williams.testnet`. Next, finish the Ubuntu sandbox tests, then implement SDK registration/send/scan/spend flows.

## Blockers

- Host-side Rust tests must run in WSL2 Ubuntu or GitHub Actions; the Windows GNU native linker is not an accepted test environment.
