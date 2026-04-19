# ADR 0028 — Pillar S: Live-Stack Reality Gate

- **Status:** Accepted (2026-04-19)
- **Deciders:** QA Standard Owner; engineering owners of auth, prisma,
  middleware, dockerfiles
- **Supersedes:** none
- **Related:** [STANDARD.md §2.S](../../qa/STANDARD.md#2s-pillar-s--live-stack-reality-gate-binding),
  [STANDARD.md §4 (11)–(14)](../../qa/STANDARD.md#4-hard-fail-conditions-no-exceptions),
  [definition-of-done.md](../../qa/definition-of-done.md),
  [DEF-0009](../../qa/defects/DEF-0009.md), ADR
  [0019](0019-iterator-aware-coverage.md) (the `qa:coverage`
  iterator rule that this ADR sits next to in the gate sequence)

## Context

Two release-shaped reports in 18 days have shipped a "green" headline
while the deployed application failed at first interactive use:

1. **2026-04-17** — `Pass: 33, Fail: 0, Not Run: 223` while the first
   authenticated screen failed to mount. Closed by STANDARD.md §3 / §4.1
   / §5 / §6 (coverage-first reporting, browser console hard-fail,
   per-screen cards, inventory + check-coverage gate).
2. **2026-04-19 (DEF-0009)** — `npm run qa:gate` green, 1865 vitests
   green, typecheck clean, lint clean, all per-screen cards green —
   yet the user could not sign in at all on the running container.
   Three stacked root causes (stale named-volume contents, three
   unapplied Prisma migrations, dev Dockerfile postinstall ordering bug).
   None of pillars A–R, as wired into `qa:gate`, would have caught it
   from a static repository check; Pillar A's `globalSetup`
   would have caught it from a live-stack check, but `qa:gate` doesn't
   run Pillar A and the Pillar A run was honestly reported as
   "Not Run" because Docker was not available — and the gate accepted
   that.

Both incidents share a structural shape: **the gate validated the
source tree, not the running system.** All 18 existing pillars (A–R)
operate from the source tree; even Pillar A's smoke spec, when it is
run under `npm run test:e2e`, drives a Next.js server that Playwright
itself spawned with the tester's local environment — not the deployed
container with its named volumes, env file, network, and entrypoint.

## Decision

Add **Pillar S — Live-Stack Reality Gate** as a 19th pillar in
`docs/qa/STANDARD.md`. Pillar S is HTTP-only (no browser; no
Playwright dependency) so it can run on any contributor's machine,
in CI, and in the Fix-Until-Green loop, regardless of whether
Playwright/Docker/browsers are installed.

Pillar S has six required surfaces:

1. **Bring-up health probe** — `GET {BASE_URL}/api/health` returns 200
   with `services.database === "ok"`.
2. **Schema / migration parity gate** —
   `scripts/qa/check-migration-drift.mjs` wraps `prisma migrate status`
   against the live database, fails on any pending migration, drift,
   or failure-to-connect (no-connection ≠ no-pending).
3. **Role-by-role real sign-in matrix** —
   `scripts/qa/live-stack-smoke.mjs` reads the role registry from
   `tests/e2e/roles.ts` (single source of truth shared with Pillar A's
   `globalSetup`), and for every entry in `STAFF_ROLES` performs the
   production CSRF + `POST /api/auth/callback/credentials` round-trip,
   asserts a 302 to a non-`/auth/signin` URL, asserts the
   `authjs.session-token` cookie is set, and asserts
   `GET /api/auth/session` returns a populated session with the
   expected `user.role`.
4. **Authenticated session probe** — at least one authenticated
   App-Router page or tRPC procedure (default: `/dashboard`) returns
   200 for the admin role with a visible `<main>` / `<h1>` / `<h2>`,
   proving the session actually authorizes against the application
   surface and not just against `/api/auth/session`.
5. **Anonymous public-surface invariants** — every entry in
   `docs/qa/inventories/route-inventory.json` with `group === "public"`
   returns 200 anonymously (NOT a redirect-followed-by-200 — the FIRST
   response status is checked) AND its rendered HTML contains a visible
   `<main>` / `<h1>` / `<h2>` (a 200-blank-shell still fails). Spot-checks
   `/errors/insufficient-scope` and `/errors/insufficient_scope`. This
   structurally closes the DEF-0007 / DEF-0008 anonymous-routing class.
6. **Dockerfile cold-build sanity** —
   `scripts/qa/check-dockerfile-build.mjs` validates every compose file
   with `docker compose ... config -q`; in `--cold` mode runs
   `docker compose build --no-cache` for every app service, catching
   ordering bugs (the prisma-postinstall finding a schema that hasn't
   been copied yet, missing runtime deps, etc.) that named-volume-shadowed
   dev rebuilds can hide for weeks.

A seventh probe — the **stale-named-volume probe** (compares the
running container's `/app/node_modules/.prisma/client/schema.prisma`
to the on-disk `prisma/schema.prisma`, and the running container's
`/app/.next/build-manifest.json` mtime to the latest `master` commit
time) — is part of Pillar S as well, and is implemented inside
`scripts/qa/live-stack-smoke.mjs` when invoked with `--volume-probe`
so it can introspect the running container via `docker exec`. Required
for any PR touching `docker-compose.*.yml` named volumes.

`npm run qa:gate` is updated from:

```
qa:inventory && qa:cards:check && qa:coverage && sdk:check && postman:check
```

to:

```
qa:inventory && qa:cards:check && qa:coverage && qa:migrations
  && qa:live-stack && sdk:check && postman:check
```

so that the green-light path probes the running system. When `BASE_URL`
is unreachable, `qa:live-stack` reports `Pillar S: Not Run`, prints
the bring-up commands the operator should run, and exits non-zero.
Per STANDARD.md §3 ("Not Run on a covered pillar counts as fail of the
gate"), this is a hard fail by design — the gate refuses to be green
without a live stack.

## Anti-weakening rules (BINDING)

These are §4.2 violations whose temptation is greater for Pillar S
than for any other pillar, because Pillar S requires a live stack to
run and contributors will be tempted to mark it "skipped" rather than
stand up the stack:

1. Skipping Pillar S because "Docker isn't available" without filing
   the honest `Pillars not run: S` headline AND a defect card AND
   failing the gate.
2. Replacing the live HTTP probe with an in-process Next.js spawn that
   does NOT use the same env / volumes / network as the deployed stack.
3. Catching `prisma migrate status` failures and reporting "no pending
   migrations" because the script could not connect to the database.
   No connection ≠ no pending — count it as Not Run, fail the gate.
4. Hard-coding the role matrix anywhere other than `tests/e2e/roles.ts`.
   Drift between `roles.ts` and `prisma/seed.ts` is itself a covered
   condition (the live smoke fails when a role's email/password is
   absent from the seeded users).
5. Replacing the real CSRF round-trip with a mocked session cookie or
   a `vi.spyOn(NextAuth, "signIn")` shim.
6. Lowering the `qa:live-stack` exit code from non-zero to zero on any
   failure path.
7. Removing `qa:migrations` or `qa:live-stack` from `qa:gate` to "speed
   up CI". The static gates are necessary but no longer sufficient.
8. Letting the **stale-named-volume probe** treat "named volume not
   present" as pass. The probe MUST exit non-zero when it cannot
   prove the volume is fresh (e.g. it cannot `docker exec` into the
   running container) — `unprovable freshness ≡ stale`.

## Alternatives considered (and rejected)

### Alternative 1 — make Pillar A's `globalSetup` part of `qa:gate`

Rejected because Pillar A requires Playwright + at least one browser,
adds 60–180 s of warmup even when the underlying check is "did
sign-in succeed", and silently degrades to "Not Run" when Docker is
unavailable. Pillar S is browserless and runs in 5–10 s on a healthy
stack; it can sit inside the Fix-Until-Green loop without amplifying
loop time. Pillar A is still required separately on release-shaped
PRs (and is now wired explicitly via the live-stack matrix spec under
`tests/e2e/live-stack/`).

### Alternative 2 — bake migration deploy into the dev container entrypoint

Rejected as the only fix because it would silently mask schema drift —
the contributor would never see the "you forgot to commit a migration"
signal; the entrypoint would just apply whatever's pending and the
log line would scroll past. The chosen design applies migrations
explicitly via `npm run db:migrate:prod` during bring-up, then runs
`qa:migrations` as a separate gate, so the gate has an opinion about
schema drift even when the entrypoint succeeds. (We may still adopt
the entrypoint convenience as a separate change; it is orthogonal to
this gate.)

### Alternative 3 — only run Pillar S in CI, not locally

Rejected because the 2026-04-19 incident was reproduced locally hours
before any CI run. The gate must be runnable in the same loop where
the bug is being chased, not delegated to a downstream system that the
contributor only checks after pushing.

### Alternative 4 — replace named volumes with bind mounts in dev compose

Rejected as the only fix because the named volumes were chosen
deliberately (lines 56–60 of `docker-compose.dev.yml` cite "two
production-class incidents (DEF-001 missing pino, and the prior
@prisma/client outage)"). They survive container recreation by design.
The right answer is not to remove the survivability but to add a
gate that surfaces when the survivors have gone stale. The
**stale-named-volume probe** in Pillar S does exactly that.

## Consequences

**Positive:**

- Reports of "everything green" while the user can't sign in are
  structurally impossible: `qa:gate` is no longer green unless a real
  CSRF round-trip succeeded for every seeded staff role on the
  deployed stack moments before.
- Schema drift between source and database fails the gate explicitly
  and points the operator at `npm run db:migrate:prod` /
  `prisma migrate deploy`.
- Cold Dockerfile rebuilds are exercised on every release, catching
  package.json/Dockerfile ordering regressions before they hide
  behind named-volume staleness.
- The role registry in `tests/e2e/roles.ts` becomes load-bearing for
  Pillar S, so any drift between it and `prisma/seed.ts` surfaces
  immediately.

**Negative:**

- `qa:gate` now requires a reachable `BASE_URL` (default
  `http://localhost:6015`). Contributors running the gate without the
  dev stack up will see a clear "Not Run" failure with the bring-up
  commands printed; this is the desired behavior but it does add
  friction.
- CI pipelines that cannot stand up the dev stack (e.g. the lint-only
  shard) will need to invoke `qa:gate:static` (kept as an alias for
  the old `qa:gate` body) explicitly. The default `qa:gate` is the
  full version.
- Some Fix-Until-Green loops will get slightly longer because Pillar S
  re-runs in step 5 alongside the relevant pillar from A–R.

**Net:** the cost is a small ongoing tax on every loop, paid in
exchange for structural elimination of the "green report, broken
deploy" failure mode.

## Anti-weakening attestation

A reviewer who proposes a change matching any of the §Anti-weakening
list above MUST be sent back to this ADR before the change can be
considered. Any change that touches `scripts/qa/live-stack-smoke.mjs`,
`scripts/qa/check-migration-drift.mjs`,
`scripts/qa/check-dockerfile-build.mjs`, or
`tests/e2e/live-stack/role-login-matrix.spec.ts` MUST cite this ADR
in its PR description and explain why the change does not weaken any
of the seven required surfaces.
