# Verified facts and evidence

Only facts backed by a source or a real executed test belong here. Simulated results must be labelled `SIMULATED` elsewhere.

## 2026-11-08

- **VERIFIED:** The supplied brief requires research before product code and requires testnet proof of spending from a derived stealth account. Source: `VEIL-BRIEF.md`.
- **VERIFIED:** ERC-5564 specifies stealth meta-addresses, announcements, view tags, and separate viewing/spending capabilities. Source: https://eips.ethereum.org/EIPS/eip-5564
- **VERIFIED:** ERC-6538 specifies a stealth meta-address registry. Source: https://eips.ethereum.org/EIPS/eip-6538
- **VERIFIED:** Local toolchain check found Node 25.8.1, pnpm 10.32.1, Rust 1.99.1, cargo-near 0.22.0, and near-cli-rs 0.31.1. Rust tests are run in WSL2 Ubuntu/CI because the Windows GNU linker is not supported for the sandbox dependency.
- **VERIFIED:** `pnpm typecheck`, `pnpm test`, and the standalone 10,000-send V1 property proof pass for the SDK prototype. See `verification/test-report.md`.

## Gate R: 2026-11-08

- **VERIFIED:** Testnet account `veil-williams.testnet` was created through the faucet. Creation transaction: https://testnet.nearblocks.io/txns/3gikbmGdG6BDKVfMPKuH4UxH2Us9y2jkzGDkwtUTDo7m
- **VERIFIED:** `scripts/gate-r-proof.ts` derived stealth implicit account `c33b272aab306099fd707466554ff15d6d8d854bb09ce0cf1916f9b9b1477b7f`.
- **VERIFIED:** `sender1.veil-williams.testnet` funded that stealth account with `0.05 NEAR`. Transaction: https://testnet.nearblocks.io/txns/73thst1ZRW2GUXnqDuPrLAjRcH8Zm4UoJPnUHocSXgA
- **VERIFIED:** The stealth account sent `0.01 NEAR` back to `sender1.veil-williams.testnet` using the custom near-api-js raw-scalar signer. Transaction: https://testnet.nearblocks.io/txns/6avEHsr11CVDCobn67CJMwqXhfzxoRWx5rfWyQJQzEAF
- **VERIFIED:** The spend transaction used the stealth account public key and the nonce returned by `view_access_key`; NEAR executed it successfully.
- Evidence output: `results/gate-r-20261108224016.json`.

## Contract deployment: 2026-11-08

- **VERIFIED:** `veil-registry` release WASM built for `wasm32-unknown-unknown` and deployed/initialized at `registry.veil-williams.testnet`. Transaction: https://testnet.nearblocks.io/txns/CSWjocpzb4UkcxLqpPAkTFrC7UcEeLBMnkRKFt4RHBUy
- **VERIFIED:** `veil-router` release WASM built for `wasm32-unknown-unknown` and deployed/initialized at `router.veil-williams.testnet`. Transaction: https://testnet.nearblocks.io/txns/Dubffp7Ev7BXQ8RcTaoXhM2GVVeqRQ94SigXHLTjNCpi
- **VERIFIED:** `router.total_announcements()` returned `0` from the deployed contract.
- **VERIFIED:** The owner funded the contract accounts with testnet NEAR. Registry transfers: https://testnet.nearblocks.io/txns/u9ZeW3hYGeA1M1FLwENDnbsEr746EJkMFtPJeEAn4Wu and https://testnet.nearblocks.io/txns/EmZVhh76HpwPhXfezS3soL44dqeX9Q9VvPJTH5jGkPJv. Router transfers: https://testnet.nearblocks.io/txns/AsgvYT7GWTT9M1v3YMvvscHcQkUyCHQXe9yhTD2zSs69 and https://testnet.nearblocks.io/txns/5foKaHp6smgRpkaNmLsGh4Zf2oUCxku7525gUi9AWJvv.

## FT and announcement measurements: 2026-11-09

