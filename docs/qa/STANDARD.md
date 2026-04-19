# HDPulseAI QA Standard — Comprehensive QA Test Layer

**Status:** BINDING. This document is the canonical, versioned testing standard for
the ESSEN Credentialing Platform and for every future HDPulseAI product unless an
explicit ADR supersedes a clause.
**Version:** 1.2.0 (2026-04-19)
**Owner:** QA Standard Owner (see `## 9. Roles & governance`)
**Audience:** every human and AI agent that writes, reviews, or merges code into
this repository, plus any future repository that adopts this standard.

> **Why this exists.** Two prior rounds of testing have shipped reports of
> "everything green" while the deployed application failed at first
> interactive use:
>
> - **2026-04-17 — Hydration / webpack regression.** A report claimed
>   `Pass: 33, Fail: 0, Not Run: 223` while the first authenticated screen
>   failed to mount due to a hydration mismatch in
>   `src/components/layout/sidebar.tsx` and a webpack factory error. Closed
>   by §3 (coverage-first reporting), §4.1–§4.3 (browser console / hydration
>   / uncaught exception are hard fails), §5 (per-screen card per route),
>   §6 (inventory + `check-coverage.ts` gate).
> - **2026-04-19 — Sign-in dead on the deployed dev stack (DEF-0009).**
>   A subsequent report claimed `npm run qa:gate` green, 1865 vitests
>   green, typecheck clean, lint clean, all per-screen cards green — yet
>   the user could not sign in at all on the running container. Three
>   stacked root causes: (a) `docker-compose.dev.yml` named volumes
>   shadowed the freshly-rebuilt image with a stale Prisma client and
>   stale webpack-compiled `src/server/auth.ts`; (b) three Prisma
>   migrations had never been applied to the live database
>   (`organization_id` column missing); (c) `Dockerfile.web` /
>   `Dockerfile.worker` copied `prisma/` AFTER `npm install`, so even a
>   `--no-cache` rebuild died at the postinstall hook. The miss was
>   structural: `qa:gate` ran ZERO specs (only inventory + coverage
>   gates + SDK/Postman drift), and the Pillar A smoke that DOES drive a
>   real CSRF + credentials sign-in was honestly reported as "Not Run"
>   because Docker was not available — yet that was treated as
>   informational rather than a fail of the gate. Closed by Pillar S (§2),
>   §4 hard-fails (11)–(14), §8 DoD additions, and the cited gate-script
>   wiring.
>
> This standard exists to make those classes of failure structurally
> impossible going forward: coverage is reported before pass/fail,
> browser console errors are hard failures, "Not Run" is never a passing
> outcome, **the gate exercises the deployed stack and not just the
> source tree**, and **schema drift / dead seed accounts / cold-build
> regressions fail the gate explicitly.**

---

## 1. Scope

This standard applies to:

1. Every change merged to `master` (or any protected branch) of this repository.
2. Every release artifact (container image, npm publish, FHIR endpoint, public API).
3. Every new HDPulseAI repository created from the project template.
4. Every AI agent invocation (Claude Code, Cursor, Codex, others) operating on
   any of the above.

There is **no "out of scope"** category. If a behavior ships, it must be
covered. Items that cannot yet be automated must be tracked as manual cards
under `docs/qa/per-screen/` or `docs/qa/per-flow/` with an owner and a target
automation date.

---

## 2. The 19 testing pillars (A–S)

Every change MUST be analyzed against all 19 pillars. The relevant pillar(s)
MUST be exercised before the change merges.

