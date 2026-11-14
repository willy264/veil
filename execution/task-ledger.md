# Veil execution ledger

Updated 14 Nov 2026 00:31 UTC. Frontend hard stop: 14 Nov 10:00 UTC (9.5 hours left). Submission deadline: 14 Nov 23:59 UTC (23.5 hours left).

| Task | State | Evidence |
|---|---|---|
| Research R0-R2 | Done | research/01-prior-art.md; research/02-problem-evidence.md |
| Gate R and FT costs | Verified | docs/VERIFIED.md; FT storage 0.00125 NEAR, lowest tested stipend 0.03092 NEAR |
| Registry/router/SDK V1-V5 | Deployed and tested | registry2/router2; Ubuntu CI and 10,000-send property test |
| Three-sender demo | Verified | results/demo-20261111221900.json |
| Sputnik DAO payout | Verified | results/demo-dao-20261111220608.json |
| Green UI product polish | Live | Proof, steppers, NEAR amounts, real states, receipts, auditor, mobile containment |
| UI regression tests | Passing | 24 tests including 10 simulated web flows |
| Responsive/contrast/keyboard QA | Passing | results/ui-polish/final-pass/results.json; 44 checks |
| Mobile lab performance | Passing | lighthouse-final-mobile.json; 98/100/100/100, LCP 1.59s, CLS 0 |
| Hosted signed flow | Verified | results/hosted-wallet-20261113T191343566Z.json |
| Signer disclosure | Complete | Scripted test signer, not browser wallet approvals; README/video/submission |
| Current screenshots | Complete | docs/screenshots/ |
| Video with voiceover | Complete locally | 117s; product-video-verification.json and product-video-review.json |
| README/submission/video/X drafts | Updated | Current URL, receipts, screenshot links, honest limits; public video URL awaits human upload |
| Dependency alerts | Documented unchanged | docs/DEPENDABOT.md |
| Fresh clone | Passing | results/fresh-clone-20261114.json at 0a0c70f |
| CI and deployment | Passing at 0a0c70f | CI 43533851015; Vercel success. Final documentation commit uses the same release gate |
| Submission tag | Release gate | Move/push only after final commit CI and Vercel pass; final report records exact commit |
| Public video upload / X / form | Human action | Nothing published or submitted |

No funding, DAO, contract or Vercel-login blocker remains. No implementation work is pending. The old video required re-recording after the UI change; the replacement is complete. Preserve ignored raw media and the local MP4. Stop frontend work at 10:00 UTC.
