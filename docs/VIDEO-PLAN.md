# Demo video plan

Target length: about 2 minutes, screen capture plus voiceover. The hosted URL must be deployed first; the web controls below are all present in the static app.

1. Show `ada.veil-williams.testnet` and the Veil app's registry lookup.
2. Register the viewing and spending keys through the wallet action flow.
3. Run the testnet demo: three senders pay fresh implicit accounts, while the named account is never used as the transfer destination.
4. Open the three NearBlocks transactions and point out that each destination is a different hex implicit account.
5. Refresh the Veil scanner and show all three payments discovered for Alice.
6. Spend one payment back to a sender using the derived scalar and show the NearBlocks receipt.
7. Show the Sputnik DAO FunctionCall payout and the scanner marking its stealth recipient owned.
8. Close with the honest limits: amounts, timing, senders, and later sweeping remain linkable; the app is testnet-only.

Use `docs/VERIFIED.md` for exact links and the two committed evidence JSON files. Before recording on the hosted URL, click Resolve, Refresh, and Build router action and verify each produces visible output. Do not show or narrate private keys.
