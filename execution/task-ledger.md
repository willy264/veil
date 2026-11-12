# Veil execution ledger

Updated 2026-11-12 06:52 UTC. Deadline: 2026-11-14 23:59 UTC; approximately 65.1 hours remain.

| Task | State | Evidence / next action |
|---|---|---|
| R0-R2 brief, prior art, public-account research | Done | docs/VEIL-BRIEF.md; research/01-prior-art.md; research/02-problem-evidence.md |
| Gate R raw-scalar spend | Verified on testnet | results/gate-r-20261108224016.json |
| Cost measurements | Done | FT storage 0.00125 NEAR; lowest tested FT stipend 0.03092 NEAR; docs/VERIFIED.md |
| Contracts and Rust/sandbox gate | Implemented; prior CI green | registry2/router2 deployed; results/deploy-20261111.json |
| SDK, V1-V5 tests | Implemented | 10,000-send property test; vectors; current local suite: 21 passing tests including 7 simulated web regressions |
| Fresh scripted demo | Verified | results/demo-20261111221900.json: three private sends, three matches, one spend |
| DAO payout | Verified | results/demo-dao-20261111220608.json: create, propose, approve, scan |
| Web fixes | Local checks passed | Integer registration deposit, stable message derivation, output index, pagination, auditor export/scan, spend receipt; results/local-browser-1794466234781.json |
| Public hosting | Blocked on protection; build configuration fixed | Root vercel.json builds and serves apps/web. Human disables Vercel Deployment Protection. Candidate: https://veil-willy264s-projects.vercel.app |
| Hosted wallet verification | Pending | Run scripts/check-hosted.mjs after public access; then actual wallet approvals. Local mocked tests are not proof of hosted transactions. |
| Video script/narration | Prepared | 115-second segmented narration, results/video-narration-timing.json; human wallet footage pending |
| Research/NEP/README/submission/X drafts | Exist; release updates pending | Canonical public URL, narration/shot list, final video URL |
| Dependency alerts | Documented, intentionally retained | docs/DEPENDABOT.md; seven open alerts |
| Final CI/tag/push | Pending this checkpoint | Previous green/tag commit: 4645e62; retag after current checks |
| Publish video, X, submit | Pending human | No public post or submission authorized |

Next: deploy hosting fix, check public alias without authentication, verify hosted wallet actions, update URL/evidence, finish recording package, retag/push. Keep tests with simulated wallet responses clearly distinguished from testnet receipts.

Fresh-clone install/typecheck/14-test/web-build checks passed on 11 Nov before the latest web fixes. The earlier faucet/owner-key blockers are resolved for deployed contracts and DAO evidence. WSL2/Ubuntu is the supported Rust/sandbox environment.
