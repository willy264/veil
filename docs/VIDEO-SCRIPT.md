# Video script: 1:58

250 words, 14 scenes, 1920×1080. Synthetic narration (Windows speech, Microsoft David). It shows real testnet transactions on the hosted app; a scripted Node signer replaces only the wallet connector, so no browser-wallet approval screens are shown. That is said once, in the second scene.

- **Frames:** recorded by [`apps/web/record-video.mjs`](../apps/web/record-video.mjs) at a 960×540 viewport with device scale 2.
- **Cards:** the opener uses public NearBlocks API data for `ref-finance.near`, with counterparty names shortened. The implicit-account card uses live testnet RPC data.
- **Evidence:** transactions, scene timings and the spend warning are in [results/veil-demo-v2.json](../results/veil-demo-v2.json). Captions are in [results/veil-demo-v2.srt](../results/veil-demo-v2.srt).

## 0:00 to 0:13

Frame: `cards/public.png`

A NEAR name is a public ledger. Anyone can look up ref-finance.near and see its balance, 91 tokens and nearly a million transactions, each with its counterparty.

## 0:13 to 0:23

Frame: `frames/01-hero.png`

Veil gives a NEAR name private receiving. People still pay the name, but each payment lands in a fresh account that only the owner can find and spend.

## 0:23 to 0:32

Frame: `frames/01-hero.png`

This recording uses real testnet transactions, signed by a scripted test signer instead of a browser wallet.

## 0:32 to 0:40

Frame: `frames/02-enabled.png`

The receiver connects and signs one message. Veil derives a spend key and a view key in the browser.

## 0:40 to 0:46

Frame: `frames/03-registered.png`

Registering publishes only their public halves for the name, with a small storage deposit.

## 0:46 to 0:53

Frame: `frames/04-send-filled.png`

In another session, a sender types the name and 0.05 NEAR.

## 0:53 to 0:58

Frame: `frames/05-send-receipt.png`

The receipt shows delivery to a fresh receiving account, not to the name.

## 0:58 to 1:06

Frame: `frames/06-inbox.png`

Back with the receiver, one scan finds the payment among everyone's announcements, using the view key.

## 1:06 to 1:14

Frame: `frames/07-proof.png`

Live NearBlocks data for the name shows only its registration. The payment is visible only to the receiver.

## 1:14 to 1:26

Frame: `cards/implicit.png`

Each payment address is an ordinary NEAR implicit account, with no new account type. Its only key is the account ID itself, and the receiver's derived key signs for it.

## 1:26 to 1:31

Frame: `frames/08-spend-form.png`

To spend, the receiver picks a destination and an amount.

## 1:31 to 1:38

Frame: `frames/09-spent.png`

Veil warns that the destination becomes publicly linked to this payment, then signs the transfer.

## 1:38 to 1:46

Frame: `frames/10-auditor.png`

An auditor with the shared view key finds the same payment, read-only. There is no spend control.

## 1:46 to 1:57

Frame: `cards/end.png`

Veil is a testnet prototype. Amounts, timing and senders stay public. Try it at veil-eta-khaki.vercel.app
