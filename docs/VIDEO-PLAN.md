# Product demo shot list: 1:57

Hosted app: https://veil-eta-khaki.vercel.app. The current recording shows the polished green interface and real signed testnet transactions. It uses a **scripted test signer, not a browser wallet**. See [signed-flow evidence](../results/hosted-wallet-20261113T191343566Z.json), the [word-for-word script](VIDEO-SCRIPT.md), and [export instructions](NARRATED-TOUR.md).

## Timeline

| Time | Shot and verified action |
|---|---|
| 0:00–0:12 | Hero comparison, testnet label and scripted-signer disclosure. Before enabling, the comparison is labelled Example. |
| 0:12–0:28 | Receiver chooses Receive, connects, then clicks Enable Veil. A real NEP-413 signature supplies the browser derivation. |
| 0:28–0:38 | Register `veil-demo-recv.testnet`; show confirmation. Registration attaches 0.01 NEAR for storage/refunds. |
| 0:38–0:56 | Separate sender session: enter that name, leave the field to resolve it, enter 0.05 NEAR and send. Show Delivered privately and its NearBlocks receipt. |
| 0:56–1:10 | Receiver scans Private payments. Show the matching destination and 0.0500 NEAR balance. |
| 1:10–1:22 | Spend 0.0010 NEAR to the connected named account, confirm the public-link warning, and show success. |
| 1:22–1:35 | Copy Auditor key through Auditor access. In a third unsigned session, paste into the masked field and scan. Show the same payment with no Spend control. |
| 1:35–1:47 | Dated DAO evidence panel: 11 November 2026, approved payout, one payment found. This is separate evidence, not a DAO page in the app. |
| 1:47–1:57 | Honest limits. Hold through the complete final spoken sentence. |

The recording trims long network waits and pads confirmed states. It retains action starts and results. No balance, receipt or successful payment is fabricated. Amounts in the app are NEAR, to four decimals.

DAO source: [PASS record](../results/demo-dao-20261111220608.json), `veildao4434750196.sputnikv2.testnet`, [approval receipt](https://testnet.nearblocks.io/txns/5JQtGN7P2xUM2zMef2QxT9s3eWErPFrWgNkHMVhJBSHP). There is no DAO proposal page in this interface.

## Optional recording with a browser wallet

The UI change required a new recording. The scripted-signer version supplies it; browser-wallet approval footage remains optional and unverified.

1. Use two isolated browser profiles with funded testnet accounts you control, plus an unsigned auditor profile. The receiving wallet must support NEP-413. Do not overwrite a registration made with a different signing key.
2. Keep the receiver tab open and use the same wallet signing key for re-derivation. Never record seed screens, signature bytes, clipboard history or developer tools containing keys.
3. Follow the timeline above, substituting the two approved names. Preserve wallet approval screens and final transaction results; trim only waiting time. If actual amounts differ, update the narration and evidence.
4. Keep sends sequential. V1 derives against the next router index; concurrent sends may prevent normal discovery.
5. Keep the Auditor key field masked. The public-link confirmation is essential: the current Spend control transfers 0.001 NEAR to the connected named account, not a full-balance or anonymous withdrawal.
6. Export H.264/AAC at 1920×1080, check every caption and the first/last words of each scene, then choose a public upload destination. Public upload and submission have not been performed.

If using Clipdio, import the current MP4 or the local raw clips and narration. Clipdio previously required an email sign-in; no sign-in or email submission was performed by the agent. The delivered edit uses Playwright, Windows speech and FFmpeg.
