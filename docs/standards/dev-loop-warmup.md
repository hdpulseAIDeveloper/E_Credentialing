# HDPulseAI Standard — Dev-Loop Route Warmup

**Status:** v1.0.0 — adopted 2026-04-17
**Owner:** Platform / DevEx
**Applies to:** every Next.js application in the HDPulseAI portfolio

## Problem

Next.js dev mode (`next dev`) lazily compiles each route module on its
first HTTP request, and evicts compiled routes from memory after
`onDemandEntries.maxInactiveAge` (default 15 seconds). This produces
the user-visible symptom: **"every link feels slow the first time I
go to it,"** and the same lag recurs whenever you haven't visited a
route within the last few seconds.

This is a developer-experience defect, not an application defect — it
disappears the moment you run `next start` against a production
build — but it makes day-to-day work feel sluggish, masks real
performance regressions, and destabilises Playwright runs against
`next dev` (see `docs/qa/defects/DEF-INFRA-0001.md`).

## Standard

Every Next.js application **MUST** ship the following dev-loop
artifacts in addition to its normal `next dev` invocation:

1. **`onDemandEntries` cache extended** in the Next config so compiled
   pages stay hot for the entire dev session, not 15 seconds:

   ```ts
   onDemandEntries: {
     maxInactiveAge: 24 * 60 * 60 * 1000, // 24h
     pagesBufferLength: 200,
   }
   ```

   This is harmless under Turbopack (which ignores it) and HMR is
   unaffected (HMR uses its own invalidation path).

2. **`scripts/dev/warm-routes.mjs`** — a route pre-warmer that
   discovers every static App Router route from the filesystem and
   GETs each one once so Next compiles on the warmer's request, not
   on the user's first click.

3. **`scripts/dev/dev-with-warmup.mjs`** — an orchestrator that
   spawns `next dev`, waits for the `Ready` log line, then runs the
   warmer in the background.

4. **Package scripts** added to `package.json` (no `cross-env` or other
   new dep — the per-app port lives in the script itself, see below):

   ```json
   "dev:warm": "node scripts/dev/dev-with-warmup.mjs",
   "warm":     "node scripts/dev/warm-routes.mjs",
   "preview":  "next build && next start -p <port>"
   ```

5. **Dev container CMD** (if the app ships a `Dockerfile.dev` or
   `Dockerfile.web`) **MUST** be `npm run dev:warm`, with a
   `command:` override in `docker-compose.dev.yml` so the change
   applies on `docker compose up -d` without an image rebuild.

6. **Container volume mounts** for `./scripts/`, `./package.json`,
   and (where applicable) `./docs/qa/inventories/` so the warmer is
   live-editable inside the container.

7. **Escape hatches:**
   - `SKIP_WARMUP=1` runs plain `next dev` with no warmer.
   - `npm run preview` builds the production bundle and serves it
     for demos/UAT (zero first-click latency, no HMR).
   - `NODE_ENV=production` causes the warmer to refuse to run.

## Canonical implementation

The reference scripts live in this repository at
`scripts/dev/_canonical-sibling-warmer/`. Every sibling Next.js app
copies them verbatim into its own `scripts/dev/` (no shared package
yet — keeps each app self-contained for cloning/forking). When the
canonical version changes, run the rollout protocol below.

| App                                | Path                                               | Port  | Locales | Auth |
| ---------------------------------- | -------------------------------------------------- | ----- | ------- | ---- |
| **E_Credentialing** (reference 1)  | `EssenApps/E_Credentialing`                        | 6015  | none    | yes — uses NextAuth login flow + route inventory |
| IntentionHealthcare                | `EssenWebsites/IntentionHealthcare`                | 6008  | en      | no  |
| NYReach                            | `EssenWebsites/NYReach`                            | 6005  | en      | no  |
| BronxTreatmentCenter               | `EssenWebsites/BronxTreatmentCenter`               | 6009  | en      | no  |
| EssenHealthcare                    | `EssenWebsites/EssenHealthcare`                    | 6006  | en      | no  |
| WebsiteV1 (frontend)               | `WebsiteV1/frontend`                               | 3000  | none    | no  |

The E_Credentialing version of the warmer is bespoke (it authenticates
as the seeded admin and uses the QA route inventory) because the app
is gated behind NextAuth and would otherwise only warm the redirect to
`/auth/signin`. Every other app in the table uses the canonical
sibling version unchanged.

## Per-app configuration

The canonical sibling warmer is parameterised by environment variables
so the same script works in every app:

| Var             | Purpose                                | Example          |
| --------------- | -------------------------------------- | ---------------- |
| `PORT`          | dev server port                        | `6008`           |
| `BASE_URL`      | full origin (overrides `PORT`)         | `http://localhost:6008` |
| `WARM_LOCALES`  | comma-separated locales for `[locale]` | `en,es`          |
| `WARM_EXTRA`    | extra paths to warm                    | `/sitemap.xml`   |
| `NEXT_DEV_ARGS` | extra args to `next dev`               | `--turbopack`    |
| `SKIP_WARMUP=1` | disable the warmer                     |                  |

Defaults for `PORT`, `NEXT_DEV_ARGS`, and `WARM_LOCALES` are baked
into each app's local copy of the scripts in an `APP_DEFAULTS` block
at the top of `scripts/dev/dev-with-warmup.mjs` and
`scripts/dev/warm-routes.mjs`. This is the **only** intentional
divergence from the canonical script and is what lets the
`package.json` `dev:warm` script stay generic
(`node scripts/dev/dev-with-warmup.mjs`) without needing `cross-env`
to set environment variables in a Windows-compatible way.

Override at runtime by setting the same env vars in
`docker-compose.dev.yml` `environment:` or in the developer's shell.

## Verification

After applying the fix to an app, verify with:

1. `docker compose -f docker-compose.dev.yml up -d <service>`
2. Watch logs until you see `[warm] done: N routes warmed in Xs`.
3. Time five distinct routes — each should respond in **< 500 ms**
   (most under 200 ms). Any route over 5 s is logged with `SLOW`.
4. Wait five minutes idle, then re-time the same routes — they
   should still be **< 500 ms** (proves `onDemandEntries` is taking
   effect, not just the initial warmup).

## Update protocol

When the canonical scripts change:

1. Edit `scripts/dev/_canonical-sibling-warmer/*` in E_Credentialing.
2. For each app in the registry table above, copy the updated files
   into that app's `scripts/dev/` and commit per-app with a short
   message referencing this standard's version.
3. Bump the version at the top of this file.

This is intentionally manual until the portfolio justifies a shared
npm package — the script is small (~200 LOC) and per-app divergence
(e.g. auth strategy, locale list) is real.