| ID  | Pillar                                                   | Lives under                       |
|-----|----------------------------------------------------------|-----------------------------------|
| A   | Functional smoke (every route, every role)               | `tests/e2e/smoke/**`              |
| B   | RBAC matrix (route × role allow / redirect / 403)        | `tests/e2e/rbac/**`               |
| C   | PHI scope & encryption (no SSN/DOB leakage)              | `tests/e2e/phi-scope/**`          |
| D   | Deep end-to-end flows (committee, PSV, attestation, …)   | `tests/e2e/flows/**`              |
| E   | Accessibility (axe; serious/critical fail the build)     | `tests/e2e/a11y/**`               |
| F   | Visual regression (`toHaveScreenshot`)                   | `tests/e2e/visual/**`             |
| G   | Cross-browser & responsive (Chromium, Firefox, WebKit)   | `tests/e2e/responsive/**`         |
| H   | Performance, load & soak (Lighthouse CI + k6)            | `tests/perf/**`                   |
| I   | Security & DAST (ZAP baseline, semgrep, npm audit, snyk) | `tests/security/**`               |
| J   | API contract (OpenAPI 3.1, tRPC procedure snapshots)     | `tests/contract/**`               |
| K   | External integration (CAQH, NPDB, PECOS, eMedNY, …)      | `tests/external/**`               |
| L   | Time-shifted scenarios (sessions, expirables, jobs)      | `tests/e2e/time/**`               |
| M   | Data integrity, migrations, backup & DR                  | `tests/data/**`                   |
| N   | Concurrency, idempotency & resilience                    | `tests/e2e/concurrency/**`        |
| O   | File / email / SMS / print / PDF handling                | `tests/e2e/files/**`              |
| P   | Compliance controls (HIPAA, NCQA CVO, CMS-0057-F, JC)    | `tests/e2e/compliance/**`         |
| Q   | Documentation integrity (links, OpenAPI↔code, ADRs)      | `tests/docs/**`                   |
| R   | Observability (`/api/metrics`, structured logs, alerts)  | `tests/observability/**`          |
| S   | **Live-Stack Reality Gate** — bring-up smoke, schema/migration parity, role-by-role real sign-in matrix, anonymous public-surface invariants, Dockerfile cold-build sanity (HTTP-only; runs WITHOUT a browser so it always runs even when Playwright cannot) | `scripts/qa/live-stack-smoke.mjs` + `scripts/qa/check-migration-drift.mjs` + `scripts/qa/check-dockerfile-build.mjs` + `tests/e2e/live-stack/**` |

The pillar inventory is canonical. Adding or removing a pillar requires an ADR
and a bump of this document's `Version` line. Pillar S was added in version
1.2.0 by [ADR 0028](../dev/adr/0028-live-stack-reality-gate.md) in response
to the 2026-04-19 sign-in regression (DEF-0009).

### 2.S Pillar S — Live-Stack Reality Gate (BINDING)

Pillars A–R validate the source tree. Pillar S validates the **deployed
running system**. It exists because the source tree can be 100% green
while the deployed stack is broken in ways the source tree cannot see:
stale named-volume contents, unapplied migrations, dead seed accounts,
broken Dockerfiles, drifted environment variables, missing middleware
allow-list entries.

Pillar S MUST run on every release-shaped change and on every PR that
touches any of: `src/server/auth.ts`, `src/middleware.ts`, `prisma/**`,
`Dockerfile.*`, `docker-compose.*.yml`, `.env*`, `scripts/web-entrypoint.sh`,
`src/lib/api/error-catalog.ts`, or any `src/app/api/auth/**` route.

#### 2.S.1 What Pillar S MUST cover

1. **Bring-up health** — `GET /api/health` returns 200 with
   `services.database === "ok"` against the deployed stack.
2. **Schema / migration parity** — `prisma migrate status` against the
   live database reports zero pending and zero drift. Hard-fails (4).11.
3. **Role-by-role real sign-in matrix** — for every entry in
   `tests/e2e/roles.ts` `STAFF_ROLES`, perform the production CSRF +
   `/api/auth/callback/credentials` round-trip and assert: 302 redirect
   to a non-`/auth/signin` URL, `authjs.session-token` cookie issued,
   `GET /api/auth/session` returns a populated session with the
   expected `user.role`. Hard-fails (4).12.
4. **Authenticated session probe** — at least one authenticated tRPC
   procedure (or App Router page) returns 200 for the admin role,
   proving the session actually authorizes against the API and not just
   against `/api/auth/session`.
5. **Anonymous public-surface invariants** — every entry in
   `route-inventory.json` with `group === "public"` returns 200
   anonymously (no redirect, no auth wall) AND its rendered HTML
   contains a visible `<main>` / `<h1>` / `<h2>`. Closes the DEF-0007 /
   DEF-0008 class of regressions.
