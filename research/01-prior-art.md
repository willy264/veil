# Prior art

## ERC-5564

**VERIFIED:** ERC-5564 defines stealth addresses, separate spending and viewing keys, ephemeral public keys, view tags, and an announcement contract. Its reference scheme uses secp256k1 and a one-byte view tag. Source: https://eips.ethereum.org/EIPS/eip-5564

**INFERRED:** Veil should preserve the protocol shape while defining a NEAR-specific ed25519 scheme and an announcement format that works with NEAR contracts and RPC.

## ERC-6538

**VERIFIED:** ERC-6538 defines a registry for mapping an entity to a stealth meta-address and supports direct or delegated registration. Source: https://eips.ethereum.org/EIPS/eip-6538

**INFERRED:** Veil's registry can use the NEAR predecessor account as the entity key and keep registration simple for the MVP.

## Umbra, Fluidkey, Monero and Nervos

**UNKNOWN:** A complete, source-backed comparison of Umbra, Fluidkey, Monero, and the Nervos CCC extension is still required before Gate R. The brief identifies the relevant dimensions: gas funding, scanning cost, withdrawal re-linking, view keys, and one-time destinations.

## NEAR-specific prior art

**UNKNOWN:** No claim is made yet about an existing NEAR stealth-address NEP or production implementation. This must be checked against the NEPs repository and NEAR governance/forum sources before submission.

## Confidential Intents

**INFERRED:** Confidential Intents complements Veil rather than replacing it: Veil hides the link between a named account and a receiving destination, while confidential settlement can hide more of the subsequent asset flow. Mainnet use requires explicit human approval and is outside the initial testnet MVP.
