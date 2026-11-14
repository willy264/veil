# Veil handoff

Updated 14 Nov 2026 00:23 UTC. Frontend hard stop: 14 Nov 10:00 UTC (9.6 hours left). Submission deadline: 14 Nov 23:59 UTC (23.6 hours left).

## Completed

- Green design polish is live at https://veil-eta-khaki.vercel.app. Existing palette/fonts retained. Public/private proof, Receive/Send steppers, NEAR balances, plain states, receipts, separate inbox/auditor and disclosures are implemented.
- Implementation commits: `9fb236d`, `2237b61`, `c276341`, `ba1ee0e`. Each pushed. CI at `ba1ee0e` passes: https://github.com/willy264/veil/actions/runs/43490083710.
- Build/typecheck/24 tests pass. Production QA passes 44 combinations of viewport/path/motion, keyboard and validation checks with zero errors. `results/ui-polish/final-pass/results.json`.
- Production mobile Lighthouse: performance 98; accessibility/best practices/SEO 100; LCP 1.59s; CLS 0. `results/ui-polish/lighthouse-final-mobile.json`. Lab evidence only.
- The full signed hosted flow passed with the user-authorized `veil-demo-recv.testnet` and `veil-demo-send.testnet`: enable/register, 0.0500 NEAR send, scan, 0.0010 NEAR spend, unsigned auditor. `results/hosted-wallet-20261113T191343566Z.json`. This uses a scripted Node test signer, not browser wallet approvals. Original app crypto/scan/spend ran in the hosted browser.
- Keys are in ignored root `.env`; never print them or read `.env` into chat. Default `node apps/web/demo-hosted.mjs` is inert. Do not rerun `--execute` just to review evidence: it creates another payment.
- Public screenshots copied to `docs/screenshots/`. Raw video and full captures: `results/video-assets/product-polish/20261113T191343566Z/`.
- Existing contracts, SDK, Gate R, V1–V5, DAO payout and research remain verified. The former faucet/owner/hosting blockers are resolved. Dependencies remain documented in `docs/DEPENDABOT.md`.

## Current state

The new 117-second video is complete: `results/veil-demo-product.mp4` (local and ignored), captions, timing, media verification and agent frame review. It contains real hosted enable/register/send/scan/spend/auditor footage, with a scripted-signer disclosure throughout. The DAO panel is separate verified evidence dated 11 November. Full decode, complete speech and 23 captions pass; human listening/review and upload remain. Preserve `results/video-assets/product-polish/` for re-editing without another transaction.

README, submission and X draft updates are prepared. Final fresh-clone checks, final CI and release tag are next.

## Exact next action

Commit and push the completed media package after staged secret checks. Clone that commit into a clean temporary directory; run frozen install, typecheck, tests, V1 property check and web build. Commit the documentation and verification results, push, wait for green CI and Vercel, then move/push `hackathon-submission`. Do not resend demo payments for verification.

## Limits and human actions

- Scripted signing is verified; browser wallet extension approval screens are not.
- Public video upload, X publication and hackathon form submission require the human. Never publish those autonomously.
- Mainnet is not authorized. Testnet, commits, pushes and submission-tag updates are authorized.
- Sequential sends are required because V1 uses the next announcement index. Recovery requires the same wallet signing key. Spending to a named account reveals that link.
