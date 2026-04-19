# Defect Card Index

This folder is the canonical record of every defect surfaced by the
**HDPulseAI QA Standard** Fix-Until-Green loop
(`docs/qa/STANDARD.md` §4.1). Every failing spec or §4 hard-fail condition
opens a card here. Cards are append-only; they are closed (not deleted) when
the fix lands.

## How to open a defect card

1. Pick the next free `DEF-####` number from the table below (zero-padded
   to four digits).
2. Copy [_TEMPLATE.md](_TEMPLATE.md) to `DEF-####.md`.
3. Fill in **Metadata** + **Captured evidence** before you start to fix.
4. Track each Fix-Until-Green attempt in the card. The cap is N=3 per root
   cause (`STANDARD.md` §4.1.1).
5. On close, fill in the **Anti-weakening attestation** and **Closure**
   sections.

Reserved numbers (placeholder records — the actual cards will be authored
when the issues are picked up):

| ID             | Status              | Title                                                                          | Pillar | Opened     | Closed     |
|----------------|---------------------|--------------------------------------------------------------------------------|--------|------------|------------|
| DEF-0001       | Reserved            | (reserved)                                                                     | —      | —          | —          |
| DEF-0002       | Reserved            | (reserved)                                                                     | —      | —          | —          |
| DEF-0003       | **Closed (fixed)**  | Sidebar hydration mismatch — `<a>` mismatch on `/dashboard`                    | A      | 2026-04-17 | 2026-04-17 |
| DEF-0004       | **Closed (fixed)**  | Webpack factory `Cannot read properties of undefined (reading 'call')`         | A      | 2026-04-17 | 2026-04-17 |
| DEF-0005       | **Closed (fixed)**  | Systemic WCAG 2.1 AA color-contrast failure on stat tiles (palette)            | E      | 2026-04-17 | 2026-04-17 |
| DEF-0006       | **Closed (fixed)**  | `<select>` on `/dashboard` missing accessible name (WCAG 4.1.2)                | E      | 2026-04-17 | 2026-04-17 |
| DEF-INFRA-0001 | **Closed (fixed)**  | Pillar runs against `next dev` are unstable for E2E (production-build mode)   | All    | 2026-04-17 | 2026-04-18 |
| DEF-0007       | **Closed (fixed)**  | `/errors` HTML pages redirect anonymous visitors (Wave 21 contract regression) | A,J    | 2026-04-19 | 2026-04-19 |
| DEF-0008       | **Closed (fixed)**   | Systemic drift: middleware public allow-list out of sync with `route-inventory.json` `group:public` (PRE-EXISTING, ≥7 affected routes) | A,B,Q  | 2026-04-19 | 2026-04-19 |
| DEF-0009       | **Closed (fixed)**   | Sign-in dead on the deployed dev stack (3 stacked root causes: stale named volumes, unapplied Prisma migrations, Dockerfile postinstall ordering) | S      | 2026-04-19 | 2026-04-19 |
| DEF-0010       | **Closed (fixed)**   | Public marketing homepage `/` rendered without a `<main>` landmark (a11y + Pillar S Surface 5 invariant) | E,S    | 2026-04-19 | 2026-04-19 |
| DEF-0011       | **Closed (fixed)**   | `route-inventory.json` mis-classified `/settings/billing` + `/settings/compliance` as `group:public` (build-time vs runtime contract drift) | Q,S    | 2026-04-19 | 2026-04-19 |
| DEF-0012       | **Closed (fixed)**   | `.dockerignore` excluded runtime-needed `docs/` subtrees → `/changelog` 500 + degraded public-API artifacts | Q,S    | 2026-04-19 | 2026-04-19 |
| DEF-0013       | **Closed (fixed)**   | `/api/v1/postman.json` 500 — Next.js public-vs-route URL collision (artifact moved to `data/`) | J,S    | 2026-04-19 | 2026-04-19 |
| DEF-0014       | **Closed (fixed)**   | Lazy-compile dev loop returned ("every link feels slow the first time") — Turbopack-default + dynamic-route warmer + Pillar S Surface 7 budget gate | S      | 2026-04-19 | 2026-04-19 |
| DEF-0015       | **Closed (fixed)**   | Production worker build broken — `tsconfig.worker.json` blanket `src/lib/**/*` include pulled `src/lib/billing/stripe-client.ts` → `@/env` → `@t3-oss/env-nextjs` (modern `exports` package) into the legacy `moduleResolution: "node"` worker compile, failing the `ecred-worker-prod` Dockerfile build at step 9/9 | S      | 2026-04-19 | 2026-04-19 |
| DEF-0016       | **Closed (fixed)**   | `next build` page-data collection refused to start because four optional Azure URL env vars were set to operator placeholder strings ("placeholder") in production `.env`; `z.string().url().optional()` rejected them, breaking `ecred-web-prod` build — schema now treats non-URL values as `undefined` for `.optional()` URL fields only | S      | 2026-04-19 | 2026-04-19 |

