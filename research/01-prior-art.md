# Prior art

Research completed 2026-11-10. These comparisons describe documented designs and do not claim that Veil provides their full privacy properties.

## ERC-5564 and ERC-6538

[ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) specifies stealth meta-addresses, ephemeral public keys, announcements, view tags, and separate spending/viewing capabilities. Its reference scheme is secp256k1-oriented. [ERC-6538](https://eips.ethereum.org/EIPS/eip-6538) specifies a registry for mapping an entity to a stealth meta-address and supports direct or delegated registration.

Veil keeps this application shape but adapts the key and destination model to NEAR Ed25519 implicit accounts. The registry key is a NEAR named account and the announcement is stored by the router contract.

## Umbra

[Umbra](https://github.com/ScopeLift/umbra-protocol) is an EVM stealth-address protocol. Its documented model uses a reusable stealth identity and fresh receiving addresses; its documentation also warns that poor withdrawal hygiene can undo privacy. Umbra is a precedent for wallet UX and announcements, but its EVM contract/account model is not directly portable to NEAR.

## Fluidkey

[Fluidkey](https://docs.fluidkey.com/) is a wallet-oriented stealth-account system. Its technical documentation describes recoverable stealth-account initialization data and an ENS resolver integration. It is a useful precedent for managing many one-time accounts behind a familiar identity, while Veil keeps the named-account registry and scanning logic in NEAR contracts and SDK code.

## Monero

[Monero's official stealth-address description](https://web.getmonero.org/resources/moneropedia/stealthaddress.html) describes sender-created one-time destinations, a private view key for detecting incoming outputs, and a separate spend key. Monero additionally hides sender ambiguity and amounts using ring signatures and RingCT; Veil does not claim those properties.

## Nervos CCC stealth extension

The [CCC stealth extension proposal](https://talk.nervos.org/t/introducing-a-stealth-address-extension-for-ccc/10802) describes a reusable receiving identity, ECDH-derived one-time destinations, view-key scanning, and fresh change. The post labels the package as a prototype with live integration and upstream review still pending. It is the direct conceptual precedent for Veil's sender/scan/spend flow, but CKB's lock-script model differs from NEAR's implicit-account model.

## NEAR-specific work

[NEAR's account documentation](https://github.com/near/nearcore/blob/master/docs/DataStructures/Account.md) confirms that a 64-character hex NEAR-implicit account is the public Ed25519 key bytes and that sending to it creates the account. [NEAR's NEP repository](https://github.com/near/NEPs) was checked for a stealth-address standard; no finalized NEAR stealth-address NEP was identified in the repository at research time. A separate [SIP Protocol privacy SDK](https://docs.sip-protocol.org/sdk-api/near-privacy/) documents Ed25519 stealth functions for NEAR/Intents, but it is an external project, not a NEAR core standard.

## Design implications

Veil's distinct NEAR contribution is combining the established meta-address/view-key pattern with native implicit-account creation, avoiding a new output lock or account type. The honest boundary remains: amounts, timing, sender identities, and later consolidation remain observable.
