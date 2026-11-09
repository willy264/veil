# Technical verification

## Status

Initial design only. No testnet transaction is claimed here.

## Risks to verify

1. NEAR implicit account encoding and creation semantics.
2. Whether a raw ed25519 scalar can sign a NEAR transaction accepted by standard verification.
3. FT storage registration and sender-paid storage costs.
4. Router atomicity and refund behavior for NEAR and NEP-141 transfers.
5. Announcement pagination and scan cost.

## MVP flow decision

**HYPOTHESIS:** Require the sender to include a small NEAR stipend with each private payment. This makes a fresh implicit account able to pay a later transaction and keeps gas sponsorship tied to the sender already visible on-chain. A relayer can be added later.

**UNKNOWN:** The stipend and FT storage amount must be measured on testnet and recorded with transaction links.

## Gate R result

**VERIFIED (2026-11-08):** A `0.05 NEAR` funding transfer was sufficient for the tested stealth account to send `0.01 NEAR` back. This is not yet the minimum stipend for an FT transfer; FT storage and transfer measurements remain pending.