DEF-0003 and DEF-0004 were the original failures named in `STANDARD.md`
§10 that this entire QA Standard exists to prevent from recurring
silently. They were closed in Phase 0 by clearing the stale Next.js dev
cache (full diagnosis in DEF-0003.md).

DEF-0005, DEF-0006 and DEF-INFRA-0001 were surfaced by the first full
Pillar E run (2026-04-17).

DEF-0005 was closed the same day by a palette-level Tailwind override
(`tailwind.config.ts`) that mathematically guarantees AA contrast on
every foreground/background pair the app renders. See the card for
the full ratio table and the `npm run qa:a11y:palette` verifier.

DEF-INFRA-0001 was fully closed on 2026-04-18 by Wave 1.1 of the
local "unblock + commercialize" Cursor plan.
The fix is `npm run qa:e2e:prod` — `scripts/qa/e2e-prod-bundle.mjs`
orchestrates `npm run build` → `npm start` → wait-for-`/api/health` →
`playwright test --config=playwright.prod.config.ts` → kill server,
forwarding Playwright's exit code as its own. The Pillar E timeout
class is now structurally impossible because every route is
pre-compiled before Playwright sends the first request. Per-test
budgets in `playwright.prod.config.ts` are unchanged from the dev
config (no STANDARD.md §4.2 weakening); workers are cranked from 2 →
4 because production bundles serve concurrent requests cleanly.

With DEF-INFRA-0001 closed, the QA Standard's open-defect ledger was
empty until 2026-04-19.

DEF-0007 was discovered during the Wave 21 Fix-Until-Green loop: the
new `/errors` and `/errors/[code]` public HTML pages — promised as
"fully public" by the per-screen cards, ADR 0027, and §3.10 of the
versioning policy — were redirected by `src/middleware.ts` to
`/auth/signin` for anonymous visitors. Captured evidence is in the
DEF-0007 card (HTTP 307 against the `npm start` prod bundle on
`http://localhost:6015`). Closed the same day by adding `/errors` and
`/errors/` to the middleware public allow-list, plus a new
`tests/e2e/anonymous/pillar-a-public-smoke.spec.ts` that iterates over
`route-inventory.json` `group === "public"` and asserts each route
returns 200 to an anonymous client.

DEF-0008 was surfaced in the same loop, as a separate card to keep
the DEF-0007 fix at "one root cause per commit" (STANDARD.md §4.1.4).
It is the systemic same-shape drift between the hand-maintained
public allow-list in `src/middleware.ts` and the canonical
`route-inventory.json` `group: public`. Eight routes are currently
affected (`/legal/*` × 4, `/cvo`, `/sandbox`, `/pricing`,
`/changelog`, plus the `/settings/billing` and `/settings/compliance`
suspect cases). DEF-0008 is **Escalated** — the appropriate fix is
structural (build-time derivation of the allow-list) and exceeds
the Wave 21 PR's blast radius. The new anonymous public-smoke spec
will catch every future drift instance from this point forward,
without requiring DEF-0008 to be resolved before the runtime side
of the contract is enforced.
