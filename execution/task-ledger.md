# Veil execution ledger

Last updated: 2026-11-09 05:39 UTC

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
| R4 | Practical flow and cost verification | complete | FT storage bound corrected to `0.00125 NEAR`; fresh-account sweep proves `0.04 NEAR` as the minimum successful tested stipend; announcement storage is `191 bytes` / `0.00191 NEAR` |
| GATE-R | Choose scheme and record proof transaction | complete | `docs/VERIFIED.md`; `results/gate-r-20261108224016.json` |
| P1 | Scaffold SDK and tests | in progress | Crypto core exists; V1, V2, V3, V5 pass; V4 contract integration remains |
| P2 | Registry and router contracts | in progress | Deployed to testnet; wasm check passes; host/sandbox and FT tests pending |
| P3 | Web demo | pending | Must follow SDK and contract interfaces |

## Decisions needed from human

- Optional testnet account names, for example `veil-<name>.testnet`.
- Whether a 1Click JWT and a mainnet payout account are available.

## Hours remaining

At 2026-11-09 05:39 UTC: approximately 138.32 hours remain until 2026-11-14 23:59 UTC. Recalculate at the start of each work session.
