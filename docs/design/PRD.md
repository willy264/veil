# Veil frontend PRD

## Summary

Veil lets a NEAR named-account owner receive payments at fresh implicit accounts and scan them privately with a viewing key.

- Stage: testnet prototype
- Niche: fintech / privacy infrastructure
- Primary goal: enable a recipient and show the private inbox
- Secondary goal: let a sender pay a registered name and show the public/private comparison
- Primary CTA: Connect wallet
- Secondary CTA: Resolve name

## Trust and flows

The recipient connects a testnet wallet, derives keys from a NEP-413 signature, registers a name, scans announcements and can spend from an owned stealth account. The sender resolves the name, submits a private payment and waits for finality. An auditor pastes a view key and can scan incoming payments without a spend key.

The interface must explain that amounts, timing, sender identity and token contracts remain public. Spending to the named account creates a link. V1 sends are sequential because the derivation uses the next router index.

## UI acceptance

- Public app loads anonymously on testnet.
- All wallet, RPC, empty, loading and failure states are visible in the page.
- Keys never leave browser memory or appear in logs, evidence or UI output.
- Focus, labels, contrast, reduced motion and mobile reflow pass the frontend standard.
- Build remains static and testnet-only.
