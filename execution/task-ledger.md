# Veil execution ledger

Last updated: 2026-11-10 08:12 UTC

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
| P1 | Scaffold SDK and tests | in progress | SDK flows committed and 10 tests pass; dedicated committed V3/V5 vectors and malformed-input suite remains |
| P2 | Registry and router contracts | complete | WSL2 Ubuntu clippy, workspace tests, sandbox test, and `wasm32-unknown-unknown --release` build pass; V4 router unit/sandbox coverage committed |
| P3 | Web demo | pending | Must follow SDK and contract interfaces |

## Decisions needed from human

- Optional testnet account names, for example `veil-<name>.testnet`.
- Whether a 1Click JWT and a mainnet payout account are available.

## Hours remaining

At 2026-11-10 08:12 UTC: approximately 111.79 hours remain until 2026-11-14 23:59 UTC. Recalculate at the start of each work session.

## Pause checkpoint: 2026-11-09 06:25 UTC

- Done: local Git repository initialized on `main`; ignore rules added; initial commit `914bb52`; measurement milestone committed as `cf04dd7`.
- Done: FT storage corrected to `0.00125 NEAR`; fresh-account sweep passes with minimum successful tested stipend `0.04 NEAR`; NearBlocks evidence links are in `docs/VERIFIED.md`.
- Done: router unit tests pass in WSL2 Ubuntu (`2 passed`); router sandbox integration test passes in WSL2 Ubuntu (`1 passed`).
- Done: CI and Ubuntu Rust gate. `.github/workflows/ci.yml` now runs fmt, clippy, workspace tests, WASM build, sandbox test, and TypeScript tests. WSL2 execution completed with all Rust checks passing.
- In progress: `contracts/Cargo.lock` includes `near-workspaces 0.24.0` and its sandbox dependencies; registry/router test contexts were updated for near-sdk 5.30.1.
- Done: V4 router coverage. `cargo test -p veil-router --lib` reports 6 passing tests; the WSL2 sandbox test reports 1 passing test covering native NEAR, FT receipt, malformed refund, and pagination.
- Done: fine fresh-account stipend sweep. `0.03090` and `0.03091` failed; `0.03092` through `0.03100` succeeded. The reported balance requirement is `0.030919537863328 NEAR`; account storage footprint is `182 bytes` / `0.00182 NEAR`; actual FT spend burn is `0.000031263713664 NEAR`.
- Done: SDK flows. `pnpm typecheck` and `pnpm test` pass with 10 tests for NEP-413 derivation, registry actions, NEAR/FT sends, scan, spend, export, and re-link warnings.
- Exact next action: add committed V3/V5 vectors, malformed meta-address/input tests, wrong-key tests, and explicit view-key-no-spend tests.
- Not started: V4 router refund/FT/pagination coverage beyond the existing announce pagination test; SDK flows; V3/V5 vectors; demo; web app; NEP draft; README/video plan; submission JSON/X draft; final tag.
