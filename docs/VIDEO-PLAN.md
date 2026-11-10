# Demo video plan

Target length: 90 seconds, screen capture plus voiceover.

1. Show `ada.veil-williams.testnet` and the Veil app's registry lookup.
2. Register the viewing and spending keys through the wallet action flow.
3. Run the testnet demo: three senders pay fresh implicit accounts, while the named account is never used as the transfer destination.
4. Open the three NearBlocks transactions and point out that each destination is a different hex implicit account.
5. Refresh the Veil scanner and show all three payments discovered for Alice.
6. Spend one payment back to a sender using the derived scalar and show the NearBlocks receipt.
7. Close with the honest limits: amounts, timing, senders, and later sweeping remain linkable; Sputnik payout is a documented prerequisite, not a completed action.

Use `docs/VERIFIED.md` for the exact links and `results/demo-20261110085124.json` for the recorded run. Record on testnet only; do not show or narrate private keys.
