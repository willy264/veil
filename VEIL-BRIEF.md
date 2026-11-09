# VEIL: Full Build Brief for the Coding Agent

**Lead:** Partner B. **Tracks:** `privacy` (primary), `open`. Read `COMMON-RULES.md` first; its guardrails override this brief.

> One sentence: **Veil gives every `.near` name private receiving. People still pay `degen.near`, but each payment lands at a fresh one-time account that only the owner can find and spend, so the name's public history stays empty.**

**Inspiration (read it, don't copy code):** the Nervos stealth-address extension for CCC, https://talk.nervos.org/t/introducing-a-stealth-address-extension-for-ccc/10802. It uses meta-addresses with view and spend keys, ECDH, one-time destinations, view-key scanning, separate spending, and honest limits.

---

## PHASE 0: Context (≈30 min)
1. Record hours remaining to 2026-11-14 23:59 UTC in `execution/task-ledger.md`.
2. Ask the human for the testnet account names (e.g. `veil-<name>.testnet`) and whether a 1Click JWT and a mainnet account exist. Both are optional.
3. Check the toolchain against COMMON-RULES §3.

## PHASE 1: RESEARCH FIRST (≈5–6 hours; no product code before Gate R)
Label everything VERIFIED, INFERRED, HYPOTHESIS or UNKNOWN, with sources.

### R1. Prior art → `research/01-prior-art.md`
Study these and summarise each:
- **ERC-5564** (stealth addresses): https://eips.ethereum.org/EIPS/eip-5564
- **ERC-6538** (stealth meta-address registry): https://eips.ethereum.org/EIPS/eip-6538
- **Umbra** (Ethereum stealth payments) and **Fluidkey** (Base). What UX did they ship, and what problems did they hit (gas funding, re-linking on withdrawal, scanning cost)?
- **Monero** one-time addresses and view keys: the original dual-key scheme.
- The **Nervos CCC stealth extension** above, its Obscell lock, and its listed limits.
- On NEAR, check whether any stealth or private-receive project or NEP exists. Search the NEPs repo (https://github.com/near/NEPs), gov.near.org, and X for #NEARHackathon privacy entries. Record anything found.
- **NEAR Confidential Intents** and the 1Click `confidentiality` parameter: https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps.md. Explain how Veil complements them: Veil hides *who received*; Confidential Intents can hide flows.

### R2. Problem evidence → `research/00-brief.md`
Show how much a `.near` name exposes. Use NearBlocks or FastNEAR APIs on a few public named accounts: balances, FT and NFT holdings, counterparties. Present a "what anyone can see about any .near name" table. Use only well-known public accounts (foundations, DAOs), never private individuals. Optionally cite crypto wrench-attack and phishing-targeting data. Use privacy-related statements from the judges Illia and Mert only if they are sourced.

### R3. Cryptography design (the critical research) → `research/03-design-decisions.md`
NEAR implicit accounts: the account ID is the lowercase hex of a 32-byte **ed25519** public key, and the account is created when funds arrive. Verify this at https://docs.near.org/protocol/account-id and in the implicit-accounts docs.

**Scheme A (preferred): ed25519 dual-key stealth**
- **Recipient** keeps scalars `v` (view) and `s` (spend), with `V = v·G` and `S = s·G` on the ed25519 group. The order `L` is the prime subgroup order. The meta-address is `(S, V)`.
- **Sender** picks a random scalar `r` and computes `R = r·G` and the shared point `Z = r·V`. Then:
  - `h = H("veil-v1" ‖ Z ‖ i) mod L`, where `i` is an output index (0 for single sends);
  - `P = S + h·G`;
  - the stealth account is `hex(P)`;
  - the view tag is the first byte of `H("veil-tag" ‖ Z)`.
- **Recipient scanning:** compute `Z' = v·R` and check the view tag first (this skips about 255/256 of announcements). On a tag match, compute `P' = S + h'·G` and compare it with `P`.
- **Spend key:** `p = (s + h) mod L`. NEAR transactions need an ed25519 signature for public key `P` made directly with scalar `p`, not from a seed. Implement RFC 8032-compatible signing from a raw scalar:
  - nonce `k = H(domain ‖ p ‖ msg ‖ random) mod L`
  - `Rsig = k·G`
  - `S_sig = (k + H(Rsig ‖ P ‖ msg)·p) mod L`
  - The result must verify with **standard** ed25519 verification. Use `@noble/curves` ed25519 point arithmetic (verify the current version and its API).
- **Required proofs before Gate R:**
  - (1) Unit test: a signature from a derived `p` verifies with standard `ed25519.verify` against `P`.
  - (2) Testnet proof: send 0.05 testnet NEAR to `hex(P)`, then **sign a transaction from that implicit account with the scalar signer** (e.g. a transfer back) and see it succeed on chain. Log the tx hash in `docs/VERIFIED.md`.
- Check for low-order and cofactor issues: reject `R` and `P` that aren't in the prime-order subgroup, and hash with point encodings. Document this.

**Scheme B (fallback if A fails the testnet proof): secp256k1 ETH-implicit accounts**
NEAR supports `0x…` ETH-style implicit accounts (wallet-contract based; verify the current NEP and docs). With secp256k1, use the exact ERC-5564 SECP256k1 scheme (scheme ID 1). Bonus: meta-addresses would be compatible with Ethereum stealth tooling. Verify how transactions are signed for these accounts; it may be harder. Choose A or B and record why.

### R4. Practical flows → `research/02-tech-verification.md`
- **Gas funding:** a fresh stealth account holding only an FT has no NEAR for gas. Decide on a sender-paid **gas stipend**, e.g. 0.01–0.02 testnet NEAR, sent along with the payment. That's acceptable because it links only the sender, who is already linked. Alternatively, a relayer pays gas via meta-transactions (NEP-366), and you'd need to verify relayer availability. Pick one and document it.
- **FT storage:** the stealth account must be registered on the FT contract via `storage_deposit`, paid by the sender. Measure the cost.
- **Announcement storage:** cost per announcement on-chain. Decide on a paginated on-chain log versus events plus an indexer. Recommended: an on-chain paginated log, so scanning needs only RPC and no indexer.
- **Batching:** whether a single transaction can do `storage_deposit` and `ft_transfer` on the token contract (same receiver, so a batch is OK), plus the announcement (a different receiver). Design a router contract so the user signs as few transactions as possible.
- **Withdrawal privacy:** sweeping many stealth accounts into one re-links them. Design SDK warnings and options:
  - spend directly from a stealth account;
  - deposit into NEAR Intents (mainnet; optional confidential).

### Gate R
Proceed only when all of the following hold:
- The scheme is chosen, and the **testnet spend-from-stealth proof tx exists**.
- The costs (stipend, storage, announcement) are measured.
- The differences from ERC-5564, Umbra and the Nervos work are written in two sentences.

---

## PHASE 2: PRODUCT SPEC

### Components
1. **NEP draft** `docs/NEP-DRAFT-stealth-meta-address.md`. Use the NEP template format: summary, motivation, spec (key formats, meta-address encoding `st:near:<S_hex><V_hex>`, scheme IDs, announcement format, view tags), reference implementation, security considerations, alternatives (ERC-5564/6538).
2. **Registry contract** `veil-registry`:
   - `register(spend_pub_hex, view_pub_hex, scheme_id)`, keyed by `predecessor_account_id`. Requires a storage deposit.
   - `unregister()`.
   - `get_meta(account_id) -> Option<Meta>`.
   - Event `meta_registered`.
3. **Router / announcer contract** `veil-router`:
   - `send_near(stealth_account, ephemeral_pub_hex, view_tag: u8, memo_ciphertext?)` (payable). Transfers NEAR to the implicit account **and** appends an announcement atomically.
   - `ft_on_transfer(sender_id, amount, msg)`. Here `msg = {stealth_account, ephemeral_pub_hex, view_tag, memo_ciphertext?}`. It forwards `ft_transfer` to the stealth account (registered beforehand; see the SDK) and appends the announcement. On failure it refunds via the return value. Callers must be allow-listed FT contracts, or any caller with a storage check.
   - `announce(...)` (payable storage) for flows that pay elsewhere, e.g. a 1Click payout to a stealth account.
   - Views: `get_announcements(from_index, limit) -> Vec<Announcement{index, block, token, stealth_account, ephemeral_pub, view_tag, amount?}>` and `total_announcements()`.
   - Events: `stealth_sent`.
   - The optional encrypted memo is encrypted to the shared secret, e.g. "Invoice #12".
4. **TypeScript SDK** `@veil/sdk`:
   - `generateKeys()`, deterministic from a wallet signature: sign a fixed NEP-413 message, then derive `v` and `s` via HKDF. Users can then recover their keys from their wallet alone. Verify that NEP-413 signing is deterministic in the wallets you test (ed25519 signatures are deterministic).
   - `register(meta)`, `resolve(name)`.
   - `sendNear(to, amount)` and `sendFt(to, token, amount)`. These handle storage_deposit and the stipend.
   - `scan({fromIndex}) -> owned[]`, using view tags.
   - `balanceOf(owned)`.
   - `spend(owned, action)`, using the scalar signer.
   - `exportViewKey()`, for auditors.
   - Re-link warnings.
5. **Web app** (Next.js 16 + near-connect):
   - **Receive:** "Enable Veil for degen.near" (keys derived from a wallet signature), then register. Shows your private inbox: scanned payments, balances per stealth account, and actions (send onward, deposit to Intents) with re-link warnings.
   - **Send:** type `degen.near`. If Veil is enabled, a "Send privately" toggle appears. Choose NEAR or a test FT.
   - **Explorer view:** side by side, "what NearBlocks shows for degen.near" (nothing new) versus "what degen.near's owner sees" (3 payments).
   - **Auditor mode:** paste a view key to see incoming payments read-only.
   - **DAO payout demo:** a Sputnik DAO (testnet factory `sputnikv2.testnet`; verify) makes a FunctionCall proposal to `veil-router.send_near` paying a contributor privately. Approve it and show it arriving.
   - **Intents demo (optional, mainnet, human approval):** a 1Click quote whose `recipient` is the stealth implicit account on NEAR, then `announce`. Show the dry quote on testnet docs, and one tiny real swap only with approval.

### Invariants and properties (each must have a test)
- **V1, correctness:** for random keys and 10,000 random sends, the recipient finds exactly their own payments: no false negatives and no false positives after full check.
- **V2, unlinkability (on-chain data):** no announcement or transfer contains the recipient's name or meta-address. Two payments to the same recipient share no on-chain identifier. Test this by asserting the stealth accounts differ and no field equals any recipient key.
- **V3, spend authority:** only `p = s + h` signs valid transactions for `P`. The view key alone cannot spend (test: deriving with `v` but not `s` fails).
- **V4, router atomicity:** the NEAR or FT transfer and the announcement either both happen or the funds are refunded.
- **V5:** the signature from the scalar signer verifies with standard ed25519, using the test vectors in `verification/`.

### Honest limits (README)
- Amounts, timing, the sender and the token are visible.
- The gas stipend comes from the sender.
- Network-level metadata (RPC IP) is not hidden.
- Sweeping re-links accounts.
- The view key reveals incoming payments to whoever holds it.
- It is a prototype and not audited. Testnet only for the MVP.

---

## PHASE 3: ARCHITECTURE
```
veil/
├─ contracts/registry/   contracts/router/       # near-sdk 5.30
├─ packages/sdk/                                  # crypto (noble), scan, send, spend, signer
├─ apps/web/                                      # Next.js 16
├─ scripts/  setup-testnet.sh  deploy.sh  demo-send.ts  demo-scan.ts  demo-dao.ts
├─ verification/vectors.json                      # test vectors (keys, R, P, tag, signatures)
└─ (docs incl. NEP-DRAFT, research, execution, submission, results)
```
**Security checklist:**
- Never log or persist `s` unencrypted. Encrypt keys in browser storage with a key derived from a wallet signature, or keep them in memory only.
- Constant-time scalar operations come from the library.
- Validate all points: on-curve and prime order.
- Use domain-separated hashes.
- Contract checks: storage deposits, an FT caller allow-list, `#[private]` callbacks.

## PHASE 4: TESTS AND CI
- **SDK (vitest):** V1, V3 and V5; vectors; malformed meta-addresses; wrong keys; tag collisions.
- **Contracts:** unit tests plus sandbox (near-workspaces 0.24):
  - `send_near` and `ft` flows, including refund on failure;
  - pagination;
  - a stealth account spends in the sandbox using the TS scalar signer. Drive it via JS against the sandbox, or prove it in the testnet script.
- **Testnet evidence:** `pnpm demo:all`
  1. registers `alice-veil.testnet`;
  2. sends 3 payments from 3 different accounts;
  3. scans and finds all 3;
  4. spends from one stealth account;
  5. runs the DAO payout.

  It writes `results/demo-<ts>.json` with every tx link, plus a screenshot of the explorer showing the name untouched.
- **CI:** Rust and TS jobs per COMMON-RULES.

## PHASE 5: DAY PLAN
| Day | Work | Exit check |
|---|---|---|
| 8 Nov | R1–R3. Implement the derive and scalar-sign prototype. **Testnet spend-from-stealth proof** | Proof tx hash logged (Gate R) |
| 9 Nov | SDK core (keys, derive, tag, scan, sign) + vectors + tests; registry contract | V1, V3, V5 green |
| 10 Nov | Router contract (NEAR + FT + announce), sandbox tests, testnet deploy | V4 green |
| 11 Nov | SDK send/spend flows; demo scripts; DAO payout; NEP draft | `demo:all` runs on testnet |
| 12 Nov | Web app: receive inbox, send toggle, explorer comparison, auditor mode | Live URL |
| 13 Nov | README, fresh-clone test, video, optional Intents dry quote | Done-checklist ✓ |
| 14 Nov | Buffer, X post (human), submission JSON (human) | Submitted |

**Cut order:** Intents → auditor UI → encrypted memo → DAO demo (keep it as a script). **Never cut** the testnet spend proof, scanning, tests, the NEP draft or the README.

## PHASE 6: SUBMISSION PACKAGE

### README outline
1. **Title:** "Veil: stealth .near names".
2. **The problem:** a `.near` name is a public diary. Show a table.
3. **How it works:** a diagram covering keys, send, announce, scan and spend.
4. **Proof:** testnet tx links. NearBlocks shows nothing for the name, while the owner's inbox shows all payments.
5. **Try it in 5 minutes:** `pnpm i` → `pnpm test` → `pnpm demo:all` (see 3 private payments found and 1 spent) → open `<url>`.
6. **NEAR features used:** implicit accounts, NEP-413, NEP-141, Sputnik DAO, events, optionally NEAR Intents.
7. **NEP draft:** link to it.
8. **Comparison** with ERC-5564, Umbra, Fluidkey and the Nervos CCC stealth extension.
9. **Limits.**
10. **Built with / AI disclosure.**
11. **Related projects (Q-015).**
12. **License:** MIT.

### Demo video (≈2 min)
1. **(0:00)** "Your .near name is a public diary: balance, every memecoin, every payer. Watch." Show a public account's history.
2. **(0:15)** "Veil gives your name private receiving." Enable Veil for alice.near with one signature.
3. **(0:30)** Three wallets send to `alice.near` with "Send privately" switched on.
4. **(0:50)** NearBlocks for alice.near: nothing new. "On-chain, there's no link to Alice."
5. **(1:05)** Alice's inbox scans and finds all 3, using view tags so it's fast on a phone.
6. **(1:20)** Spend from one stealth account directly. "Only Alice's spend key can do this. Her auditor's view key can see but never spend."
7. **(1:35)** A DAO pays a contributor privately through a Sputnik proposal.
8. **(1:50)** "No new account type: NEAR implicit accounts make stealth native. NEP draft and code in the repo. Built at NEAR HACKATHON."

### X post
"Built at #NEARHackathon: Veil, stealth .near names. People still pay alice.near, but every payment lands at a fresh one-time account only Alice can find and spend. Her name's public history stays empty. NEP draft + SDK + demo: <link> @NEARProtocol"

### Submission
- **Tracks:** `["privacy","open"]`.
- Print the JSON and wait for the human's "yes".
