# Veil reference sheet

References guide interaction patterns; they are not implementation proof. "Page content reviewed" means the cited public page's text and image descriptions were retrieved during research, not that its live controls were tested. "Search-confirmed" means the topic was confirmed without a detailed visual review. "User-supplied pattern" records a prior reference supplied for this project.

| Reference | Verification | Take | Avoid |
|---|---|---|---|
| [Binance: How to send and receive crypto](https://www.binance.com/en-NZ/support/faq/detail/02f7eb872eca4a1ea44c775767170d13) | Search-confirmed Send/Receive support article; not treated as a full visual review | Familiar Send/Receive vocabulary and explicit asset, network, destination and amount context | Do not claim its exact layout was inspected; do not copy Binance branding, assets or exchange-only complexity |
| [Coinbase Wallet](https://wallet.coinbase.com/) | Page content reviewed | Clear wallet-action hierarchy and concise account-oriented language | Avoid promotional claims, oversized marketing composition and copied visual treatment |
| [Kraken Wallet](https://www.kraken.com/wallet) | Page content reviewed | Explicit Send/Receive actions and watch-only access | Avoid copying brand identity, illustrations, page structure or unsupported security claims |
| [Ontiver](https://ontiver.com/) | User-supplied pattern | Keep trust details and plain explanatory copy close to decisions | Do not infer current product behavior or reuse assets without a fresh visual/source check |
| [QuickBite](https://quickbiteltd.org/) | User-supplied pattern | Use short, legible progression for multi-step Receive states | Do not import unrelated brand styling or claim that its present page was reviewed in this pass |
| [Trustly travel](https://www.trustly.com/verticals/travel) | User-supplied pattern | Put benefit and supporting proof near the relevant action | Avoid marketing metrics or partner proof that Veil cannot substantiate |
| [Nothin'](https://noth.in/) | User-supplied pattern | Let typography, rhythm and negative space provide hierarchy | Avoid novelty that reduces wallet density, legibility or action clarity |
| [NearBlocks testnet](https://testnet.nearblocks.io/) | User-supplied runtime evidence destination | Use explorer links for public account and transaction evidence when hashes/accounts exist | An explorer link is not proof of privacy, ownership, an audit or application correctness by itself |
| [NEP-413 specification](https://github.com/near/NEPs/blob/master/neps/nep-0413.md) | Primary technical specification | Name the signed-message derivation step accurately and keep its payload/domain context explicit in implementation | Do not describe a signature request as registration or transaction confirmation |
| [NEAR documentation: accounts](https://docs.near.org/protocol/account-model) | Primary technical documentation | Use precise named-account and implicit-account terminology | Do not turn protocol guidance into a claim that a particular wallet/RPC action succeeded |

## Applied direction

The resulting UI is an original Veil wallet: charcoal surfaces, neutral text and one gold accent; compact wallet tabs; real scanned NEAR totals; and the existing Veil SVG logo/favicon. It borrows category conventions, not assets or a one-to-one composition. Overview, Send, Receive and Transfer are the main wallet actions, while Inbox and Auditor remain intact.

The Binance Pay landing page was unavailable during research. It must not be described as visually inspected and contributes no page-specific design claims here. The linked Binance Send/Receive support result supports terminology/discoverability only.

## Guidance versus runtime proof

| Guidance | Runtime proof |
|---|---|
| Reference screenshots/pages, this PRD, labels, flow diagrams and warning copy | Live RPC/account results, scan output, wallet responses, registry confirmation, transaction hashes and NearBlocks records |
| Describes the intended interface and expected states | Demonstrates what happened in a specific execution |
| Can recommend displaying a scanned total or explorer link | Cannot establish that the total is correct or transaction final without running the relevant path |

No reference supports inventing balances, fiat values, audits, security certifications, adoption figures, speed claims or privacy metrics. Any future claim of that kind needs a named source, date, scope and reproducible runtime or audit evidence.
