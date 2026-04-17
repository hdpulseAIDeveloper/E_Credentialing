# DEF-INFRA-0001 — Pillar runs against `next dev` are unstable for E2E

| Field      | Value                                                |
| ---------- | ---------------------------------------------------- |
| Status     | **Open — Roadmap**                                   |
| Pillar     | All (infra)                                          |
| Severity   | Process (not an app defect; QA infrastructure gap)   |
| Opened     | 2026-04-17                                           |
| Owner      | Platform / DevEx                                     |

## Captured evidence

Pillar A run 4 (no warm-up): 16/173 specs failed with
`TimeoutError: page.goto: Timeout 30000ms exceeded` for routes that
**passed cleanly** in the same run for the admin role. Pattern:
admin role compiled the route first → admin spec passed → other
roles arrived 10 minutes later → dev server's compile queue was
backed up → 30s budget exhausted before HTML returned.

Pillar A run 5 (with `globalSetup` warm-up): 173/173 passed in 18m.

Pillar E run 1: 8/42 timeouts on the heaviest pages
(`/admin/users`, `/admin/workflows`, `/analytics`, `/roster`)
because axe analysis added ~5–10s on top of compile, exceeding the
60s test budget on first hit.

## Root cause

`next dev` recompiles each route on first request. Compilation is
single-threaded per Next process and routes with deep import graphs
(admin pages with Excalidraw, react-table, etc.) take 7-20s. With 2
parallel Playwright workers each navigating to 18 routes, the
compile queue backs up and exceeds per-test budgets even after the
warm-up.

## Minimum fix

Add an E2E runner mode that builds the production bundle once and
serves it via `npm start`:

```
npm run build
PORT=6015 npm start &
E2E_BASE_URL=http://localhost:6015 npx playwright test
```

Production builds:

- have all routes pre-compiled (no first-hit latency)
- have stable hashed chunks (no Fast Refresh module-map drift —
  eliminates the entire DEF-0003 / DEF-0004 class of failures)
- match what real users get

This is non-trivial because the build needs the worker container's
deps (Playwright bots) and a transient test database. Tracked
separately as a roadmap item.

## Workaround (in place today)

`tests/e2e/global-setup.ts` performs a sequential warm-up of every
static route as the admin user before the suite starts. This makes
Pillar A reliably green but **does not fix Pillar E timeouts** when
axe analysis stacks on top.

## Developer-experience fix shipped 2026-04-17

Users reported the same underlying symptom interactively: "every link
feels slow the first time I go to it." That was the exact same lazy
per-route compile lag this defect documents, surfaced by actual
clicks instead of automated specs. We shipped a three-part fix:

1. **Dev-server route cache is no longer evicted in 15s.**
   `next.config.mjs` sets `onDemandEntries.maxInactiveAge = 24h` and
   `pagesBufferLength = 200` so once a page is compiled it stays hot
   for the entire dev session. Default was 15s / 5 pages, which
   caused the second and third "first visits" to each route.

2. **Dev container auto-prewarms every static route at boot.**
   `scripts/dev/dev-with-warmup.mjs` spawns `next dev`, waits for the
   first `Ready` log line, then runs `scripts/dev/warm-routes.mjs` in
   the background. The warmer authenticates as the seeded admin via
   NextAuth's Credentials API, reads `docs/qa/inventories/route-inventory.json`,
   and GETs every static route once so Next compiles on the warmer's
   request — not on the user's click. Docker compose runs this via
   `command: ["npm", "run", "dev:warm"]` so it's the default when the
   user runs `docker compose up`. `SKIP_WARMUP=1` opts out.

3. **`npm run preview` builds and serves the prod bundle** for
   demos / UAT where zero first-click latency matters and HMR is not
   needed. Same as the E2E roadmap fix above but as a developer
   escape hatch rather than a test-runner mode.

Observed effect (measured 2026-04-17 on this workspace):

- first `docker compose up -d ecred-web`: dev server Ready in ~5s,
  warmer compiles all 45 static routes in ~4m, then idle.
- subsequent user clicks on any warmed route: **~100ms** middleware
  redirect / page render — no on-demand compile.
- a Fast Refresh edit still hot-reloads in <1s; the cache eviction
  change does not break HMR because HMR uses its own invalidation
  path, not `onDemandEntries`.

This does **not** close the defect — the E2E stability half of the
problem (Pillar E axe + first-compile stacking on the same spec)
still requires the "build once, test against `npm start`" roadmap
item. The dev-loop fix is scoped to the interactive developer
experience.

## Anti-weakening attestation

- [x] No per-test `timeout: 90_000` overrides have been added to mask
      the dev-server compile latency.
- [x] No `.skip` / `test.fixme` was added on the timing-out routes.
- [x] The 60s timeout in `playwright.config.ts` is unchanged from the
      QA Standard default.
