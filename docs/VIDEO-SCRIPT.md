# Veil narration — 1:57

Record the real hosted flow at https://veil-eta-khaki.vercel.app using the [shot list](VIDEO-PLAN.md). The wording below is for footage of completed steps, not a claim that this recording has already happened. The automated browser check submits no wallet transactions.

The generated synthetic narration is `results/video-assets/voiceover-final.wav` (117 seconds). Its source is [video-scenes.json](video-scenes.json), and the [timing report](../results/video-narration-timing.json) confirms that each complete spoken segment fits its scene, with at least half a second of remaining room. No spoken audio is cut. The old `results/veil-demo.mp4` is an obsolete draft.

| Time | Narration |
|---|---|
| 0:00–0:10 | Veil brings private receiving to NEAR named accounts. Keep one readable name, while every payment goes to a fresh address. |
| 0:10–0:24 | First, connect a testnet wallet and choose Derive keys. Approve the message in your wallet. Veil derives viewing and spending keys in this browser. Keep the same wallet signing key. |
| 0:24–0:36 | Register name publishes the two public keys. Approve the registry transaction, then resolve the name. Senders can now look up this reusable identity. |
| 0:36–0:53 | In a separate sender window, enter that name and send a small testnet payment. The browser derives a new implicit account and asks the wallet to approve the router call. The result shows the one-time destination. |
| 0:53–1:07 | Back in the recipient window, Scan checks the public announcements with the private viewing key. The matching payment appears with its balance. Other people's announcements stay outside this inbox. |
| 1:07–1:22 | Choose Transfer to send a small amount from that stealth account. Read the warning: sending to your named account creates a public link. Review and confirm, then check the successful transaction receipt. |
| 1:22–1:36 | Copy the view key and open a separate auditor window. Paste it into the masked field and scan the registered name. The auditor sees incoming payments, with no spending key or spend control. |
| 1:36–1:47 | Recorded Sputnik DAO evidence shows council approval of a private router payout, and the recipient scanner finding that payment. |
| 1:47–1:57 | Testnet only. Amounts, timing and senders remain public. Combining balances reveals links. |

Regenerate on Windows with System.Speech and FFmpeg installed:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-voiceover.ps1 -Ffmpeg ffmpeg
```

The script measures each WAV, adjusts speaking rate if needed, then pads silence to each scene length. It fails rather than trimming speech. The generated audio is ignored by Git; the source and timing report are committed. The narrator is synthetic, not a recording of a team member.

Use the [fresh scripted demo](../results/demo-20261111221900.json) only as prior evidence. The DAO shot uses the separately verified [DAO evidence](../results/demo-dao-20261111220608.json), with [council approval](https://testnet.nearblocks.io/txns/5JQtGN7P2xUM2zMef2QxT9s3eWErPFrWgNkHMVhJBSHP).
