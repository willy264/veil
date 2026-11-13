# Veil product polish

Subject: private receiving for NEAR named accounts.
Audience: testnet recipients, senders and auditors.
Moment: someone wants to receive a payment without putting it on their named account's public history.
Primary job: enable receiving, share a name, send privately, and find the payment.
Characteristic proof: the public name's history beside the recipient's private inbox.

## Design contract

Read the kit at `C:/Users/HP/Downloads/design-kit/design-kit`: AGENTS, core text-copy, components, QA gates, design system and motion, plus the fintech profile. The user's current instruction takes priority over its starter-stack and palette defaults. Retain this static app, every existing colour and font token, and its two existing radii. No React migration, new fonts, financial-regulation claims, stock imagery or effects library.

Tone: clear, calm, specific. Avoid: trading terminal, developer console, promotional claims. Expression stays in the existing typography and green accent. New UI copy implements the user's named labels and plain-language brief; it does not require another approval round. The app handles testnet NEAR, so banking/KYC guidance in the generic fintech pack is not applicable.

## Structure

Header and wallet status. Existing headline and a plain explanation. Two-column public/private proof with an explicit Example label until recipient keys exist. Small Network details disclosure. Two numbered paths, Receive and Send, followed by full-width Private payments and Auditor sections. Technical explanations live in How it works. Mobile stacks in reading order.

One primary action for the active receive step; other steps are secondary or disabled with an explanation. Send resolves the name on blur, validates the amount, requests a wallet signature once and shows a receipt. The page's only content highlight marks a newly discovered payment with an opacity transition; reduced motion uses a static label.

## Content and proof

| Claim / content | Source / condition |
|---|---|
| Separate receiving accounts | Existing browser derivation and `results/demo-20261111221900.json` |
| Three illustrative receipts before connection | Explicitly labelled Example, never presented as live activity |
| Public activity | NearBlocks testnet API, linked to the connected account; failures are not reported as an empty history |
| Private payment balances | Final testnet `view_account`, integer conversion to NEAR with four decimals, half-up rounding |
| Auditor cannot spend | Existing view-only scanner; no spending scalar is created in auditor mode |
| Delivered privately | Only after a successful transaction result; unknown results stay unconfirmed |
| Privacy limits | Amounts, timing and senders stay public; spending to a named account creates a link |

No invented regulators, guarantees, rates, testimonials or performance figures. Keep existing limitations and key-recovery guidance accessible. Placeholder names are examples, not prefilled account selections.

## State and accessibility rules

Empty: icon and one next step. Loading: stable space, spinner, meaningful label. Errors: plain message and retry, without assuming money did not move after an uncertain submission. Success: amount, destination link and public receipt. Prevent duplicate submits. Wallet changes clear all private state. Inputs keep labels and linked errors. No private key or auditor key enters logs, persistence, telemetry or server requests.

Use existing `--muted` or `--subtle` tokens for control borders that need 3:1 contrast; do not change their values. Preserve palette/font tokens byte-for-byte. Native buttons, forms, ordered steps and disclosures supply keyboard behaviour. Use one custom outline SVG family with `currentColor`; no icon dependency or emoji. Screenshot at 1440 and 390, critique, fix and repeat. Run the broader kit widths, axe, keyboard checks, reduced-motion checks and production lab performance. Field p75 metrics cannot be claimed from a lab run.

Hard stop: 14 Nov 2026 at 10:00 UTC. Cut mobile table extras, then receipt copying, then illustrative data if necessary. Keep comparison, two paths, NEAR formatting and plain language. The existing demo video must be re-recorded after this polish.
