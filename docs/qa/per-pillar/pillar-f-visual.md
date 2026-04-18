# Pillar F — Visual regression baselines (per-browser matrix)

Wave 4.4 promotes pillar F from a single chromium screenshot of the
sign-in page to a curated per-browser baseline matrix that locks the
rendered DOM of the highest-traffic public + staff surfaces in
**chromium, firefox, and webkit**.

## Driver

`playwright.visual.config.ts` — separate from the functional
`playwright.config.ts` so role/RBAC failures don't get tangled with
visual diffs.

Snapshot path template:

```
tests/e2e/visual/__screenshots__/<spec>/<projectName>/<name>.png
```

Three engine baselines live side-by-side and are reviewable in a normal
PR diff.

## Coverage

### Anonymous (`anonymous.visual.spec.ts`)

| Name | Route |
| --- | --- |
| `landing` | `/` |
| `auth-signin` | `/auth/signin` |
| `auth-register` | `/auth/register` |
| `legal-privacy` | `/legal/privacy` |
| `legal-terms` | `/legal/terms` |
| `legal-hipaa` | `/legal/hipaa` |
| `legal-cookies` | `/legal/cookies` |

### Staff (`staff.visual.spec.ts`, admin storageState)

| Name | Route |
| --- | --- |
| `dashboard` | `/dashboard` |
| `providers-list` | `/providers` |
| `applications` | `/applications` |
| `documents` | `/documents` |
| `expirables` | `/expirables` |
| `sanctions` | `/sanctions` |
| `committee` | `/committee` |
| `audit-log` | `/audit-log` |
| `admin-settings` | `/admin/settings` |

`session-now` and `last-refreshed` test-id'd elements are masked so
unrelated clock ticks don't fail every diff.

## Running locally

```bash
# One-time: install all three browser engines + their OS deps
npm run qa:visual:install

# Bootstrap or refresh baselines after an intentional UI change
npm run qa:visual:update

# Verify against committed baselines (CI behavior)
npm run qa:visual
```

The `qa:visual` task spins up no app of its own — point
`E2E_BASE_URL` at a running dev/prod bundle (default
`http://localhost:6015`).

## Anti-weakening (STANDARD.md §4.2)

- `maxDiffPixelRatio` is pinned at **0.02** for all visual specs —
  do not raise per-spec to mute a real diff.
- `threshold` is pinned at **0.15** to absorb anti-aliasing noise across
  WebKit minor versions; raising it requires an ADR.
- A failing baseline always means: (a) regenerate intentionally with
  `qa:visual:update`, (b) commit the new PNGs, (c) call out the visual
  delta in the PR description and link the screenshot diff.
- NEVER add `test.skip` to bypass a visual diff "for now". Either fix
  the regression or update the baseline.

## CI wiring

The nightly `qa-fix-until-green.yml` workflow includes a `visual` job
that runs `npm run qa:visual` against the prod bundle (`npm start`).
On first failure it uploads the `playwright-visual` HTML report
(under `docs/qa/results/<date>/`) so reviewers can step through every
diff.

## Adding a new screen

1. Add a row to `PAGES` in either `anonymous.visual.spec.ts` or
   `staff.visual.spec.ts`.
2. Run `npm run qa:visual:update` locally.
3. Commit the three new PNGs (one per engine) — they live next to the
   spec under `__screenshots__/`.
4. Reference this pillar from the per-screen card if the new route is
   in `docs/qa/per-screen/`.
