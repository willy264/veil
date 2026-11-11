# Veil handoff

Updated 2026-11-11 05:30 UTC. Approximately 90 hours remain until the 2026-11-14 23:59 UTC deadline.

## Current state

The repository contains the research-first scaffolding, tested contracts, TypeScript SDK, and a testnet-only wallet-connected web app in `apps/web`.

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
- V3/V5 evidence is committed in `verification/v3-v5-vectors.json`; the SDK test suite now has 14 passing tests, including malformed points, wrong-key rejection, and view-only spend rejection.
- Web UI is committed in `apps/web`: near-connect testnet login, NEP-413 key derivation in memory, registry registration/resolution, private NEAR send, scanner/balance inbox, scalar spend with relink warning, explorer link, and view-only auditor scan. `pnpm --dir apps/web build` passes.
- Cleanup is committed: `veil-kit.zip` removed and `VEIL-BRIEF.md`/`COMMON-RULES.md` moved into `docs/`. `submission.json` points at `https://github.com/willy264/veil`; dependency limitations are documented in `docs/DEPENDABOT.md`.
- Fresh clone on 2026-11-11 passed frozen install, SDK typecheck, 14 tests with one worker, and the web build.

## Exact next action

The scripted testnet demo is complete in `results/demo-20261110085124.json`: register, three private sends, scan found 3, and one stealth spend. R1/R2 research is complete in `research/01-prior-art.md` and `research/02-problem-evidence.md`. The web app and submission documents are complete. The final tag is created only after this handoff commit.

## Blockers

- Host-side Rust verification is complete in WSL2 Ubuntu; the Windows GNU native linker remains unsupported for sandbox tests.
- The one requested sole-council DAO attempt is blocked before submission: `pnpm demo:dao` lacks `VEIL_DAO_OWNER_PRIVATE_KEY`, and `veil-williams.testnet` has only about `0.1847 NEAR` versus the documented 5 NEAR deposit. Evidence: `results/demo-dao-20261110194505.json`. No DAO payout claim remains in the submission materials.
- A fresh `registry2.veil-williams.testnet` account attempt was rejected by the faucet flow because the available signer was interpreted as `testnet`; no fresh deployment was made. The verified contracts remain `registry.veil-williams.testnet` and `router.veil-williams.testnet`.

## Resume command

The project is code-and-evidence submission-ready. The contracts, WSL2 gate, V4 tests, stipend measurements, SDK flows, V3/V5 vectors, testnet demo, wallet UI, Vercel build configuration, NEP draft, research, video plan, X draft, submission JSON, cleanup, and fresh-clone check are complete. Human-only actions remain: deploy Vercel and paste its live URL into README, verify the hosted wallet flow, record the video, post X, make the repository public if needed, and submit the form. Mainnet remains untouched.
