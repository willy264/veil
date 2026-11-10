# NEP draft: stealth receiving for named accounts

**Status:** engineering draft for review, not a protocol standard.

## Abstract

This proposal defines an application-level convention for receiving NEAR and NEP-141 assets through fresh implicit accounts while retaining a human-readable NEAR name as the public receiving identity.

## Registry record

The registry maps a named account to:

```json
{
  "spend_pub_hex": "32-byte Ed25519 point",
  "view_pub_hex": "32-byte Ed25519 point",
  "scheme_id": 1
}
```

The record is replaced by the named account owner and is read through `get_meta`. A registry deposit covers storage.

## Send and announce

The sender samples an ephemeral scalar `r`, computes the ephemeral point `R = rG`, and derives a shared point from the recipient view point. A domain-separated hash and output index produce `h`; the one-time public key is `P = S + hG`, encoded as the 64-character implicit Ed25519 account ID. The sender pays `P` and announces `R`, a one-byte view tag, token, amount, and output index through the router.

The view tag is a cheap rejection filter. It is not a proof of ownership and must never be treated as authentication.

## Scan and spend

The recipient computes the shared point with the private viewing scalar, checks the view tag, and recomputes `P`. The corresponding private scalar is `s + h`. A relayer may submit a transaction from the implicit account, but only the derived spending scalar can authorize it. An auditor with only the viewing scalar can identify incoming payments but cannot produce a spend signature.

## Interoperability and safety

Implementations must domain-separate scheme IDs, validate canonical points and scalar ranges, bind the announcement index into the derivation, reject malformed inputs, and preserve the token and amount fields. Implementations must warn before consolidating multiple stealth accounts into one destination.

This convention does not hide amount, timing, sender identity, token identity, or later correlation caused by sweeping. It does not require a protocol change or a new account type. The current Veil implementation uses Ed25519 implicit accounts; a separate scheme ID is required for secp256k1 or Ethereum-style accounts.
