# Veil execution ledger

Updated 14 Nov 2026 00:12 UTC. Frontend stop: 14 Nov 10:00 UTC, about 9.8 hours left. Submission: 14 Nov 23:59 UTC, about 23.8 hours left.

| Task | State | Evidence / next action |
|---|---|---|
| Research R0–R2 | Done | research/01-prior-art.md; research/02-problem-evidence.md |
| Gate R and FT costs | Verified | docs/VERIFIED.md; FT storage 0.00125 NEAR, lowest tested stipend 0.03092 NEAR |
| Registry/router/SDK V1–V5 | Deployed and tested | registry2/router2; Ubuntu CI, 10,000-send property test |
| Scripted three-sender demo | Verified | results/demo-20261111221900.json |
| Sputnik DAO payout | Verified | results/demo-dao-20261111220608.json |
| Green UI product polish | Live | Proof panel, Receive/Send steppers, NEAR formatting, real states, receipts, auditor, layout |
| UI regression tests | Passing | 24 tests including ten simulated web flows; CI 43490083710 |
| Responsive/contrast/keyboard QA | Passing | results/ui-polish/final-pass/results.json; 44 path/motion/width checks |
| Mobile lab performance | Passing | results/ui-polish/lighthouse-final-mobile.json; 98/100/100/100, LCP 1.59s, CLS 0 |
| Hosted signed flow | Verified | results/hosted-wallet-20261113T191343566Z.json; enable/register/send/scan/spend/auditor |
| Signer disclosure | Required in delivery | Scripted Node test signer, not browser wallet approvals |
| Current screenshots | Captured | docs/screenshots/; raw capture directory in handoff |
| New video with voiceover | Rendering in progress | 117-second plan, real hosted clips; final narration scene error under repair |
| README/submission/video docs | In progress | Update to real UI, signed evidence and final video |
| Dependency alerts | Documented unchanged | docs/DEPENDABOT.md |
| Fresh clone / final CI / tag | Pending final files | Verify frozen install/build/tests, green CI, retag and push |
| Public video upload / X / form | Human action | No publication or submission performed |

No old funding, DAO, contract or Vercel-login blocker remains. Demo keys are available in ignored `.env`; no new credentials are needed. The older video must be replaced after the UI change; render from existing signed footage rather than repeating payments. Stop frontend work at 10:00 UTC even if extras remain.
