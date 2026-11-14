# NEP draft: stealth receiving for named accounts (Veil scheme 1)

**Status:** engineering draft for review, not a protocol standard. It needs no protocol change.

## Summary

A named account publishes two Ed25519 public keys in a registry. A sender derives a fresh one-time public key `P` from them and pays the implicit account `hex(P)`. The sender then posts an announcement that only the named account's view key can recognise. Only its spend key can produce the signing scalar for `P`.

## Motivation

A `.near` name is a public ledger of everything it receives. NEAR implicit accounts already make "an account for any Ed25519 public key" native, so stealth receiving needs no new account type, no contract wallet and no relayer for NEAR payments. This follows [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) and [ERC-6538](https://eips.ethereum.org/EIPS/eip-6538), adapted to Ed25519 and implicit accounts.

## Specification

### Notation and encodings

- `G` is the Ed25519 base point and `L = 2^252 + 27742317777372353535851937790883648493` is the prime subgroup order.
- **Scalars** are integers mod `L`, encoded as 32-byte little-endian. `LE(b)` reads bytes `b` as a little-endian integer.
- **Points** are encoded as 32-byte RFC 8032 compressed Edwards points, written as 64 lowercase hex characters in JSON.
- `‖` is byte concatenation. `UTF8(s)` is the UTF-8 encoding of `s`. `BE32(i)` is `i` as a 4-byte big-endian unsigned integer.
- `SHA-256` and `SHA-512` are FIPS 180-4. `HKDF-SHA256` is RFC 5869.

### Point validation

Implementations must reject a point that fails to decode, is the identity, or is not torsion-free (`L·X ≠ identity`). This applies to registered spend and view keys, announced ephemeral keys and announced receiving accounts. The reference registry and router contracts enforce it on-chain.

### Key request (NEP-413)

The account owner signs this [NEP-413](https://github.com/near/NEPs/blob/master/neps/nep-0413.md) payload with a full-access key:

| Field | Value |
|---|---|
| `message` | `Veil key derivation v2: derive private receiving keys for this NEAR account.\nAccount: <accountId>` |
| `recipient` | `veil-eta-khaki.vercel.app` |
| `nonce` | `SHA-256(UTF8("veil-key-derivation:testnet:v2:" ‖ accountId))` (32 bytes) |

The wallet returns a 64-byte Ed25519 signature `sig`. Ed25519 signing is deterministic, so the same wallet key always yields the same `sig`.

The earlier v1 request used the message prefix `Veil key derivation v1`, `recipient = accountId` and the nonce domain `veil-key-derivation:testnet:v1:`. Implementations should offer it only to open payments sent to v1 keys.

### Key derivation

```
okm = HKDF-SHA256(ikm = sig, salt = UTF8("veil-nep413-v1\n" ‖ accountId), info = UTF8("spend-and-view"), length = 64)
s   = LE(okm[0..32])  mod L   (if 0, use 1)
v   = LE(okm[32..64]) mod L   (if 0, use 1)
S   = s·G                     spend public key
V   = v·G                     view public key; v is the auditor key
```

### Registry record

`register(spend_pub_hex, view_pub_hex, scheme_id)` stores this record for the predecessor account, which must attach a storage deposit. `get_meta(account_id)` returns it:

```json
{ "spend_pub_hex": "<hex S>", "view_pub_hex": "<hex V>", "scheme_id": 1 }
```

### Send

1. Read the recipient's record and validate `S` and `V`.
2. Read `i = total_announcements()` from the router. This is the derivation index.
3. Pick a fresh random scalar `r` in `[1, L−1]` from a CSPRNG. Compute `R = r·G` and the shared point `Z = r·V` (32 bytes compressed).
4. Compute:

   ```
   h   = LE(SHA-256(UTF8("veil-v1") ‖ Z ‖ BE32(i))) mod L
   P   = S + h·G
   tag = SHA-256(UTF8("veil-tag") ‖ Z)[0]
   ```

5. Call `send_near(stealth_account = hex(P), ephemeral_pub_hex = hex(R), view_tag = tag)` with the amount attached. The router transfers the amount to the implicit account `hex(P)`, creating it, and appends an announcement in the transfer's callback.

### Announcement

```json
{ "index": 4, "block_height": 277551667, "token": "router2.veil-williams.testnet",
  "stealth_account": "<hex P>", "ephemeral_pub_hex": "<hex R>", "view_tag": 233,
  "amount": "50000000000000000000000" }
```

`index` is the router's count when the announcement was stored. `token` is the router's own account ID for NEAR, or the token contract for NEP-141. `get_announcements(from_index, limit)` returns at most 100 rows.

### Scan

For each announcement with ephemeral key `R` and stored index `n`:

1. Validate `R` and compute `Z' = v·R`.
2. If `SHA-256(UTF8("veil-tag") ‖ Z')[0] ≠ view_tag`, skip it. This rejects about 255 of every 256 unrelated announcements with one scalar multiplication.
3. For `j = n, n−1, …, max(0, n−32)`, compute `h_j` and `P_j = S + h_j·G` as in Send. If `hex(P_j) = stealth_account`, the payment is owned and its signing scalar is `p = (s + h_j) mod L`.

The window covers sends whose announcement was stored later than the index the sender read, because other announcements landed in between. The stored index is never earlier than the derivation index. The view tag is a filter, not proof of ownership. An auditor holding only `v` runs steps 1–3 without `s`.

### Spend

The receiving account's full-access key is `P`, and `p·G = P`. Sign the NEAR transaction hash `M` with standard Ed25519 using the scalar `p` directly:

```
k     = LE(SHA-512(UTF8("veil-ed25519-nonce-v1") ‖ LE32(p) ‖ M ‖ rand32)) mod L
Rsig  = k·G
c     = LE(SHA-512(Rsig ‖ P ‖ M)) mod L
sig   = Rsig ‖ LE32((k + c·p) mod L)
```

`sig` verifies with RFC 8032 verification against `P`. Implementations must warn that any spend links the receiving account to its destination.

## Reference implementation

- `packages/sdk` (TypeScript) and `apps/web/app.js` (browser), cross-tested for identical output.
- `contracts/registry` and `contracts/router` (near-sdk 5.30).

## Test vectors

All values are hex, generated by `packages/sdk/scripts/vectors.ts` and checked in CI by `packages/sdk/test/vectors.test.ts`. The full set is in [`verification/scheme1-vectors.json`](../verification/scheme1-vectors.json). The wallet signature is a fixed test value, not a real wallet output.

| Step | Value |
|---|---|
| `accountId` | `alice.testnet` |
| request `nonce` | `524b7ab1a12acb6965017c574f0763406c71bbb7400e2f9a818cbdb68babd171` |
| `sig` | `0104070a0d101316191c1f2225282b2e3134373a3d404346494c4f5255585b5e6164676a6d707376797c7f8285888b8e9194979a9da0a3a6a9acafb2b5b8bbbe` |
| `s` (LE) | `be651aed11f361af19b44d4eb424e0ae0699c893997699918193deef96426101` |
| `v` (LE) | `2857bd3fc8b2fd76b9f256145ce0e0d642ad7c2d64940664d5acdc563ce4cb03` |
| `S` | `716f27790c70804a94fbe483a1eb0680afa4d353c7a283a72074b75f971c7a06` |
| `V` | `44914c0f592dda87d4b83d1166282e7f103eec67ffa5a4bcbb05d9fc53502270` |
| `r` (LE) | `efcdab8967452301efcdab8967452301efcdab8967452301efcdab8967452301` |
| `i` | `7` |
| `R` | `89735cc0223ef615eae81a4d5e32a4e394d2c2e0f88a3ae4bfc5e7c4673b6651` |
| `Z` | `560bd7fce6c9394ce5e4ed7949a340da38507c8a1bef32cf3bd068864867a67a` |
| `h` (LE) | `7a36f78c96d6cfd79e3959a2df71cc4b9322bb52f6b06bcd0d9974fa06728f09` |
| `P` (receiving account) | `2d0b6d224fb580cdd1f88bd94a15e613367f1bf84d3b2dff956ee754ee2e7a0e` |
| `view_tag` | `61` |
| stored index `n` | `9` (found at `j = 7`) |
| `p` (LE) | `389c117aa8c93187b8eda6f09396acfa99bb83e68f27055f8f2c53ea9db4f00a` |
| `M`, `rand32` | `UTF8("veil-scheme1-vector")`, 32 zero bytes |
| `sig` over `M` | `a4a2a3781c16e36dccdf276c104fd15283380fe931d0a9bec758f4eb01ad790896569e8d76f3dc9001b6f0d25a93e8d131facff9278e4faedff16783dd3e1e00` |

## Security considerations

- **Signature-derived keys.** Anyone holding `sig` holds the spend key. The `recipient` names the Veil app so wallets can show who is asking. A phishing site can still request the same payload.
- **Hash to scalar.** `h` and the key scalars reduce 256-bit values mod `L`, a slightly non-uniform distribution. It is unpredictable to anyone without `Z` or `sig`.
- **Public metadata.** This scheme does not hide amount, timing, sender, token or later links created by spending.
- **Router dependence.** Announcements are written by a callback after the transfer. The [threat model](THREAT_MODEL.md) lists three known issues in the deployed router and their fixes.

## Alternatives

- **ERC-5564 / ERC-6538:** the same dual-key pattern on secp256k1 with a separate announcer and registry. NEAR's Ed25519 implicit accounts remove the need for a smart-account wallet per receiving address.
- **An indexer instead of an on-chain log:** cheaper storage, but scanning then depends on an off-chain service.
