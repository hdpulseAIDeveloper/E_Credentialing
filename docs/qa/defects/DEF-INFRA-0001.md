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

## Anti-weakening attestation

- [x] No per-test `timeout: 90_000` overrides have been added to mask
      the dev-server compile latency.
- [x] No `.skip` / `test.fixme` was added on the timing-out routes.
- [x] The 60s timeout in `playwright.config.ts` is unchanged from the
      QA Standard default.
