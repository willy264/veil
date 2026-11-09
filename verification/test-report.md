# Verification report

## 2026-11-08

### Commands

```text
pnpm typecheck
pnpm test
```

### Results

- **PASS:** TypeScript type checking for `@veil/sdk`.
- **PASS:** 5 SDK assertions pass in Vitest; the long V1 run was moved to a standalone process to avoid Vitest worker progress timeouts.
- **PASS:** An owned announcement is recovered from the view key and spend public key.
- **PASS:** An unrelated announcement is rejected.
- **PASS:** A signature generated from a raw derived scalar verifies with standard `@noble/curves` Ed25519 verification.
- **PASS:** Standalone V1 run: 10,000 sends, 256 decoys, 0 false negatives, 0 false positives, and 10,000 distinct stealth accounts.
- **PASS:** V2 verifies different sends produce different public stealth accounts and do not include the recipient public meta-address.
- **PASS:** V3 verifies a view-only-derived scalar does not verify against the recipient spend public key.

### Not tested yet

- Contract sandbox behavior and router refund callback.
- Full SDK send/scan/spend integration flows.

### Contract checks

- **PASS:** `cargo fmt --all -- --check` for the contract workspace.
- **PASS:** `cargo check --workspace --target wasm32-unknown-unknown --message-format=short` for `veil-registry` and `veil-router`.
- **BLOCKED:** Host-side `cargo test --workspace` could not complete in the current Windows GNU toolchain because the native dependency requires a compatible linker; a separate `cargo test --test sandbox_round` process is also holding Cargo's package lock. No contract test result is claimed.