6. **Dockerfile cold-build sanity** — `docker compose ... config -q`
   validates compose; in `--cold` mode, `docker compose build --no-cache`
   for every app service must complete. Hard-fails (4).13.
7. **Stack-version pin** — the running container's commit SHA / image
   digest is recorded in the report. Drift between "what `master` says"
   and "what the running container is" is itself a finding.

#### 2.S.2 Anti-weakening for Pillar S

The temptation to silence Pillar S is greater than for any other pillar
because it requires a live stack to run. The following count as §4.2
violations:

1. Skipping Pillar S because "Docker isn't available" without filing the
   honest "Pillars not run: S" headline AND a defect card AND failing
   the gate.
2. Replacing the live HTTP probe with an in-process Next.js spawn that
   does NOT use the same env / volumes / network as the deployed stack.
3. Catching `prisma migrate status` failures and reporting "no pending
   migrations" because the script could not connect to the database.
   No connection = "Not Run" = §3 fail.
4. Hard-coding the role matrix instead of reading
   `tests/e2e/roles.ts` (drift between the two would mask a missing
   role).
5. Replacing the real CSRF round-trip with a mocked session cookie.

#### 2.S.3 Where Pillar S lives

| Surface                     | File                                            |
|-----------------------------|-------------------------------------------------|
| HTTP-only smoke (no browser)| `scripts/qa/live-stack-smoke.mjs`               |
| Migration parity gate       | `scripts/qa/check-migration-drift.mjs`          |
| Cold Dockerfile build gate  | `scripts/qa/check-dockerfile-build.mjs`         |
| Browser-driven role matrix  | `tests/e2e/live-stack/role-login-matrix.spec.ts`|
| npm-script entry points     | `qa:live-stack`, `qa:migrations`, `qa:dockerfile`, included in `qa:gate` |

---

## 3. Headline reporting rule

A test report or PR comment is only considered valid if it leads with
**coverage** before pass/fail. The minimum headline is:

```
Routes covered:    X of Y      (must be 100% before release)
Roles exercised:   X of N      (must be 100% before release)
Pillars touched:   <list of A–S IDs>
Pillars green:     <list of A–S IDs that ran AND passed>
Pillars not run:   <list>      (NOT-RUN ≠ PASS — counts as failure for the gate)
Live stack:        <commit SHA running in the container> | migrations: 0 pending | sign-in matrix: ADMIN/MANAGER/SPECIALIST/COMMITTEE_MEMBER all green
Pass / Fail / Skip: P / F / S
```

The legacy report format (`Pass: 33, Fail: 0, Not Run: 223`) is explicitly
forbidden. A run with any "Not Run" case for a covered pillar is reported as a
**fail** of the gate, not a pass. **Pillar S is a covered pillar on every
release-shaped change** (per §2.S); a release report missing the `Live stack:`
line, or showing it as "Not Run", is a §3 violation regardless of the rest of
the suite.

---

## 4. Hard-fail conditions (no exceptions)

The following events MUST fail the suite, the PR check, and the deploy gate.
None of them may be downgraded to a warning, screenshot, or "known issue":

1. Any browser console `error` during any spec.
2. Any React hydration warning (`Expected server HTML to contain a matching …`).
3. Any uncaught `TypeError: Cannot read properties of undefined (reading 'call')`
   or any other unhandled exception.
4. Any 5xx response from any first-party route, tRPC procedure, or webhook
   during any spec.
5. Any axe-core `serious` or `critical` violation on any rendered route.
6. Any PHI field (SSN, DOB, home address, raw DEA) appearing in a response
   served to a role that should not see it (Operations, RCM/Billing, Provider
   viewing another provider, public API).
7. Any broken first-party link (`<a href>` resolving to 4xx/5xx).
8. Any contract drift where the OpenAPI / tRPC snapshot does not match the
   shipped surface.
9. Any compliance-tagged spec (`@hipaa`, `@ncqa`, `@cms-0057-f`, `@jc-npg-12`)
   regressing.
10. `scripts/qa/check-coverage.ts` reporting any inventoried route, link, API,
    tRPC procedure, bot, webhook, job, or form without at least one assigned
    spec.
