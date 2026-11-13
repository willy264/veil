# Veil execution ledger

UI polish update: 13 Nov 2026 19:02 UTC. Frontend hard stop: 14 Nov 10:00 UTC (about 15 hours left); submission deadline 14 Nov 23:59 UTC (about 29 hours left). Hero comparison, Receive/Send steppers, plain states, button hierarchy, receipt/copy, inbox/auditor and four-decimal NEAR balances are implemented. Existing palette/font tokens unchanged. Build/typecheck/24 tests and initial browser QA pass. Screenshots at 1440/390 reviewed; both-tab and keyboard follow-up in progress. Next: deploy, real hosted scripted-signer run, and updated narrated video. User has supplied two authorized demo account keyfiles; no human wallet session is required for this scripted recording. Browser wallet approvals will be clearly distinguished from it.

Scripted-signer preparation: both authorized demo keys verified, each account has 10 NEAR, ignored `.env` populated. Runner is inert by default; `--preflight` reads only and `--execute` permits one guarded real flow. Preflight evidence: `results/hosted-wallet-20261113T190029570Z.json`. Production UI `2237b61` deployed automatically after push. No transaction submitted yet. Prior status below is historical until the final evidence update.

| Task | State | Evidence / next action |
|---|---|---|
| Narrated video recreation | Complete locally | results/veil-demo-green-ui.mp4; 117 seconds, 1080p, synthetic voice, full captions; results/narrated-tour-video.json |
| Design rollback | Live; browser verified | 7ff421b restores ebfd14f; build/typecheck/21 tests pass; results/hosted-check-1794472250465.json; Git history preserved |
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
| Current-UI footage, narration and editing | Complete | docs/NARRATED-TOUR.md; sentence-timed SRT; local WAV/MP4; dated evidence labels; no new wallet signatures |
| Wallet footage | Separate human verification | docs/VIDEO-PLAN.md remains the real-wallet shot list; current tour does not claim live approvals |
| Video public upload | Pending human | Review the completed local export and upload it; add public URL |
| Research/NEP/README/submission/X drafts | Prepared | Working URL and honest status documented; video public_url remains null until upload |
| Dependency alerts | Documented, retained | docs/DEPENDABOT.md; seven open alerts |
| Release CI/tag/push | CI runs on pushes; tag follows checked release | Code fix CI 43171196000 at fce35d5 is green; use GitHub Actions and hackathon-submission for final commit status |
| X and submission | Pending human | No post or submission made |

Next: review the completed narrated video, upload it when authorized, and add the public URL. For separate hosted-wallet verification, preserve the original Alice script identity and use a compatible recipient wallet/key. Sends must be sequential because V1 has no index reservation. Spend sends to the connected named account with a re-link warning.

Historical: fresh-clone frozen install/typecheck/14-test/web-build passed on 11 Nov before these web fixes. Current full CI includes 21 tests and web build. The old hosting, faucet, funding and deployment blockers are resolved. Ubuntu/WSL2 remains the supported Rust/sandbox environment.