- **VERIFIED:** Six-decimal mock FT `mockft.veil-williams.testnet` was deployed and initialized. Transaction: https://testnet.nearblocks.io/txns/EbkhtkRzDbHuKn97ZWCBAAvwtZjcMU7vusZPhTB5v7bs
- **VERIFIED:** `storage_balance_bounds` returned `1250000000000000000000` yoctoNEAR, which is `0.00125 NEAR` (`1 NEAR = 10^24 yoctoNEAR`) for one FT account. The earlier `1.25 NEAR` wording was a unit-conversion error.
- **VERIFIED:** The Gate R stealth account was registered on the mock FT with an attached `0.00125 NEAR` minimum storage deposit. Transaction: https://testnet.nearblocks.io/txns/3sCaNhjmCuP5BpdsPoVmTtXnCnQAXcGg9FCRVM7c3spH
- **VERIFIED:** The stealth account transferred one atomic vUSD unit to `sender1` using the raw-scalar signer. Transaction: https://testnet.nearblocks.io/txns/AErSVsRbuiJs8YThhrFGxJSFFG1g6vnNkAZ8jgVYwryJ
- **VERIFIED:** Observed FT transfer cost was `31,282,787,150` gas units and `0.00003128278715 NEAR` burned. Evidence: `results/ft-spend-20261109051130.json`.
- **VERIFIED:** The router announcement path stored two announcements. An exact RPC storage delta across the second announcement was `191 bytes`; at `10^19 yoctoNEAR/byte`, that is `0.00191 NEAR` per announcement. Announcement transactions: https://testnet.nearblocks.io/txns/BbckmJhcWPwsXWsZpUoSzP3V31mCYiHLX2PM9cCB1NxD and https://testnet.nearblocks.io/txns/6z2Hhf61KqoqYgeXBCXj4dx1bw1qFSBCbzAYPXgJSYLD
- **VERIFIED:** The initial sweep tested `0.01`, `0.02`, `0.04`, and `0.08 NEAR`; its evidence remains in `results/stipend-sweep-20261109053830.json`.
- **VERIFIED:** A fresh-account fine sweep tested `0.03090`, `0.03091`, `0.03092`, `0.03093`, `0.03095`, and `0.03100 NEAR`, with a new derivation salt and the exact `0.00125 NEAR` FT storage deposit per account. Evidence: `results/stipend-sweep-20261110080747.json`.
- **VERIFIED:** `0.03090` and `0.03091 NEAR` failed with `NotEnoughBalanceError`; the RPC required `30919537863328000000001` yoctoNEAR (`0.030919537863328 NEAR`). `0.03092 NEAR` and above succeeded. The lowest reliable tested stipend is therefore `0.03092 NEAR`, with a `0.000000462136672 NEAR` tested margin above the reported requirement.
- **VERIFIED:** Each fresh implicit account used `182` bytes, a nominal account storage footprint of `0.00182 NEAR` at `10^19 yoctoNEAR/byte`. That footprint is not the FT transfer fee: the sender separately funds the mock FT registration at `0.00125 NEAR`; the stealth account needs the stipend primarily to satisfy the transaction's temporary 30-Tgas balance requirement. The successful FT spend burned `312637136640` gas units (`0.000031263713664 NEAR`), while the preflight balance requirement was `0.030919537863328 NEAR`.
- **VERIFIED:** Successful fine-sweep spend-back transactions: https://testnet.nearblocks.io/txns/69b7ybKWdQLNnaDGBZYnwS2KY8hLKYjdCmCUri6wyauR, https://testnet.nearblocks.io/txns/5xr3yjZewGUyMNncc1MhtExBCVNRrUbJuWH9QZ8rNjvZ, https://testnet.nearblocks.io/txns/AXuLnS3kbcop7YHJQjVkXiMSchUW5qDk6FgGH7j5d1is, and https://testnet.nearblocks.io/txns/DcYoHmxopHTj4Lp6t9WqndbRzRqStXDarSx5CFpybKLw.

## Measurement interpretation

- The mock FT `storage_deposit` cost is `0.00125 NEAR` per registered account, from `storage_balance_bounds` and the successful registration transaction above.
- The router announcement storage delta was `191 bytes`, or `0.00191 NEAR` at `10^19 yoctoNEAR/byte`, across the second announcement.
