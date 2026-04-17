# Definition of Done — every PR

**Status:** BINDING. Derived from [STANDARD.md §8](STANDARD.md).
**Audience:** every contributor (human or AI agent).

A PR may not be merged unless **every** box below is checked. If a box does
not apply, write `n/a — <reason>` next to it; do not silently skip.

## 1. Build & basic hygiene

- [ ] `npm run typecheck` is clean.
- [ ] `npm run lint` is clean.
- [ ] `npm test` is green.
- [ ] `node scripts/forbidden-terms.mjs` is clean.
- [ ] `npm run build` succeeds (web).
- [ ] If the worker changed: `npm run build:worker` succeeds.

## 2. QA pillars touched (mark all that apply)

Pillar IDs are defined in [STANDARD.md §2](STANDARD.md#2-the-18-testing-pillars-ar).

- [ ] A — Functional smoke
- [ ] B — RBAC matrix
- [ ] C — PHI scope & encryption
- [ ] D — Deep end-to-end flows
- [ ] E — Accessibility
- [ ] F — Visual regression
- [ ] G — Cross-browser & responsive
- [ ] H — Performance / load / soak
- [ ] I — Security / DAST
- [ ] J — API contract
- [ ] K — External integrations
- [ ] L — Time-shifted scenarios
- [ ] M — Data integrity / migrations / DR
- [ ] N — Concurrency / idempotency / resilience
- [ ] O — Files / email / SMS / print / PDF
- [ ] P — Compliance controls
- [ ] Q — Documentation integrity
- [ ] R — Observability

For every box checked above, at least one new or updated spec MUST live under
the corresponding folder (see STANDARD.md §2). Paste the spec paths here:

```
tests/e2e/<pillar>/<file>.spec.ts
tests/e2e/<pillar>/<file>.spec.ts
```

## 3. Coverage & inventories

- [ ] `npm run qa:inventory` was run; `docs/qa/inventories/*.md` is up-to-date.
- [ ] `scripts/qa/check-coverage.ts` is green (no inventoried entity is
      orphaned).
- [ ] Any new route has a per-screen card at `docs/qa/per-screen/<slug>.md`
      with `Linked specs:` populated.
- [ ] Any new flow has a per-flow card at `docs/qa/per-flow/<slug>.md` with
      `Linked specs:` populated.
- [ ] `docs/qa/coverage-matrix.md` (screens × roles) is updated if a new
      screen, role, or permission boundary was added.

## 4. Hard-fail conditions cleared

Confirm none of the following tripped on the smoke run for this PR
(see [STANDARD.md §4](STANDARD.md#4-hard-fail-conditions-no-exceptions)):

- [ ] Zero browser console `error` messages.
- [ ] Zero React hydration warnings.
- [ ] Zero uncaught `TypeError` or other unhandled exceptions.
- [ ] Zero 5xx from any first-party route, tRPC procedure, or webhook.
- [ ] Zero axe-core `serious`/`critical` violations on touched routes.
- [ ] Zero PHI leakage on touched routes.
- [ ] Zero broken first-party links on touched routes.
- [ ] OpenAPI / tRPC contract snapshots match the shipped surface.
- [ ] No regression on `@hipaa`, `@ncqa`, `@cms-0057-f`, `@jc-npg-12` specs.

## 5. PHI / security

- [ ] New PHI fields use `encrypt`/`encryptOptional`.
- [ ] New PHI fields are excluded from public-API responses.
- [ ] New log statements that touch PHI go through the redaction path.
- [ ] New mutations write an audit row via `writeAuditLog`.
- [ ] New cross-tenant lookups verify the actor owns the resource.

## 6. Documentation

- [ ] `CHANGELOG.md` updated under `## [Unreleased]`.
- [ ] If architecture changed: ADR landed under `docs/dev/adr/`.
- [ ] If a stack/locked decision changed: `docs/system-prompt.md` updated.
- [ ] If user-visible behavior changed: `docs/user/` updated.
- [ ] If API surface changed: `docs/api/` and OpenAPI spec updated.
- [ ] `docs/status/blocked.md` updated if this change depends on human input.

## 7. If your run is red — Fix-Until-Green loop (BINDING)

> Per [STANDARD.md §4.1](STANDARD.md#41-failure-response-loop--fix-until-green-binding).
> A PR with red specs MAY NOT be marked done, MAY NOT be reported as passing,
> and MAY NOT be merged. Enter the loop below and stay in it until the pillar
> is green or the attempt cap (N=3) is reached.

For each failing spec or §4 hard-fail condition:

- [ ] **Capture** evidence: spec name + path, console error, stack trace,
      `trace.zip`, screenshot, video, network HAR (for any 5xx), browser, role,
      route at time of fail.
- [ ] **File a defect card** at `docs/qa/defects/DEF-####.md` using the
      template at `docs/qa/defects/_TEMPLATE.md`. Link the card from the PR.
- [ ] **Diagnose root cause.** Fix priority order:
      (a) production code → (b) genuinely-wrong assertion → (c) flaky fixture.
      Never weaken the assertion.
- [ ] **Apply minimum fix.** One root cause per commit. Update the DEF card
      with the fix.
- [ ] **Re-run the full pillar**, not just the single spec. The smoke
      pillar (A) is re-run on every fix regardless. Cross-cutting fixes
      (auth, layout, middleware, schema) require re-running every pillar that
      exercises the touched layer.
- [ ] **Loop until green** OR until 3 attempts on the same root cause have
      failed. After attempt 3: STOP, escalate to the user with the captured
      evidence, do **not** mark the PR done.

### 7.1 Anti-weakening — the fix you applied MUST NOT be any of these

(See [STANDARD.md §4.2](STANDARD.md#42-anti-weakening-rules-binding) for the
full list. Any one of these is, by itself, a violation.)

- [ ] I did **not** weaken the assertion (e.g. `toBe` → `toBeTruthy`).
- [ ] I did **not** delete, rename out of glob, `.skip`, `.todo`, `.fixme`,
      `xtest`, `xit`, or `describe.skip` the failing spec.
- [ ] I did **not** widen a selector (`locator('a')`, `getByRole('button')`
      without name, etc.) to dodge the assertion.
- [ ] I did **not** wrap the failing path in `try { } catch {}`,
      `.catch(() => {})`, `expect.soft`, `test.fail`, or any other swallow.
- [ ] I did **not** add `@ts-expect-error` or `// eslint-disable-next-line`
      to silence the type / lint signal that flagged the bug.
- [ ] I did **not** mock out the failing path with `vi.mock(...)` /
      `page.route(...)` bypass without proving the mock matches production.
- [ ] I did **not** raise a timeout (`test.setTimeout`, `waitForTimeout`)
      to mask a race.
- [ ] I did **not** soften strict equality to substring / regex match.
- [ ] I did **not** lower a coverage threshold in any pillar config.
- [ ] I did **not** edit `scripts/qa/check-coverage.ts` or pillar inventories
      to silence a complaint.

### 7.2 Loop exit checklist

A PR may exit the fix loop only when **all** of these are true:

- [ ] Every pillar I re-ran is green (zero failed specs, zero §4 hard-fail
      conditions, zero "Not Run" entries on covered specs).
- [ ] `scripts/qa/check-coverage.ts` is green.
- [ ] Every defect card opened during the loop is closed with a root-cause
      description and a link to the fix commit.
- [ ] The headline reporting block in §8 below reflects the green run.

If you exited the loop because you ran out of context, time, tokens, or
patience: that is **not** a legitimate exit. Escalate per §7 step 6.

## 8. Headline reporting block (paste into PR description)

```
Routes covered:    X of Y
Roles exercised:   X of N
Pillars touched:   <A–R IDs>
Pillars green:     <A–R IDs>
Pillars not run:   <A–R IDs — must be empty for release PRs>
Pass / Fail / Skip: P / F / S
```

A PR description without this block is incomplete and will be requested for
revision by `CODEOWNERS`.