11. **Schema / migration drift** — `prisma migrate status` against the
    target database reports any pending migration, any "drift detected",
    any "database schema is not in sync", or any failure to connect.
    Enforced by `scripts/qa/check-migration-drift.mjs`. (Added in 1.2.0;
    closes the column-`organization_id`-missing root cause of DEF-0009.)
12. **Dead seed account / role-by-role sign-in regression** — any seeded
    staff role from `tests/e2e/roles.ts` `STAFF_ROLES` failing the live
    CSRF + `/api/auth/callback/credentials` round-trip on the deployed
    stack. The credentials must come from `tests/e2e/roles.ts` (single
    source of truth — `prisma/seed.ts` is its sibling). Enforced by
    `scripts/qa/live-stack-smoke.mjs`. (Added in 1.2.0; closes the
    user-reported "Sign In is not working. Nothing happens" of DEF-0009.)
13. **Cold Dockerfile build regression** — `docker compose build
    --no-cache` failing on any app service in any compose file. Catches
    package.json/Dockerfile ordering bugs (the `prisma generate`
    postinstall finding a schema that has not been copied yet, missing
    runtime dependencies, etc.) that named-volume-shadowed dev rebuilds
    can hide for weeks. Enforced by
    `scripts/qa/check-dockerfile-build.mjs --cold`. (Added in 1.2.0;
    closes the dev Dockerfile root cause of DEF-0009.)
14. **Stale named-volume contents shadowing the deployed image** — the
    Pillar S smoke includes a `volume-staleness` probe that asserts the
    Prisma client schema in the running container's
    `node_modules/.prisma/client/schema.prisma` matches the on-disk
    `prisma/schema.prisma`, AND that the running container's
    `/app/.next/build-manifest.json` (when present) was written after
    the most recent `git log` commit on `master`. Either mismatch is a
    hard fail — the operator must `docker volume rm` the stale volume
    and recreate. (Added in 1.2.0; closes the
    `ecred_web_node_modules` / `ecred_web_next_cache` root cause of
    DEF-0009.)

---

## 4.1 Failure response loop — "fix until green" (BINDING)

Whenever any spec fails, or any §4 hard-fail condition fires, the contributor
(human or AI agent) MUST enter the loop below. It is **not** acceptable to
report results, mark work "done", or hand the branch back to the user while
the loop is still red.

```
            ┌──────────────────────────────────────────────┐
            │  1. Capture                                  │
            │     - Failing spec name + file path          │
            │     - Console error / stack trace            │
            │     - Screenshot + video + trace.zip         │
            │     - Network log (HAR) for any 5xx          │
            │     - Browser, role, route at time of fail   │
            └──────────────────────────────────────────────┘
                                ▼
            ┌──────────────────────────────────────────────┐
            │  2. File a defect card                       │
            │     docs/qa/defects/DEF-####.md              │
            │     (use docs/qa/defects/_TEMPLATE.md)       │
            └──────────────────────────────────────────────┘
                                ▼
            ┌──────────────────────────────────────────────┐
            │  3. Diagnose root cause                      │
            │     Fix priority order:                      │
            │       (a) production code  (default)         │
            │       (b) genuinely-wrong assertion          │
            │       (c) flaky fixture / data               │
            │     Never: weaken the assertion.             │
            └──────────────────────────────────────────────┘
                                ▼
            ┌──────────────────────────────────────────────┐
            │  4. Apply minimum fix                        │
            │     - One root cause per commit              │
            │     - Update DEF card with the fix           │
            └──────────────────────────────────────────────┘
                                ▼
            ┌──────────────────────────────────────────────┐
            │  5. RE-RUN THE FULL PILLAR                   │
            │     Not just the single failing spec.        │
            │     If the failure was in pillar A (smoke),  │
            │     re-run the entire smoke pillar so the    │
            │     fix did not break a sibling spec.        │
            └──────────────────────────────────────────────┘
                                ▼
                ┌─────────────────────────┐
                │   Pillar green?         │
                ├──────────┬──────────────┤
                │ Yes      │ No           │
                ▼          ▼              ▼
            DONE      Attempt # ≥ 3 ?     loop to step 1
                          │
                          ▼
                  STOP & ESCALATE
                  (do NOT mark done)
```

