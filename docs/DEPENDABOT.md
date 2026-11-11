# Dependency alerts

Checked against the public repository on 2026-11-11. The seven open alerts are development or build-chain dependencies; the hosted web app does not ship Vitest or Tinypool.

| Package | Alert | Status | Reason |
|---|---:|---|---|
| `@vitest/mocker` | 3, 4, 7 | open | Fixes require Vitest 4.1.11/4.1.12 or 5.x. The project is pinned to the 3.x line; upgrading would be a major version change and needs a separate compatibility pass. |
| `vitest` | 2, 4 | open | Same 3.x-to-4.x major-version boundary. |
| `tinypool` | 5, 6 | open | Fixes require Tinypool 2.1.1/2.1.2, while the Vitest 3 dependency tree resolves 1.1.1. A safe patch/minor-only update is unavailable. |
| `wee_alloc` | 1 | open | Unmaintained with no patched version. Replacing it requires changing the NEAR contract build/runtime configuration and needs a separate WASM compatibility review. |

The alerts are not silently dismissed. CI runs the test suite and the web build does not expose the affected development server packages. Revisit these before production or a major Vitest upgrade.
