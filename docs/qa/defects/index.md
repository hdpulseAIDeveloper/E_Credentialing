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

With DEF-INFRA-0001 closed, the QA Standard's open-defect ledger is
empty.
