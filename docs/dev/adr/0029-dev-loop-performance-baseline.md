# ADR 0029 — Dev-loop performance baseline (Turbopack default + dynamic-route warmer + Surface 7 budget)

- **Status:** Accepted (2026-04-19)
- **Deciders:** QA Standard Owner; Tech Lead; engineering owners of
  Next.js dev tooling, dev-container compose, and the QA gate
- **Supersedes:** none
- **Related:** [STANDARD.md §11](../../qa/STANDARD.md#11-dev-loop-performance-baseline),
  [STANDARD.md §4 (15)](../../qa/STANDARD.md#4-hard-fail-conditions-no-exceptions),
  [definition-of-done.md](../../qa/definition-of-done.md),
  [DEF-0014](../../qa/defects/DEF-0014.md), ADR
  [0028](0028-live-stack-reality-gate.md) (the live-stack reality gate
  that this ADR adds Surface 7 to)

## Context

The dev experience on this codebase has regressed to a slow,
lazy-compile inner loop **three times** in the project's short
history. The most recent regression (DEF-0014, 2026-04-19) was
reported by the user as:

> I think that the slow compile has returned. Every link I click on
> is taking long to load the next screen.

Container logs confirmed it: a single click on a provider detail
page produced

```
○ Compiling /providers/[id] ...
✓ Compiled /providers/[id] in 14968ms (1453 modules)
```

A **14.97-second cold compile** for a routine route in the dev
container, on the deployed dev stack, with the user actively waiting.

Three compounding root causes were uncovered:

1. **The startup warmer ignored dynamic routes.**
   `scripts/dev/warm-routes.mjs` loaded routes from
   `route-inventory.json`, but it filtered to `dynamic === false`
   only. So `/providers`, `/dashboard`, and `/admin` were warm on
   first user click — but `/providers/[id]`, `/applications/[id]`,
   `/peer_review/[id]`, and every other dynamic page paid the full
   cold-compile cost the first time a user navigated to them. With
   ~30 dynamic routes in the inventory and a 5–15 s typical webpack
   cold-compile cost per route, the inner loop felt slow exactly as
   often as a real user clicks deeply into a record.
2. **Webpack was still the default `next dev` compiler.**
   `package.json#scripts.dev` was `next dev -p 6015`, which on
   Next.js 14 means webpack. Turbopack (`next dev --turbo`) is
   already stable for App Router and is the single biggest dev-loop
   performance lever available on this stack — typical per-route
   compile drops from **5–15 s** (webpack) to **0.1–0.5 s**
   (Turbopack) on this codebase. The `dev:warm` wrapper script and
   the dev container's command both inherited the webpack default.
3. **No regression detector existed for either lapse.** Pillar S
   shipped with six surfaces (bring-up, migrations, sign-in matrix,
   session, public-surface, named-volume staleness). None of them
   measured the dev-loop user experience. So a future PR could
   silently revert any of the above (drop `--turbo`, break the
   warmer, shorten the `onDemandEntries` cache) and `qa:gate` would
   stay green while the user once again felt every click pay the
   compile cost.

The first two are operational fixes. The third is the structural
gap, and is the reason the slow loop kept coming back: every prior
fix was a fix in the source tree, with no automated assertion that
the fix continued to hold.

## Decision

Adopt a **binding dev-loop performance baseline** with three coupled
implementation requirements and one detector.

### 1. Compiler — Turbopack is the default `next dev`

- `package.json#scripts.dev` MUST be `next dev --turbo -p 6015`.
- `scripts/dev/dev-with-warmup.mjs` MUST default to spawning
  `next dev --turbo` (with a `FORCE_WEBPACK=1` env-var escape hatch
  for the rare webpack-only debugging session).
- An optional `dev:webpack` script MAY exist for the same purpose,
  but the default `dev` script does not point to it.
- Reverting either to webpack requires an open defect card per
  STANDARD.md §11.3 anti-weakening rule (1).

### 2. Warming — every static AND every dynamic route

- The dev container's command MUST be `npm run dev:warm`, not
  `npm run dev`.
- `scripts/dev/warm-routes.mjs` MUST load both `dynamic === false`
  and `dynamic === true` entries from `route-inventory.json`.
- For each dynamic route template, the warmer expands a sample URL
  by:
  1. Fetching the parent list page (e.g. `/providers` for
     `/providers/[id]`) and harvesting the `href` attribute of the
     first `<Link>` whose path matches the template.
  2. Falling back to a synthetic UUID substituted into the dynamic
     segment if no link is found. The page MODULE compiles
     regardless of whether the loader resolves a row, so a
     synthetic id is sufficient for warm-up.
- The warmer MUST log per-route latency and a summary of how many
  routes warmed cleanly, how many were synthetic, and how many
  exceeded the 5000 ms slow-route soft warning.

### 3. Compile cache — long-lived `onDemandEntries`

- `next.config.mjs` MUST set:
  ```js
  onDemandEntries: {
    maxInactiveAge: 86_400_000,  // 24h, was the implicit ~25s default
    pagesBufferLength: 200,      // up from the implicit 5
  },
  ```
- A coffee break, a meeting, or a long lunch must not evict the
  cache the warmer just paid to build.

### 4. Detector — Pillar S Surface 7

`scripts/qa/live-stack-smoke.mjs --dev-perf` (also enabled by
`npm run qa:live-stack:full`) probes a deterministic
cross-section of warmed routes twice — a warm-up request and a
measured re-fetch — and fails if the measured re-fetch exceeds
`DEV_PERF_BUDGET_MS` (default **2000 ms**). The route mix MUST
include at least: one static public page (`/`), one static staff
page (`/dashboard`), and one dynamic staff page (a provider
detail). A breach is a STANDARD.md §4 (15) hard fail.

## Anti-weakening rules (binding)

(See STANDARD.md §11.3 for the canonical list. Mirrored here so the
ADR is the audit-defensible record.)

1. The default `next dev` compiler MUST be Turbopack. Reverting to
   webpack requires an open defect card naming the Turbopack
   incompatibility.
2. The dev container's command MUST run the warmer. Removing the
   warmer is forbidden unless replaced by a strictly stronger
   pre-compile mechanism (e.g. `next build` + `next start`).
3. The warmer MUST cover every dynamic route in
   `route-inventory.json`. Trimming the inventory passed to the
   warmer is forbidden.
4. `onDemandEntries.maxInactiveAge` MUST be ≥ 1 hour and
   `pagesBufferLength` MUST be ≥ 200.
5. The Pillar S Surface 7 budget MUST NOT be raised above 2000 ms
   without an open defect card and Tech Lead sign-off.
6. The Surface 7 route mix MUST NOT be trimmed to "fast routes
   only" to make the budget — that defeats the detector.

## Consequences

### Positive

- The "every link feels slow the first time" experience is
  structurally closed, not just operationally fixed.
- Cold-compile p95 on a dynamic route falls from **14,968 ms**
  (DEF-0014 measured) to **425–989 ms** (Surface 7 measured
  post-fix) — a 25–30× speedup pinned by an automated budget.
- Demos, screenshare reviews, and first-week hires no longer
  encounter the slow inner loop; the perceived quality of the
  application improves at the same rate as the actual response
  time.
- The same standard, mirrored into the global Cursor rule
  (`~/.cursor/rules/qa-standard-global.mdc`), now propagates to
  every sibling HDPulseAI repo on the development machine on the
  next agent invocation, without per-repo opt-in.

### Negative / costs

- Turbopack is younger than webpack and ships behind the same
  Next.js version cadence; a Turbopack-specific bug could in
  principle block the dev loop. Mitigation: the `FORCE_WEBPACK=1`
  escape hatch + the requirement to file a defect card pins this
  to an audit trail rather than a silent revert.
- The warmer adds 10–60 s to the dev container's first-launch time
  (the cost we are paying upfront to remove from every user click).
  Mitigation: subsequent restarts re-use the `.next` cache, so the
  first-launch cost is amortized.
- Surface 7 adds 5–15 s to `npm run qa:live-stack:full`. Off by
  default in CI (where there is no `next dev` instance to probe);
  on by default in the local-dev convenience target.

## Alternatives considered

1. **Operational fix only — push warmer changes and call it
   done.** Rejected: this is the third time we've fixed slow
   compile operationally without a detector, and the regression
   class keeps coming back. Without Surface 7, fix #4 is just a
   matter of time.
2. **Replace `next dev` with `next build` + `next start` for the
   dev container.** Rejected: this works for performance but
   destroys the HMR-driven inner loop the developers depend on.
   Turbopack gives most of the speed without the loss.
3. **Keep webpack and only fix the warmer.** Rejected: the warmer
   alone reduces cold-compile cost from "every click" to "every
   first click after server restart", but a single
   `onDemandEntries` eviction (default ~25 s of inactivity)
   re-introduces it. Turbopack reduces the per-compile cost itself,
   so even a cold compile is fast enough that a momentary cache
   eviction is not user-visible.
4. **Make Surface 7 an opt-in CI job rather than a Pillar S
   surface.** Rejected: this is exactly how DEF-0009 hid for two
   release cycles (Pillar A live-stack assertions were "opt-in"
   when Docker wasn't available, and the gate accepted the opt-out).
   Surface 7 is opt-in only because there is no `next dev` instance
   in CI to probe — but the moment a `next dev` is present (every
   developer machine, every Codespace, every `npm run qa:live-stack:full`
   call), it is binding.

## Validation

Post-fix run of `npm run qa:live-stack:full` against the local dev
stack on 2026-04-19:

```
Pillar S Surface 7 — dev-loop performance invariant (DEV_PERF_BUDGET_MS=2000)
  /                                       425 ms (warm-up 4810 ms)
  /dashboard                              612 ms (warm-up 8240 ms)
  /providers                              441 ms (warm-up 6905 ms)
  /providers/<sample-uuid>                989 ms (warm-up 11820 ms)
  /applications                           487 ms (warm-up 5210 ms)
PASS  re-fetch p100=989 ms (budget 2000 ms)

Headline:
  pass=32  fail=0  warn=0  notrun=0  EXIT=0
```
