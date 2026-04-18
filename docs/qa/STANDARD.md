# HDPulseAI QA Standard — Comprehensive QA Test Layer

**Status:** BINDING. This document is the canonical, versioned testing standard for
the ESSEN Credentialing Platform and for every future HDPulseAI product unless an
explicit ADR supersedes a clause.
**Version:** 1.1.0 (2026-04-17)
**Owner:** QA Standard Owner (see `## 9. Roles & governance`)
**Audience:** every human and AI agent that writes, reviews, or merges code into
this repository, plus any future repository that adopts this standard.

> **Why this exists.** A previous round of testing reported "all 500+ test
> conditions Pass" while the application's first post-login screen failed to
> render at all. That happened because the prior layer was an HTTP-only Python
> probe, ran no JavaScript, opened no browser, and marked unexecuted cases as
> "Not Run" without failing the headline. This standard exists to make that
> class of failure structurally impossible going forward: coverage is reported
> before pass/fail, browser console errors are hard failures, and "Not Run" is
> never a passing outcome.

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

## 2. The 18 testing pillars (A–R)

Every change MUST be analyzed against all 18 pillars. The relevant pillar(s)
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

The pillar inventory is canonical. Adding or removing a pillar requires an ADR
and a bump of this document's `Version` line.

---

## 3. Headline reporting rule

A test report or PR comment is only considered valid if it leads with
**coverage** before pass/fail. The minimum headline is:

```
Routes covered:    X of Y      (must be 100% before release)
Roles exercised:   X of N      (must be 100% before release)
Pillars touched:   <list of A–R IDs>
Pillars green:     <list of A–R IDs that ran AND passed>
Pillars not run:   <list>      (NOT-RUN ≠ PASS — counts as failure for the gate)
Pass / Fail / Skip: P / F / S
```

The legacy report format (`Pass: 33, Fail: 0, Not Run: 223`) is explicitly
forbidden. A run with any "Not Run" case for a covered pillar is reported as a
**fail** of the gate, not a pass.

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

A new tool may be added; an existing tool may be replaced only via an ADR under
`docs/dev/adr/`.

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
7. PR description includes the headline reporting block from §3.
8. None of the §4 hard-fail conditions tripped on the smoke run.
9. Any new PHI field is encrypted at rest (`encrypt`/`encryptOptional`),
   redacted in logs, and excluded from public-API responses.
10. `CHANGELOG.md` updated under `## [Unreleased]`.

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

## 10. Failure mode that this standard explicitly prevents

The 2026-04-17 failure mode is named here so it cannot recur silently:

- **Symptom:** Test report claimed `Pass: 33, Fail: 0, Not Run: 223` while the
  first authenticated screen failed to mount due to a hydration mismatch in
  `src/components/layout/sidebar.tsx` and a webpack factory error.
- **Root cause:** the runner was an HTTP probe (no browser, no JS execution);
  "Not Run" cases were excluded from the headline; the report had no coverage
  line; no per-screen card existed for the dashboard route.
- **Standard response:** §3 (coverage before pass/fail), §4.1–§4.3 (browser
  console, hydration, uncaught exception are hard fails), §5 (per-screen card
  for every route), §6 (inventory + `check-coverage.ts` gate).

A future report that matches the symptom shape is a violation of this standard
even if every spec is green.

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
