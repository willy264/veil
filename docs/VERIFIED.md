# Verified facts and evidence

Only facts backed by a source or a real executed test belong here. Simulated results must be labelled `SIMULATED` elsewhere.

## 2026-11-08

- **VERIFIED:** The supplied brief requires research before product code and requires testnet proof of spending from a derived stealth account. Source: `VEIL-BRIEF.md`.
- **VERIFIED:** ERC-5564 specifies stealth meta-addresses, announcements, view tags, and separate viewing/spending capabilities. Source: https://eips.ethereum.org/EIPS/eip-5564
- **VERIFIED:** ERC-6538 specifies a stealth meta-address registry. Source: https://eips.ethereum.org/EIPS/eip-6538
- **VERIFIED:** Local toolchain check found Node 25.8.1, pnpm 10.32.1, Rust 1.99.1, cargo-near 0.22.0; `near` CLI was unavailable.
- **VERIFIED:** `pnpm typecheck` and `pnpm test` pass for the SDK prototype; 3 tests cover ownership recovery, unrelated-payment rejection, and standard Ed25519 verification from a raw scalar. See `verification/test-report.md`.

## Gate R: 2026-11-08

- **VERIFIED:** Testnet account `veil-williams.testnet` was created through the faucet. Creation transaction: https://explorer.testnet.near.org/transactions/3gikbmGdG6BDKVfMPKuH4UxH2Us9y2jkzGDkwtUTDo7m
- **VERIFIED:** `scripts/gate-r-proof.ts` derived stealth implicit account `c33b272aab306099fd707466554ff15d6d8d854bb09ce0cf1916f9b9b1477b7f`.
- **VERIFIED:** `sender1.veil-williams.testnet` funded that stealth account with `0.05 NEAR`. Transaction: https://explorer.testnet.near.org/transactions/73thst1ZRW2GUXnqDuPrLAjRcH8Zm4UoJPnUHocSXgA
- **VERIFIED:** The stealth account sent `0.01 NEAR` back to `sender1.veil-williams.testnet` using the custom near-api-js raw-scalar signer. Transaction: https://explorer.testnet.near.org/transactions/6avEHsr11CVDCobn67CJMwqXhfzxoRWx5rfWyQJQzEAF
- **VERIFIED:** The spend transaction used the stealth account public key and the nonce returned by `view_access_key`; NEAR executed it successfully.
- Evidence output: `results/gate-r-20261108224016.json`.

## Contract deployment: 2026-11-08

- **VERIFIED:** `veil-registry` release WASM built for `wasm32-unknown-unknown` and deployed/initialized at `registry.veil-williams.testnet`. Transaction: https://explorer.testnet.near.org/transactions/CSWjocpzb4UkcxLqpPAkTFrC7UcEeLBMnkRKFt4RHBUy
- **VERIFIED:** `veil-router` release WASM built for `wasm32-unknown-unknown` and deployed/initialized at `router.veil-williams.testnet`. Transaction: https://explorer.testnet.near.org/transactions/Dubffp7Ev7BXQ8RcTaoXhM2GVVeqRQ94SigXHLTjNCpi
- **VERIFIED:** `router.total_announcements()` returned `0` from the deployed contract.
- **VERIFIED:** The owner funded the contract accounts with testnet NEAR. Registry transfers: https://explorer.testnet.near.org/transactions/u9ZeW3hYGeA1M1FLwENDnbsEr746EJkMFtPJeEAn4Wu and https://explorer.testnet.near.org/transactions/EmZVhh76HpwPhXfezS3soL44dqeX9Q9VvPJTH5jGkPJv. Router transfers: https://explorer.testnet.near.org/transactions/AsgvYT7GWTT9M1v3YMvvscHcQkUyCHQXe9yhTD2zSs69 and https://explorer.testnet.near.org/transactions/5foKaHp6smgRpkaNmLsGh4Zf2oUCxku7525gUi9AWJvv.

## FT and announcement measurements: 2026-11-09

- **VERIFIED:** Six-decimal mock FT `mockft.veil-williams.testnet` was deployed and initialized. Transaction: https://explorer.testnet.near.org/transactions/EbkhtkRzDbHuKn97ZWCBAAvwtZjcMU7vusZPhTB5v7bs
- **VERIFIED:** `storage_balance_bounds` returned `1.25 NEAR` (`1250000000000000000000` yoctoNEAR) for one FT account.
- **VERIFIED:** The Gate R stealth account was registered on the mock FT with the 1.25 NEAR storage deposit. Transaction: https://explorer.testnet.near.org/transactions/3sCaNhjmCuP5BpdsPoVmTtXnCnQAXcGg9FCRVM7c3spH
- **VERIFIED:** The stealth account transferred one atomic vUSD unit to `sender1` using the raw-scalar signer. Transaction: https://explorer.testnet.near.org/transactions/AErSVsRbuiJs8YThhrFGxJSFFG1g6vnNkAZ8jgVYwryJ
- **VERIFIED:** Observed FT transfer cost was `31,282,787,150` gas units and `0.00003128278715 NEAR` burned. Evidence: `results/ft-spend-20261109051130.json`.
- **VERIFIED:** The router announcement path stored two announcements. An exact RPC storage delta across the second announcement was `191 bytes`; at `10^19 yoctoNEAR/byte`, that is `0.00191 NEAR` per announcement. Announcement transactions: https://explorer.testnet.near.org/transactions/BbckmJhcWPwsXWsZpUoSzP3V31mCYiHLX2PM9cCB1NxD and https://explorer.testnet.near.org/transactions/6z2Hhf61KqoqYgeXBCXj4dx1bw1qFSBCbzAYPXgJSYLD
- **PENDING:** The exact minimum NEAR stipend still needs a fresh-account threshold sweep; the current result is an observed successful FT-transfer burn, not a minimum claim.

## Measurements pending

- Minimum stipend for one FT transfer from a stealth account.
- Mock six-decimal FT `storage_deposit` cost.
- Per-announcement storage cost.

## Testnet evidence

No live transaction evidence has been produced yet.
