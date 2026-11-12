# Human recording shot list — 1:57

Public URL: https://veil-eta-khaki.vercel.app. This is a single-page app with six panels. Public loading, live contract views and the wallet chooser are verified; actual wallet approvals and footage are still to be recorded. Use the prepared `results/video-assets/voiceover-final.wav` and [word-for-word script](VIDEO-SCRIPT.md).

## Before recording

1. Use two separate browser profiles: recipient and sender. Choose funded testnet accounts you control. The recipient needs a wallet that supports NEP-413 and should not already have a different Veil registration. Do not replace the scripted Alice registration: those keys were created by the demo script, not this wallet flow.
2. Keep the recipient tab open. Use the same wallet signing key when re-deriving; switching wallets, rotating signing keys or older random-nonce registrations may not recover the same identity.
3. Open an unsigned third browser context for the auditor. Keep its view-key input masked. Do not record wallet seed/recovery screens, NEP-413 signature bytes, clipboard history or developer tools containing keys.
4. Keep sends sequential and wait for each announcement before sending again. V1 binds derivation to the next router index; concurrent sends can change it and make a payment invisible to the normal scanner.
5. Record each interaction fully at 1920×1080 or the available screen size. Wallet approval/network waits may take longer than the edited scene. Trim only waits, keeping the actual buttons, approvals and results. Preserve transaction hashes as separate public evidence.

## Timeline

| Time | Record this |
|---|---|
| 0:00–0:10 | Public URL and testnet badge; show registry2/router2. No Vercel login screen. |
| 0:10–0:24 | Recipient window: Connect wallet, Derive keys, NEP-413 approval, confirmation. Hide wallet recovery screens. |
| 0:24–0:36 | Recipient: Register name; approve 0.01 NEAR storage deposit; wait for confirmation; Resolve the actual account. |
| 0:36–0:53 | Separate sender profile: connect, enter recipient and 0.01 NEAR, Send privately, approve router2, show destination/receipt. Keep recipient tab open. |
| 0:53–1:07 | After finality, recipient clicks Scan. Show real owned account and balance; retain receipt/hash separately. |
| 1:07–1:22 | Recipient: Spend; record re-link confirmation for 0.001 NEAR to connected account; show result hash and NearBlocks receipt. |
| 1:22–1:36 | Copy view key; separate unsigned context: paste in password field, enter name, Scan as auditor. Never unmask or record clipboard contents. |
| 1:36–1:47 | Show committed DAO JSON PASS, DAO ID, scan.found=1 and NearBlocks approval. Label: previously recorded DAO evidence. |
| 1:47–1:57 | Hold final app/limits card through end; keep complete last sentence audible. |

Registration attaches 0.01 testnet NEAR for contract storage/refunds. The send is 0.01 NEAR. The current Spend control sends 0.001 NEAR to the connected recipient's named account; it explicitly reveals that link. Do not describe this spend as anonymous or a full-balance withdrawal.

For the DAO scene show [PASS evidence](../results/demo-dao-20261111220608.json), DAO `veildao4434750196.sputnikv2.testnet`, and [approval receipt](https://testnet.nearblocks.io/txns/5JQtGN7P2xUM2zMef2QxT9s3eWErPFrWgNkHMVhJBSHP). Label it “Previously recorded DAO evidence”; there is no DAO proposal page in the app.

## Assembly in Clipdio

Import the newly recorded clips and `voiceover-final.wav`. Place narration at 0:00; trim/extend footage to the scene boundaries above. Keep the final scene through 1:57. Export an MP4 with H.264 video/AAC audio and replay the first and last words of every scene. Verify the recipient scan and spend hashes against testnet NearBlocks before upload.

Do not reuse the old `results/veil-demo.mp4` as a finished demo: it contains only read-only footage and has an incomplete timeline. `scripts/record-demo.mjs` is now explicitly a read-only B-roll helper. Clipdio upload, final recording/edit and public video URL are pending.
