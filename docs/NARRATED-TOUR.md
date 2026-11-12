# Narrated tour

This 117-second tour combines the current hosted, restored green six-panel UI with evidence cards made from transactions verified on 11 November 2026. The scene contract is [`narrated-tour-scenes.json`](narrated-tour-scenes.json). Keep [`video-scenes.json`](video-scenes.json) unchanged as the human-wallet shot list.

## Recording boundary

No signer keys are available in the recording session. Human signer footage was not recorded. The live footage may open the wallet chooser, edit fields, resolve the public registry entry for `alice.veil-williams.testnet`, and show read-only interface copy. It must not imply that a wallet signed in, keys were derived, a registration or payment was submitted, a recipient scan ran, an auditor key was available, or a spend occurred during this recording.

Registration publishes public spending and viewing keys. Key derivation normally begins with a wallet signature and retains the derived private viewing and spending keys in browser memory. The public resolve call needs no wallet signature. Evidence cards must be visibly labeled as prior transactions or prior evidence from 11 November 2026.

## Evidence sources

- `results/demo-20261111221900.json`: three prior send hashes, `scan.found = 3`, and spend hash `HQMiR2HzAcByzDGKDK6mptaEA69Sjoe9HrAVKQQqQCsN`.
- `results/demo-dao-20261111220608.json`: sole-council approved payout evidence and `scan.found = 1`.

These records support only the claims stated in the scenes. Do not describe the recorded session as finding or spending funds, and do not claim that Veil removes all visibility. Amounts, timing, senders and token contracts remain public; later consolidation can reveal links.

## Deliverables

- Local video: `results/veil-demo-green-ui.mp4`, 1:57, 1920×1080, 30 fps, H.264 with AAC audio and burned-in captions.
- Editable captions: [`results/veil-demo-green-ui.srt`](../results/veil-demo-green-ui.srt).
- Separate narration: `results/video-assets/green-ui/voiceover-final.wav`, synthetic Microsoft Hazel Desktop voice.
- [Media verification](../results/narrated-tour-video.json) records the output checksum, full decode, caption coverage and evidence sources. [Narration timing](../results/narrated-tour-timing.json) confirms that complete speech fits each scene.
- [Final review](../results/narrated-tour-review.json) records the frame review and 48 kHz audio checks: mean level −16.8 dB and peak −1.5 dB.
- Raw clips, sentence audio and a nine-frame contact sheet are in `results/video-assets/green-ui/`.

Large media files are local and Git-ignored. The source scripts, captions and verification records are committed. The video is ready for review; no public video upload or hackathon submission has been made. Real hosted wallet approvals remain a separate verification task.

## Recreate the export

Install Playwright with Chromium and FFmpeg, then run from the repository root on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/narrate-tour.ps1 -Ffmpeg ffmpeg
node scripts/create-demo-video.mjs
```

Use `VEIL_PLAYWRIGHT_MODULE` for an absolute path to an existing Playwright module and `VEIL_FFMPEG` for an absolute FFmpeg executable path when they are not on the default search paths. The narration command accepts `-Voice` to select another installed Windows voice; regenerate the video after changing it. No signer environment variables are read by either script.

`node scripts/create-demo-video.mjs --render-only --assemble-only` reassembles existing clips with regenerated narration and captions. `--recapture=enable --capture-only` retakes one scene; follow it with `--render-only --render-scene=enable` to replace that clip and export again.

Review raw clip boundaries before the final export. Browser capture finalization can add trailing frames; each scene in the local `capture-manifest.json` may specify `trimStartSeconds` to preserve the intended opening. The delivered export records its reviewed wallet-chooser trim in the media verification JSON.

Captions use the measured duration of each separately synthesized sentence, and the renderer verifies that their combined text exactly matches the narration. This avoids inaccurate Windows speech-progress timestamps. Each scene is padded after speech, never cut mid-sentence.

Clipdio's browser editor required an email sign-in, and its Windows download required email submission. Neither was performed. This version was recorded and assembled locally with Playwright, Windows System.Speech and FFmpeg; the MP4 can be imported into a video editor later.
