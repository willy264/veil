# Cryptography design decisions

## Scheme

**HYPOTHESIS / PROPOSED:** Scheme A, dual-key ed25519 stealth receiving, is the preferred NEAR-native design.

The recipient has view scalar `v` and spend scalar `s`, with public points `V = vG` and `S = sG`. The sender samples scalar `r`, publishes `R = rG`, and computes `Z = rV`. For output index `i`:

```text
h = H("veil-v1" || encode(Z) || uint32_be(i)) mod L
P = S + hG
account_id = lowercase_hex(encode(P))
view_tag = H("veil-tag" || encode(Z))[0]
```

The recipient computes `Z' = vR`, checks the view tag, derives `P'`, and compares it with the announced implicit account key. The spend scalar is `p = s + h mod L`.

## Required proof

The implementation must prove both:

- a signature made from the derived raw scalar verifies with standard ed25519 verification;
- a funded testnet implicit account can sign and execute a transaction.

Before the live proof, this remained **HYPOTHESIS**. After Gate R on 2026-11-08, both required proofs are **VERIFIED**: the signature passes standard Ed25519 verification locally, and a funded derived implicit account successfully signed a NEAR testnet transfer.

**VERIFIED locally (2026-11-08):** The TypeScript prototype creates a derived raw-scalar signature that passes standard `@noble/curves` Ed25519 verification. This does not prove NEAR transaction acceptance; that requires a funded testnet account and a confirmed transaction.

## Security constraints

- Hash encoded points, not implementation-specific point objects.
- Use domain separation for derivation and view tags.
- Reject malformed or low-order points.
- Keep spend scalars out of logs and unencrypted persistent storage.
- Treat an exported view key as read-only disclosure, never spending authority.

## Fallback

**HYPOTHESIS:** If raw-scalar ed25519 signing fails on testnet, evaluate NEAR's Ethereum-style implicit-account path and document the compatibility and signing tradeoffs before switching schemes.
