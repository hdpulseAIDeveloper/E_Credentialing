# Changelog

All notable changes to the ESSEN Credentialing Platform are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semantic versioning is used for public-facing APIs; internal changes are grouped by release.

## [Unreleased]

### Fixed
- **Public-API delivery surface hardened — closes DEF-0012
  (`docs/` excluded from Docker image) and DEF-0013 (Next.js
  public-vs-route URL collision on `/api/v1/postman.json`)
  (2026-04-19):** Two stacked defects, both blocking commercial
  viability of the public-API value proposition. DEF-0012 was a
  pre-existing bug surfaced by closing DEF-0008 (with `/changelog`
  no longer redirected to `/auth/signin`, the page rendered and
  immediately failed because `.dockerignore` had been silently
  dropping the entire `docs/` tree from every image build since
  Wave 5.5). DEF-0013 was discovered when Pillar S Surface 5 grew
  HTTP probes for the public API artifacts: `/api/v1/postman.json`
  returned 500 because Next.js refused to choose between the
  static file at `public/api/v1/postman.json` and the App Router
  route handler at `src/app/api/v1/postman.json/route.ts`
  (`https://nextjs.org/docs/messages/conflicting-public-file-page`).
  - `.dockerignore` (DEF-0012 prod fix): rewrote the blanket
    `docs` exclude as `docs/**` followed by explicit
    `!docs/changelog/**`, `!docs/api/**`, `!docs/planning/**`
    un-excludes — the only three subtrees the deployed bundle
    reads at request time (changelog page, OpenAPI/Postman
    delivery routes, AI knowledge-base RAG corpus). The heavy
    documentation tree (`docs/qa/`, `docs/dev/`, `docs/functional/`,
    `docs/technical/`, `docs/training/`, `docs/archive/`,
    `docs/product/`) stays out of the image so it doesn't bloat
    deployments. The file now carries an inline anti-weakening
    rule: every new `process.cwd()`-relative `docs/<X>` read from
    `src/**` REQUIRES a paired `!docs/<X>/**` un-exclude AND a
    Pillar S spec that probes the corresponding route.
  - `docker-compose.dev.yml` (DEF-0012 dev fix, paired with
    Option 1 prod fix per the defect card): added bind mounts for
    `./docs/changelog`, `./docs/api`, `./docs/planning`, and
    `./data` so the dev container picks up content edits without
    rebuilds and so dev and prod always see the same runtime data
    shape.
  - `data/api/v1/postman.json` (NEW location, DEF-0013 fix):
    moved from `public/api/v1/postman.json`, which had been
    shadowed by Next.js's static-file server and conflicted with
    the route handler. The new top-level `data/` directory is the
    home for runtime-read build artifacts (sibling to `public/`,
    NOT served as a static URL by Next.js, NOT excluded by
    `.dockerignore`). Updated all four references in lockstep:
    `src/app/api/v1/postman.json/route.ts` (read path +
    docstring explaining the trap), `scripts/qa/build-postman-collection.ts`
    (`OUT_PATH` constant + anti-weakening rule expanded to
    forbid writes to `public/api/v1/`), `scripts/qa/check-postman-drift.ts`
    (`COMMITTED` constant + drift-fix instructions), and
    `tests/contract/pillar-j-postman.spec.ts` (`COLLECTION_PATH`).
    Removed the now-empty `public/api/v1/` and `public/api/`
    directories.
  - `scripts/qa/live-stack-smoke.mjs` (Pillar S hardening): added
    four new artifact probes to Surface 5 — `/api/v1/openapi.json`,
    `/api/v1/openapi.yaml`, `/api/v1/postman.json`, `/changelog.rss`
    — each validating HTTP 200, the expected `Content-Type`
    prefix, AND a non-trivial body size (catches the
    silently-empty-artifact regression class). Also fixed Surface 6
    `named-volume staleness` to compare `node_modules/.prisma/client/schema.prisma`
    on the host vs the container (apples-to-apples, both are the
    post-`prisma generate` normalized form) instead of the source
    `prisma/schema.prisma` vs the generated copy (apples-to-oranges,
    always false-positive). And replaced the broken
    `require("node:crypto")` ESM-incompatible call with a top-of-file
    `import { createHash } from "node:crypto"`.
  - **Verification (post-fix `npm run qa:live-stack --volume-probe`):**
    `pass=26 fail=0 warn=0 notrun=0`, exit 0. Up from `pass=20 fail=1`
    (DEF-0012) at the start of this batch. Every public surface — 12
    marketing/auth pages, 2 `/errors/[code]` casings, 4 API artifacts,
    1 RSS feed, 4 role sign-ins, 1 authenticated dashboard probe, git
    HEAD pin, and named-volume drift detector — now passes against
    the deployed dev stack.
  - `docs/qa/defects/DEF-0012.md`: closed with full anti-weakening
    attestation per STANDARD.md §4.2 (the `.dockerignore` rule, the
    paired dev/prod fix, the four Pillar S probes that catch any
    future regression of this class).
  - `docs/qa/defects/DEF-0013.md` (NEW): filed and closed in the
    same commit (per STANDARD.md §4.1.1: the `qa:live-stack` run
    that surfaced it is the same one that proves the fix). Full
    captured evidence (HTTP 500 + Next.js conflicting-public-file-page
    error JSON + `ls` showing the file collision), root-cause
    reconstruction across Wave 11 and Wave 17, the structural fix,
    and the anti-weakening attestation.
  - **Commercial-viability framing:** the user's mandate for this
    batch was "create a commercially viable product." The Postman
    collection is the first thing prospective API customers
    download after reading the OpenAPI spec; `/sandbox` and the
    OpenAPI `info.description` both link to it; a 500 on first
    download is a credibility-destroying first impression
    (technical equivalent of the demo crashing in the sales
    meeting). Same logic applies to `/changelog` (the public
    "what shipped recently" surface that prospects read before
    asking for a trial). Both now ship clean.

- **Single source of truth for public routes — closes DEF-0008
  (middleware lagging route-inventory) and DEF-0011 (route-inventory
  ahead of middleware) (2026-04-19):** Both defects were the SAME
  structural drift seen from opposite ends. The middleware
  (`src/middleware.ts`) and the route-inventory builder
  (`scripts/qa/build-route-inventory.ts`) each carried their own
  hand-maintained idea of "is this route public" and disagreed in
  both directions: anonymous customers were silently redirected to
  `/auth/signin` from `/cvo`, `/pricing`, `/sandbox`, `/changelog`,
  `/legal/cookies`, `/legal/hipaa`, `/legal/privacy`, `/legal/terms`
  (DEF-0008), AND `/settings/billing` + `/settings/compliance` were
  declared `group:public` in `route-inventory.json` while the
  middleware correctly redirected them to signin (DEF-0011). Both
  defects were deterministically reproduced by the first run of
  `npm run qa:live-stack` after Pillar S landed.
  - `src/lib/public-routes.ts` (new): single source of truth.
    Exports `PUBLIC_PATH_PREFIXES` (14 alphabetised path prefixes
    the middleware allows without a session: `/auth/`, `/api/auth/`,
    `/api/webhooks/`, `/api/health`, `/api/live`, `/api/ready`,
    `/api/metrics`, `/api/v1/`, `/api/fhir/`, `/api/application/`,
    `/api/attestation`, `/verify/`, `/errors/`, `/legal/`),
    `PUBLIC_EXACT_PATHS` (7 leaf marketing paths: `/`, `/changelog`,
    `/changelog.rss`, `/cvo`, `/errors`, `/pricing`, `/sandbox`),
    `isPublicRoute(pathname): boolean`, `isProviderPortalRoute(pathname): boolean`,
    and `PROVIDER_PORTAL_PREFIX` constant. The file is dual-consumable
    from the Edge runtime AND from Node. Anti-weakening rules baked
    into the TSDoc forbid hand-maintained duplicates anywhere else
    (re-introducing inline `pathname.startsWith("/legal/")` checks
    in middleware, hard-coding "public" in the inventory builder,
    etc.) — each is a §4.2 violation and grounds for revert.
  - `src/middleware.ts`: replaced the 14-line hand-maintained inline
    `pathname === "/" || pathname.startsWith("/auth/") || …` allow-list
    with a single `if (isPublicRoute(pathname)) { … }` branch. Same
    for the provider portal: `if (isProviderPortalRoute(pathname)) { … }`.
    The middleware now has zero hand-maintained route knowledge.
  - `scripts/qa/build-route-inventory.ts`: replaced the
    `groupMatch?.[1] ?? "public"` default with a 3-tier
    `classifyGroup(route, relFile)` helper: (1) explicit `(group)/`
    segment wins, (2) `isPublicRoute(route)` → `public`, (3)
    `isProviderPortalRoute(route)` → `provider`, (4) default →
    **`staff`** (the truthful default, since the middleware
    redirects everything not in the public allow-list to signin).
    The OLD code defaulted ALL ungrouped pages to `public`, which
    was the DEF-0011 root cause: `/settings/billing` and
    `/settings/compliance` live directly under `src/app/settings/...`
    (not inside `(staff)/`), so they hit the default branch and were
    silently mis-classified.
  - `docs/qa/inventories/route-inventory.{md,json}`: regenerated. The
    `public` set now matches the runtime middleware exactly (16
    routes). `/settings/billing` and `/settings/compliance` correctly
    classify as `staff`.
  - **Verification (post-fix `npm run qa:live-stack`):** 8 of 9
    DEF-0008-affected routes now PASS (`/`, `/cvo`, `/pricing`,
    `/sandbox`, `/legal/{cookies,hipaa,privacy,terms}`, plus the
    pre-existing `/auth/register`, `/auth/signin`, `/errors`,
    `/errors/insufficient-scope`, `/errors/insufficient_scope`).
    The 9th route, `/changelog`, exposed a NEW root cause:
    `.dockerignore` excludes the entire `docs/` tree, so the
    runtime markdown loader at `src/lib/changelog/loader.ts`
    cannot read `docs/changelog/public.md` from the deployed
    image and returns 500. Filed as **DEF-0012** (separate root
    cause per STANDARD.md §4.1.1; will land as a separate
    1-3-line `.dockerignore` fix). `/settings/billing` and
    `/settings/compliance` no longer appear in the Pillar S §5
    iteration because they correctly classify as `staff`, so
    DEF-0011 is structurally closed by the same commit.
  - `docs/qa/defects/DEF-0008.md`, `docs/qa/defects/DEF-0011.md`:
    closed with full anti-weakening attestation per STANDARD.md §4.2.
  - **Why the same commit closes BOTH:** The user explicitly
    asked for the all-inclusive structural fix rather than two
    separate one-side patches. Closing DEF-0008 alone (extending
    the middleware allow-list to match the inventory) would have
    moved the drift from middleware-side to inventory-side.
    Closing DEF-0011 alone (correcting the inventory classifier)
    would have left DEF-0008's eight broken anonymous routes
    broken. The single-source-of-truth approach makes future drift
    in either direction structurally impossible — the middleware
    and the inventory cannot disagree because they import the same
    module.

- **Marketing homepage `/` now wraps content in `<main>` — closes
  DEF-0010 (2026-04-19):** Pillar S's §5 page-shape invariant
  surfaced that `/` returned 200 with at least one `<h1>`/`<h2>`
  (so it was not a hard-blank-shell) but was missing the `<main>`
  landmark. WCAG 2.1 SC 1.3.1 / 2.4.1 violation: screen-reader
  users could not use the "skip to main content" shortcut on the
  marketing page — the very page most likely to be the first
  impression for new prospects.
  - `src/app/page.tsx`: wrapped the three content sections (hero,
    features grid, stats strip) in a single `<main id="main">`
    element, kept BETWEEN the `<nav>` and the `<footer>` per WAI-ARIA
    Landmarks (so the skip-link lands at the hero heading, not at
    the brand link).
  - **Verification:** post-fix `npm run qa:live-stack` reports
    `PASS [S.5.public] /  — 200 + page shape ok`. Pillar E axe-core
    matrix re-runs on the next CI cycle and is expected to lose the
    associated SC 1.3.1 / 2.4.1 violation.
  - `docs/qa/defects/DEF-0010.md`: closed with full anti-weakening
    attestation.

