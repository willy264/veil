# Narrated tour

This 117-second tour combines the current hosted, restored green six-panel UI with evidence cards made from transactions verified on 11 November 2026. The scene contract is [`narrated-tour-scenes.json`](narrated-tour-scenes.json). Keep [`video-scenes.json`](video-scenes.json) unchanged as the human-wallet shot list.

## Recording boundary

No signer keys are available in the recording session. Human signer footage was not recorded. The live footage may open the wallet chooser, edit fields, resolve the public registry entry for `alice.veil-williams.testnet`, and show read-only interface copy. It must not imply that a wallet signed in, keys were derived, a registration or payment was submitted, a recipient scan ran, an auditor key was available, or a spend occurred during this recording.

Registration publishes public spending and viewing keys. Key derivation normally begins with a wallet signature and retains the derived private viewing and spending keys in browser memory. The public resolve call needs no wallet signature. Evidence cards must be visibly labeled as prior transactions or prior evidence from 11 November 2026.

## Evidence sources

- `results/demo-20261111221900.json`: three prior send hashes, `scan.found = 3`, and spend hash `HQMiR2HzAcByzDGKDK6mptaEA69Sjoe9HrAVKQQqQCsN`.
- `results/demo-dao-20261111220608.json`: sole-council approved payout evidence and `scan.found = 1`.

These records support only the claims stated in the scenes. Do not describe the recorded session as finding or spending funds, and do not claim that Veil removes all visibility. Amounts, timing, senders, token contracts, and network metadata remain public; later consolidation can reveal links.

## Deliverables

The final render is reserved as `results/veil-demo-green-ui.mp4`, captions as `results/veil-demo-green-ui.srt`, and voiceover as `results/video-assets/green-ui/voiceover-final.wav`. These paths are target filenames only. Generation and media-probe status must be added by the parent recording/render pipeline after it creates and verifies the files.
