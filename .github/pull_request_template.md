# Summary

<!-- What does this PR change? Why? -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Docs
- [ ] Security fix
- [ ] Test / infra

## How to test

<!-- Paste the commands and manual steps a reviewer should follow. -->

---

## QA Standard — Pillars touched (BINDING)

> The full standard lives at [docs/qa/STANDARD.md](../docs/qa/STANDARD.md). The
> per-PR Definition of Done is at
> [docs/qa/definition-of-done.md](../docs/qa/definition-of-done.md). Every box
> below MUST be checked or annotated `n/a — <reason>`.

Mark every pillar this change touches. Each marked pillar requires at least
one new or updated spec under the pillar's folder.

- [ ] A — Functional smoke (`tests/e2e/smoke/**`)
- [ ] B — RBAC matrix (`tests/e2e/rbac/**`)
- [ ] C — PHI scope & encryption (`tests/e2e/phi-scope/**`)
- [ ] D — Deep end-to-end flows (`tests/e2e/flows/**`)
- [ ] E — Accessibility (`tests/e2e/a11y/**`)
- [ ] F — Visual regression (`tests/e2e/visual/**`)
- [ ] G — Cross-browser & responsive (`tests/e2e/responsive/**`)
- [ ] H — Performance / load / soak (`tests/perf/**`)
- [ ] I — Security / DAST (`tests/security/**`)
- [ ] J — API contract (`tests/contract/**`)
- [ ] K — External integrations (`tests/external/**`)
- [ ] L — Time-shifted scenarios (`tests/e2e/time/**`)
- [ ] M — Data integrity / migrations / DR (`tests/data/**`)
- [ ] N — Concurrency / idempotency / resilience (`tests/e2e/concurrency/**`)
- [ ] O — Files / email / SMS / print / PDF (`tests/e2e/files/**`)
- [ ] P — Compliance controls (`tests/e2e/compliance/**`)
- [ ] Q — Documentation integrity (`tests/docs/**`)
- [ ] R — Observability (`tests/observability/**`)
- [ ] **S — Live-Stack Reality Gate** (`scripts/qa/live-stack-smoke.mjs` +
      `scripts/qa/check-migration-drift.mjs` +
      `scripts/qa/check-dockerfile-build.mjs` + `tests/e2e/live-stack/**`).
      REQUIRED for any PR that touches `src/server/auth.ts`,
      `src/middleware.ts`, `prisma/**`, `Dockerfile.*`,
      `docker-compose.*.yml`, `.env*`, `scripts/web-entrypoint.sh`,
      `src/lib/api/error-catalog.ts`, `next.config.mjs`,
      `package.json#scripts`, `scripts/dev/**`, or any
      `src/app/api/auth/**` route. Surface 7 (dev-loop perf) is the
      detector for the "every link feels slow" regression class
      (DEF-0014, ADR 0029).

### New / updated specs

```
tests/e2e/<pillar>/<file>.spec.ts
tests/contract/<file>.spec.ts
```

## Headline reporting block (REQUIRED — paste actual numbers)

> Per [STANDARD.md §3](../docs/qa/STANDARD.md#3-headline-reporting-rule), the
> coverage line goes FIRST. A "Pass / Fail" count without a coverage line is
> not a valid report. Any "Not Run" entry for a covered pillar counts as a
> **fail** of the gate.

```
Routes covered:    X of Y
Roles exercised:   X of N
Pillars touched:   <A–S IDs>
Pillars green:     <A–S IDs>
Pillars not run:   <A–S IDs>     (must be empty for release PRs)
Live stack:        <commit SHA running in container> | migrations: 0 pending | sign-in matrix: ADMIN/MANAGER/SPECIALIST/COMMITTEE_MEMBER all green | dev-perf: p100 <Nms> (<2000ms budget)
Pass / Fail / Skip: P / F / S
```

## Hard-fail conditions cleared

(See [STANDARD.md §4](../docs/qa/STANDARD.md#4-hard-fail-conditions-no-exceptions).)

- [ ] Zero browser console `error` messages.
- [ ] Zero React hydration warnings.
- [ ] Zero uncaught `TypeError` / unhandled exceptions.
- [ ] Zero 5xx from any first-party route, tRPC procedure, or webhook.
- [ ] Zero axe-core `serious`/`critical` violations on touched routes.
- [ ] Zero PHI leakage on touched routes.
- [ ] Zero broken first-party links on touched routes.
- [ ] OpenAPI / tRPC contract snapshots match the shipped surface.
- [ ] No regression on `@hipaa`, `@ncqa`, `@cms-0057-f`, `@jc-npg-12` specs.
- [ ] **Zero pending Prisma migrations** (`npm run qa:migrations` green — STANDARD.md §4 (11)).
- [ ] **Every seeded staff role can sign in** on the deployed stack
      (`npm run qa:live-stack` green for ADMIN, MANAGER, SPECIALIST,
      COMMITTEE_MEMBER — STANDARD.md §4 (12)).
- [ ] **Cold Dockerfile rebuild succeeds** (`npm run qa:dockerfile -- --cold`
      green — STANDARD.md §4 (13); required when PR touches `Dockerfile.*`,
      `package.json`, `prisma/**`, or postinstall hooks).
- [ ] **Named-volume staleness** probe green (Prisma client schema host==container,
      `.next/build-manifest.json` newer than latest master — STANDARD.md §4 (14)).
- [ ] **Dev-loop performance invariant** green: `npm run qa:live-stack:perf`
      (or `qa:live-stack:full`) Pillar S Surface 7 measured re-fetch p100
      < 2000 ms (STANDARD.md §4 (15) + §11; required when PR touches
      `next.config.mjs`, `package.json#scripts.dev`, `scripts/dev/**`,
      `route-inventory.json`, or `docker-compose.dev.yml`).

## Coverage & inventories

- [ ] `npm run qa:inventory` was run; `docs/qa/inventories/*.md` is committed.
- [ ] `scripts/qa/check-coverage.ts` is green (no orphaned routes / links /
      APIs / tRPC procedures / bots / webhooks / jobs / forms).
- [ ] Per-screen card present at `docs/qa/per-screen/<slug>.md` for any new
      route, with `Linked specs:` populated.
- [ ] Per-flow card present at `docs/qa/per-flow/<slug>.md` for any new user
      flow, with `Linked specs:` populated.
- [ ] `docs/qa/coverage-matrix.md` updated if a screen / role / permission
      boundary was added.

## Build & basic hygiene

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test` green
- [ ] `node scripts/forbidden-terms.mjs` clean
- [ ] `npm run qa:gate` green end-to-end (includes `qa:migrations` +
      `qa:live-stack`; static-only green is no longer enough).
- [ ] New Prisma schema changes have a migration in `prisma/migrations/**`
- [ ] PHI fields written in new code use `encryptOptional`/`encrypt`
- [ ] User-facing copy does not reference upgrade/uplift/migration language
- [ ] `docs/status/blocked.md` updated if this change depends on human input
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`