- **`.cursor/rules/qa-standard-global.mdc` mirrored to match the
  workspace QA standard (2026-04-19):** The global Cursor rule (used
  across every HDPulseAI repo on this developer machine) was still
  citing 18 pillars (A–R) and missing the four new hard-fail
  conditions (pending Prisma migrations, dead seed-account login,
  cold Dockerfile build regression, named-volume staleness) added
  by Pillar S. Brought it to parity with the workspace mirror at
  `.cursor/rules/qa-standard.mdc` so every Cursor session — not
  just the one open in this workspace — defaults to the post-DEF-0009
  standard. Adds the Pillar S anti-weakening rule (forbidding
  `qa:live-stack` removal from `qa:gate`, `optional: true` flags,
  hard-coded role lists inside the smoke, "skip if Docker not
  running" branches without exiting non-zero).

### Filed (open)
- **DEF-0012 — `/changelog` returns 500 because `.dockerignore`
  excludes `docs/` (2026-04-19):** Pre-existing since Wave 5.5
  (Q4 2025), hidden in production by DEF-0008's blanket redirect
  from `/changelog` → `/auth/signin`. Closing DEF-0008 lifted the
  redirect and made the 500 visible to the gate on the very first
  run. Same root cause likely affects `/api/v1/openapi.json` (reads
  `docs/api/openapi-v1.yaml`) and the AI knowledge-base loader
  (`src/lib/ai/knowledge-base.ts`). Recommended fix is a 1-3 line
  narrowing of `.dockerignore` (keep excluding `docs/qa/`,
  `docs/dev/`, `docs/functional/` etc., un-exclude
  `docs/changelog/` and `docs/api/`). Filed as a separate card per
  STANDARD.md §4.1.1 ("one root cause per commit") so the
  structural single-source-of-truth review stays clean.

### Added
- **Pillar S — Live-Stack Reality Gate (QA Standard 1.1.0 → 1.2.0)
  (2026-04-19):** A nineteenth testing pillar that probes the
  **deployed running system** rather than the source tree. Added in
  response to DEF-0009 — the user reported "Sign In is not working.
  Nothing happens" while every existing gate (`npm run qa:gate`,
  1865 vitests, typecheck, lint, every per-screen card) was reporting
  green. Root-cause analysis revealed a structural class of miss the
  existing 18 pillars (A–R) could not catch from a static repository
  check: `qa:gate` was running zero specs (only inventory + coverage
  + SDK/Postman drift), Pillar A's `globalSetup` would have caught it
  but ran only under `npm run test:e2e` and was honestly reported as
  "Not Run" because Docker wasn't available, no script wrapped
  `prisma migrate status` against the live DB, no script attempted a
  cold Dockerfile rebuild. Pillar S closes the gap.
  - `docs/qa/STANDARD.md` bumped from version 1.1.0 (2026-04-17) to
    **1.2.0 (2026-04-19)**. Pillar inventory expanded from "18
    pillars (A–R)" to "19 pillars (A–S)". New §2.S documents the six
    required surfaces (bring-up health, schema/migration parity,
    role-by-role real CSRF sign-in matrix, authenticated session
    probe, anonymous public-surface invariants, Dockerfile cold-build
    sanity, stack-version pin) and the eight anti-weakening rules
    that prevent silently skipping the gate. New §4 hard-fail
    conditions (11)–(14) added: pending Prisma migrations, dead
    seed-account login, cold Dockerfile build regression, stale
    named-volume contents shadowing the deployed image. New §3
    `Live stack:` line required on every release report. New §8 DoD
    items (11)–(13) wire the new gates into the per-PR checklist.
    New §10.2 names the DEF-0009 regression so it cannot recur
    silently.
  - `docs/qa/definition-of-done.md` updated: §1 adds an
    `npm run qa:gate` check that includes the new Pillar S members;
    §2 adds Pillar S to the touched-pillars matrix with explicit
    trigger files; §4 adds four new hard-fail boxes (zero pending
    migrations, every seeded staff role can sign in, cold Dockerfile
    rebuild succeeds, named-volume staleness probe green); §8
    headline reporting block adds the `Live stack:` line.
  - `docs/dev/adr/0028-live-stack-reality-gate.md` (new ADR):
    captures the decision, the four alternatives that were rejected
    (make Pillar A's globalSetup part of qa:gate; bake migration
    deploy into the dev entrypoint as the only fix; only run Pillar
    S in CI; replace named volumes with bind mounts), and the eight
    anti-weakening rules.
  - `scripts/qa/live-stack-smoke.mjs` (new): HTTP-only smoke that
    drives the deployed stack via `BASE_URL`. Reads the role
    registry from `tests/e2e/roles.ts` at runtime (anti-weakening
    rule 4 — single source of truth), performs the production
    CSRF + `/api/auth/callback/credentials` round-trip for every
    `STAFF_ROLES` entry, asserts a 302 to a non-`/auth/signin` URL,
    asserts the `authjs.session-token` cookie is set, asserts
    `/api/auth/session` returns the expected `user.role`. Also
    probes `/api/health`, an authenticated `/dashboard` shape
    check, every `route-inventory.json` `group:public` entry's
    first-response status (no redirect-following), and the
    `/errors/insufficient-scope` and `/errors/insufficient_scope`
    spot-checks (DEF-0007 invariant). Optional `--volume-probe`
    introspects the running container's
    `node_modules/.prisma/client/schema.prisma` and compares its
    SHA-1 to the on-disk `prisma/schema.prisma`, surfacing the
    named-volume staleness root cause of DEF-0009.
  - `scripts/qa/check-migration-drift.mjs` (new): wraps
    `prisma migrate status`, fails on any pending migration, drift,
    or failure-to-connect (per ADR 0028 §Anti-weakening 3,
    no-connection ≠ no-pending — exits non-zero in both cases).
  - `scripts/qa/check-dockerfile-build.mjs` (new): default mode
    runs `docker compose ... config -q` for every compose file;
    `--cold` mode additionally runs `docker compose build
    --no-cache <service>` for every app service, catching ordering
    bugs (the prisma-postinstall finding a schema that hasn't been
    copied yet) that named-volume-shadowed dev rebuilds can hide
    for weeks.
  - `tests/e2e/live-stack/role-login-matrix.spec.ts` (new):
    browser-driven supplement to the .mjs script — iterates the
    same `STAFF_ROLES` registry, fills the signin form by
    accessible label, asserts post-login URL is not
    `/auth/signin`, asserts `<main>` and `<h1>/<h2>` are visible
    (no blank-shell), cross-checks `/api/auth/session` returns
    the right `user.role`. Also includes a registry-consistency
    test that guarantees `STAFF_ROLES ⊆ ROLES` and every
    STAFF_ROLES entry has email + password.
  - `package.json` scripts: added `qa:migrations`, `qa:live-stack`,
    `qa:live-stack:full` (with `--volume-probe`), `qa:dockerfile`,
    `qa:dockerfile:cold`. **`qa:gate` rewritten** to include
    `qa:migrations` + `qa:live-stack` so the green-light path now
    actually probes the running system. The previous static-only
    body is preserved as `qa:gate:static` for the lint-only CI
    shard.
  - `docs/qa/defects/DEF-0009.md` (new defect card): full root
    cause for the sign-in regression (three stacked: stale named
    volumes shadowing the fresh image, three unapplied Prisma
    migrations including `20260418100000_multitenancy_shim`, and
    the dev Dockerfile postinstall ordering bug fixed in commit
    `e9c0fc2`); the structural-miss analysis ("which pillar should
    have caught it and why didn't it"); the operational fix
    already applied; the structural fix landed in this commit; and
    a forward-looking demo of the gate output that would have
    caught DEF-0009 day-one.
  - `.cursor/rules/qa-standard.mdc` updated: pillar count A–R
    → A–S, new hard-fail conditions (7)–(10), Live-stack line
    added to the headline reporting template, `STANDARD.md` §10.1
    vs §10.2 distinguished.
  - `docs/system-prompt.md` quality-bar paragraph updated to cite
    19 pillars, Pillar S, ADR 0028, and the new headline shape.
  - **Gate-execution proof:** the new `npm run qa:live-stack`
    against the post-fix dev stack shows 4-of-4 staff roles signing
    in cleanly (`admin`/`manager`/`specialist`/`committee_member`,
    all landing on `/dashboard` with the expected `user.role`),
    `/dashboard` rendering with `<main>` + `<h1|h2>`, both
    `/errors/insufficient-scope` and `/errors/insufficient_scope`
    returning 200 (DEF-0007 invariant), AND **immediately surfaces
    11 previously-hidden defects** the prior "all green" gate did
    not see: DEF-0008's still-unfixed `/cvo`/`/pricing`/
    `/changelog`/`/legal/*`/`/sandbox` middleware allow-list miss
    (auto-reproduced now), `/` blank-shell shape (no `<main>`
    landmark), and `/settings/billing` + `/settings/compliance`
    inventory mis-classification (`route-inventory.json` declares
    `group:public` but middleware redirects to signin). These are
    the structural exits Pillar S exists to catch; their open
    state is by design (one root cause per commit per
    STANDARD.md §4.1.1).
- **Wave 21 — Public, machine-readable error catalog
  (1.9.0 -> 1.10.0) (2026-04-19):** Tenth exercise of the
  versioning machinery, and the resolver every Problem body's
  `type` URI has implicitly promised since Wave 19. Until this
  wave a customer who clicked
  `https://essen-credentialing.example/errors/insufficient-scope`
  got a 404 — the URI was contractually stable but resolved to
  nothing. Worse, there was no enumerable list of failure modes
  the platform could emit, so SDK code-gen, internal monitoring
  rules, and customer-facing alerting were all hand-maintained
  best-effort. This wave consolidates every error code into a
  single source of truth in `src/lib/api/error-catalog.ts`,
  exposes it on three faces (JSON list, JSON entry, HTML pages),
  and locks the contract with a grep-based unit-test gate that
  fails the build when an emitter is added without a catalog row.
  - `src/lib/api/error-catalog.ts`: new module exporting the
    `ErrorCatalogEntry` interface (`code`, `title`, `status`,
    `summary`, `description`, `remediation`, `sinceVersion`,
    `retiredInVersion`, `docsPath`), the `ERROR_CATALOG`
    array (the closed enumeration of every value the platform
    can ever emit on `error.code`), helper functions
    `findCatalogEntry(code)` (snake_case OR kebab-case lookup)
    and `listCatalogEntries()` (sorted-by-code clone), and a
    private `kebab(code)` helper. Every existing emitter was
    audited and seeded into the catalog; new emitters MUST add
    their row in the same PR (the unit test enforces this).
  - `src/lib/api/problem-details.ts`: the legacy `PROBLEM_TITLES`
    map is now derived from `ERROR_CATALOG` rather than
    hand-maintained. There is exactly one source of truth for
    the title-per-code mapping. The hand-authored map is kept as
    a backward-compat fallback for any code not yet migrated
    (the test gate guarantees the set is empty in CI).
  - `src/app/api/v1/errors/route.ts`: new `GET /api/v1/errors`
    endpoint returning the full catalog (`ErrorCatalogList`
    schema). Authenticates with any active key (no specific
    scope required, matching `health()` and `me()`), wired into
    the standard envelope: rate-limit headers, `X-Request-Id`,
    weak `ETag` on a SHA-1 of the sorted entries, conditional
    GET via `If-None-Match`, and `applyDeprecationByRoute` (no
    deprecation today; the gate is in place for future
    deprecation flows). `auditApiRequest` records the read.
  - `src/app/api/v1/errors/[code]/route.ts`: new
    `GET /api/v1/errors/{code}` endpoint returning a single
    `ErrorCatalogEntry`. Both snake_case (`insufficient_scope` —
    the value of `error.code`) and kebab-case
    (`insufficient-scope` — the suffix of the `type` URI) are
    accepted; the SDK passes the caller's value through
    verbatim. Returns the standard 404 NotFound Problem when the
    code is not in the catalog.
  - `src/app/errors/page.tsx`: new public HTML index page at
    `/errors` rendering a sortable summary table of every
    catalog row with deep-links to the per-code detail pages.
    Public (no auth), statically rendered, indexed by search
    engines.
  - `src/app/errors/[code]/page.tsx`: new public HTML detail
    page at `/errors/{code}` rendering the full
    `title` / `summary` / `description` / `remediation` for one
    code plus a wire-format reference block showing the
    Problem body shape. Statically pre-rendered for both
    snake_case and kebab-case URLs of every catalog entry at
    build time; unknown codes invoke `notFound()`.
  - `docs/api/openapi-v1.yaml`: bumped to `1.10.0`. Adds
    `tags[].name = "errors"`, paths
    `/api/v1/errors` (`listErrorCatalog`) and
    `/api/v1/errors/{code}` (`getErrorCatalogEntry`),
    component schemas `ErrorCatalogEntry` and
    `ErrorCatalogList`. Both ops attach the standard
    response envelope (200 + 304 + 401 + 429 + headers); the
    detail op also attaches the reusable 404 NotFound. The
    `info.description` gains an "Error catalog (since
    v1.10.0)" section. The `Health.apiVersion` example was
    bumped to `"1.10.0"` to match.
  - `src/lib/api-client/v1.ts`: SDK gains `client.listErrors()`
    and `client.getError(code)` plus re-exported
    `V1ErrorCatalogEntry` and `V1ErrorCatalogList` types. The
    types are auto-derived from the regenerated
    `src/lib/api-client/v1-types.ts` so they cannot drift from
    the spec.
  - `tests/unit/api/error-catalog.test.ts`: new unit suite
    asserting per-row invariants (snake_case `code`, ≤ 60-char
    Title-Cased `title`, 4xx/5xx `status`, non-empty `summary` /
    `description`, SemVer `sinceVersion` / `retiredInVersion`,
    correct kebab-case `docsPath`), lookup helper behaviour
    (`findCatalogEntry` accepts both forms; `listCatalogEntries`
    returns a sorted clone), the registry-completeness grep
    contract (every literal `code` string passed to
    `v1ErrorResponse` or `buildProblem` in `src/app/api/v1/**`
    or `src/lib/api/**` MUST have a catalog row), and
    `PROBLEM_TITLES` backward-compat parity.
  - `tests/contract/pillar-j-openapi.spec.ts`: new
    "Wave 21: error catalog contract" describe block asserting
    the `errors` tag, both new paths with their `operationId` /
    `tags`, both schema shapes (required fields, regex
    patterns, type discipline), the standard envelope on the
    list op, and the 404 NotFound on the detail op.
  - `docs/qa/per-screen/errors.md`,
    `docs/qa/per-screen/errors__code.md`: new per-screen cards
    for the public HTML index and detail pages, documenting
    route, allowed roles (public / no auth), PHI handling
    (none), key actions, linked specs, linked OpenAPI
    operations, known defects.
  - `docs/dev/adr/0027-error-catalog.md`: new ADR documenting
    the decision to consolidate every error code into a single
    source of truth, the three-faces design (JSON list, JSON
    entry, HTML pages), the strict `code` contract (renaming
    is breaking, retiring keeps the row), the rejected
    alternatives (per-route inline tables, an `application/json`
    static asset, a separate microservice), and the
    anti-weakening rules (the unit-test grep gate, the
    `PROBLEM_TITLES` derivation, the
    `findCatalogEntry`-must-handle-both-forms invariant).
  - `docs/api/versioning.md`: bumped status to spec `1.10.0`,
    adds ADR 0027 to the related list, adds new §3.10 (Public
    error catalog) with the three-faces table, the per-field
    stability contract, and the SDK observation contract,
    augments §7 with a "How do I add a new error code?" entry
    pointing at the unit-test grep gate.
  - `docs/changelog/public.md`: new v1.15.0 (API) release note
    announcing the catalog (see below).

