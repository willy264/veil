# Verified facts and evidence

Only facts backed by a source or a real executed test belong here. Simulated results must be labelled `SIMULATED` elsewhere.

## Polished hosted flow: 2026-11-13 / 14

- **VERIFIED:** A fresh clone of `0a0c70f` passed frozen installation, typecheck, 24 tests, the 10,000-send V1 check (256 decoys; zero false negatives/positives) and web build, without copying credentials. [Fresh-clone evidence](../results/fresh-clone-20261114.json). Rust, sandbox and WASM checks pass on [Ubuntu CI](https://github.com/willy264/veil/actions/runs/43533851015).
- **VERIFIED:** The final anonymous hosted check passed page/assets, chooser, registry2 resolution and router2 reads with five announcements. [Read-only evidence](../results/hosted-check-1794615996906.json). The separate signed-flow evidence below covers actual transactions.
- **VERIFIED:** The replacement product video is 117 seconds, 1920×1080/30 fps, with 236 spoken words and 23 complete sentence captions. Full decode, speech timing and caption coverage pass. [Media verification](../results/product-video-verification.json), [narration timing](../results/product-video-timing.json), [agent frame review](../results/product-video-review.json). It uses real hosted signed footage, with the scripted-signer disclosure throughout; the DAO scene is dated separate evidence. Human listening/review and public upload remain.
- **VERIFIED:** No authorized demo key or seed value was found in tracked/non-ignored text and evidence. The 103 long Ed25519 values in historical evidence are public transaction signatures. [Check scope and result](../results/secret-check-20261114.json). The explicitly authorized local `.env` is ignored and excluded from publication.
- **VERIFIED:** The restored green palette/fonts remain. Receive/Send steppers, live public/private comparison, plain states, NEAR balances, receipts and a read-only auditor are live at https://veil-eta-khaki.vercel.app. [QA report](UI-QA-20261114.md).
- **VERIFIED:** Production checks pass 44 path/viewport/motion combinations, keyboard navigation, live resolution, errors, no page errors and no document overflow. [Browser QA](../results/ui-polish/final-pass/results.json).
- **VERIFIED:** Mobile Lighthouse reports 98 performance, 100 accessibility, 100 best practices, 100 SEO, 1.59s LCP and 0 CLS. These are lab measurements. [Report](../results/ui-polish/lighthouse-final-mobile.json).
- **VERIFIED:** The hosted app derived keys from a real NEP-413 signature for `veil-demo-recv.testnet`, registered it, received 0.0500 NEAR from `veil-demo-send.testnet`, found the payment, spent 0.0010 NEAR and found it in an unsigned auditor session. [Complete public evidence](../results/hosted-wallet-20261113T191343566Z.json).
- Registration: [8ojP7xQ2DpLpAXjzyEdo5hmEnMBf8sfsWSMyanpWhSKA](https://testnet.nearblocks.io/txns/8ojP7xQ2DpLpAXjzyEdo5hmEnMBf8sfsWSMyanpWhSKA).
- Private send: [GU7Yg8hhdNDBHNvvxuXomaneKzJmPMBevzfrHjrL9ojz](https://testnet.nearblocks.io/txns/GU7Yg8hhdNDBHNvvxuXomaneKzJmPMBevzfrHjrL9ojz).
- Spend: [CVVXiD2TVSqyY8vGYARKH2XQqmjAasKbMqmdUXCyQZq8](https://testnet.nearblocks.io/txns/CVVXiD2TVSqyY8vGYARKH2XQqmjAasKbMqmdUXCyQZq8).
- Receiving account: [7d86abd76e8d4814aafb42995d8c1e47526e03f1e12b87bd8100786a64c79bb0](https://testnet.nearblocks.io/address/7d86abd76e8d4814aafb42995d8c1e47526e03f1e12b87bd8100786a64c79bb0).
- **SCOPE:** The real signed run used a scripted test signer, not a browser wallet. Only the connector module was replaced in the recording browser; hosted app derivation, scanning, raw-scalar signing and RPC submissions ran for real. No browser-extension approval coverage is claimed. Auditor input stayed masked; private keys were not printed or committed.
- **VERIFIED:** The official `https://rpc.testnet.near.org` endpoint is used after Fastnear returned HTTP 429. Contracts remain registry2/router2. Earlier dated sections below are historical.

## Design rollback: 2026-11-12

- **VERIFIED:** At the user's request, commit `7ff421b` restores the previous green fintech design from `ebfd14f`. Web files and wallet-flow tests match that version. Build, typecheck and all 21 tests pass.
- **VERIFIED:** The public site serves the restored six-panel interface. Anonymous access, assets, wallet chooser, registry2 lookup and router2 reads pass with no runtime errors. [New hosted evidence](../results/hosted-check-1794472250465.json). This check submitted no wallet transactions.

## Hosted app and recording package: 2026-11-12

- **VERIFIED:** https://veil-eta-khaki.vercel.app loads in a fresh anonymous browser, with no Vercel login. Root/index aliases and JavaScript/CSS/config assets return HTTP 200. All six panels render; the near-connect wallet chooser opens. [Browser evidence](../results/hosted-check-1794466492403.json).
- **VERIFIED:** The hosted browser resolves Alice through registry2 and reads four announcements from router2 over testnet RPC, with no page errors. This is read-only verification; it did not approve a wallet transaction.
- **VERIFIED:** CI at fce35d5 passes Rust, sandbox, WASM, 21 tests, the 10,000-send property check and web build. [Run](https://github.com/willy264/veil/actions/runs/43171196000). Seven web tests use simulated wallet/RPC responses; real hosted approvals remain for the human session.
- **VERIFIED:** Generated narration is 117 seconds. Each complete spoken segment fits its scene with at least 0.5 seconds spare; [timing report](../results/video-narration-timing.json). The final wallet footage is not recorded yet. The earlier MP4 is an obsolete draft.
- **LIMIT:** V1 derives against the next router index. Concurrent submissions can change it and prevent normal discovery. Sequential recording is required; the current deployment has no index reservation protocol.

## 2026-11-08

- **VERIFIED:** The supplied brief requires research before product code and requires testnet proof of spending from a derived stealth account. Source: `docs/internal/VEIL-BRIEF.md`.
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

## Fresh contract deployment: 2026-11-11

- **VERIFIED:** `registry2.veil-williams.testnet` was created by `veil-williams.testnet` with 0.1 NEAR initial balance. Creation transaction: https://testnet.nearblocks.io/txns/2WzojzVdrGTtPBHRB1FG86bKxQswGvUzKKLXJ4HbasEA
- **VERIFIED:** `router2.veil-williams.testnet` was created by `veil-williams.testnet` with 0.1 NEAR initial balance. Creation transaction: https://testnet.nearblocks.io/txns/HqzyLWd9y53md74Wd8weX7YgWwpRYkz8RVLTbu7u2xAM
- **VERIFIED:** The owner funded the fresh registry and router accounts with 2.3 and 3.2 NEAR. Registry funding: https://testnet.nearblocks.io/txns/CJRj7GksPP71v5KmpB1XQefJ2MtTbQzdvratNXxKA4VG. Router funding: https://testnet.nearblocks.io/txns/6x82QtMGurV9k5JPjxwucUV2T8KrXYW6VSLX6gS7GG5r
- **VERIFIED:** `veil-registry` WASM (225,233 bytes) was deployed to `registry2.veil-williams.testnet`. Transaction: https://testnet.nearblocks.io/txns/Gb2WV6yiFGQKfuASYPnma3V1mPPrYgGpW99Lcajzt3j1
- **VERIFIED:** `veil-registry` was initialized successfully; `get_meta` returned `null` for an unregistered account. Transaction: https://testnet.nearblocks.io/txns/BodQ7uxwKrzwvcikozHwJNn34cfUmdB3P3oPGHLAgNoq
- **VERIFIED:** `veil-router` WASM (312,040 bytes) was deployed to `router2.veil-williams.testnet`. Transaction: https://testnet.nearblocks.io/txns/BvHS4STvW5C8zimzCHdmQdW68DaNVNrtD75jehgtLrMx
- **VERIFIED:** `veil-router` was initialized successfully; `total_announcements` returned `0`. Transaction: https://testnet.nearblocks.io/txns/86rukk9rutc431c93VTmnt7TyFafLZYUb6kiUPYhJzsZ
- **VERIFIED:** The owner balance after these operations was `14.470371962853741 NEAR`; the DAO payout was executed separately and is documented below.

## Sputnik DAO payout: 2026-11-11

- **VERIFIED:** `veildao4434750196.sputnikv2.testnet` was created through `sputnikv2.testnet` with `veil-williams.testnet` as the sole council. Creation: https://testnet.nearblocks.io/txns/5ZHuDo2n792VicWzMSbP3zx2ZMyqVeKcAkzoGVBkwuWG
- **VERIFIED:** DAO policy confirmed `veil-williams.testnet` as the council. The FunctionCall proposal to `router2.veil-williams.testnet` was added as proposal `0`: https://testnet.nearblocks.io/txns/8vsaYtRBkkPv68wUhuRF5F3yyXRtJJDzVYKCqmzEV14M
- **VERIFIED:** The sole council approved proposal `0`: https://testnet.nearblocks.io/txns/5JQtGN7P2xUM2zMef2QxT9s3eWErPFrWgNkHMVhJBSHP
- **VERIFIED:** The recipient scanner found one owned announcement for stealth account `47fc80fb091df782903007d9b568a40098409d3c93f94b9cc0df7cc903937c10`, amount `0.04 NEAR`. Full secret-free evidence: `results/demo-dao-20261111220608.json`.

## Fresh-contract end-to-end demo: 2026-11-11

- **VERIFIED:** `alice.veil-williams.testnet` registered on `registry2.veil-williams.testnet`: https://testnet.nearblocks.io/txns/EY8L8AHEMQ4n26ZyrXsFUi1uhR4HoW3oBrUAtaFQ9n8d
- **VERIFIED:** Three private sends through `router2.veil-williams.testnet` succeeded: https://testnet.nearblocks.io/txns/AFm3ATfYfq6TYcboWhkjgitHZ9VRmErULUquBXMAeiCw, https://testnet.nearblocks.io/txns/D4KjHNuT945xVQyjDWC9kpMsYudMZwjMdAo4TxoVZFry, and https://testnet.nearblocks.io/txns/Zp7ne1RCZA7uVtgt6p7Yfku727Ni7HqUa4J6dSiQhKW
- **VERIFIED:** Alice's scan found all three owned announcements, and one stealth account spent back to `veil-demo1.testnet`: https://testnet.nearblocks.io/txns/HQMiR2HzAcByzDGKDK6mptaEA69Sjoe9HrAVKQQqQCsN
- **VERIFIED:** Full secret-free evidence is committed in `results/demo-20261111221900.json`. Its DAO field is a prerequisite probe only; the completed DAO payout is documented in `results/demo-dao-20261111220608.json`.
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

## Testnet demo: 2026-11-10

- **VERIFIED:** The scripted demo registered Alice's meta-address, sent three private `0.01 NEAR` payments from fresh faucet-funded demo accounts, scanned and found all three, then spent one stealth output. Evidence: `results/demo-20261110085124.json`.
- Register: https://testnet.nearblocks.io/txns/EACePGCGboNaxyMUFg6yc9FbYeqwDjB7fd57QaMHvjST
- Sends: https://testnet.nearblocks.io/txns/CcP8bbX9aGgogtFrCxdeoZt5oXP8SuvGThryjM9uS9Fy, https://testnet.nearblocks.io/txns/5w1RTyMMG8sakMUhACxop8N1LtnJf4GSCXkujaY6mNCF, https://testnet.nearblocks.io/txns/9Pzghy1VHauxJViZac6MotLezD4uL5WGrDyhRMSLrS1z
- Spend: https://testnet.nearblocks.io/txns/vMbgFyzUb1PnU9eN5pR9cgUsWF1QafS1kXznp2kBQJH

## Narrated current-UI video: 2026-11-12

- The recreated local export is `results/veil-demo-green-ui.mp4`: 117 seconds, 1920×1080 at 30 fps, H.264/AAC, synthetic voiceover and burned-in captions. [Media verification](../results/narrated-tour-video.json) contains its SHA-256 and complete decode result.
- [Narration timing](../results/narrated-tour-timing.json) verifies all nine scenes fit without cutting speech. The [SRT](../results/veil-demo-green-ui.srt) covers the full narration using measured sentence audio durations.
- [Final review](../results/narrated-tour-review.json) records the inspected scene frames and audio levels. Its checksum matches the delivered video; 48 kHz audio peaks at −1.5 dB without clipping.
- Live footage shows the restored green public UI, wallet chooser, public registry resolution, payment form and auditor controls. Dated cards separately show the three-send/scan/spend and DAO evidence from 11 November. The recording submitted no transactions and loaded no signing keys; it is not evidence of hosted wallet approvals.
- [Delivery and reproduction notes](NARRATED-TOUR.md) list the local assets. Public video upload remains pending. Clipdio required email access, so this export was assembled locally.
