# Video script: 2:00

258 words, 13 scenes, 1920×1080, synthetic narration (Windows speech, Microsoft David).

- **Scene 3** is a real Meteor Wallet (Chrome extension) approval of the Enable Veil key message, recorded by hand on the hosted app on 14 November 2026 ([evidence](../results/wallet-test-meteor-20261114.json)).
- **The other scenes** show a real hosted testnet run in which a scripted Node signer replaces only the wallet connector; the narration says so in scene 4.
- **Frames:** recorded by [`apps/web/record-video.mjs`](../apps/web/record-video.mjs) at a 960×540 viewport with device scale 2.
- **Cards:** the opener uses public NearBlocks API data for `ref-finance.near` (counterparty names shortened); the implicit-account card uses live testnet RPC data.
- **Evidence:** transactions and timings are in [results/veil-demo-v2.json](../results/veil-demo-v2.json); captions are in [results/veil-demo-v2.srt](../results/veil-demo-v2.srt).

## 0:00 to 0:13

Source: `cards/public.png`

A NEAR name is a public ledger. Anyone can look up ref-finance.near and see its balance, 91 tokens and nearly a million transactions, each with its counterparty.

## 0:13 to 0:23

Source: `frames/01-hero.png`

Veil gives a NEAR name private receiving. People still pay the name, but each payment lands in a fresh account that only the owner can find and spend.

## 0:24 to 0:39

Source: `results/veil-test.mp4 from 0:42 (real Meteor approval, cropped)`

Here the receiver uses a real wallet, Meteor. It asks to sign Veil's key message and shows the Veil app as the site. No payment is made, and Veil derives the receiver's keys from that signature, in the browser.

## 0:39 to 0:48

Source: `frames/03-registered.png (scripted session)`

From here, a scripted signer stands in for the wallet. Registering publishes only the public keys for the name.

## 0:48 to 0:55

Source: `frames/04-send-filled.png`

In another session, a sender types the name and 0.05 NEAR.

## 0:55 to 1:01

Source: `frames/05-send-receipt.png`

The receipt shows delivery to a fresh receiving account, not to the name.

## 1:01 to 1:08

Source: `frames/06-inbox.png`

Back with the receiver, one scan finds the payment among everyone's announcements, using the view key.

## 1:08 to 1:16

Source: `frames/07-proof.png`

Live NearBlocks data for the name shows only its registration. The payment is visible only to the receiver.

## 1:16 to 1:28

Source: `cards/implicit.png`

Each payment address is an ordinary NEAR implicit account, with no new account type. Its only key is the account ID itself, and the receiver's derived key signs for it.

## 1:28 to 1:34

Source: `frames/08-spend-form.png`

To spend, the receiver picks a destination and an amount.

## 1:34 to 1:40

Source: `frames/09-spent.png`

Veil warns that the destination becomes publicly linked to this payment, then signs the transfer.

## 1:40 to 1:48

Source: `frames/10-auditor.png`

An auditor with the shared view key finds the same payment, read-only. There is no spend control.

## 1:48 to 1:59

Source: `cards/end.png`

Veil is a testnet prototype. Amounts, timing and senders stay public. Try it at veil-eta-khaki.vercel.app
