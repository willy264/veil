# What a public `.near` name reveals

Research completed 2026-11-10 using public protocol/DAO accounts only. The examples were confirmed to exist through final mainnet RPC account views; values and transaction histories change continuously.

| Public account | Publicly observable today | Privacy leak for named receiving |
|---|---|---|
| `near` | Balance, storage usage, code hash, access-key list, contract calls, transfers, senders, recipients, amounts, and block timing | A payment sent directly to `near` is visibly addressed to the same readable name every time |
| `proximity-labs.near` | Account state and complete public transaction/receipt history; its current account state is queryable even when balance is zero | Incoming transfers can be grouped by the stable organization name and correlated with senders and timing |
| `ref-finance.near` | Named account state, fungible-token interactions, contract calls, transfers, and public receipts | Users and counterparties can see the named protocol account's payment relationships and amounts |
| `mintbase.near` | Named account state, contract activity, transfers, token interactions, and block timestamps | A merchant/creator relationship is directly exposed when the named account is the payment destination |
| `sputnik-dao.near` | DAO balance, policy/contract state, proposals, votes, calls, transfers, and receipts | Treasury payments are publicly attributable to the DAO name and can be graphed by recipient, amount, and time |

NEAR's [account model](https://github.com/near/nearcore/blob/master/docs/DataStructures/Account.md) and [developer account documentation](https://github.com/near/docs/blob/master/integrations/accounts.mdx) explain the contrast: named accounts are readable identities, while a NEAR implicit account is a 64-character hex rendering of an Ed25519 public key. Veil routes each payment to a fresh implicit account and publishes only the announcement needed for the recipient to scan it.

The table does not imply that a fresh implicit account hides the sender, amount, timing, token contract, or later consolidation. Those remain in Veil's [honest limits](../README.md#honest-limits).
