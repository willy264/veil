# Veil handoff

Active UI polish, 13 Nov 2026 19:02 UTC: Receive/Send steppers, live proof panel, NEAR balances, plain states, receipts and separate inbox/auditor sections are implemented. Existing palette/font tokens are preserved. Build, typecheck and 24 tests pass. First browser QA pass has no failures; screenshots at 1440/390 reviewed. See `results/ui-polish/first-pass/results.json`. Follow-up covers both tabs and keyboard interaction before deployment. Frontend stop is 14 Nov 10:00 UTC, about 15 hours away.

The user has authorized scripted test signing with `veil-demo-recv.testnet` and `veil-demo-send.testnet`. Both keys passed FullAccess verification and both balances were 10 NEAR. The Node-only runner loaded the keys into ignored `.env`, never into Chromium or logs. See `results/hosted-wallet-20261113T190029570Z.json` (preflight only). Do not request wallet credentials again. Fastnear returned HTTP 429; frontend commit `2237b61` now uses the official `https://rpc.testnet.near.org` and is live on the production alias. No new transaction has been submitted yet.

Exact next action: finish both-tab/keyboard QA and performance follow-up, then run `node apps/web/demo-hosted.mjs --execute` on the hosted URL. Review public evidence and edit the recorded clips into a 1:50–2:00 narrated demo. README/video must say **scripted test signer, not a browser wallet**. Update current screenshots, submission, evidence and this handoff; verify CI, re-tag and push. The older video below is historical and must be replaced for this UI.

Performance follow-up: first mobile Lighthouse run scored performance 57 / accessibility 100 / SEO 100 / CLS 0. Wallet and transaction imports are now deferred to their actions, and a green V favicon fixes the missing-icon request. All 24 tests still pass. The both-path QA repeat and a fresh production Lighthouse run are required before recording. First Lighthouse evidence is retained as a baseline, not a passing performance claim.

Updated 2026-11-12 23:44 UTC. About 48.3 hours remain until 14 Nov 23:59 UTC.

## Narrated video recreation

The recreated video is `results/veil-demo-green-ui.mp4`: 117 seconds, 1080p, synthetic Hazel voiceover, sentence-timed captions and nine scenes. See [delivery notes](../docs/NARRATED-TOUR.md), [media verification](../results/narrated-tour-video.json), [timing](../results/narrated-tour-timing.json), and [captions](../results/veil-demo-green-ui.srt). Captions cover the complete narration; speech is not truncated. Live signing keys are absent in this agent session, so the recording uses current public UI plus explicitly dated prior testnet evidence. Clipdio requires email sign-in/download submission, so no Clipdio account or email was submitted. The local MP4 was assembled with Playwright, System.Speech and FFmpeg. Raw clips and audio are preserved locally under `results/video-assets/green-ui/`; large media is Git-ignored.

## Design restored at the user's request

The trading-style redesign was reverted to the previous green fintech design from `ebfd14f`. The web files, wallet behavior, tests, design notes and recording instructions again match that version. The prior redesign remains in Git history. The local narration has been regenerated to match the restored Spend control. Continue from this design unless the user requests another change.

Rollback commit `7ff421b` is pushed and live. Build, typecheck and 21 tests pass; a fresh [public browser check](../results/hosted-check-1794472250465.json) confirms the six panels, wallet chooser and live registry/router reads without login or runtime errors. [Rollback CI](https://github.com/willy264/veil/actions/runs/43183430706). Actual wallet approvals remain outside this read-only check.

## Verified state

- Public app: https://veil-eta-khaki.vercel.app. Fresh anonymous browser access to root/index aliases/assets, six panels and wallet chooser passes. Live Alice registry resolution and router announcement reads pass with no page errors. [Hosted evidence](../results/hosted-check-1794466492403.json).
- Vercel project `veil` uses repository root `.`; root `vercel.json` now builds/serves `apps/web`. The production alias is public. Generated Vercel deployment aliases may still require login; use the production URL.
- Active testnet contracts: `registry2.veil-williams.testnet` and `router2.veil-williams.testnet`. [Deployment](../results/deploy-20261111.json).
- Registration, three private sends, scan finding three and one spend: [fresh demo](../results/demo-20261111221900.json). Separate [DAO PASS](../results/demo-dao-20261111220608.json) covers its DAO prerequisite field.
- Gate R, FT storage of 0.00125 NEAR, and lowest tested FT stipend of 0.03092 NEAR: [measurements](../docs/VERIFIED.md).
- Web fixes: integer registration deposit, repeatable derivation with the same wallet signing key, nonzero announcement indices, pagination, auditor scan/export, point validation, spend warning/receipt and visible RPC failures.
- CI at fce35d5 is [green](https://github.com/willy264/veil/actions/runs/43171196000): Rust/sandbox/WASM, 21 tests, 10,000-send property test and web build. Seven web tests simulate wallet/RPC responses and are not new testnet receipts.
- Research, NEP, README, X and submission drafts exist. README/submission now distinguish verified public access from pending hosted wallet approvals.

## Recording package

The completed current-UI tour uses `docs/narrated-tour-scenes.json` and `results/video-assets/green-ui/voiceover-final.wav`. The [wallet shot list](../docs/VIDEO-PLAN.md) and [wallet script](../docs/VIDEO-SCRIPT.md) remain a separate plan for genuine signed-in footage. The old `results/veil-demo.mp4` is superseded and must not be submitted.

## Exact next action

Human: review `results/veil-demo-green-ui.mp4`, then authorize or perform the public upload and put its URL into `submission.json`. The video is complete locally. Real hosted wallet approvals are still unverified in this session. To add signed-in footage, follow the separate wallet shot list with funded recipient/sender profiles and an unsigned auditor context. Do not overwrite the scripted Alice identity or expose signing material.

Agent can rerun the read-only check with `node scripts/check-hosted.mjs https://veil-eta-khaki.vercel.app`; install Playwright or set `VEIL_PLAYWRIGHT_MODULE` to its installed module path.

## Remaining limits

- Public access and live reads are verified. Actual hosted wallet approvals need a human browser session; this agent has no signed-in wallet or demo signer environment variables.
- V1 sends must be sequential: concurrent submissions can change the expected router index and prevent normal discovery. Wallet recovery requires the same signing key; older random-nonce registrations may not be recoverable through this flow.
- The current Spend button sends 0.001 NEAR to the connected named account and warns that the link becomes public.
- Seven dependency alerts remain documented in [DEPENDABOT.md](../docs/DEPENDABOT.md), per instruction.
- Public video upload, X publication and form submission are pending. Optional replacement footage requires a signed-in wallet session. Mainnet is not authorized. Commit/push/tag updates are authorized.

The previous hosting, faucet, DAO-funding and fresh-contract blockers are resolved. Do not report them as outstanding.
