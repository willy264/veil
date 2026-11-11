# Demo video plan

Target length: about 2 minutes, screen capture plus voiceover. Hosted URL: https://veil-eta-khaki.vercel.app. The web controls below are all present in the deployed app.

1. Show `ada.veil-williams.testnet` and the Veil app's registry lookup.
2. Register the viewing and spending keys through the wallet action flow.
3. Run the testnet demo: three senders pay fresh implicit accounts, while the named account is never used as the transfer destination.
4. Open the three NearBlocks transactions and point out that each destination is a different hex implicit account.
5. Refresh the Veil scanner and show all three payments discovered for Alice.
6. Spend one payment back to a sender using the derived scalar and show the NearBlocks receipt.
7. Show the verified Sputnik DAO payout and recipient scan, then close with the honest limits: amounts, timing, senders, and later sweeping remain linkable; the app is testnet-only.

Use `docs/VERIFIED.md` and `results/demo-dao-20261111220608.json` for exact links. On the hosted URL, connect a testnet wallet, derive keys, register, resolve a name, send privately, scan the inbox, and use the auditor view. The DAO payout is verified by the script evidence; do not show or narrate private keys.
