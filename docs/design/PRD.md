# Veil frontend PRD

## Summary

Veil is a testnet wallet for private receiving on NEAR named accounts. The redesign should feel like a focused trading-wallet product: compact, stateful and trustworthy, with a charcoal foundation and one restrained gold accent. It must remain recognizably Veil rather than reproduce Binance, Coinbase, Kraken or any other product.

- Stage: testnet prototype
- Niche: fintech / privacy infrastructure
- Audience: NEAR users, merchants, freelancers, donors and auditors
- Primary goal: show the connected user's real scanned NEAR balance and make wallet actions easy to find
- Primary CTA when disconnected: Connect wallet
- Primary CTA when connected but not registered: Enable Veil
- Architecture: dependency-light static HTML, CSS and ES modules

## Product principles

1. Show wallet facts, not market theatre. The overview reports NEAR totals obtained from the application's scan and account data. It does not invent fiat values, price movement, portfolio charts, yield, volume, P&L or other market data.
2. Keep the next action obvious. The overview stays visible beside keyboard-accessible Send, Receive and Transfer tabs. Inbox and Auditor remain available as first-class destinations.
3. Put risk next to the action that creates it. Public-data limits, transaction status, storage deposits and relinking warnings appear in the relevant flow rather than in promotional copy.
4. Separate guidance from proof. Explanatory text can describe intended behavior; only live RPC results, wallet responses, transaction hashes and explorer links are runtime evidence. The UI must not imply an audit, privacy guarantee, completed transaction or measured performance without evidence.
5. Preserve Veil identity. Use the repository's original Veil SVG mark and favicon. Do not import logos, icons, screenshots, illustrations, copy or other assets from reference products.

## Information architecture

The app shell uses a compact header, wallet identity/network state and a main tab set:

- **Overview:** connected named account, testnet status, total scanned NEAR, available stealth accounts and recent activity. Totals come from actual scan/account results and expose loading, stale, empty and error states.
- **Send:** pay a Veil name or supported destination through the private-send flow.
- **Receive:** derive or restore NEP-413 keys, register a receiving name and copy the registered name.
- **Transfer:** spend from a selected owned stealth account to an adjustable destination and amount.
- **Inbox:** retain announcement scanning, incoming payment rows, transaction evidence and empty/error states.
- **Auditor:** retain read-only scanning with a view key and make the absence of spend authority explicit.

On narrow screens the same destinations may reflow into a bottom or horizontally scrollable tab bar, but labels, ordering and current-tab state remain unambiguous. No workflow is hidden behind hover.

## Wallet overview

The overview is an account surface, not an exchange dashboard.

- Display the connected NEAR account and `testnet` network label.
- Calculate total scanned NEAR from the current scan result. If totals combine multiple stealth accounts, make that scope clear and avoid double counting.
- Keep exact NEAR values available; do not fabricate fiat conversion or live pricing.
- Distinguish scan-in-progress, scan-complete, no-payments, disconnected, RPC failure and stale-result states.
- Link transaction hashes and relevant accounts to the testnet explorer when evidence exists.
- Never use sample balances in a state that could be mistaken for a connected wallet's data. Demo fixtures, if retained for development, must be visibly marked and excluded from production state.

## Wallet actions

### Send

The Send tab exposes asset, network, destination and amount as labeled controls. V1 asset is NEAR and network is NEAR testnet; fixed values may be presented as read-only selectors so the transaction context is still explicit. Destination accepts the supported Veil name/account form. Amount validation must cover empty, invalid, zero, insufficient-balance and fee/storage requirements before wallet approval. After submission, show pending, success and failure states plus a transaction hash when available.

V1 private sends remain sequential because derivation uses the next router index. The interface must prevent ambiguous repeat submission while a send is unresolved.

### Receive

Receive is a short stateful flow, not a marketing panel:

1. Connect a NEAR testnet wallet.
2. Request the NEP-413 signature used to derive or recover Veil keys.
3. Register the chosen receiving name, including wallet approval and storage-deposit context where applicable.
4. Show the confirmed registered name with a copy action.

Derivation and registration are distinct states. Copy is enabled only when a name is present; a local derived name is not presented as registered until registration has runtime confirmation. Keys stay in browser memory and never appear in logs, URLs, analytics, evidence panels or copyable output.

### Transfer

Transfer spends from an owned stealth account. The source is an explicit selector populated by scan results; the destination and NEAR amount remain adjustable until confirmation. The review state shows source, destination, amount, network and known fee/storage implications.

Before wallet approval, present a prominent, plain-language warning: transferring to the user's named account or another identity-linked destination can publicly relink the stealth account and weaken privacy. Acknowledging the warning does not claim anonymity or make the transfer private. Disable submission when the selected source is unavailable, ownership is not established, the amount is invalid or required data is stale.

## Trust, privacy and evidence

The interface must state that NEAR transaction amounts, timing, sender identity, recipient accounts and token contracts can remain public. Veil reduces address reuse for receiving; it does not hide the base chain or guarantee anonymity.

- Guidance includes labels, warnings, expected steps and privacy explanations.
- Runtime proof includes current RPC data, wallet-returned status, confirmed registry state, transaction hashes and explorer records.
- Design references are inspiration only and are not evidence that Veil's implementation behaves correctly.
- Do not display invented audits, security badges, user counts, performance metrics, privacy scores or transaction success rates.
- The Auditor accepts a view key for read-only incoming-payment scans and must never imply spending capability.

## Visual direction

- Use a near-black/charcoal canvas, neutral text hierarchy and one gold accent for selected state, focus and primary commands.
- Prefer dense, aligned wallet rows, segmented tabs, restrained dividers and compact controls over promotional hero composition or decorative cards.
- Use the original Veil SVG logo and favicon already owned by the project.
- Do not copy reference-product layouts one-for-one or use their brand assets, typography, icons or trade dress.
- Avoid gradients, glow, glassmorphism, oversized balances, fake charts, ticker strips and decorative market statistics.
- Preserve 44px targets, visible focus, semantic labels, status announcements, contrast, mobile reflow and reduced motion.

## States and acceptance criteria

- The static app loads anonymously and identifies itself as testnet.
- A disconnected user can understand the product without seeing a fictional wallet balance.
- Overview totals equal the totals produced by the active scan/account-data path.
- Send, Receive and Transfer are directly accessible and expose asset, network, destination and amount where applicable.
- Receive distinguishes NEP-413 derivation, registration confirmation and copying the registered name.
- Transfer supports selecting a stealth source and editing destination/amount, and requires an explicit relinking warning before approval.
- Inbox and Auditor behavior remains available after the redesign.
- Wallet, RPC, scan, empty, loading, stale, pending, success and failure states are represented without claiming unobserved outcomes.
- Keys never leave browser memory or appear in logs, URLs, evidence or visible output.
- The app uses Veil-owned logo/favicon assets and no copied third-party assets.
- Focus, labels, contrast, reduced motion and responsive layouts satisfy `AGENTS.md`.
- The build remains static and testnet-only.

Passing these design criteria is guidance-level acceptance. Runtime correctness still requires build/tests, wallet approval exercises, RPC scans and explorer verification; documentation alone is not proof that those checks passed.
