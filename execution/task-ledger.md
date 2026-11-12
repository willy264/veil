# Veil execution ledger

Updated 2026-11-12 08:16 UTC. Deadline: 2026-11-14 23:59 UTC; approximately 63.7 hours remain.

| Task | State | Evidence / next action |
|---|---|---|
| Wallet UI/brand refresh | Implemented; release checks in progress | Send/Receive/Transfer, original logo/favicon, real NEAR totals, 25 tests; results/wallet-ui-1794471265204.json and results/wallet-lighthouse-1794471315329.json |
| R0-R2 brief, prior art, public-account research | Done | docs/VEIL-BRIEF.md; research/01-prior-art.md; research/02-problem-evidence.md |
| Gate R raw-scalar spend | Verified | results/gate-r-20261108224016.json |
| Costs | Measured | FT storage 0.00125 NEAR; lowest tested FT stipend 0.03092 NEAR; docs/VERIFIED.md |
| Contracts and Rust/sandbox gate | Deployed/tested | registry2/router2; results/deploy-20261111.json; CI 43171196000 |
| SDK/V1-V5 and web regressions | Passing | 21 tests, including 7 simulated wallet/RPC web tests; 10,000-send property run |
| Fresh scripted demo | Verified | results/demo-20261111221900.json: register, three sends, three matches, spend |
| DAO payout | Verified | results/demo-dao-20261111220608.json: create/propose/approve/scan |
| Web flow fixes | Implemented/tested | Storage units, deterministic signature request, output index, auditor scan/export, pagination, points, spend receipt |
| Public hosting | Verified | https://veil-eta-khaki.vercel.app; results/hosted-check-1794466492403.json |
| Hosted read checks | Passed | Six panels, root/index/assets, wallet chooser, registry2/router2 views; no login or page errors |
| Hosted wallet approvals | Pending human session | Automated checks are read-only; simulated tests verify call routing, not real approvals |
| Video script/shot list/narration | Ready | docs/VIDEO-SCRIPT.md; docs/VIDEO-PLAN.md; 117-second WAV; results/video-narration-timing.json |
| Wallet footage/edit/upload | Pending human | Record actual steps, trim waits, overlay full narration, export and add public URL |
| Research/NEP/README/submission/X drafts | Prepared | Working URL and honest status documented; video public_url remains null until upload |
| Dependency alerts | Documented, retained | docs/DEPENDABOT.md; seven open alerts |
| Release CI/tag/push | CI runs on pushes; tag follows checked release | Code fix CI 43171196000 at fce35d5 is green; use GitHub Actions and hackathon-submission for final commit status |
| X and submission | Pending human | No post or submission made |

Next: human records real wallet steps using the shot list. Preserve the original Alice script identity; use a compatible recipient wallet/key. Sends must be sequential because V1 has no index reservation. Spend intentionally demonstrates the warning by sending to the connected named account.

Historical: fresh-clone frozen install/typecheck/14-test/web-build passed on 11 Nov before these web fixes. Current full CI includes 21 tests and web build. The old hosting, faucet, funding and deployment blockers are resolved. Ubuntu/WSL2 remains the supported Rust/sandbox environment.
