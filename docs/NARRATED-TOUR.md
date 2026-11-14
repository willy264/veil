# Narrated product demo

> Superseded on 14 November 2026 by the cut described in [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md). This file describes the earlier 13 November video.

The current 1:57 video records the polished green app at https://veil-eta-khaki.vercel.app performing real testnet actions. The receiver enabled Veil and registered, the sender paid 0.0500 NEAR, the receiver scanned and spent 0.0010 NEAR, and an unsigned auditor found the payment. [Signed-flow evidence](../results/hosted-wallet-20261113T191343566Z.json).

It uses a **scripted test signer, not a browser wallet**. The Node runner replaces the wallet connector for the two user-authorized demo accounts; the hosted app runs its own derivation, scanning and raw-scalar spend signing. Browser extension approval screens are not covered. The disclosure stays on screen and is spoken at the start.

## Files

- Local MP4: `results/veil-demo-product.mp4`, 117 seconds, 1920×1080, 30 fps, H.264/AAC with captions.
- [Captions](../results/veil-demo-product.srt), [scene plan](../apps/web/demo-scenes.json), [script](VIDEO-SCRIPT.md), [shot list](VIDEO-PLAN.md).
- [Narration timing](../results/product-video-timing.json), [media verification](../results/product-video-verification.json), [frame review](../results/product-video-review.json).
- Raw action footage: `results/video-assets/product-polish/20261113T191343566Z/`.
- Edit assets, sentence audio and contact sheet: `results/video-assets/product-polish/edit/`.

Large media is local and Git-ignored. Sources, captions, checksums and evidence are committed. Both older exports, `veil-demo.mp4` and `veil-demo-green-ui.mp4`, are superseded. A public video URL remains pending human upload.

## Evidence and editing boundary

The action footage comes from the completed hosted run on 13 November 2026. Account and transaction checks are in its evidence JSON. Long RPC waits are shortened; confirmed frames may be held to fit narration. Mobile screenshot intervals are excluded from the desktop edit. The editor never signs, reads credentials or broadcasts transactions.

The DAO scene is a separate panel labelled **11 November 2026**. It shows the verified [Sputnik payout](../results/demo-dao-20261111220608.json), including its approval and recipient scan. It does not imply that a DAO interface exists in the app or that a new DAO transaction occurred during recording.

Microsoft Hazel Desktop supplies synthetic narration. Every complete sentence is measured from its generated WAV, then captioned at that duration. Speech fits its scene without truncation. The final scene retains the public limits: amounts, timing and senders stay visible, and spending can link identities.

## Recreate the edit from existing footage

On Windows with System.Speech, Playwright/Chromium and FFmpeg installed, run from the repository root:

```powershell
node apps/web/render-demo.mjs --capture-dir results/video-assets/product-polish/20261113T191343566Z --evidence results/hosted-wallet-20261113T191343566Z.json --check
node apps/web/render-demo.mjs --capture-dir results/video-assets/product-polish/20261113T191343566Z --evidence results/hosted-wallet-20261113T191343566Z.json
```

Use `--ffmpeg <executable>` and `--playwright <module-directory>` if the tools are outside the default search paths. `--voice` selects an installed Windows voice. `--skip-narration` reuses matching, already verified narration; it does not skip timing and text validation. The renderer has no credential requirement.

A fresh clone contains the source and evidence, not the ignored raw media. Preserve the local `results/video-assets/` directory and MP4. Do not rerun `apps/web/demo-hosted.mjs --execute` merely to re-edit: that creates another testnet payment.

The source recording can be reproduced with the guarded runner after arranging the two authorized local testnet signers. Its default invocation is inert; `--preflight` checks account access without a transaction. Read its help before any intentional new recording.

Clipdio required email sign-in when checked earlier. No account was created or email submitted. This export was recorded and assembled with Playwright, Windows System.Speech and FFmpeg and can be imported into another editor.