### 4.1.1 Attempt cap (BINDING)

The loop cap is **N = 3 attempts on the same root cause**. After three
unsuccessful attempts at the same root cause:

1. STOP. Do not loop a fourth time.
2. Update the defect card with: every fix attempted, every spec output, and
   the current best hypothesis.
3. Escalate to the user explicitly with the captured evidence.
4. Do **not** mark the work done. Do **not** report green.

A different root cause resets the counter to 0; an apparent "different"
failure that turns out to be the same underlying defect does NOT reset it.

### 4.1.2 Re-run scope (BINDING)

When you re-run after a fix, the minimum scope is **the entire pillar that
the failing spec belongs to**, not the single spec. Cross-cutting fixes
(auth, layout, middleware, schema) require re-running every pillar that
exercises the touched layer. The smoke pillar (A) is re-run on every fix
regardless.

### 4.1.3 Loop exit criteria (BINDING)

You may exit the loop only when **all** of the following are true:

- The pillar(s) you re-ran are green (zero failed specs, zero hard-fail §4
  conditions, zero "Not Run" entries on covered specs).
- `scripts/qa/check-coverage.ts` is green.
- The defect card for the original failure is closed with a root-cause
  description and a link to the fix commit.
- The headline reporting block from §3 reflects the green run.

A loop that exits because the agent ran out of context, ran out of time,
ran out of tokens, or simply gave up is **not** a legitimate exit. In that
case, escalate per §4.1.1.

---

## 4.2 Anti-weakening rules (BINDING)

A failing spec may NOT be turned green by any of the following techniques.
Each one is, by itself, a violation of this standard and grounds for
reverting the change:

1. Weakening the assertion (`expect(x).toBe(5)` → `expect(x).toBeTruthy()`,
   `expect(arr).toHaveLength(7)` → `expect(arr.length).toBeGreaterThan(0)`,
   etc.) without an explicit, documented reason in the defect card.
2. Deleting the spec, renaming the file out of the test glob, or moving it
   to a folder the runner does not pick up.
3. Marking the spec `.skip`, `.todo`, `.fixme`, `xtest`, `xit`, `describe.skip`,
   or any equivalent in another runner.
4. Widening a selector to match anything (`page.locator('a')`,
   `page.locator('*')`, `getByRole('button')` without name, etc.) so the spec
   stops asserting what it was meant to assert.
5. Catching and swallowing the failing error
   (`try { ... } catch {}`, `.catch(() => {})`, `// @ts-expect-error`,
   `// eslint-disable-next-line`, `expect.soft`, `test.fail`) so the spec
   reports green while the bug still ships.
6. Mocking out the failing path
   (`vi.mock('the-thing-that-broke')`, `page.route('**/api/**', ...)`
   bypassing the real failure) without proving the mock matches production
   behavior.
7. Increasing a timeout (`test.setTimeout(120_000)`, `waitForTimeout(...)`)
   to mask flakiness instead of fixing the underlying race.
8. Replacing a strict equality with a regex / partial match
   (`expect(html).toContain('foo')` instead of `expect(html).toEqual(EXPECTED)`)
   to dodge a real diff.
9. Lowering a coverage threshold in `vitest.config.ts`,
   `playwright.config.ts`, or any pillar config to ship a red gate green.
10. Editing `scripts/qa/check-coverage.ts` (or the pillar inventories) to
    silence a complaint instead of adding the missing spec.

The legitimate ways to turn a red spec green are limited to these three:

- **Fix the production code.** The default.
- **Fix a genuinely incorrect assertion.** Allowed only if the original
  assertion was wrong about the system's intended behavior. The defect card
  MUST cite which doc / ADR / requirement establishes the corrected
  expectation.
- **Fix a flaky fixture / data setup.** Allowed only if the fixture is
  proven to be the source of nondeterminism (3 consecutive green runs after
  the fix, recorded in the defect card). Flakes are themselves defects and
  get a DEF card.

A reviewer or the QA Standard Owner may, on PR review, classify any change
that matches §4.2 (1)–(10) as a violation and require a revert, regardless
of whether the rest of the suite is green.

---

