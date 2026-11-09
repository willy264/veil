# Architecture

The planned repository has three runtime layers:

1. `packages/sdk`: key generation, stealth derivation, scanning, scalar signing, and client flows.
2. `contracts/registry` and `contracts/router`: public meta-address registration and announcement/payment routing.
3. `apps/web`: receive inbox, private send flow, explorer comparison, and auditor mode.

The first implementation milestone is the SDK cryptographic core and its test vectors. Contracts and UI depend on that interface and on the Gate R testnet proof.