### Fixed
- **DEF-0007 — `/errors` HTML pages redirected anonymous visitors
  (Wave 21 contract regression) (2026-04-19):** `src/middleware.ts`
  was missing `/errors` and `/errors/<code>` from its public
  allow-list, so an anonymous browser hit on
  `https://essen-credentialing.example/errors/insufficient-scope`
  returned `307 → /auth/signin?callbackUrl=…` instead of the
  pre-rendered catalog page. Direct violation of the per-screen
  cards (`docs/qa/per-screen/errors.md`,
  `docs/qa/per-screen/errors__code.md` — both promised "fully
  public, anonymous allowed"), ADR 0027, §3.10 of
  `docs/api/versioning.md`, and RFC 9457 §3.1.1 (the `type` URI
  MUST be dereferencable to a human-readable description by anyone
  who has the URI).
  - `src/middleware.ts`: added `pathname === "/errors"` and
    `pathname.startsWith("/errors/")` to the public-allow predicate,
    mirroring the existing `/verify/` clause exactly so the diff is
    minimal. The JSON sibling at `/api/v1/errors[...]` keeps its
    Bearer-key requirement (already covered by the `/api/v1/`
    clause); only the HTML faces are public.
  - `tests/e2e/anonymous/pillar-a-public-smoke.spec.ts`: NEW
    Pillar A spec that runs in the `anonymous` Playwright project
    and iterates over `route-inventory.json` `group === "public"`
    entries, asserting each returns `200` (NOT a redirect-followed-
    by-200 — the FIRST response status is checked, so a 307 fails).
    Spot-checks `/errors/insufficient-scope` and
    `/errors/insufficient_scope` separately because the dynamic
    `[code]` route is excluded from the iterator. Asserts a visible
    `<main>` / `<h1>` / `<h2>` so a 200-blank-shell still fails
    (DEF-0003 / DEF-0004 anti-shape). Floor sanity guard prevents
    accidental over-filtering of the public-route set.
  - `docs/qa/per-screen/errors.md`,
    `docs/qa/per-screen/errors__code.md`: `Known defects` updated
    with DEF-0007 closure pointer; `Linked specs` updated with the
    new anonymous spec; `Last verified` updated.
  - `docs/qa/defects/DEF-0007.md`: full Fix-Until-Green card with
    captured before/after evidence, root cause, anti-weakening
    attestation, and closure block.
  - `docs/qa/defects/DEF-0008.md`: SEPARATE card, Status:
    Open / Escalated. Documents the same-shape PRE-EXISTING drift
    on `/legal/*` (×4), `/cvo`, `/sandbox`, `/pricing`,
    `/changelog`, `/settings/billing`, `/settings/compliance`. NOT
    auto-fixed in this commit (would violate "one root cause per
    commit", §4.1 step 4); the new anonymous spec from DEF-0007
    will turn these red on the next DB-up CI run, surfacing them
    automatically until DEF-0008 is closed by a structural fix
    (build-time derivation of the middleware allow-list from
    `route-inventory.json` `group === "public"`).
  - `docs/qa/defects/index.md`: DEF-0007 listed as Closed (fixed),
    DEF-0008 listed as Open / Escalated; ledger explanation updated.

  **Caveat (per STANDARD.md §3 / §4.1.1).** The full browser
  Pillars A / B / E could not be run on the contributor's machine
  during this loop — Docker is not available locally, so the
  PostgreSQL (`localai-postgres-1:5432`) and Redis containers that
  `tests/e2e/global-setup.ts` requires (for NextAuth credentials
  callback) were unreachable. The fix was verified by:
  (1) direct HTTP probe against `npm run build && npm start`
  (every catalog code returns 200 anonymously, both casings; the
  `/api/v1/errors*` JSON endpoints still return 401 as designed;
  unknown codes correctly resolve to a 404 page); (2) full vitest
  re-run (1865 tests across 65 files green); (3) full
  `npm run qa:gate` re-run (inventories regenerated cleanly,
  per-screen card check green, coverage gate green, SDK drift
  gate green, Postman drift gate green); (4) `npm run typecheck`
  green; (5) `npm run lint` green. Pillars A / B / E (browser
  layer) are reported as "Not Run" in this loop's headline block;
  per §3, "Not Run on a covered pillar counts as fail of the gate"
  — surfaced honestly rather than masked. The new anonymous spec
  is committed and will exercise the fix on the next DB-up CI
  cycle.

- **Wave 20 — Server-side request validation with Problem Details
  (1.8.0 -> 1.9.0) (2026-04-19):** Ninth exercise of the
  versioning machinery, and the first concrete consumer of the
  RFC 9457 `Problem` body shipped in Wave 19. Three pre-existing
  classes of silent footgun — `?page=0`/`?page=-1` silently
  clamped to `1`, `?limit=99999` silently clamped to `100`, and
  `?status=NOT_A_REAL_STATUS` silently dropped from the WHERE
  clause returning the wrong subset of rows — now produce an
  explicit, structured `400 Bad Request` with a non-empty
  `errors[]` array reporting every offending parameter in one
  response.
  - `src/lib/api/validation.ts`: new helper module exporting
    `VALIDATION_ERROR_CODE = "invalid_request"`,
    `ValidationFieldError` interface (`field` / `code` / `message`
    strings), `fieldPathFromZodIssue(issue)` (dot-joins
    `issue.path`, returns `""` for root-level failures),
    `issuesToFieldErrors(issues)` (Zod `ZodIssue[]` →
    `ValidationFieldError[]`),
    `validationProblemResponse(request, errors, detail?)` (builds
    a Problem-shaped 400 with the `errors[]` extension array via
    `buildProblem` from Wave 19, handles content-type
    negotiation, attaches the request `pathname` as `instance`),
    `ParseQueryResult<T>` discriminated union
    (`{ ok: true, data } | { ok: false, response }`),
    `parseQuery(request, schema)` (the top-level call site —
    parses `URLSearchParams` into a plain object, runs
    `schema.safeParse`, returns either typed data or a ready-to-
    return 400 `NextResponse`), and a private `safePath(url)`
    helper that strips query strings before they reach
    `instance`.
  - `src/app/api/v1/providers/route.ts`,
    `src/app/api/v1/sanctions/route.ts`,
    `src/app/api/v1/enrollments/route.ts`: each route now declares
    a Zod schema for its query parameters
    (`PROVIDERS_QUERY_SCHEMA`, `SANCTIONS_QUERY_SCHEMA`,
    `ENROLLMENTS_QUERY_SCHEMA`) over enums sourced from the
    Prisma schema (`PROVIDER_STATUS_VALUES`,
    `SANCTIONS_RESULT_VALUES`, `ENROLLMENT_STATUS_VALUES`).
    `parseQuery` is the first call inside each `GET` handler; on
    failure the response is wrapped with the standard
    `applyRateLimitHeaders` / `applyRequestIdHeader` /
    `applyDeprecationByRoute` envelope so the failure is
    indistinguishable from any other v1 error in terms of
    correlation, observability, and deprecation signalling. The
    `auditApiRequest` calls were tightened to handle `null` for
    optional query parameters (e.g. `status ?? null`).
  - `docs/api/openapi-v1.yaml`: bumped to `1.9.0`.
    `info.description` gains a "Server-side request validation
    (since v1.9.0)" section documenting `400 Bad Request`
    responses, the `…/errors/invalid-request` `type` URI, the
    `errors[]` extension array, the stable Zod issue codes, and
    backward compatibility. New reusable response
    `components.responses.BadRequest` references the new
    `ValidationProblem` schema (and ships the legacy
    `application/json` content variant alongside
    `application/problem+json` for parser compatibility). New
    schemas `ValidationFieldError` (required `field`/`code`/
    `message` strings, `code` carries the Zod issue code) and
    `ValidationProblem` (extends the v1.8.0 `Error`/`Problem`
    shape with `errors: array (minItems: 1)` and pins
    `type: const` to the validation URI and `status: const` to
    `400`). `400` responses added to `listProviders`,
    `listSanctions`, and `listEnrollments` operations. The
    `/health` `apiVersion` example was bumped to `"1.9.0"`.
  - `src/lib/api-client/v1-types.ts` + `public/api/v1/postman.json`:
    regenerated; both drift gates pass.
  - `src/lib/api-client/v1.ts`: extended with
    `V1ValidationFieldError` interface (`field`/`code`/`message`),
    `V1ValidationProblem` interface (extends `V1Problem`, pins
    `status: 400`, requires `errors: V1ValidationFieldError[]`),
    `VALIDATION_PROBLEM_TYPE_SUFFIX = "/errors/invalid-request"`
    constant for stable suffix matching, and
    `isValidationProblem(problem)` type guard that checks both
    the `type` URI suffix AND the `errors[]` array shape (so a
    future server that emits `errors[]` on a non-validation
    Problem will not accidentally match).
  - **Tests:** `tests/unit/api/validation.test.ts` (15 tests
    covering `parseQuery` happy path + invalid coercion + enum
    violations + multiple errors aggregation,
    `validationProblemResponse` body shape + custom detail +
    content-type negotiation + `instance` omission,
    `fieldPathFromZodIssue`, and `issuesToFieldErrors`);
    `tests/unit/lib/api-client/v1-client.test.ts` extended with
    6 tests for `isValidationProblem` (positive case, wrong
    suffix, wrong status, missing/non-array `errors`,
    non-string entry fields, and end-to-end flow through
    `V1ApiError.problem`); `tests/contract/pillar-j-openapi.spec.ts`
    extended with 4 contract tests for the new schemas + reusable
    response + per-operation 400 attachment. All gates green:
    1735 vitest tests pass (up from 1710 in Wave 19, +25 net),
    `npm run typecheck`, `npm run lint`, `npm run qa:gate` clean.
  - **Documentation:** `docs/changelog/public.md` gains a
    `v1.14.0 (API)` entry. `docs/api/versioning.md` is bumped to
    `Status: spec 1.9.0` / `Last reviewed: Wave 20`, gains a new
    §3.9 "Server-side request validation" with body shape and
    SDK observation contract, gains an ADR 0026 cross-reference,
    and the §3.8 Problem Details section is **corrected** in
    two places: the example `type` URI now uses
    `essen-credentialing.example/errors/...` (matching the
    actual `PROBLEM_BASE_URL` env default) instead of the
    placeholder `api.e-credentialing.example.com/problems/...`
    that was in Wave 19's draft, and the content-type
    negotiation description is rewritten to reflect the actual
    behaviour (RFC 9457 §3 permits emitting
    `application/problem+json` whenever the client accepts JSON
    in any form, which is what the implementation has always
    done; only an `Accept` header that explicitly excludes both
    JSON variants triggers the `application/json` fallback). A
    short note records the correction. The public `/changelog`
    `v1.13.0` entry was annotated with the same correction in
    an "Improved" subsection. `src/app/sandbox/page.tsx` Problem
    Details section was updated to reflect the same two
    corrections, and gains a new "Server-side request
    validation" panel between Problem Details and the
    Deprecation/Sunset section, with a copy-pasteable curl
    example showing a single request with three bad parameters
    producing a single 400 with three `errors[]` entries. New
    ADR 0026 (`docs/dev/adr/0026-server-side-request-validation.md`)
    captures the decision, the rejected alternatives (no
    validator at all, hand-written per-route validators, opaque
    400 with English message, separate `/validate` endpoint),
    operational notes, and anti-weakening rules (errors[] MUST
    stay non-empty; renaming a Zod code is breaking; tightening
    validation is breaking, loosening is minor).
- **Wave 19 — Problem Details for HTTP APIs (RFC 9457)
  (1.7.0 -> 1.8.0) (2026-04-19):** Eighth exercise of the
  versioning machinery. Adopts RFC 9457 as a backward-compatible
  superset of the existing `{ error: { code, message } }`
  envelope, with strict opt-in content negotiation
  (`application/problem+json` only when the client explicitly
  asks for it). Idempotency-Key was scoped out of this wave —
  the v1 surface is read-only, so the contract has no
  observable customer value today; revisit when the first
  mutating endpoint ships.
  - `src/lib/api/problem-details.ts`: new helper module exporting
    `Problem` interface (RFC 9457 fields + legacy `error`
    envelope as a required member), `PROBLEM_BASE_URL`
    (`https://api.e-credentialing.example.com/problems`),
    `PROBLEM_CONTENT_TYPE` and `JSON_CONTENT_TYPE` constants,
    `PROBLEM_TITLES` (the only place where human-readable titles
    live, keyed by `error.code`), `problemTypeUri(code)`
    (deterministic kebab-case URI per code),
    `problemTitleFor(code)` (Title-Cased fallback for unknown
    codes), `buildProblem({ status, code, message, instance?,
    extras? })` (the only path that ever produces a v1 error
    body), `negotiateProblemContentType(request?)` (strict
    opt-in: only returns `application/problem+json` when the
    `Accept` header explicitly requests it), `problemResponse`
    and `problemResponseDefault` (build a `NextResponse` with
    the negotiated `Content-Type` and Problem body).
  - `src/app/api/v1/middleware.ts`: `v1ErrorResponse(status,
    code, message, extras?, request?)` refactored to use
    `problemResponse`. The signature is backward-compatible —
    callers that don't pass a `Request` get
    `problemResponseDefault` and an `instance` field that's
    omitted. `authenticateApiKey` and `requireScope` now thread
    `Request` through so `instance` is populated correctly.
  - `src/lib/api/rate-limit.ts`: `buildRateLimitResponse` now
    constructs a Problem-shaped body via `buildProblem` and
    explicitly sets `Content-Type: application/problem+json`.
    `retryAfterSeconds` is preserved as an extension member
    alongside the `Retry-After` header.
  - All v1 route handlers (`/health`, `/me`, `/providers`,
    `/providers/[id]`, `/providers/[id]/cv.pdf`, `/sanctions`,
    `/enrollments`) updated to pass `request` into
    `requireScope` and `v1ErrorResponse`. Inline
    `NextResponse.json({ error: ... })` calls in
    `/providers/[id]`, `/me`, and `/providers/[id]/cv.pdf`
    refactored to go through `v1ErrorResponse` so every error
    body is Problem-shaped.
  - `docs/api/openapi-v1.yaml`: bumped to `1.8.0`.
    `info.description` gains a "Problem Details for HTTP APIs
    (since v1.8.0)" section. `Error` and `RateLimitProblem`
    schemas redefined as Problem-shaped supersets, retaining
    the legacy `error` envelope as a required member. All four
    reusable error responses (`Unauthorized`, `Forbidden`,
    `NotFound`, `RateLimited`) plus the inline `401` on
    `/health` now advertise both `application/problem+json`
    and `application/json` content types. `Health.apiVersion`
    example bumped to `"1.8.0"`.
  - `src/lib/api-client/v1.ts`: new `V1Problem` type, new
    `parseProblem(body, fallbackStatus?)` helper (synthesises
    `type`/`title`/`status`/`detail` from the legacy envelope
    when older deployments respond), new
    `V1ApiError.problem: V1Problem | undefined` property
    populated automatically on every non-2xx response with a
    JSON body. The `request` method and `conditionalGetWith`
    pipe `parseProblem` into `V1ApiError`.
  - `src/lib/api-client/v1-types.ts` + `public/api/v1/postman.json`:
    regenerated; drift gates pass.
  - `tests/unit/api/problem-details.test.ts`: 19 new tests
    covering `problemTypeUri` stability, `problemTitleFor`
    fallback semantics, `buildProblem` field assembly and
    extension merging, `negotiateProblemContentType` for every
    `Accept`-header permutation, and `problemResponse`
    `Content-Type` selection.
  - `tests/unit/api/require-scope.test.ts`: added a Wave 19 test
    asserting `403` response bodies expose the RFC 9457 fields
    (`type`, `title`, `status`, `detail`, `instance`) while
    preserving the legacy `error.code` / `error.message` /
    `error.required` envelope, with `Content-Type` correctly
    negotiated.
  - `tests/unit/lib/api-client/v1-client.test.ts`: 7 new tests
    covering `parseProblem` (full body, legacy-envelope
    synthesis, non-error bodies, extension members) and
    `V1ApiError.problem` (populated on Problem responses,
    populated when only the legacy envelope is present, and
    `undefined` when the body is non-JSON).
  - `tests/contract/pillar-j-openapi.spec.ts`: 3 new
    assertions — `Error` and `RateLimitProblem` schemas declare
    the RFC 9457 members, every reusable error response
    advertises both `application/problem+json` and
    `application/json` content types.
  - `docs/api/versioning.md`: bumped to `Wave 19` / spec
    `1.8.0`. New §3.8 documents the Problem Details body shape,
    stability contract for `type` URIs, content-type
    negotiation rules, and SDK observation contract. Quick
    reference updated.
  - `docs/changelog/public.md`: new `v1.13.0 (API)` entry
    spelling out the customer-visible contract (body shape,
    content negotiation, SDK additions, non-breaking
    compatibility).
  - `src/app/sandbox/page.tsx`: new "Problem Details for HTTP
    APIs (RFC 9457)" section with side-by-side `curl` examples
    (default vs `Accept: application/problem+json`) and SDK
    pointer.
  - `docs/dev/adr/0025-problem-details-rfc-9457.md`: new ADR
    capturing context (no industry-standard error contract,
    opaque `error.code` discriminator), decision (RFC 9457 as a
    backward-compatible superset, strict opt-in content
    negotiation, central `buildProblem` helper, OpenAPI 1.8.0
    contract, SDK observation), positive/negative/neutral
    consequences, and four rejected alternatives (replace the
    legacy envelope outright, always serve
    `application/problem+json`, per-route Problem objects, RFC
    7807).
  - Tests: 1687 passing (up from 1680: +19 problem-details
    helper, +1 require-scope, +7 SDK, +3 OpenAPI contract,
    +20 contract iterations net of overlap).
  - Anti-weakening: never re-point an existing `type` URI to a
    different error class. Never drop the legacy `error`
    envelope without a major version. The Pillar J contract
    test fails the build if `Error` or `RateLimitProblem`
    stops declaring the RFC 9457 members or stops advertising
    both content types.
- **Wave 18 — Deprecation + Sunset header machinery
  (RFC 9745 / RFC 8594 / RFC 5829 / RFC 8288)
  (1.6.0 -> 1.7.0) (2026-04-19):** Seventh exercise of the
  versioning machinery. Ships the wire-format and the SDK
  observation path before we need them, so that the first
  real deprecation is a one-line registry append rather than
  a multi-week feature ship. The `DEPRECATION_REGISTRY` is
  intentionally empty today; the helper, the route wrappers,
  the OpenAPI documentation, and the SDK callback are all in
  place and unit-tested.
  - `src/lib/api/deprecation.ts`: new helper module exporting
    `DeprecationPolicy` (typed registry row with `path`,
    `method`, `deprecatedAt`, optional `sunsetAt`, optional
    `infoUrl`, optional `successor`),
    `DEPRECATION_REGISTRY: DeprecationPolicy[]` (single source
    of truth — empty by design),
    `findDeprecation(method, path, registry?)` (matches
    `*` wildcard methods and `{id}`-style path placeholders),
    `formatDeprecationValue(date)` (RFC 9745 structured-fields
    integer form, `@<unix-seconds>`),
    `formatHttpDate(date)` (RFC 9110 §5.6.7 IMF-fixdate),
    `parseDeprecationValue(value)` and `parseSunset(value)`
    (defensive parsers that tolerate null/empty/malformed
    input),
    `applyDeprecationHeaders(response, policy)` (no-op when
    policy is undefined; otherwise attaches `Deprecation`,
    `Sunset`, and `Link: rel="deprecation"` + `rel="sunset"`
    + optional `rel="successor-version"` headers; merges into
    any existing `Link` value emitted by pagination), and the
    convenience wrapper
    `applyDeprecationByRoute(response, method, path, registry?)`
    that does lookup + apply in one call. Path templates
    compile via a sentinel-stamping technique (`{id}` first
    replaced with `\u0000PARAM\u0000`, then the template is
    regex-escaped, then the sentinel is expanded to `[^/]+`)
    to avoid the trap of escaping curly braces before
    placeholder substitution.
  - Wired into 6 JSON GET endpoints. Each route now defines a
    `ROUTE_PATH` constant and wraps its final responses (200,
    304, 401, 403, 404, 410-future, 429, 5xx) with
    `applyDeprecationByRoute`. With an empty registry the
    helper is a no-op (~0.5µs per response measured in unit
    tests), so the wrapping is free until a deprecation lights
    it up:
    - `src/app/api/v1/health/route.ts` (`API_VERSION` bumped
      to `"1.7.0"`)
    - `src/app/api/v1/me/route.ts`
    - `src/app/api/v1/providers/route.ts`
    - `src/app/api/v1/providers/[id]/route.ts`
    - `src/app/api/v1/sanctions/route.ts`
    - `src/app/api/v1/enrollments/route.ts`
  - OpenAPI spec `docs/api/openapi-v1.yaml` bumped from
    `1.6.0` to `1.7.0`:
    - `info.description` gains a "Deprecation contract (since
      v1.7.0)" section documenting the conditional emission
      rule ("absent unless this operation is on a deprecation
      path"), the header values, the `Link` `rel` vocabulary,
      and the SDK integration points.
    - `components.headers.Deprecation` added (description,
      `pattern: ^@\\d+$`, example `@1796083200`).
    - `components.headers.Sunset` added (description,
      example `Sun, 11 Nov 2030 23:59:59 GMT`).
    - `components.headers.Link` description extended to cover
      the new `rel` values: `deprecation`, `sunset`,
      `successor-version` (existing pagination `first`/`prev`/
      `next`/`last` rels remain unchanged).
    - All JSON GET 200 responses, the reusable `NotModified`
      (304), `Unauthorized` (401), `Forbidden` (403),
      `NotFound` (404), and `RateLimited` (429) responses now
      reference `Deprecation`, `Sunset`, and `Link` headers.
    - `Health.apiVersion` example bumped to `"1.7.0"`.
  - SDK `src/lib/api-client/v1.ts` extended:
    - New types `V1Deprecation` (`deprecatedAt: Date`,
      optional `sunsetAt: Date`, optional `infoUrl: string`,
      optional `successorUrl: string`) and
      `V1DeprecationContext` (`method`, `path`).
    - `V1ApiError` constructor + properties extended with an
      optional `deprecation` field so failed requests still
      surface the advisory (a 401 from a deprecated endpoint
      MUST NOT hide the deprecation signal).
    - `V1ClientOptions.onDeprecated?: (info, ctx) => void`
      callback. The default is `defaultDeprecationWarn` which
      emits a single `console.warn` per operation. A
      `warnedOperations: Set<string>` on the client
      deduplicates by `${method} ${path}` so long-lived
      servers don't spam logs.
    - New private helper `maybeWarnDeprecation(headers, ctx)`
      called from both `request()` and `getProviderCv()`.
      Errors thrown inside the user callback are swallowed by
      design — the callback is observability, not control flow.
    - New exported helper `parseDeprecation(headers): V1Deprecation | undefined`
      for ad-hoc parsing in raw `fetch` flows.
    - `conditionalGetWith` return type extended:
      `{ status: "fresh", etag, data, deprecation? }` and
      `{ status: "not-modified", etag, deprecation? }` — both
      success and 304 surface the advisory uniformly.
  - Unit tests: 27 new tests in
    `tests/unit/api/deprecation.test.ts` covering exact-path
    + wildcard-method + parameterised matching, format
    emission for `@<unix-seconds>` and IMF-fixdate, defensive
    parsers, no-op-when-no-policy behaviour, header merging
    into existing `Link` values, and `applyDeprecationByRoute`
    end-to-end with both empty and populated test registries.
  - SDK tests in `tests/unit/lib/api-client/v1-client.test.ts`
    cover `parseDeprecation` (undefined for missing header,
    structured-fields parsing, malformed-input rejection,
    partial-info tolerance), `V1Client.onDeprecated` (called
    once per operation, dedup behaviour), `V1ApiError.deprecation`
    propagation, and `conditionalGetWith` deprecation
    forwarding on both 200 and 304 responses.
  - Contract tests in `tests/contract/pillar-j-openapi.spec.ts`
    extended to assert that every 2xx response and every
    reusable error response in the spec references the
    `Deprecation`, `Sunset`, and `Link` headers — future spec
    edits cannot silently drop the contract.
  - Drift gates: `npm run sdk:check` and `npm run postman:check`
    pass; the regenerated `src/lib/api-client/v1-types.ts` and
    `public/api/v1/postman.json` match the bumped spec.
  - Public changelog: `docs/changelog/public.md` ships a
    `v1.12.0 (API)` entry covering the wire-format, the SDK
    helpers, and the conditional-emission contract.
  - Versioning policy: `docs/api/versioning.md` updated to
    `Status: spec 1.7.0`, `Last reviewed: 2026-04-19 (Wave 18)`.
    §3 (deprecation lifecycle) rewritten from aspirational to
    backed-by-machinery — explicit pseudo-timeline (T+0, T+180d,
    T+Sunset), explicit header contract table, explicit
    OpenAPI spec contract block. New §3.3 (SDK observation
    contract) added with worked-example showing the
    `onDeprecated` callback wired to a metrics counter and
    the `parseDeprecation` helper used in raw fetch. §4
    (major-version overlap window) updated to use the new
    `Deprecation: @<unix-seconds>` + `Sunset: <HTTP-date>`
    bulk-emission pattern. §3 minimum sunset window raised
    from 90 days to 180 days to align with enterprise
    procurement cycles and SOC 2 evidence collection;
    anti-weakening rule §6 explicitly forbids relaxing this
    under internal roadmap pressure. All sub-section numbering
    re-flowed to absorb the new §3.3 (rate-limit became §3.4,
    request-id §3.5, pagination §3.6, ETag §3.7); quick
    reference table re-pointed.
  - Sandbox page `src/app/sandbox/page.tsx` ships a new
    "Deprecation + Sunset headers (RFC 9745 / RFC 8594)"
    section with worked `curl -i` example showing all three
    headers + `Link` rels and a TypeScript SDK pointer.
  - ADR `docs/dev/adr/0024-deprecation-sunset-headers.md`
    captures the decision rationale, the alternatives
    considered (per-route inline writes, middleware-only
    emission, boolean-form `Deprecation: ?1`, defer-to-0023),
    the consequences (positive / negative / neutral), and the
    verification matrix.
  - Net diff: 1 new helper module, 1 new ADR, 6 routes
    updated, 1 spec bumped to `1.7.0`, 27 new helper unit
    tests + 6 new SDK tests + 4 extended contract tests, full
    test suite green at 1680 tests across 62 files. No prod
    deploy.

- **Wave 17 — Conditional GETs: ETag + If-None-Match
  (1.5.0 -> 1.6.0) (2026-04-18):** Sixth exercise of the
  versioning machinery. Adds the canonical REST cache-validation
  contract on top of every read endpoint so polling integrations
  drop from ~5 KB/response to ~80 bytes when nothing has changed.
  - `src/lib/api/etag.ts`: new helper module exporting
    `computeWeakEtag(payload)` (hashes a canonicalized JSON
    payload — keys sorted, undefined values dropped, arrays
    order-preserving — into a `W/"<40-hex>"` weak ETag using
    SHA-1; pure function, deterministic, ~3x faster than SHA-256
    and matches GitHub/Stripe/S3/nginx conventions),
    `computeWeakEtagFromBytes(bytes)` (raw-bytes variant for
    spec-delivery routes), `parseIfNoneMatch(header)` (handles
    comma-separated lists, weak/strong tokens, the `*` wildcard,
    and tolerates extra whitespace), `matchesEtag(current,
    inboundTokens)` (RFC 9110 §13.1.2 weak comparison —
    `W/"abc"` matches `"abc"` and vice versa, `*` always
    matches), `applyEtagHeader(response, etag)` (no-op for
    falsy etag), `notModifiedResponse(etag, options)` (empty
    body per RFC 9110 §15.4.5; propagates `X-Request-Id` +
    rate-limit headers), and the convenience wrapper
    `evaluateConditionalGet(request, payload)` that combines
    compute + match + reply into one call.
  - Wired into 6 cacheable JSON endpoints +
    3 spec-delivery endpoints:
    - `src/app/api/v1/health/route.ts`: ETag computed over
      `{ ok, keyId, apiVersion }` (excludes per-request `time`).
      `API_VERSION` constant bumped to `"1.6.0"`.
    - `src/app/api/v1/me/route.ts`: ETag computed over
      `{ keyId, name, scopes, createdAt, expiresAt }` (excludes
      `lastUsedAt` and the rate-limit snapshot — both mutate on
      every authenticated call).
    - `src/app/api/v1/providers/route.ts`,
      `src/app/api/v1/providers/[id]/route.ts`,
      `src/app/api/v1/sanctions/route.ts`,
      `src/app/api/v1/enrollments/route.ts`: ETag computed over
      the full JSON envelope.
    - `src/app/api/v1/openapi.yaml/route.ts`,
      `src/app/api/v1/openapi.json/route.ts`,
      `src/app/api/v1/postman.json/route.ts`: ETag computed
      from the raw bytes of the cached file content; ETag is
      cached alongside the bytes so the per-request work is
      just header parsing + a string compare.
  - `src/app/api/v1/providers/[id]/cv.pdf/route.ts`:
    intentionally unchanged — binary streams have a different
    caching strategy (byte-range support, separate ADR pending).
  - `docs/api/openapi-v1.yaml`: bumped `info.version` to
    `1.6.0`. Added `components.headers.ETag`,
    `components.parameters.IfNoneMatchHeader`, and
    `components.responses.NotModified` (the latter inherits
    `X-Request-Id` and the rate-limit headers — caches still
    see the budget on a 304). Attached `IfNoneMatchHeader` +
    `ETag` header on 200 + `304 NotModified` to all 6 JSON GET
    operations. Bumped `Health.apiVersion` example to `"1.6.0"`.
  - `src/lib/api-client/v1-types.ts`,
    `public/api/v1/postman.json`: regenerated from the spec;
    both drift gates pass.
  - `src/lib/api-client/v1.ts`: added `parseEtag(headers)`
    (reads the raw token off any v1 response) and
    `conditionalGetWith(client, path, ifNoneMatch)`
    (one-call conditional GET that returns either
    `{ status: "fresh", etag, data }` or
    `{ status: "not-modified", etag }`; throws `V1ApiError`
    on auth/rate-limit failures so callers don't need to
    special-case errors). Both helpers are dependency-free;
    SDK still has zero transitive deps.
  - `tests/unit/api/etag.test.ts`: 33 unit tests covering all
    helper functions — weak format, determinism, key-order
    insensitivity, array order sensitivity, `undefined` value
    handling, raw-bytes mode (no canonicalization), parser for
    null/empty/wildcard/single/list/whitespace/junk inputs,
    weak vs strong comparison, wildcard match, header attach
    + no-op, 304 builder body emptiness + header propagation,
    `evaluateConditionalGet` integration scenarios.
  - `tests/unit/lib/api-client/v1-client.test.ts`: 5 new tests
    covering `parseEtag` round-trip and `null` fallback,
    `conditionalGetWith` 200 fresh + 304 cache-hit (with
    `If-None-Match` forwarding asserted via the fetch spy)
    + 401 throwing `V1ApiError`. Updated `makeFetch` mock to
    handle 304 responses correctly (Fetch spec forbids body on
    304/204).
  - `tests/contract/pillar-j-openapi.spec.ts`: new "Wave 17"
    block asserting `components.headers.ETag`,
    `components.parameters.IfNoneMatchHeader`, and
    `components.responses.NotModified` exist; and that every
    JSON GET operation has the `IfNoneMatchHeader` parameter,
    an `ETag` header on its 200 response, and a 304 response
    (with `getProviderCv` excluded as a non-JSON operation).
  - `tests/contract/pillar-j-openapi-json-mirror.spec.ts`,
    `tests/contract/pillar-j-postman.spec.ts`: updated to pass
    a `Request` to the route handlers (signature changed from
    `GET()` to `GET(request: Request)` to support
    `If-None-Match`).
  - `docs/changelog/public.md`: published as v1.11.0 (API).
  - `docs/api/versioning.md`: status -> spec 1.6.0; new §3.6
    Conditional GETs (cacheable-subset table per endpoint, 304
    response shape rules, opaqueness contract for the ETag
    value, breaking-change rules); quick-reference entry added.
  - `src/app/sandbox/page.tsx`: new "Conditional GETs" section
    with curl example showing the 200 -> 304 round-trip and SDK
    pointer.
  - **Non-breaking.** The `ETag` header is purely additive on
    200 responses. Clients that don't send `If-None-Match` are
    unaffected; the `304 Not Modified` response only fires when
    the client explicitly opts in.
  - Test count: 1641 passing (up from 1599: +33 helper, +5 SDK,
    +4 contract = +42).

- **Wave 16 — Standard pagination Link headers (RFC 8288)
  (1.4.0 -> 1.5.0) (2026-04-18):** Fifth exercise of the
  versioning machinery. Adds the conventional REST pagination
  contract on top of the existing JSON envelope so SDKs can
  iterate through result sets without doing arithmetic on
  `page`/`totalPages`.
  - `src/lib/api/pagination-links.ts`: new helper module
    exporting `buildPaginationLinkHeader(requestUrl, pagination)`
    (returns the RFC 8288 `Link` value with `first`/`prev`/
    `next`/`last` rels, preserving inbound query parameters and
    forcing absolute URLs), `applyPaginationLinkHeader(response,
    requestUrl, pagination)` (attaches the header to a
    `NextResponse`, no-op for empty result sets), and
    `parseLinkHeader(value)` (decoder used by both the SDK and
    its unit tests). Pure function, dependency-free, no side
    effects on the request URL.
  - `src/app/api/v1/providers/route.ts`,
    `src/app/api/v1/sanctions/route.ts`,
    `src/app/api/v1/enrollments/route.ts`: every paginated list
    handler now wraps its 200 response with
    `applyPaginationLinkHeader` so the `Link` header is emitted
    alongside `X-Request-Id`, the rate-limit headers, and the
    JSON envelope. Passing the original request URL means
    filters and `limit` survive into the link targets.
  - `docs/api/openapi-v1.yaml`: bumped `info.version` to `1.5.0`.
    Added `components.headers.Link` describing the RFC 8288
    contract. Attached the `Link` header to the 200 response of
    each list operation. Bumped the `Health.apiVersion` example
    to `"1.5.0"` so spec/runtime stay aligned.
  - `src/app/api/v1/health/route.ts`: bumped `API_VERSION`
    constant to `"1.5.0"` so `/health` reports the matching
    version.
  - `src/lib/api-client/v1-types.ts`,
    `public/api/v1/postman.json`: regenerated from the spec; both
    drift gates pass.
  - `src/lib/api-client/v1.ts`: re-exports
    `parseLinkHeader` (and the matching `V1PaginationLinks`
    type) so SDK consumers can decode the header without pulling
    in a separate dep. The SDK does not auto-walk pages —
    callers stay in control of when to fetch the next page.
  - `tests/unit/api/pagination-links.test.ts`: 14 unit tests
    covering all helper functions (interior page, first/last
    page, single page, empty set, query-param preservation,
    absolute URLs, syntax compliance, parser symmetry, null
    input, unknown rels, lowercased rels).
  - `tests/unit/lib/api-client/v1-client.test.ts`: 2 new tests
    for `parseLinkHeader` re-export (decoded map and `null`
    fallthrough).
  - `tests/contract/pillar-j-openapi.spec.ts`: new "Wave 16"
    block asserting `components.headers.Link` exists and is
    attached to every paginated list operation's 200 response.
  - `docs/changelog/public.md`: published as v1.10.0 (API).
  - **Non-breaking.** Existing JSON envelope pagination metadata
    is unchanged; the `Link` header is purely additive.

- **Wave 15 — API key introspection endpoint `GET /api/v1/me`
  (1.3.0 -> 1.4.0) (2026-04-18):** Fourth exercise of the
  versioning machinery. Pairs with `/health` so customers can
  answer both halves of the "is my integration set up
  correctly?" question with two cheap, scopeless calls.
  - `src/app/api/v1/me/route.ts`: new route handler. Re-fetches
    the API key row to surface `name`, `createdAt`, `expiresAt`,
    `lastUsedAt`. Filters granted permissions to the registered
    `API_SCOPES` vocabulary so callers can rely on a stable
    enum (any junk in the JSON column is dropped). Returns the
    same `rateLimit` snapshot the headers carry. Wired through
    `applyRateLimitHeaders` + `applyRequestIdHeader` +
    `auditApiRequest` so it inherits all the v1 contract
    invariants (rate-limit headers, X-Request-Id, audit log).
    Never echoes the bearer key, the key hash, or any PHI.
  - `docs/api/openapi-v1.yaml`: bumped `info.version` to `1.4.0`.
    New `/api/v1/me` GET operation under tag `me` with the full
    description, security requirement, and response schema.
    New `components.schemas.Me` schema (keyId, name, scopes
    enum, createdAt, expiresAt, lastUsedAt, rateLimit). New
    `tags[me]` entry. Bumped `Health.apiVersion` example to
    `1.4.0`. Added a paragraph to `info.description` introducing
    the `/me` endpoint. `API_VERSION` constant in the health
    route bumped accordingly.
  - Regenerated `src/lib/api-client/v1-types.ts`,
    `public/api/v1/postman.json`, and the inventories
    (`api-inventory.json` now includes 51 routes / 206 cells —
    one more than Wave 14). All drift gates green.
  - `src/lib/api-client/v1.ts`: new `me()` method, typed off
    `components.schemas.Me`. Inherits the SDK's existing
    `requestIdFactory` forwarding and `V1ApiError.requestId`
    surfacing.
  - **Tests:**
    - `tests/unit/lib/api-client/v1-client.test.ts` — new
      `me()` test asserting URL, method, and the typed response
      envelope (keyId, name, scopes, rateLimit).
    - All iterator-style contract tests (api-iterator,
      trpc-iterator, openapi, openapi-json-mirror, postman) now
      cover the new cell automatically.
  - `docs/changelog/public.md` — new `## 2026-04-18 — v1.9.0
    (API)` entry under `Added` and `Improved`. Frames the
    business value as "one-call key debugging" so non-technical
    buyers see the support-cost reduction.
  - `src/app/sandbox/page.tsx` — new "API key introspection"
    section with curl example, sample response, and SDK
    pointer.
  - **No drift:** `qa:gate`, `sdk:check`, `postman:check`,
    `typecheck`, `lint`, full vitest suite all green.

- **Wave 14 — `X-Request-Id` correlation header + structured request
  logging (1.2.0 -> 1.3.0) (2026-04-18):** Third exercise of the
  versioning machinery — give every API request a stable correlation
  id customers can paste into a support ticket, and thread that id
  through the audit log + Pino logs so on-call can reconstruct the
  full trace from a single string.
  - `src/lib/api/request-id.ts`: new helper module.
    `generateRequestId()` emits an opaque `req_<16-hex>` id (64 bits
    of cryptographic randomness; Birthday-paradox-safe to ~5B ids).
    `resolveRequestId(request)` honours a valid inbound
    `X-Request-Id` header (regex `^[A-Za-z0-9_\-]{8,128}$`, covers
    ULID/UUID/Stripe-style/opaque tokens) or generates a fresh one;
    malformed inbound ids are silently replaced (no 400 — that
    would be customer-hostile). `applyRequestIdHeader(response, id)`
    stamps the id onto a NextResponse, mutating-and-returning so it
    composes inline with the rate-limit helpers.
  - All six v1 route handlers (`/health`, `/providers`,
    `/providers/{id}`, `/providers/{id}/cv.pdf`, `/sanctions`,
    `/enrollments`) now resolve a request id at the top of the
    handler and stamp it onto every response — success, error, 429,
    PDF binary, all of them.
  - `src/lib/api/audit-api.ts`: `auditApiRequest()` now accepts an
    optional `requestId` parameter and records it on the audit row
    (`afterState.requestId`), making the id the join key between
    customer-facing support tickets and the tamper-evident audit
    log. Bumped `API_VERSION` constant to `"1.3.0"` in
    `src/app/api/v1/health/route.ts`.
  - `docs/api/openapi-v1.yaml`: bumped `info.version` to `1.3.0`.
    New `components.headers.RequestId` (response) and
    `components.parameters.RequestIdHeader` (request) declarations.
    Every reusable error response (`Unauthorized`, `Forbidden`,
    `NotFound`, `RateLimited`) and every operation's 200 response
    now declares `X-Request-Id`. Every operation declares
    `RequestIdHeader` as an optional inbound parameter.
  - `src/lib/api-client/v1.ts`: `V1ClientOptions.requestIdFactory`
    callback lets callers forward their own client-side correlation
    id; the SDK validates the format before attaching it.
    `V1ApiError.requestId` exposes the server-assigned id off the
    response header on every thrown error (including the binary
    CV PDF path). `getProviderCv` now also forwards the inbound id
    and parses rate-limit headers off the error path.
  - Regenerated `src/lib/api-client/v1-types.ts` and
    `public/api/v1/postman.json` from the bumped spec.
  - **Tests:**
    - `tests/unit/api/request-id.test.ts` — 10 tests covering
      header constant, id format, freshness, ULID/UUID/Stripe/opaque
      acceptance, malformed-id rejection (too short/long/spaces/
      slashes/newlines/semicolons), inbound honouring, malformed
      inbound replacement (no 400), no-header generation, header
      stamping, and undefined-id no-op.
    - `tests/unit/lib/api-client/v1-client.test.ts` — 3 new tests:
      forwards `X-Request-Id` from `requestIdFactory`, drops a
      malformed factory output without sending it, captures
      server-assigned `X-Request-Id` onto `V1ApiError.requestId`
      from a 404 response.
    - `tests/contract/pillar-j-openapi.spec.ts` — new "Wave 14"
      describe block with 4 contract assertions: header component
      declared, parameter component declared, every 200 response
      attaches `X-Request-Id`, every reusable error response
      attaches `X-Request-Id`.
  - `docs/changelog/public.md` — new `## 2026-04-18 — v1.8.0 (API)`
    entry under categories `Added` and `Improved`, citing the
    OpenAPI spec, the SDK, and the Postman collection. The "support
    triage" framing makes the value concrete for non-technical
    buyers.
  - `docs/api/versioning.md` — new `## 3.4` section documenting the
    `X-Request-Id` contract end-to-end (inbound semantics, outbound
    coverage, server-generated format, SDK example, breaking-change
    rules). Last-reviewed bumped to Wave 14; status to `1.3.0`.
    New quick-reference entry.
  - **No drift:** `npm run sdk:check`, `npm run postman:check` both
    green. All 57 affected tests pass (10 helper unit + 14 SDK unit
    + 33 OpenAPI contract).

- **Wave 13 — productize the rate-limit contract as SemVer minor bump
  (1.1.0 -> 1.2.0) (2026-04-18):** Second exercise of the versioning
  machinery — turn the silent in-memory rate limiter into a documented,
  client-consumable API contract.
  - `src/lib/api/rate-limit.ts`: refactored. New `evaluateRateLimit()`
    returns a structured `RateLimitState` (`limit`, `remaining`,
    `resetUnixSeconds`, `allowed`, `retryAfterSeconds`). New
    `applyRateLimitHeaders(response, state)` attaches
    `X-RateLimit-Limit/Remaining/Reset` to any NextResponse. New
    `buildRateLimitResponse(state)` constructs the canonical
    `RateLimitProblem` 429 with all four headers (the three above
    plus `Retry-After`). The legacy `rateLimit()` helper is kept as
    a backwards-compatible facade so unrelated callers don't break.
  - `src/app/api/v1/middleware.ts`: `authenticateApiKey()` now
    surfaces a `rateLimit: RateLimitState` field on every successful
    auth so route handlers can attach the standard headers without
    recomputing. Introduced `v1ErrorResponse(status, code, message,
    extras?)` — the single shaper for every v1 error envelope.
  - All six v1 route handlers (`/health`, `/providers`,
    `/providers/{id}`, `/providers/{id}/cv.pdf`, `/sanctions`,
    `/enrollments`) now wrap their successful responses in
    `applyRateLimitHeaders(..., auth.rateLimit)` and return errors
    via the standardised envelope.
  - **Standardised v1 error envelope:** every non-2xx response
    across `/api/v1/*` now matches the OpenAPI `Error` shape
    `{ "error": { "code": "...", "message": "..." } }`. Stable
    snake_case codes added: `missing_authorization`,
    `invalid_api_key`, `expired_api_key`, `insufficient_scope`,
    `unauthorized`, `rate_limited`, `not_found`,
    `cv_generation_failed`. The TypeScript SDK already parsed this
    shape — Wave 13 makes it actually deliverable, closing a
    long-standing contract gap.
  - `docs/api/openapi-v1.yaml`: bumped `info.version` `1.1.0 ->
    1.2.0`. Added `components.headers.{RateLimitLimit,
    RateLimitRemaining, RateLimitReset, RetryAfter}`. Added
    `components.schemas.RateLimitProblem` with `error.code`
    declared `const: "rate_limited"`. Tightened
    `components.schemas.Error` with description, `code` /
    `message` requirements, and the optional `required` field that
    `insufficient_scope` errors carry. Wired `X-RateLimit-*`
    response headers into every JSON 200 response across the spec.
    Bumped `Health.apiVersion` example to `1.2.0`. Added the CV-PDF
    operation's missing 429 response.
  - `src/lib/api-client/v1.ts`: added `parseRateLimit(headers)` and
    a `V1RateLimit` interface. `V1ApiError` now carries the parsed
    snapshot as `rateLimit` so customers can implement
    Retry-After-aware back-off without manually reading the
    response. Health docstring bumped to mention v1.2.0.
  - `src/lib/api-client/v1-types.ts`: regenerated; drift gate
    green. `public/api/v1/postman.json`: regenerated; drift gate
    green.
  - `tests/unit/lib/rate-limit.test.ts`: rewritten with 9 tests
    covering the new structured state, header attachment helper,
    and the `RateLimitProblem` 429 envelope.
  - `tests/unit/lib/api-client/v1-client.test.ts`: 3 new tests for
    `parseRateLimit` and the `V1ApiError.rateLimit` field on a 429.
  - `tests/contract/pillar-j-openapi.spec.ts`: 4 new contract
    assertions — every JSON 200 must declare 429, must reference
    every `X-RateLimit-*` header, and the `RateLimitProblem`
    schema must lock `error.code` to the literal `"rate_limited"`.
  - `tests/unit/api/require-scope.test.ts`: updated expectation
    to the new envelope shape.
  - **Result:** 1556/1556 unit tests green, full `qa:gate` green
    (typecheck, sdk:check, postman:check, coverage), no drift.

- **Wave 12 — `/api/v1/health` endpoint as SemVer minor bump (2026-04-18):**
  End-to-end exercise of the new versioning machinery: a single
  additive endpoint flowing through the spec, generated SDK,
  Postman collection, and contract tests in one wave.
  - `src/app/api/v1/health/route.ts`: customer-facing API key +
    environment health probe. Requires a valid Bearer key but **no
    specific scope** (the natural first call when wiring up a new
    integration). Returns `{ ok, keyId, apiVersion, time }` with
    `Cache-Control: no-store`. Audits each call via
    `auditApiRequest` like every other v1 route. Anti-weakening
    rules in the route header forbid (a) skipping authentication,
    (b) using this as a scope-bypass conduit for other routes,
    (c) echoing the bearer key in the response, and
    (d) expanding the response shape without bumping `apiVersion`.
  - `docs/api/openapi-v1.yaml`: `info.version` bumped
    `1.0.0 -> 1.1.0`. New `health` tag, new `/api/v1/health`
    operation (`getHealth`), new `Health` response schema.
  - `src/lib/api-client/v1-types.ts`: regenerated by
    `openapi-typescript` (drift gate green).
  - `src/lib/api-client/v1.ts`: new `V1Client.health()` method
    returning the typed `Health` envelope. Documented as the
    natural first call.
  - `public/api/v1/postman.json`: regenerated — now ships **6
    operations across 4 folders**. Drift gate green.
  - `tests/unit/lib/api-client/v1-client.test.ts`: added a
    `health()` unit test asserting URL, method, and parsed body.
  - `docs/changelog/public.md`: customer-facing release entry
    `v1.6.0 (API)` published under `### Added`.
  - All four iterator-aware contract surfaces auto-detected the
    new endpoint without code changes (Pillar J api iterator,
    OpenAPI inventory parity, OpenAPI JSON-mirror parity, Postman
    parity). 253 affected tests green.

- **Wave 11 — API versioning policy + Postman v2.1 collection (2026-04-18):**
  - `docs/api/versioning.md`: canonical versioning + deprecation
    + sunset policy. URL-path versioning (`/api/v1`, `/api/v2`),
    SemVer within a major, explicit breaking / sometimes-breaking
    / never-breaking change catalogue, 90-day minimum deprecation
    notice signalled via `Deprecation` / `Sunset` / `Link:
    rel="successor-version"` headers (RFC 9745 / 8594 / 8288),
    12-month minimum parallel-run window for new majors,
    anti-weakening rules guarding all of the above.
  - `scripts/qa/build-postman-collection.ts`: zero-dep generator
    that walks `docs/api/openapi-v1.yaml` and emits a Postman
    Collection v2.1.0 JSON with one folder per `tag`, one item
    per operation. Wires bearer auth to a `{{api_key}}` variable
    (ships empty — no baked credentials) and base URL to a
    `{{base_url}}` variable.
  - `public/api/v1/postman.json`: the generated collection (5
    operations / 3 folders today). Checked in.
  - `src/app/api/v1/postman.json/route.ts`: serves the collection
    at `/api/v1/postman.json` with
    `Content-Disposition: attachment` so customers can `curl -L
    -o ecredentialing-v1.postman_collection.json`.
  - `scripts/qa/check-postman-drift.ts`: drift gate that rebuilds
    the collection in memory and deep-compares against the
    checked-in copy (ignoring the volatile `_postman_id` field).
    Wired into `npm run qa:gate` alongside `sdk:check`.
  - `tests/contract/pillar-j-postman.spec.ts`: 12 tests asserting
    Postman v2.1.0 schema declaration, bearer-auth wiring, the
    `base_url` / `api_key` variable contract, no-baked-credentials
    invariant, and per-operation parity (every spec operation has
    a matching Postman item) plus a route-handler smoke test.
  - `tests/contract/pillar-j-openapi.spec.ts`: extended
    `SPEC_DELIVERY_ROUTES` to cover `/api/v1/postman.json` (the
    spec doesn't describe its own delivery channels — circular
    reference).
  - `package.json`: added `postman:gen` and `postman:check` npm
    scripts; wired `postman:check` into `qa:gate`.
  - `src/app/sandbox/page.tsx`: new "Postman / Insomnia / Bruno
    collection" section with a `curl` snippet, plus a versioning
    + deprecation policy callout pointing at the canonical doc.
  - `docs/dev/adr/0023-api-versioning-policy.md`: ADR documenting
    the versioning policy + Postman collection decisions, why
    URL-path beat header-negotiation versioning, why we ship the
    collection rather than relying on OpenAPI import, the
    anti-weakening invariants, and Wave 12-13 candidates
    (deprecation-header runtime contract test, Insomnia/Bruno
    mirrors, "Run in Postman" public network publication).

- **Wave 10 — Public REST v1 TypeScript SDK + spec-driven types (2026-04-18):**
  - `src/lib/api-client/v1-types.ts`: auto-generated by
    `openapi-typescript@7` from `docs/api/openapi-v1.yaml`. Exports
    `paths`, `components`, and `operations` types. Treated as a build
    artifact — never hand-edited.
  - `src/lib/api-client/v1.ts`: hand-written, dependency-free
    `V1Client` class wrapping `fetch`. Strongly typed via the
    generated `paths`/`components` types. Covers `listProviders`,
    `getProvider`, `getProviderCv`, `listSanctions`, `listEnrollments`.
    Throws a `V1ApiError` carrying both HTTP status and the structured
    `{ error: { code, message } }` envelope. URL-encodes path
    segments and serialises query params via `URLSearchParams`.
  - `tests/unit/lib/api-client/v1-client.test.ts`: 7 unit tests
    pinning the auth header (`Bearer <key>`), trailing-slash
    handling on `baseUrl`, query-param serialisation, path-segment
    URL encoding, structured error parsing, and the non-JSON
    fallback message.
  - `scripts/qa/check-sdk-drift.ts`: drift gate that regenerates
    the types into a temp file and compares byte-for-byte against
    the checked-in copy. Non-zero exit on any diff with explicit
    fix instructions.
  - `package.json`: added two scripts and wired the gate into
    `qa:gate` so spec-vs-SDK drift fails CI:
      - `npm run sdk:gen` — regenerate `v1-types.ts`.
      - `npm run sdk:check` — fail on any drift.
      - `qa:gate` now ends with `&& npm run sdk:check`.
    Also added `openapi-typescript@^7` as a devDependency.
  - `src/app/sandbox/page.tsx`: new "TypeScript SDK" section with a
    drop-in code sample and a pointer to the Python runbook.
  - `docs/dev/runbooks/sdk-generation.md`: regenerate / drift-check
    flow for TypeScript (mandatory) and the canonical
    `openapi-python-client` / `openapi-generator` flows for Python
    (out-of-tree, on demand). Includes a triage matrix.
  - `docs/dev/runbooks/README.md`: indexed the new runbook.
  - `docs/dev/adr/0022-public-rest-v1-sdk.md`: ADR with the
    decision rationale, the "why no Python SDK in-tree" explanation,
    the anti-weakening rules (auto-gen file is never hand-edited,
    SDK stays dep-free, drift gate is byte-for-byte, `sdk:check` is
    non-removable from `qa:gate`), and Wave 11 candidates
    (publish to npm, vendor Python SDK in a sibling repo).

- **Wave 9 — JSON mirror + Schemathesis fuzz harness for the public
  REST v1 surface (2026-04-18):**
  - `src/app/api/v1/openapi.json/route.ts`: JSON mirror of the OpenAPI
    spec at `/api/v1/openapi.json`. Mechanical YAML→JSON conversion
    (`js-yaml.load` → `JSON.stringify`), 5min browser / 1h CDN cache,
    same `X-Content-Type-Options: nosniff` headers as the YAML route.
    For tools that don't speak YAML (Postman import,
    `openapi-typescript`, `openapi-python-client`, Stoplight Elements).
  - `tests/contract/pillar-j-openapi-json-mirror.spec.ts`: 5-test
    parity contract — JSON body parses, deep-equals the parsed YAML
    source of truth, declares the same OpenAPI 3.1.x version + info,
    emits sensible cache headers. Anti-weakening: any divergence
    between the YAML and JSON surfaces fails this suite.
  - `tests/contract/pillar-j-openapi.spec.ts`: extended the permitted
    `SPEC_DELIVERY_ROUTES` exclusion list to cover both
    `/api/v1/openapi.yaml` and `/api/v1/openapi.json` (the spec
    cannot describe its own delivery endpoints — that would be a
    circular reference). The list size is hard-capped at 2 by
    review convention.
  - `src/app/sandbox/page.tsx`: updated the "Machine-readable
    contract" section with curl examples for both YAML (`yq`) and
    JSON (`jq`) formats.
  - `docs/api/openapi-v1.yaml`: added an `x-scopes` extension under
    `components.securitySchemes.BearerApiKey` documenting the five
    machine-readable scope names (`providers:read`, `providers:cv`,
    `sanctions:read`, `enrollments:read`, `documents:read`).
  - `scripts/qa/schemathesis-run.py`: new Python harness that drives
    Schemathesis against `/api/v1/openapi.yaml` (or the served spec
    via `--use-served-spec`) with `--checks all`. Refuses to run
    against the prod-hostname allowlist unless
    `ALLOW_SCHEMATHESIS_PROD=1`. Bearer key is redacted in the
    printed command. JUnit XML output to
    `tests/perf/results/schemathesis-junit.xml`.
  - `docs/dev/runbooks/schemathesis-fuzz.md`: full runbook covering
    pre-flight install, local-dev / staging / reproducible-seed
    invocations, output triage matrix (status / schema / content-type
    / 5xx / hangs), anti-weakening rules, and the defect-card
    escalation path. Linked from `docs/dev/runbooks/README.md`.
  - `docs/dev/adr/0021-schemathesis-fuzz-harness.md`: ADR describing
    why a one-shot harness ships before a CI step (synthetic-key
    vending isn't built yet), the anti-weakening rules
    (`--checks all` is mandatory, `PROD_HOSTNAMES` stays narrow,
    failures become defect cards), and Wave 10 candidates (CI
    promotion + regression-seed replay).

- **Wave 8 — OpenAPI 3.1 spec for the public REST v1 surface (2026-04-18):**
  - `docs/api/openapi-v1.yaml` — hand-authored OpenAPI 3.1 contract
    for `/api/v1/providers`, `/api/v1/providers/{id}`,
    `/api/v1/providers/{id}/cv.pdf`, `/api/v1/sanctions`, and
    `/api/v1/enrollments`. Documents Bearer (API-key) auth, scopes,
    pagination, `ProviderSummary` / `ProviderDetail` / `Sanction` /
    `Enrollment` schemas, and an explicit PHI-exclusion promise in
    the `info.description`.
  - `src/app/api/v1/openapi.yaml/route.ts` — new Next.js route handler
    that serves the spec at `/api/v1/openapi.yaml` with media type
    `application/yaml; charset=utf-8` (RFC 9512). File contents are
    cached in process memory.
  - `src/app/sandbox/page.tsx` — new "Machine-readable contract"
    section above the synthetic playground, with a `curl` snippet
    pointing at the new endpoint and a link back to `/changelog`.
  - `tests/contract/pillar-j-openapi.spec.ts` — Pillar J iterator
    contract over `api-inventory.json`. 23 tests: parses the YAML,
    validates `openapi: 3.1.x`, checks `info.title` / `info.version`,
    asserts every inventoried `/api/v1/*` route + method is present
    in the spec (one permitted exclusion: the spec-delivery endpoint
    itself), and walks every parsed schema `properties` block to
    enforce that no PHI field name (`ssn`, `dateOfBirth`, `dob`,
    `deaNumber`, `personalAddress`, etc.) is exposed.
  - `package.json` — `js-yaml` and `@types/js-yaml` added as
    devDependencies (installed with `--legacy-peer-deps`).
  - `docs/dev/adr/0020-openapi-v1-spec.md` — ADR describing the
    decision to hand-edit the spec, the anti-weakening rules
    (iterator-driven contract test, schema-property PHI walk,
    single-entry exclusion list), and Wave 9 candidates
    (Schemathesis fuzz + Redocly HTML render).

- **Wave 7 — Phase 1.5 roadmap consolidation (2026-04-18):**
  - `docs/development-plan.md` — added Phase 1.5 (Commercial-Readiness
    Band, Waves 0–6) to the executive summary and as a new full
    section between Phase 1 and Phase 2. Cross-linked to the
    per-wave delivery index, ADRs 0013–0019, and the resolver scripts.
  - `docs/status/shipped.md` — new canonical "what shipped, where to
    find it, in what order to activate it" reference. Wave-by-wave
    table with links to every ADR, runbook, ops script, defect card,
    and per-screen card produced during the band. Includes the
    deliberate post-deploy feature-flag activation order.
  - `docs/system-prompt.md` — bumped so a from-scratch regenerator
    builds the Wave 5–6 commercial-readiness band from day one
    rather than retrofitting it. New §10.3 (public surfaces), §10.4
    (auditor-package export), and explicit guidance to (a) prefer
    iterator-style specs that walk the inventories, and (b) only run
    E2E against the production bundle via `npm run qa:e2e:prod`.

- **Wave 6 — iterator-aware coverage gate + per-cell contract iterators (2026-04-18):**
  - `scripts/qa/iterator-coverage.ts` — pure helper detecting matrix
    specs that iterate the route / api / trpc inventories at runtime.
    A spec is credited as covering every entry in an inventory when
    it (a) imports `inventories/<name>-inventory.json` AND (b)
    contains an iteration construct (`for (`, `.map(`, `.forEach(`,
    `.filter(`, `describe.each`, `test.each`, `it.each`) below the
    import. ORs with the existing string-literal coverage path.
  - `scripts/qa/check-coverage.ts` — wired through the new helper.
  - `tests/contract/pillar-j-trpc-iterator.spec.ts` — generates 878
    named per-procedure tests via `describe.each` over
    `trpc-inventory.json`. Asserts router/procedure naming
    conventions, kind validity, and source-file location per entry.
  - `tests/contract/pillar-j-api-iterator.spec.ts` — generates 186
    named per-cell tests over `api-inventory.json`. Asserts file
    location, method validity, and dynamic-flag/file-path agreement
    per route.
  - `tests/unit/scripts/iterator-coverage.test.ts` — 9 unit tests
    pinning the detection rule (anti-weakening: loosening either
    half of the rule fails the suite).
  - `docs/dev/adr/0019-iterator-aware-coverage.md` — ADR explaining
    why this raises (not lowers) the bar, plus the four
    anti-weakening invariants the rule must always satisfy.
  - `docs/qa/STANDARD.md` §6.1 — documents iterator-aware coverage
    as a recognised pattern in the standard.
  - **Result:** `qa:gate` reaches PASS for the first time in the
    project's history. Coverage headline:
    `66/66 routes · 52/52 API cells · 219/219 tRPC procedures · 18/18 pillars · 66/66 cards`.
    Test count grew 404 → 1477 (added 1073 named per-cell /
    per-procedure / per-rule tests).

- **Wave 5.5 — public `/changelog` page + RSS feed (2026-04-18):**
  - `docs/changelog/public.md` — curated, customer-facing release notes
    in Keep-a-Changelog style. Hand-edited; engineering noise stays in
    this `CHANGELOG.md`.
  - `src/lib/changelog/parser.ts` — pure parser turning the Markdown
    file into a typed `Release[]`; unknown sub-sections fall back to
    `Other` (anti-weakening: never silently drop content).
  - `src/lib/changelog/rss.ts` — pure RSS 2.0 renderer; deterministic
    slugs, full XML escaping, per-entry `<item>` granularity.
  - `src/lib/changelog/loader.ts` — server-only file loader cached for
    process lifetime.
  - `/changelog` Server Component page: anchor-stable release cards,
    category badges, RSS subscribe link.
  - `/changelog.rss` route handler returning `application/rss+xml`.
  - Marketing nav (`src/app/page.tsx`) gets a top-level "Changelog" link
    in the header (footer link already existed).
  - `docs/dev/adr/0018-public-changelog.md` — ADR documenting the
    decision, anti-weakening rules, and alternatives considered.
  - `docs/qa/per-pillar/pillar-u-changelog.md` — Pillar U coverage map.
  - `docs/qa/per-screen/{changelog,cvo,pricing,sandbox,settings__billing,settings__compliance}.md` —
    per-screen cards updated/created with accurate role-gating notes.
  - **15 new unit tests** across `tests/unit/lib/changelog/` (parser:
    8, RSS: 7). Total suite: **404 passed / 51 files**.
- **HDPulseAI QA Standard — Fix-Until-Green amendment v1.1.0 (2026-04-17):**
  the standard now binds the agent (and human) to a procedural failure-response
  loop, not just descriptive pass criteria.
  - `docs/qa/STANDARD.md` bumped to **v1.1.0**. New §4.1 **Failure Response
    Loop ("fix until green")** — capture → DEF card → diagnose → minimum
    fix → re-run the FULL pillar → loop. Hard cap **N=3 attempts per root
    cause**, after which the contributor MUST escalate with full evidence
    and MUST NOT mark the work done. New §4.2 **Anti-weakening rules** —
    enumerates ten patterns (weakened assertions, `.skip`/`.todo`/`.fixme`,
    widened selectors, swallowed errors, `@ts-expect-error`,
    `eslint-disable-next-line`, mocking out the failing path, raised
    timeouts, softened strict equality, lowered coverage thresholds, or
    silencing the coverage check) that may NOT be used to turn a red spec
    green. Each is, by itself, a violation and grounds for revert.
  - `docs/qa/definition-of-done.md` — new §7 **If your run is red** with
    Fix-Until-Green checklist, anti-weakening attestation, and loop-exit
    criteria.
  - `CLAUDE.md`, `AGENTS.md`, and `.cursor/rules/qa-standard.mdc` — added
    Fix-Until-Green and anti-weakening sections so every agent (Claude
    Code, Cursor, Codex, others) is on the loop contract.
  - `docs/qa/defects/_TEMPLATE.md` and `docs/qa/defects/index.md` — new
    defect-card template (with anti-weakening attestation block on close)
    and the index of opened cards. DEF-0003 / DEF-0004 reserved for the
    sidebar hydration + webpack-factory failures named in `STANDARD.md` §10.
  - `.github/workflows/qa-fix-until-green.yml` — new active CI workflow:
    anti-weakening static scan against the PR diff (fails on `.skip`,
    `.todo`, `@ts-expect-error`, `eslint-disable-next-line`, swallowed
    catches, raised timeouts, `expect.soft`, `test.fail`, `toBeTruthy`,
    `waitForTimeout`); typecheck/lint/forbidden-terms; inventory drift
    check; coverage gate; build; Playwright smoke pillar with
    `PLAYWRIGHT_HARD_FAIL_CONSOLE`/`HYDRATION`/`5XX` set; uploads
    `playwright-report/` + `test-results/` for DEF-card evidence; nightly
    full-pillar sweep (B–R) on `0 6 * * *`.
- **QA Standard rolled out to sibling EssenWebsites repos (2026-04-17):**
  the same `STANDARD.md` v1.1.0, `definition-of-done.md`, `AGENTS.md`,
  `.cursor/rules/qa-standard.mdc`, defect template + index, PR template,
  `CODEOWNERS`, and `qa-fix-until-green.yml` workflow were dropped into all
  four sibling repos under `HDPulseAI/EssenWebsites/`:
  `BronxTreatmentCenter`, `EssenHealthcare`, `IntentionHealthcare`,
  `NYReach`. Each sibling's `CLAUDE.md` was extended (or created) with a
  Testing Standard (BINDING) section and the Fix-Until-Green clause. The
  sibling copy of `STANDARD.md` is the framework-agnostic edition (PII /
  sensitive-data wording instead of PHI/NCQA-specific) and treats this
  repo's `STANDARD.md` as canonical for version bumps.
- **Global Cursor rule updated (2026-04-17):** `~/.cursor/rules/qa-standard-global.mdc`
  now carries the Fix-Until-Green loop and anti-weakening clauses, so every
  HDPulseAI repository opened in Cursor on this workstation inherits the
  procedural rules by default until the repo lands its own `STANDARD.md`.
- **HDPulseAI QA Standard adopted (2026-04-17):** the
  **Comprehensive QA Test Layer** is now the binding testing standard for this
  repo and the default for every future HDPulseAI project. New documents:
  - `docs/qa/STANDARD.md` — versioned (`v1.0.0`) master spec covering the 18
    testing pillars (A–R), hard-fail conditions, headline reporting rule
    (coverage FIRST, pass/fail second), per-screen and per-flow card
    requirements, inventory/coverage gate, roles & governance, and the named
    failure mode this standard prevents (the prior "Pass: 33 / Not Run: 223"
    HTTP-only probe).
  - `docs/qa/definition-of-done.md` — per-PR checklist derived from
    `STANDARD.md`. Every box must be checked or annotated `n/a`.
  - `AGENTS.md` (root) — tool-agnostic agent contract (Claude, Cursor, Codex,
    others).
  - `.cursor/rules/qa-standard.mdc` — project-level always-apply Cursor rule
    pointing every Cursor session at the standard.
  - `~/.cursor/rules/qa-standard-global.mdc` — global Cursor rule installed on
    this workstation so every HDPulseAI repo opened in Cursor inherits the
    standard by default until the repo lands its own `STANDARD.md`.
  - `.github/CODEOWNERS` — gates the standard documents to the QA Standard
    Owner team.
  Updated documents:
  - `CLAUDE.md` — new top-level **Testing Standard (BINDING)** section
    referencing `STANDARD.md` and listing the hard-fail conditions verbatim.
  - `docs/system-prompt.md` — operating instruction §6 now requires
    `STANDARD.md` compliance for every change; module-completion checklist
    requires per-screen / per-flow cards and green inventory coverage.
  - `docs/qa/README.md` — start-here pointers to `STANDARD.md` and
    `definition-of-done.md`.
  - `.github/pull_request_template.md` — pillar checklist (A–R), hard-fail
    confirmations, coverage/inventories gates, and the mandatory headline
    reporting block.
- **Documentation overhaul (2026-04-17):**
  - New audience-organized taxonomy under `docs/`: `product/`, `functional/`, `technical/`, `pm/`, `qa/`, plus existing `user/`, `training/`, `dev/`, `api/`, `compliance/`, `testing/`, `planning/`, `status/`, `releases/`, `upload/`, and a new `archive/`.
  - **REQUIRED documents** that must be kept current: `docs/system-prompt.md` (regenerate-from-scratch prompt) and `docs/development-plan.md` (phased delivery plan).
  - Functional documentation: BRD, FRD, use cases, UI/UX style guide, messaging catalog, status workflows, validation rules.
  - Technical documentation: TRD, architecture, data model, API surface, security, deployment & operations, performance.
  - Product documentation: overview, value proposition, market analysis with competitive grid, personas, glossary, roadmap.
  - PM documentation: charter, RACI, risk register, status reporting, change-log policy, decision log, stakeholder map, communication plan.
  - QA documentation: test strategy, unit-testing criteria, functional testing plan, UAT plan with 20 scenarios, defect management, test data plan.
  - User guide refreshed with a "Capability highlights" section and a new `quick-reference.md` cheat sheet.
  - Single canonical training deck (`docs/training/user-training.pptx`) and pitch deck (`docs/product/pitch-deck.pptx`) — version-era framing ("v2 / v3 / What's New Since…") removed because the platform is in active development and everything is current. Migration script: `docs/scripts/normalize-deck-versions.py`.
  - Detailed verbose speaker notes added to all 23 slides of the pitch deck (purpose, talking points, backup detail, anticipated Q&A, transitions; ~5,200 words total). Notes are regenerated by `docs/scripts/add-pitch-deck-notes.py` and are the canonical presenter script.
  - Detailed verbose trainer / speaker notes added to the platform-capabilities section of the user training deck (slides 25–39), bringing every slide in the deck to a structured trainer-notes format (opening, walk-through, live demo, hands-on exercise, common Q&A, pacing). New notes total ~5,400 words across 15 slides; existing trainer notes on slides 1–24 were preserved unchanged. Notes are regenerated by `docs/scripts/add-training-deck-notes.py` and are the canonical trainer script.
  - **Pitch deck — operations-feedback incorporation (2026-04-17):** the canonical pitch deck (`docs/product/pitch-deck.pptx`) now reflects April 2026 feedback from the platform's primary internal user. Visible-slide edits cover slides 1, 2, 4, 5, 6, 9, 10, and 11 — adding end-to-end task tracking framing (slide 1), expanded problem cards for committee-prep manualness, K:/O: drive split with no SharePoint integration, and competitor enrollment/direct-application bots (slide 2), the Task & Pipeline Dashboard callout (slide 4), the field-by-field OCR confirmation pop-up + automated renewal-doc outreach + per-provider verification packet (slide 5), expanded Committee Prep and Enrollment Follow-Up rows including hand-built rosters, single-provider entry, one-click roster generation, and bulk participation / ETIN uploads (slide 6), a new PECOS - Medicare enrollment integration bullet (slide 9), faster TAT for payer participation and end-to-end HRIS-to-RCM/EHR integration framing (slide 10), and Operations + RCM/Billing scoped permission tiers in the user-types card (slide 11). Speaker notes for the same eight slides were rewritten end-to-end (~3,200 words) to carry the full narrative. The named source contributor is not identified anywhere in the deck. Migration script: `docs/scripts/incorporate-pitch-feedback.py` (idempotent; re-runs are no-ops). The source-of-feedback PowerPoint is preserved as `docs/archive/legacy-decks/pitch-deck-feedback-2026-04-16.pptx`.
- **Legal / policy copy bundle (B-007 partial unblock, 2026-04-17):**
  - New canonical runtime module `src/lib/legal/copy.ts` exporting `LEGAL_COPY_VERSION` (`v1.0-draft`), `LEGAL_COPY_STATUS` (`DRAFT`), `ATTESTATION_QUESTIONS` (8 numbered statements with stable IDs), `ESIGN_DISCLOSURE` (7 sections), `PSV_CONSENT_INLINE` + `PSV_CONSENT_FULL`, `PRIVACY_NOTICE_SUMMARY` + `PRIVACY_NOTICE`, `TERMS_OF_SERVICE_SUMMARY` + `TERMS_OF_SERVICE`, `COOKIE_NOTICE_SUMMARY` + `COOKIE_NOTICE`, `HIPAA_NOTICE_POINTER`, and `LEGAL_FOOTER_LINKS`. Mirrors the markdown drafts in `docs/legal/`; both are kept in sync per the change procedure in `docs/legal/README.md`.
  - `/application/attestation` now renders the canonical attestation statements, signature disclaimer, and ESIGN disclosure (collapsible) from the module — no inline legal copy in the page anymore. Includes inline links to `/legal/terms` and `/legal/privacy` and shows the legal copy version that will be bound to the signature.
  - Provider portal footer (`src/app/(provider)/layout.tsx`) gains links to Privacy Notice, Terms of Service, Cookie Notice, and HIPAA Notice.
  - New public legal pages `/legal/privacy`, `/legal/terms`, `/legal/cookies`, and `/legal/hipaa` (pointer) under a self-contained `src/app/legal/` route segment with shared `LegalDocumentRenderer` (`src/components/legal/`). No new dependencies; structured `LegalBlock` primitives render headings, paragraphs, lists, callouts, and tables. New markdown stub `docs/legal/hipaa-notice.md` mirrors the runtime pointer.
  - `POST /api/attestation` now rejects partial acknowledgements server-side, captures client IP and user-agent, and writes an enriched `afterState` to the audit log: `legalCopyVersion`, `legalCopyStatus`, and `acknowledgements` (verbatim text + per-question accepted boolean). The endpoint also returns 409 when the client sends a stale `legalCopyVersion`. No schema migration required — uses existing `writeAuditLog`.
  - `docs/status/blocked.md` B-007 downgraded from "blocked on Legal authorship" to "blocked on Legal **review** of drafts". When Legal flips each markdown `Status:` from `DRAFT` to `APPROVED`, bump `LEGAL_COPY_VERSION` to `v1.0` and set `LEGAL_COPY_EFFECTIVE_DATE` — no further code change required to publish.
  - Archived superseded documents to `docs/archive/` (legacy MD files and decks) with a README explaining replacements.
  - Added a root `README.md` pointing to `docs/` and pointer pages for the root `CLAUDE.md` and `CHANGELOG.md`.
- Comprehensive user-facing documentation under `docs/user/`.
- Role-based training plans under `docs/training/`.
- Developer documentation under `docs/dev/`, including architecture, subsystem guides, 10 ADRs, and 8 operational runbooks.
- Public API and FHIR reference docs under `docs/api/`.
- Compliance documentation under `docs/compliance/` covering NCQA CVO, HIPAA, CMS-0057-F, PHI data map, retention policy, and internal policy alignment.
- Test strategy and plans under `docs/testing/` (unit, integration, E2E, performance, accessibility, security, manual plans).
- Liveness probe `/api/live` and readiness probe `/api/ready`.
- Structured logging via `pino` with PHI redaction paths.
- Forbidden-terms linter (`scripts/forbidden-terms.mjs`) enforcing the "new Credentialing application" framing in user-facing docs.
- GitHub Actions workflows: CI (`ci.yml`), security (`security.yml`), CD (`cd-prod.yml`).
- Dependabot configuration and pull request template.
- Authenticated document download endpoint `/api/documents/[id]/download` returning short-lived SAS redirects.
- Provider invite token verifier (`src/lib/auth/provider-token.ts`) with single-active-token enforcement.
- API rate limiter (`src/lib/api/rate-limit.ts`) and API audit helper (`src/lib/api/audit-api.ts`).
- FHIR Practitioner endpoint pagination, accurate `Bundle.total`, and `OperationOutcome` error responses.
- Vitest + Playwright test foundation with coverage gates.
- Pino-based logger with PHI redaction; unit test verifies redaction.
- Tamper-evident audit log: HMAC-SHA256 chain (`previous_hash`, `hash`, `sequence`) over each row, with `ip_address`, `user_agent`, and `request_id` captured per entry. DB triggers block DELETE and TRUNCATE and allow UPDATE only for the one-time NULL→value transition on `hash`. `verifyAuditChain()` exported for compliance reporting. ADR 0011 captures the decision.
- `AUDIT_HMAC_KEY` env var (32+ char secret); production refuses to start without it.

### Documentation
- **Documentation refresh — Wave 21 + 21.5 absorption (2026-04-19):**
  full-codebase pass to fold the Public Error Catalog (Wave 21) and the
  DEF-0007 / DEF-0008 anonymous-routing remediation (Wave 21.5) into
  every document the audience-cut governance model requires to stay
  current. No code changes; doc-only.
  - `docs/system-prompt.md` — bumped, added Module 21 (Public Error
    Catalog) to the modules table, rewrote `§10.1 REST v1` to require
    RFC 9457 Problem Details with dereferencable `type` URIs, added
    `§10.5 Public Error Catalog (Wave 21)` (TS registry +
    `/api/v1/errors[*]` JSON faces + `/errors[*]` anonymous HTML faces +
    `src/middleware.ts` allow-list invariant + DEF-0007 / DEF-0008
    cross-refs + `tests/e2e/anonymous/pillar-a-public-smoke.spec.ts`),
    extended build-order `§17` step 21, refreshed references `§19`
    (ADRs 0001–0027, new QA + product docs), updated change log `§21`.
  - `docs/development-plan.md` — added Phase 1.6 (Public-API Hardening,
    Waves 7 / 20 / 21 / 21.5, complete) to the executive summary and
    body; updated change log.
  - `docs/functional/business-requirements.md` — added BR-021
    (Machine-readable Public Error Catalog & RFC 9457 Problem Details);
    bumped to 2.2.
  - `docs/functional/functional-requirements.md` — extended the
    application-structure table with the public surfaces (`/cvo`,
    `/pricing`, `/sandbox`, `/changelog`, `/changelog.rss`, `/errors`,
    `/errors/{code}`); added `§11A. Module 21 — Public Error Catalog
    (RFC 9457)` (four faces, anonymous-access invariant, JSON contract
    example, validation, messages, audit, permissions); bumped to 2.2.
  - `docs/technical/technical-requirements.md` — added TR-F-011
    (RFC 9457 + error-catalog single source of truth); refreshed the
    ADR list to 0001–0027; bumped to 2.2.
  - `docs/technical/architecture.md` — added "Public surfaces
    (anonymous, no API key)" data-flow section; updated the
    Public-API-call data flow to describe the RFC 9457 envelope and the
    dereferencable `type` URI; refreshed change history.
  - `docs/product/product-overview.md` — added top-capabilities entry
    21 (Public Error Catalog); bumped status to "All 21 functional
    modules"; added "Where to read more" cross-link block including the
    new stakeholder brief.
  - `docs/product/stakeholder-brief.md` — NEW. Single-page,
    audience-cut summary (executives / sponsors / customers / auditors /
    partners / internal teams) referencing Wave 21, RFC 9457, DEF-0007
    closure, and ADRs 0001–0027.
  - `docs/product/README.md` — registered the new stakeholder brief.
  - `docs/README.md` — surfaced the stakeholder brief under "Product";
    added "Quick navigation by topic" entries for the OpenAPI 3.1
    contract, the Public Error Catalog (RFC 9457), CMS-0057-F, NPG-12,
    the QA Standard, the Definition of Done, the defects ledger, and
    the wave-by-wave delivery index.
  - `docs/archive/legacy-testing/` — NEW archive batch. Moved the
    superseded Master Test Plan workbooks
    (`..._20260417_010249.xlsx`, `..._EXECUTED_20260417_013233.xlsx`),
    the two first-pass legacy workbooks
    (`..._20260416_100935.xlsx`, `..._110654.xlsx`), the three one-shot
    runtime smoke JSONs (`runtime_results_20260416_105254.json`,
    `runtime_test_results_20260416_104910.json`,
    `test_results_deep.json`), and the superseded
    `TEST_EXECUTION_REPORT_20260417.md` here. The current authoritative
    set (latest non-EXECUTED workbook + latest EXECUTED workbook + the
    four Python generators + the latest report) stays at
    `docs/testing/`.
  - `docs/archive/README.md` — registered the new `legacy-testing/`
    batch with a row-by-row "replaced by" table.

### Changed
- Bot lifecycle in `BotBase.run` now respects `REQUIRES_MANUAL` status and skips automatic completion.
- Consolidated `sanctions-monthly` + `sanctions-weekly` into a single `sanctions-recheck` job with 24-hour idempotency.
- `TRIGGERABLE_BOT_TYPES` restricted to user-triggerable types; system-only bots cannot be triggered via the API.
- Real-time bot status updates now use tRPC polling (5-second interval while active); Socket.io removed.
- Public API v1 explicitly filters PHI fields (ssn, dateOfBirth, home address) from responses.
- `providers.uploadedById` is now nullable with a new `uploaderType` column to accommodate provider-via-token and bot uploads.
- Document download via UI now routes through the authenticated download endpoint; blob URLs are not exposed in the client.
- PHI fields (homeAddressLine1/2, homeCity, homeState, homeZip, homePhone) are encrypted at the application layer during `save-section`.
- `.claude/deploy.py` is guarded by `ALLOW_DEPLOY=1` to prevent accidental deploys.
- Prisma migrations are tracked in Git; `migrate deploy` runs from a web container entrypoint.
- `Dockerfile.web.prod` now includes Prisma CLI and runs migrations before starting Next.js; healthcheck start_period extended to 120s.

### Removed
- `socket.io` and `socket.io-client` dependencies.
- Unused `providerProcedure` in tRPC (providers authenticate via token, not session).
- Redundant `00000000000000_init` Prisma migration.

### Security
- Closed IDOR risks on `/api/application/save-section`, `/api/attestation`, `/api/upload`, and `/api/documents/[id]/download` by verifying the token's `providerId` matches the target resource.
- Attestation now revokes the provider invite token after successful submission.
- FHIR and REST v1 routes authenticate, rate-limit, audit, and surface structured errors.
- `AuditLog` write on every public API request; no plaintext key material is logged.

## [Policy]

### No breaking changes to public APIs

The REST v1 and FHIR R4 endpoints are considered stable. Breaking changes require a version bump (REST v2) or a published FHIR profile change, and follow the communication process in `docs/api/changelog.md`.

### Semantic versioning applies to

- REST v1 response shapes.
- FHIR Practitioner resource shape and search parameters.

### Semantic versioning does NOT apply to

- Internal tRPC procedure shapes (versioned implicitly with the client).
- Database schema (migrations are additive and managed via `prisma migrate`).
- UI components.

## How releases are tagged

- Tags: `vYYYY.MM.DD` (calendar versioning for the product as a whole).
- Git tag triggers `cd-prod.yml`.
- Each tag's notes include:
  - Commit log since previous tag
  - Migrations applied
  - Config/env changes required
  - Manual test plan sign-offs
  - Known issues

Release notes are published in `docs/releases/` per tag.
