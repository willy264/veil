# X thread draft

Draft only. Nothing has been posted. Attach `results/veil-demo-v2.mp4` (1:59.9) to post 1 after the team has reviewed it.

**1/**

Your .near name is a public ledger: anyone can look up every payment you receive.

Veil gives NEAR names private receiving. People still pay your name, but each payment lands in a fresh account only you can find and spend.

Built at NEAR HACKATHON @NEARProtocol #NEARHackathon

**2/**

How NEAR makes this simple: each payment address is an ordinary NEAR implicit account, whose ID is a one-time public key.

No new account type, no contract wallet. One wallet signature derives your keys in the browser, and only you can spend.

**3/**

Try it in 30 seconds, no wallet needed: open veil-eta-khaki.vercel.app → Auditor → veil-judge-recv.testnet + the auditor key in the README.

3 private payments appear. The name's public history shows none of them.

Tested end to end with Meteor Wallet on testnet.

**4/**

Testnet prototype. Amounts, timing and senders stay public, and spending links a payment to its destination.

Code, spec draft and receipts: github.com/willy264/veil

What would you use private receiving for? @NearBuilders @NearLegion

## Claim sources

- **Public ledger:** the [public visibility table](../../research/02-problem-evidence.md).
- **Implicit account, ID = public key:** the [NEP draft](../NEP-DRAFT-stealth-meta-address.md#spend) and the live RPC check in [results/veil-demo-v2.json](../../results/veil-demo-v2.json).
- **30-second path, 3 payments, none on the public history:** [judge demo evidence](../../results/judge-demo-20261114014907.json), checked on the hosted app and the NearBlocks API on 14 November 2026.
- **Tested with Meteor:** [wallet test evidence](../../results/wallet-test-meteor-20261114.json).
- **Limits:** [README honest limits](../../README.md#honest-limits).
