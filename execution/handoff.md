# Veil handoff

Updated 2026-11-11 06:30 UTC. Approximately 89 hours remain until the 2026-11-14 23:59 UTC deadline.

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
- Fresh deployment completed: `registry2.veil-williams.testnet` and `router2.veil-williams.testnet` were created under `veil-williams.testnet`, funded, deployed, initialized, and view-verified. Evidence: `results/deploy-20261111.json`.
- Vercel project `veil` is deployed at `https://veil-eta-khaki.vercel.app` and returned HTTP 200 with title `Veil | Private receiving for NEAR`. The exact `veil.vercel.app` hostname was unavailable to the account.
- Fresh `pnpm demo:all` completed against registry2/router2 with status `PASS_WITH_DAO_PREREQUISITE`: register passed, three private sends passed, scan found 3, and spend passed. Evidence: `results/demo-20261111221900.json`. DAO payout is separately verified in `results/demo-dao-20261111220608.json`.

## Exact next action

The scripted testnet demo is complete in `results/demo-20261110085124.json` against the prior deployment. The fresh deployment is separately verified in `results/deploy-20261111.json`; the DAO payout passed in `results/demo-dao-20261111220608.json`. R1/R2 research is complete in `research/01-prior-art.md` and `research/02-problem-evidence.md`.

## Blockers

- Host-side Rust verification is complete in WSL2 Ubuntu; the Windows GNU native linker remains unsupported for sandbox tests.
- The initial DAO attempt was blocked by unavailable signer/funds, but the later retry passed after the key was available and the signer input was normalized. Evidence: `results/demo-dao-20261111220608.json`.
- A fresh `registry2.veil-williams.testnet` account attempt was rejected by the faucet flow because the available signer was interpreted as `testnet`; no fresh deployment was made. The verified contracts remain `registry.veil-williams.testnet` and `router.veil-williams.testnet`.
- Current verified contracts are `registry2.veil-williams.testnet` and `router2.veil-williams.testnet`; DAO verification is complete.

## Resume command

The project has fresh deployed contracts, a live Vercel app, fresh end-to-end demo evidence, and code/evidence submission readiness. Remaining human-only actions are to verify the hosted wallet flow, record the video, post X, and submit the form. Mainnet remains untouched.