## 5. Per-screen and per-flow cards

Every route the application exposes MUST have a per-screen card at
`docs/qa/per-screen/<route-slug>.md`. Every distinct user flow MUST have a
per-flow card at `docs/qa/per-flow/<flow-slug>.md`.

A card is a short markdown file with this minimum shape:

```
# <Screen / flow name>

- Route(s):
- Roles allowed:                    (from docs/qa/coverage-matrix.md)
- Roles denied (must redirect/403):
- PHI fields rendered:
- Key actions / mutations:
- Linked specs:                     tests/e2e/.../<file>.spec.ts
- Linked OpenAPI / tRPC procedures:
- Known defects:                    DEF-#### in docs/qa/defects/
- Last verified:                    YYYY-MM-DD by <agent or human>
```

Cards are generated as stubs by `scripts/qa/build-screen-cards.ts` and then
hand-augmented. A card without a `Linked specs:` entry counts as missing
coverage and fails the gate.

---

## 6. Inventories (single source of truth)

These four inventories are auto-generated and committed:

| File                                          | Generator                                  |
|-----------------------------------------------|--------------------------------------------|
| `docs/qa/inventories/route-inventory.md`      | `scripts/qa/build-route-inventory.ts`      |
| `docs/qa/inventories/link-inventory.md`       | `scripts/qa/build-link-inventory.ts`       |
| `docs/qa/inventories/api-inventory.md`        | `scripts/qa/build-api-inventory.ts`        |
| `docs/qa/inventories/trpc-inventory.md`       | `scripts/qa/build-trpc-inventory.ts`       |

`scripts/qa/check-coverage.ts` reads each inventory, walks `tests/e2e/**` and
`tests/contract/**` for spec-tagged ownership, and fails the build if any
inventoried entity has no spec. The generators are run by `npm run qa:inventory`.

### 6.1 Iterator-aware coverage (Wave 6, 2026-04-18 — see ADR 0019)

A spec is credited as covering every entry in an inventory when, in
strict order, it (a) imports the inventory JSON via a relative path
ending in `inventories/<name>-inventory.json`, AND (b) contains an
iteration construct (`for (`, `.map(`, `.forEach(`, `.filter(`,
`describe.each`, `test.each`, `it.each`) below the import. This rule
is implemented by `scripts/qa/iterator-coverage.ts` and pinned by
`tests/unit/scripts/iterator-coverage.test.ts`. It exists because
matrix specs (Pillars A / B / E and the Pillar J iterators) genuinely
visit every inventoried surface at runtime — string-literal coverage
alone could never reach PASS while routes lived only as JSON data.

Anti-weakening: the rule MUST require BOTH halves (import + iteration),
MUST be inventory-name specific, and MUST never be loosened to
"presence of import is enough". The unit tests enforce all three.

---

## 7. Required tooling

| Concern                              | Tool                                      |
|--------------------------------------|-------------------------------------------|
| E2E browser                          | Playwright (Chromium, Firefox, WebKit)    |
| Unit / integration                   | Vitest 1.x                                |
| Accessibility                        | `@axe-core/playwright`                    |
| Visual regression                    | Playwright `toHaveScreenshot`             |
| Web vitals / Lighthouse              | Lighthouse CI                             |
| Load / soak                          | k6                                        |
| DAST                                 | OWASP ZAP baseline scan                   |
| SAST                                 | semgrep + `npm audit` + Snyk              |
| Contract fuzz                        | Schemathesis or Dredd against OpenAPI 3.1 |
| FHIR conformance                     | HL7 FHIR R4 Validator + Touchstone        |
| Time mocking                         | Playwright clock + libfaketime in CI      |
| Container restart resilience         | Docker Compose `restart: always` drills   |
| Documentation integrity              | `markdown-link-check` + `forbidden-terms` |
| Observability                        | `/api/metrics` scrape + log shape tests   |
| Design-system discipline             | `ecred-local/no-raw-color` ESLint rule + lite-Storybook render harness ([ADR 0015](../dev/adr/0015-design-system.md)) |

A new tool may be added; an existing tool may be replaced only via an ADR under
`docs/dev/adr/`.

### 7.1 Design-system contract (Pillar F adjunct)

