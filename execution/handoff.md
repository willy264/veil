# Veil handoff

Updated 2026-11-12 08:20 UTC. About 63.6 hours remain until 14 Nov 23:59 UTC.

## Wallet UI refresh

Implemented a trading-wallet layout with Send/Receive/Transfer tabs, original Veil SVG logo/favicon, self-hosted Geist, real scanned NEAR totals, readable receipt links, and keyboard/loading/error states. Transfer selects an owned account, destination and amount, then requires the relinking confirmation. Wallet sign-out clears private session state. Failed balance reads show unavailable instead of zero.

Local checks pass: 25 tests (11 simulated web-flow tests), typecheck/build, live testnet reads and wallet chooser. [Responsive/axe evidence](../results/wallet-ui-1794471265204.json): all three tabs at six widths in both motion modes, zero violations/errors/overflow. [Mobile Lighthouse lab](../results/wallet-lighthouse-1794471315329.json): performance 93, accessibility 100, SEO 100. These are lab/read-only checks, not wallet transaction receipts.

UI commit ec43451 is pushed; [CI 43181741193](https://github.com/willy264/veil/actions/runs/43181741193) is green. The production alias serves the redesign, and the [public browser check](../results/hosted-check-1794471529711.json) passes anonymous access, tabs, logo/favicon, live registry/router reads and wallet chooser. Recording instructions and the complete 117-second narration now use Transfer. Release docs/tag follow this checked UI commit. Real hosted wallet approvals and recording still require the human's wallet session.

## Verified state

- Public app: https://veil-eta-khaki.vercel.app. Fresh anonymous browser access, wallet overview, three payment tabs, inbox, explorer/auditor tools and wallet chooser pass. Live Alice registry resolution and router announcement reads pass with no page errors. [Hosted evidence](../results/hosted-check-1794471529711.json).
- Vercel project `veil` uses repository root `.`; root `vercel.json` now builds/serves `apps/web`. The production alias is public. Generated Vercel deployment aliases may still require login; use the production URL.
- Active testnet contracts: `registry2.veil-williams.testnet` and `router2.veil-williams.testnet`. [Deployment](../results/deploy-20261111.json).
- Registration, three private sends, scan finding three and one spend: [fresh demo](../results/demo-20261111221900.json). Separate [DAO PASS](../results/demo-dao-20261111220608.json) covers its DAO prerequisite field.
- Gate R, FT storage of 0.00125 NEAR, and lowest tested FT stipend of 0.03092 NEAR: [measurements](../docs/VERIFIED.md).
- Web fixes: integer registration deposit, repeatable derivation with the same wallet signing key, nonzero announcement indices, pagination, auditor scan/export, point validation, spend warning/receipt and visible RPC failures.
- CI at ec43451 is [green](https://github.com/willy264/veil/actions/runs/43181741193): Rust/sandbox/WASM, 25 tests, 10,000-send property test and web build. Eleven web tests simulate wallet/RPC responses and are not new testnet receipts.
- Research, NEP, README, X and submission drafts exist. README/submission now distinguish verified public access from pending hosted wallet approvals.

## Recording package

The [shot list](../docs/VIDEO-PLAN.md) and [script](../docs/VIDEO-SCRIPT.md) cover enable → register → send → scan → spend → auditor → prior DAO evidence. Generated synthetic narration: `results/video-assets/voiceover-final.wav`, exactly 117 seconds. [Timing evidence](../results/video-narration-timing.json) confirms no spoken segment is cut. The old `results/veil-demo.mp4` is a draft and must not be submitted.

## Exact next action

Human: record the shot list with a funded recipient and sender in separate wallet browser profiles, and a third unsigned auditor context. Use a recipient with no conflicting Veil registration; do not overwrite the scripted Alice identity. Preserve public transaction hashes, keep view keys masked, and avoid recording signatures/seed material. Then assemble the 1:57 video using the narration, upload it, and put the public video URL into submission.json.

Agent can rerun the read-only check with `node scripts/check-hosted.mjs https://veil-eta-khaki.vercel.app`; install Playwright or set `VEIL_PLAYWRIGHT_MODULE` to its installed module path.

## Remaining limits

- Public access and live reads are verified. Actual hosted wallet approvals need a human browser session; this agent has no signed-in wallet or demo signer environment variables.
- V1 sends must be sequential: concurrent submissions can change the expected router index and prevent normal discovery. Wallet recovery requires the same signing key; older random-nonce registrations may not be recoverable through this flow.
- The inbox Transfer button opens a form. It defaults to 0.001 NEAR and the connected named account; destination and amount are editable. Review transfer displays the explicit public-link confirmation.
- Seven dependency alerts remain documented in [DEPENDABOT.md](../docs/DEPENDABOT.md), per instruction.
- Human recording/edit/upload, X publication and form submission are pending. Mainnet is not authorized. Commit/push/tag updates are authorized.

The previous hosting, faucet, DAO-funding and fresh-contract blockers are resolved. Do not report them as outstanding.
