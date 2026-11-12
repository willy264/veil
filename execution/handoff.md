# Veil handoff

Updated 2026-11-12 06:52 UTC. About 65.1 hours remain until 14 Nov 23:59 UTC.

## Verified state

- Active testnet contracts: `registry2.veil-williams.testnet` and `router2.veil-williams.testnet`. Creation/deployment/init: [evidence](../results/deploy-20261111.json).
- Registration, three private sends, scan finding three, and one spend: [fresh demo](../results/demo-20261111221900.json). The DAO prerequisite field is covered by the separate passing [DAO run](../results/demo-dao-20261111220608.json).
- Gate R, FT storage of 0.00125 NEAR, and the lowest tested FT stipend of 0.03092 NEAR: [verified measurements](../docs/VERIFIED.md).
- Research, NEP draft, SDK, Rust/sandbox suite and 10,000-send property test exist. CI was green at 4645e62 before this checkpoint.
- Current local checks: 21 tests, SDK typecheck and web build pass. Seven new tests simulate wallet/RPC responses; they are not new on-chain evidence.
- Actual browser with live testnet reads: all six sections, Alice registry lookup, four router announcements and wallet chooser passed without page errors. [Local browser evidence](../results/local-browser-1794466234781.json). No wallet transaction was submitted by this check.
- Web fixes cover integer storage deposit, repeatable wallet-key derivation, nonzero announcement indices, paginated scanning, view-only scans/export, point validation, and retained spend receipts. V1 still requires sequential sends and the same wallet signing key for recovery.

## Hosting

Vercel project `veil` has repository root `.`. Root `vercel.json` now builds `apps/web` and serves that directory; earlier automatic deployments lacked this configuration. The old README alias returned 404. The production alias `https://veil-willy264s-projects.vercel.app` and deployment URLs currently redirect to Vercel login. The human is disabling Deployment Protection. Do not label the URL publicly verified until an anonymous browser loads the application.

## Exact next action

Push the hosting/web fixes, wait for deployment, and run `node scripts/check-hosted.mjs https://veil-willy264s-projects.vercel.app` after protection is disabled. The script requires Playwright (install outside the repository if preferred and set `VEIL_PLAYWRIGHT_MODULE` to its module path). It records anonymous assets, contract views, wallet chooser and runtime errors. Then verify real wallet approvals with the human's wallet session, update the canonical URL in README/submission, and record the shot list.

## Video and release

A 115-second segmented narration is generated at `results/video-assets/voiceover-final.wav`, with [timing evidence](../results/video-narration-timing.json). The older `results/veil-demo.mp4` is a draft with incomplete footage and must not be submitted. The human will record the wallet steps using the updated shot list; do not simulate approved transactions or expose viewing/spending material.

## Open items

- Public hosted access and real hosted wallet transactions remain unverified.
- No demo signer environment variables are present in this agent process. Existing successful DAO/demo evidence remains valid; rerunning those scripts is not required for the read-only hosting check.
- Seven dependency alerts stay documented in [DEPENDABOT.md](../docs/DEPENDABOT.md), per the user's instruction.
- Video assembly/upload, X publication and form submission remain pending. Mainnet is not authorized. Commit/push are authorized; retag after final checks.

Old faucet, missing DAO funding and fresh-contract deployment blockers are resolved and removed.