Pillar F (visual regression) is preceded by a design-system gate enforced
on every commit:

- All UI components under `src/app/**` and `src/components/**` MUST use
  the design tokens declared in `src/app/globals.css` (or the
  `hsl(var(--token))` indirection). Raw color literals are rejected by
  the `ecred-local/no-raw-color` ESLint rule.
- Every primitive in `src/components/ui/` MUST ship at least one
  `*.stories.tsx` file under `stories/`. The auto-discovery harness at
  `tests/unit/stories/render-stories.test.tsx` mounts every named export
  on every CI run; a story that throws or emits a `console.error`
  fails the build.
- See [`docs/dev/design-system.md`](../dev/design-system.md) for
  contributor guidance.

---

## 8. Definition of Done (binding for every PR)

The full per-PR checklist lives in [definition-of-done.md](definition-of-done.md).
The compressed version is:

1. `npm run typecheck`, `npm run lint`, `npm test`, and
   `node scripts/forbidden-terms.mjs` are clean.
2. The relevant pillar(s) from §2 have at least one spec exercising the change.
3. `npm run qa:inventory` was run; inventories are committed.
4. `scripts/qa/check-coverage.ts` is green.
5. Any new route has a per-screen card under `docs/qa/per-screen/`.
6. Any new flow has a per-flow card under `docs/qa/per-flow/`.
7. PR description includes the headline reporting block from §3 (including
   the new `Live stack:` line).
8. None of the §4 hard-fail conditions tripped on the smoke run.
9. Any new PHI field is encrypted at rest (`encrypt`/`encryptOptional`),
   redacted in logs, and excluded from public-API responses.
10. `CHANGELOG.md` updated under `## [Unreleased]`.
11. **`npm run qa:gate` is green end-to-end** — including the new
    Pillar S members (`qa:migrations`, `qa:live-stack`). Static-only
    gates (inventory, coverage, SDK drift, Postman drift) are
    necessary but no longer sufficient. (Added in 1.2.0.)
12. **For PRs touching auth / schema / middleware / Dockerfile /
    compose / env / entrypoint / error catalog**: the live stack was
    rebuilt from this branch (`docker compose down -v && build && up -d`)
    AND `npm run qa:live-stack` was run against it AND its output is
    pasted into the PR description's `Live stack:` line. (Added in 1.2.0.)
13. **For PRs adding a Prisma schema field**: the matching
    `migration.sql` exists under `prisma/migrations/` AND has been
    applied to the dev database AND `prisma migrate status` reports
    zero pending. (Added in 1.2.0; closes the column-missing root
    cause of DEF-0009.)

A PR that ships behavior without satisfying §8 may not be merged, regardless of
who wrote it (human or agent).

---

## 9. Roles & governance

| Role                          | Responsibility                                                |
|-------------------------------|---------------------------------------------------------------|
| QA Standard Owner             | Owns this document; approves ADRs that touch testing.         |
| Per-pillar maintainers (A–R)  | Own their pillar's specs, fixtures, and reports.              |
| Release captain (per release) | Confirms §3 headline before tagging and deploying.            |
| Incident commander            | Files DEF cards and updates the relevant per-screen card.     |
| Every contributor             | Satisfies §8 on every PR; keeps inventories regenerated.      |

Quarterly review: the QA Standard Owner walks the pillar list, confirms each
pillar has a maintainer, and bumps the `Version` line if anything material
changed. Incident retrospectives MUST answer: "Which pillar (A–R) should have
caught this, and why didn't it?" — and the answer must produce either a new
spec or a new pillar entry.

---

## 10. Failure modes this standard explicitly prevents

Each failure mode is named here so it cannot recur silently. A future
report that matches the **symptom shape** of any entry below is a
violation of this standard even if every spec is green.

### 10.1 2026-04-17 — Hydration / webpack regression

- **Symptom:** Test report claimed `Pass: 33, Fail: 0, Not Run: 223` while the
  first authenticated screen failed to mount due to a hydration mismatch in
  `src/components/layout/sidebar.tsx` and a webpack factory error.
- **Root cause:** the runner was an HTTP probe (no browser, no JS execution);
  "Not Run" cases were excluded from the headline; the report had no coverage
  line; no per-screen card existed for the dashboard route.
