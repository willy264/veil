# Wallet UI check: 12 November 2026

- PASS: Send, Receive and Transfer at 320, 375, 768, 1024, 1440 and 1920px, with normal and reduced motion. One active panel, no page overflow, all measured controls at least 44px high and 24px wide. [36 layout checks](../../results/wallet-ui-1794471265204.json).
- PASS: axe WCAG A/AA checks for every tab at 375 and 1440px in both motion modes, zero violations. Arrow keys, Home and End switch/focus the tabs; disconnected send errors are visible. Automated checks do not replace a human screen-reader session.
- PASS: local mobile Lighthouse performance 93, accessibility 100, SEO 100; LCP 0.9s, CLS 0. [Lab result](../../results/wallet-lighthouse-1794471315329.json). Total blocking time is 310ms; this run does not measure field INP or prove a production p75 result.
- PASS: 25 SDK/web tests, including exact signed transfer destination/amount, cancellation, over-balance rejection, balance RPC failure, receipt preservation after refresh failure, and duplicate-action prevention. Wallet/RPC tests are simulations.
- PASS: local build/typecheck; live registry2 resolution, router2 reads, public assets and wallet chooser. [Read-only check](../../results/local-browser-1794471026046.json).
- PASS: production alias anonymous access, tabs, logo/favicon, live testnet reads and wallet chooser after deployment. [Hosted evidence](../../results/hosted-check-1794471529711.json). [CI ec43451](https://github.com/willy264/veil/actions/runs/43181741193) passes the complete Ubuntu and TypeScript gates.
- PASS: original Veil mark and SVG favicon, one gold accent, self-hosted Geist Latin (SIL OFL in `apps/web/fonts/OFL.txt`), restrained motion. SVG brand colors and HTML theme-color intentionally match CSS tokens; they are standalone assets.
- Pending human: real wallet approvals on the hosted redesign, screen-reader review and final video footage. Existing scripted testnet receipts remain separate evidence.

Reproduce with `pnpm test`, `pnpm typecheck`, `pnpm --dir apps/web build`, then `node scripts/check-wallet-ui.mjs` and `node scripts/check-hosted.mjs --local`. Browser scripts use Playwright; the UI script also needs `@axe-core/playwright`. Install these separately or set `VEIL_PLAYWRIGHT_MODULE` / `VEIL_AXE_MODULE` to installed module paths. No private signer environment variables are required.
