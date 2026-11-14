# Veil handoff

Updated 14 Nov 2026 00:12 UTC. Frontend hard stop: 14 Nov 10:00 UTC (about 9.8 hours left). Submission deadline: 14 Nov 23:59 UTC (about 23.8 hours left).

## Completed

- Green design polish is live at https://veil-eta-khaki.vercel.app. Existing palette/fonts retained. Public/private proof, Receive/Send steppers, NEAR balances, plain states, receipts, separate inbox/auditor and disclosures are implemented.
- Implementation commits: `9fb236d`, `2237b61`, `c276341`, `ba1ee0e`. Each pushed. CI at `ba1ee0e` passes: https://github.com/willy264/veil/actions/runs/43490083710.
- Build/typecheck/24 tests pass. Production QA passes 44 combinations of viewport/path/motion, keyboard and validation checks with zero errors. `results/ui-polish/final-pass/results.json`.
- Production mobile Lighthouse: performance 98; accessibility/best practices/SEO 100; LCP 1.59s; CLS 0. `results/ui-polish/lighthouse-final-mobile.json`. Lab evidence only.
- The full signed hosted flow passed with the user-authorized `veil-demo-recv.testnet` and `veil-demo-send.testnet`: enable/register, 0.0500 NEAR send, scan, 0.0010 NEAR spend, unsigned auditor. `results/hosted-wallet-20261113T191343566Z.json`. This uses a scripted Node test signer, not browser wallet approvals. Original app crypto/scan/spend ran in the hosted browser.
- Keys are in ignored root `.env`; never print them or read `.env` into chat. Default `node apps/web/demo-hosted.mjs` is inert. Do not rerun `--execute` just to review evidence: it creates another payment.
- Public screenshots copied to `docs/screenshots/`. Raw video and full captures: `results/video-assets/product-polish/20261113T191343566Z/`.
- Existing contracts, SDK, Gate R, V1–V5, DAO payout and research remain verified. The former faucet/owner/hosting blockers are resolved. Dependencies remain documented in `docs/DEPENDABOT.md`.

## In progress

The new 117-second video editor is in `apps/web/render-demo.mjs`, with `demo-scenes.json` and `narrate-product.ps1`. Inputs validate successfully. First narration attempt failed at the final limits scene; the media worker is fixing it. No transaction or credential work is involved in rendering. Do not present the older green six-panel video as current footage.

README and verified evidence are being updated to the current UI and signed flow. Final submission/video metadata and release tag are still pending.

## Exact next action

Finish narration/render using:

```powershell
node apps/web/render-demo.mjs --capture-dir results/video-assets/product-polish/20261113T191343566Z --evidence results/hosted-wallet-20261113T191343566Z.json
```

Review contact sheet plus each scene boundary and narration timing. Fix edits using existing clips, without resending payments. Update README, video plan/script, submission, evidence, ledger/handoff. Commit each completed task after checking staged diff for secrets; push; run fresh-clone checks and wait for CI; move and push `hackathon-submission` to the final commit.

## Limits and human actions

- Scripted signing is verified; browser wallet extension approval screens are not.
- Public video upload, X publication and hackathon form submission require the human. Never publish those autonomously.
- Mainnet is not authorized. Testnet, commits, pushes and submission-tag updates are authorized.
- Sequential sends are required because V1 uses the next announcement index. Recovery requires the same wallet signing key. Spending to a named account reveals that link.
