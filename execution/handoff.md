# Veil handoff

## Current state

The repository contains the research-first scaffolding and a working TypeScript crypto prototype in `packages/sdk`.

## Last completed action

`pnpm typecheck` and `pnpm test` both pass on 2026-11-08. Gate R also passed on testnet; see `docs/VERIFIED.md` and `results/gate-r-20261108224016.json`.

## Exact next action

The registry and router contracts are implemented, pass formatting plus wasm-target checking, and are deployed to `registry.veil-williams.testnet` and `router.veil-williams.testnet`. The six-decimal mock FT is also deployed; storage and announcement measurements are recorded in `docs/VERIFIED.md`. Next, finish the fresh-account stipend sweep and sandbox tests, then implement SDK registration/send/scan/spend flows.

## Blockers

- FT storage and announcement measurements remain outstanding.
- The FT transfer burn is measured, but the minimum stipend threshold has not yet been swept with fresh accounts.
- Host-side Rust tests are currently blocked by the Windows GNU native linker/toolchain and a separate `sandbox_round` Cargo process holding the package lock.