- **Standard response:** §3 (coverage before pass/fail), §4.1–§4.3 (browser
  console, hydration, uncaught exception are hard fails), §5 (per-screen card
  for every route), §6 (inventory + `check-coverage.ts` gate).

### 10.2 2026-04-19 — Dead sign-in on the deployed dev stack (DEF-0009)

- **Symptom:** Test report claimed `npm run qa:gate` green, 1865 vitests
  green, typecheck clean, lint clean, all per-screen cards green — yet
  the user reported "Sign In is not working. Nothing happens" on the
  running container.
- **Root cause (three stacked):**
  1. `docker-compose.dev.yml` named volumes `ecred_web_node_modules`
     and `ecred_web_next_cache` (lines 56–62) survive container
     recreation and shadowed the freshly-rebuilt image with a stale
     Prisma client (no `User.organizationId` field) and a stale
     webpack-compiled `src/server/auth.ts` (still carrying the old
     multi-tenant query).
  2. Three Prisma migrations (`20260418000000_add_telehealth_expirable_types`,
     `20260418100000_multitenancy_shim`,
     `20260418130000_billing_subscription_state`) had never been
     applied to the live database, so the `organization_id` column did
     not exist on `users` even after the volume was cleaned and the
     fresh client was loaded.
  3. `Dockerfile.web` and `Dockerfile.worker` copied `prisma/` AFTER
     `npm install`, so even a `--no-cache` rebuild died at the
     `postinstall: prisma generate` hook with
     `Could not find Prisma Schema`. The prod Dockerfiles were already
     fixed; the dev pair was missed when the postinstall hook was added.
- **Why the existing pillars did not catch it:**
  - `npm run qa:gate` ran ZERO specs — only inventory + coverage gates
    + SDK drift + Postman drift. None of those probe the running stack.
  - Pillar A's `tests/e2e/global-setup.ts` DOES run the exact CSRF +
    credentials sign-in matrix that would have failed loudly, but it
    runs only under `npm run test:e2e` / `npm run qa:smoke`, not under
    `qa:gate`. It was honestly reported as "Not Run" because Docker
    was not available for the prior loop. Per §3 that should have
    failed the gate, but the headline was treated as informational.
  - No pillar probed `prisma migrate status` against the live database.
  - No pillar attempted a cold Dockerfile rebuild.
- **Standard response (this version, 1.2.0):**
  - **Pillar S — Live-Stack Reality Gate** (§2 / §2.S) added as a
    19th pillar. Browserless HTTP-only smoke that runs against the
    deployed stack: bring-up health, schema/migration parity, role-by-role
    real CSRF sign-in matrix, authenticated session probe, anonymous
    public-surface invariants, Dockerfile cold-build sanity,
    stack-version pin.
  - **§4 hard-fail conditions (11)–(14)** added for schema/migration
    drift, dead seed-account login, cold Dockerfile build regression,
    and stale named-volume contents.
  - **§3 reporting** now requires a `Live stack:` line on every release
    report.
  - **§8 DoD additions (11)–(13)** wire the new gates into the per-PR
    checklist.
  - **`npm run qa:gate`** is now `qa:inventory && qa:cards:check &&
    qa:coverage && qa:migrations && qa:live-stack && sdk:check &&
    postman:check`. The static-only path is no longer green by itself.

---

## 11. How to evolve this standard

1. Open a PR that edits this document.
2. Bump the `Version` line (semver: patch for clarification, minor for new
   pillar/clause, major for an incompatible change).
3. Land a matching ADR under `docs/dev/adr/` if a tool, pillar, or hard-fail
   condition changed.
4. Update `CLAUDE.md`, `AGENTS.md`, `docs/system-prompt.md`, the Cursor rule
   under `.cursor/rules/qa-standard.mdc`, and the global Cursor rule under
   `~/.cursor/rules/qa-standard-global.mdc` so all agents see the new version.

Reference plan that this standard operationalizes:
[testing strategy](../testing/strategy.md) and [E2E plan](../testing/e2e-plan.md).
The original `browser-based_qa_layer` working plan lives in `~/.cursor/plans/`.
