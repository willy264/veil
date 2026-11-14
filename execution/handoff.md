# Veil handoff

Updated 14 Nov 2026 00:31 UTC. Frontend hard stop: 14 Nov 10:00 UTC (9.5 hours left). Submission deadline: 14 Nov 23:59 UTC (23.5 hours left).

## Completed

- Polished green UI is live at https://veil-eta-khaki.vercel.app. Palette/fonts retained. Public/private proof, Receive/Send steppers, plain states, NEAR balances, receipts, separate inbox/auditor and mobile containment are complete. No contract or SDK protocol change in this polish.
- Real hosted enable/register/send/scan/spend/auditor run passed: results/hosted-wallet-20261113T191343566Z.json. Receiver veil-demo-recv.testnet; sender veil-demo-send.testnet; sent 0.0500 NEAR, spent 0.0010 NEAR. This uses a scripted Node test signer, not browser wallet approvals.
- QA: 44 path/viewport/motion checks, keyboard/error states and no overflow. Production mobile Lighthouse: 98 performance, 100 accessibility/best practices/SEO; LCP 1.59s, CLS 0. Evidence in results/ui-polish/final-pass/results.json and lighthouse-final-mobile.json.
- Final public check: results/hosted-check-1794615996906.json. Anonymous page/assets, chooser, registry2 lookup and five router2 announcements passed.
- New video: results/veil-demo-product.mp4, 117s, 1080p/30fps, synthetic Hazel voice, 236 words, 23 captions. Full decode, sentence timing and agent frame review passed. product-video-{timing,verification,review}.json. DAO scene is separate evidence dated 11 November 2026. Older videos are superseded after this UI change.
- Current screenshots: docs/screenshots/. README, submission, video script/plan and X draft describe the real interface and signer scope.
- Fresh clone at 0a0c70f passed frozen install, typecheck, 24 tests, 10,000-send property check and web build with no credentials copied. results/fresh-clone-20261114.json. Ubuntu CI is green at 0a0c70f: https://github.com/willy264/veil/actions/runs/43533851015. Vercel deployment passed too.
- Existing contracts, Gate R, FT measurements, V1-V5, research, three-sender demo and DAO evidence remain in docs/VERIFIED.md. Prior faucet/owner/hosting blockers are resolved. Seven dependency alerts remain documented as requested.
- Staged diffs and tracked/non-ignored text/evidence checked for credentials. Long Ed25519 values in historical evidence are public transaction signatures. No demo key or seed match found. results/secret-check-20261114.json.

## Release gate

No implementation or recording task remains. The final documentation/evidence commit must pass CI and Vercel before moving and pushing hackathon-submission. The tag points to the final release, and the final chat report records its exact commit and CI run. No mainnet, public video upload, X post or form submission was performed.

## Exact next action after release

Open results/veil-demo-product.mp4 and review the complete narration. The human then uploads the video, places its public URL in submission.json, reviews docs/X-DRAFT.md and submits the hackathon entry. No new testnet transaction is needed. Browser-wallet approval footage is optional and remains unverified; its shot list is docs/VIDEO-PLAN.md.

## Preserve for future work

Raw signed footage and edit audio: results/video-assets/product-polish/20261113T191343566Z/ and results/video-assets/product-polish/edit/. Large media is ignored by Git and must be retained locally. Re-edit with apps/web/render-demo.mjs; never rerun demo-hosted.mjs --execute merely to render a video.

Demo keys are in ignored root .env as explicitly authorized. Never print it, publish it or copy it into Vercel. Use apps/web/demo-hosted.mjs --help before any new recording. Public contract IDs remain registry2.veil-williams.testnet and router2.veil-williams.testnet.

## Honest limits

Testnet only. Amounts, timing and senders remain public. Spending to a named account creates a link. V1 requires sequential sends because derivation uses the next announcement index. Recovery requires the same signing key. No screen-reader user study, browser-extension approval coverage or field performance claim is made. Human video listening/review and publication remain.
