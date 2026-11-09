# Problem evidence

## Status

This document is an initial evidence plan. Claims are labelled until they are backed by a live public-account query or an authoritative source.

## Core claim

**INFERRED:** A readable NEAR account name makes the account a convenient public aggregation point. A viewer can inspect its account history and associated token activity, which can expose counterparties, timing, and amounts.

## Evidence to collect

Use only public foundation, DAO, or protocol accounts. Never use a private individual as an example.

| Observable | Source to capture | Privacy implication |
|---|---|---|
| Native balance and transfers | NEAR RPC / NearBlocks | Amounts and timing are public |
| Fungible-token holdings and transfers | FT contract views / indexer | Token relationships and counterparties are public |
| NFT holdings and transfers | NFT contract views / indexer | Membership or ownership can be public |
| Account name | NEAR account model docs | A human-readable label is attached to the public activity |

## Honest scope

Veil is designed to hide the recipient link, not the amount, token, sender, timing, RPC metadata, or network-level metadata. Consolidating stealth balances later can re-link them.
