# Veil execution ledger

Last updated: 2026-11-10 09:58 UTC

## Context

- Deadline: 2026-11-14 23:59 UTC.
- Baseline checked: Node 25.8.1, pnpm 10.32.1, Rust 1.99.1, cargo-near 0.22.0.
- `near-cli-rs` 0.31.1 is installed. Rust/sandbox execution is assigned to WSL2 Ubuntu/Ubuntu CI because Windows GNU cannot link the sandbox dependency.
- Testnet accounts, a 1Click JWT, and a mainnet payout account are not configured.

## Work queue

| ID | Task | Status | Evidence / blocker |
|---|---|---|---|
| R0 | Read brief and common rules | done | Source files read on 2026-11-08 |
| R1 | Prior-art research | in progress | `research/01-prior-art.md` |
| R2 | Problem evidence | pending | Use public DAO/foundation accounts only |
| R3 | Cryptography design and scalar-sign proof | complete | Local proof plus confirmed testnet spend |
| R4 | Practical flow and cost verification | complete | FT storage bound `0.00125 NEAR`; fine fresh-account sweep proves `0.03092 NEAR` as the lowest reliable tested stipend; account footprint `182 bytes` / `0.00182 NEAR`; announcement storage `191 bytes` / `0.00191 NEAR` |
| GATE-R | Choose scheme and record proof transaction | complete | `docs/VERIFIED.md`; `results/gate-r-20261108224016.json` |
| P1 | Scaffold SDK and tests | complete | SDK flows plus committed V3/V5 vectors and malformed-input tests pass; 14 SDK tests total |
| P2 | Registry and router contracts | complete | WSL2 Ubuntu clippy, workspace tests, sandbox test, and `wasm32-unknown-unknown --release` build pass; V4 router unit/sandbox coverage committed |
| P3 | Web demo | complete | Static web app reads the deployed registry/router through final testnet RPC; demo evidence passes register, 3 private sends, scan=3, and one spend. DAO payout remains an authority prerequisite. |
| P4 | Submission package | complete | NEP draft, README, video plan, X draft, submission JSON, and NearBlocks evidence committed. |

## Decisions needed from human

- Optional testnet account names, for example `veil-<name>.testnet`.
- Whether a 1Click JWT and a mainnet payout account are available.

## Hours remaining

At 2026-11-10 09:56 UTC: approximately 110.00 hours remain until 2026-11-14 23:59 UTC. Recalculate at the start of each work session.

## Completed since prior checkpoint

- Demo script corrected for near-api-js 7 `callFunction`, output-index binding, yocto conversion, finality polling, fresh faucet-funded demo accounts, and secret-free evidence output.
- Testnet demo passed: Alice registration, three private NEAR sends, scan found 3, and one stealth spend. Sputnik factory probe succeeded; payout was not submitted without DAO authority.

## Next action

Fresh-clone install, typecheck, and 14-test SDK suite pass. Final local tag is the next handoff checkpoint; then hand off video recording, X posting, repository publication, and form submission to the human.

## Pause checkpoint: 2026-11-09 06:25 UTC

- Done: local Git repository initialized on `main`; ignore rules added; initial commit `914bb52`; measurement milestone committed as `cf04dd7`.
- Done: FT storage corrected to `0.00125 NEAR`; fresh-account sweep passes with minimum successful tested stipend `0.04 NEAR`; NearBlocks evidence links are in `docs/VERIFIED.md`.
- Done: router unit tests pass in WSL2 Ubuntu (`2 passed`); router sandbox integration test passes in WSL2 Ubuntu (`1 passed`).
- Done: CI and Ubuntu Rust gate. `.github/workflows/ci.yml` now runs fmt, clippy, workspace tests, WASM build, sandbox test, and TypeScript tests. WSL2 execution completed with all Rust checks passing.
- In progress: `contracts/Cargo.lock` includes `near-workspaces 0.24.0` and its sandbox dependencies; registry/router test contexts were updated for near-sdk 5.30.1.
- Done: V4 router coverage. `cargo test -p veil-router --lib` reports 6 passing tests; the WSL2 sandbox test reports 1 passing test covering native NEAR, FT receipt, malformed refund, and pagination.
- Done: fine fresh-account stipend sweep. `0.03090` and `0.03091` failed; `0.03092` through `0.03100` succeeded. The reported balance requirement is `0.030919537863328 NEAR`; account storage footprint is `182 bytes` / `0.00182 NEAR`; actual FT spend burn is `0.000031263713664 NEAR`.
- Done: SDK flows. `pnpm typecheck` and `pnpm test` pass with 10 tests for NEP-413 derivation, registry actions, NEAR/FT sends, scan, spend, export, and re-link warnings.
- Done: V3/V5 suite. `pnpm typecheck` and `pnpm test` pass with 14 SDK tests, including `verification/v3-v5-vectors.json`.
- Exact next action: build `pnpm demo:all` on testnet, with three private sends, scan, one spend, and the Sputnik DAO payout evidence JSON.
- Not started: V4 router refund/FT/pagination coverage beyond the existing announce pagination test; SDK flows; V3/V5 vectors; demo; web app; NEP draft; README/video plan; submission JSON/X draft; final tag.
