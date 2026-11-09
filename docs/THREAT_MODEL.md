# Threat model

## Protected

- The association between a named NEAR account and individual receiving destinations.
- The recipient's ability to discover and spend their stealth accounts.
- Selective read-only disclosure through the view key.

## Public

- Sender identity, token, amount, timing, and announcement data.
- Network-level metadata such as RPC or network observer information.
- Any later consolidation that links multiple stealth accounts.

## Out of scope for the MVP

- Hiding amounts or sender identity.
- Anonymous RPC access.
- Mainnet deployment or mainnet spending.
- Production audit claims.
