# Veil frontend standard

Veil uses the fintech niche of the shared frontend design standard. Read this file before changing `apps/web`.

## Product decisions

- Product: private receiving for NEAR named accounts.
- Audience: NEAR users, merchants, freelancers, donors and auditors.
- Stage: testnet prototype.
- Primary action: connect a testnet wallet and enable Veil.
- Trust requirements: keep keys in browser memory, show testnet status, explain public limits, and expose transaction evidence.
- Stack exception: the current app is a dependency-light static HTML/CSS/ES module app. Do not add React, Tailwind or shadcn/ui only for visual work. Preserve the static build unless the product requirements change.

## Rules

- Use the tokens in `apps/web/styles.css`; do not add raw colors, font sizes or durations in page markup.
- Use fintech copy: precise, calm and honest about testnet status, transaction state, storage deposits and relinking.
- Keep one accent color, no purple or indigo gradients, no glow orbs, no glassmorphism, no emoji icons and no nested cards.
- Keep every action keyboard accessible with visible `:focus-visible`, hover, active, disabled and loading states.
- Touch targets are at least 44px. Body copy is at least 16px where it carries instructions.
- Use semantic headings, labels, live status regions and a skip link.
- Motion uses transform and opacity only and has a reduced-motion path.
- Test at 320, 375, 768, 1024, 1440 and 1920px. Test normal and reduced motion.

## Required checks

Run `pnpm --dir apps/web build`, `pnpm test`, and the hosted browser check in `scripts/check-hosted.mjs`. Report any wallet approval that was not exercised as pending human verification.
