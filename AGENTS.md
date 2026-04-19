# AGENTS.md

**Audience:** every AI coding agent operating on this repository — Claude Code,
Cursor, Codex, OpenAI Operator, Gemini CLI, Aider, or any future tool. This is
the tool-agnostic counterpart to `CLAUDE.md` (which is the same instructions
addressed specifically to Claude Code).

If you are an agent and you are reading this, treat every clause as binding
unless the user explicitly overrides it in the current session.

---

## 1. Read order before any change

1. [`CLAUDE.md`](CLAUDE.md) — repo overview, domain glossary, commands, prod
   deploy workflow.
2. [`docs/qa/STANDARD.md`](docs/qa/STANDARD.md) — the **HDPulseAI QA Standard**.
   This is the binding contract for tests.
3. [`docs/qa/definition-of-done.md`](docs/qa/definition-of-done.md) — the per-PR
   checklist. Your work is not complete until every box applies or is marked
   `n/a — <reason>`.
4. [`docs/system-prompt.md`](docs/system-prompt.md) — locked tech-stack and
   architecture decisions; quality bar.
5. [`docs/status/blocked.md`](docs/status/blocked.md) — anything currently
   blocked on a human input.

If you find a conflict between these documents, `STANDARD.md` and
`docs/system-prompt.md` win, and you must surface the conflict to the user.

---

## 2. The testing standard, in one screen

Every change MUST:

- map to at least one of the **19 pillars (A–S)** in `STANDARD.md` §2.
  Pillar S — Live-Stack Reality Gate — was added 2026-04-19 by
  [ADR 0028](docs/dev/adr/0028-live-stack-reality-gate.md) and grew
  Surface 7 (dev-loop performance invariant) by
  [ADR 0029](docs/dev/adr/0029-dev-loop-performance-baseline.md).
- have at least one spec under the pillar's folder
  (`tests/e2e/<pillar>/**`, `tests/contract/**`, `tests/e2e/live-stack/**`, etc.),
- regenerate inventories via `npm run qa:inventory`,
- keep `scripts/qa/check-coverage.ts` green,
- add a per-screen card (`docs/qa/per-screen/<slug>.md`) for any new route,
- add a per-flow card (`docs/qa/per-flow/<slug>.md`) for any new user flow,
- pass the §4 hard-fail conditions (no console errors, no hydration warnings,
  no 5xx, no PHI leakage, no broken first-party links, no pending Prisma
  migrations, no dead seed account, no cold Dockerfile rebuild failure,
  no named-volume staleness, **no lazy-compile dev-loop regression**),
- be reported using the **headline reporting block** from `STANDARD.md` §3:

  ```
  Routes covered:    X of Y
  Roles exercised:   X of N
  Pillars touched:   <A–S IDs>
  Pillars green:     <A–S IDs>
  Pillars not run:   <A–S IDs>      (must be empty for release)
  Live stack:        <commit SHA running in container> | migrations: 0 pending | sign-in matrix: ADMIN/MANAGER/SPECIALIST/COMMITTEE_MEMBER all green | dev-perf: p100 <Nms> (<2000ms budget)
  Pass / Fail / Skip: P / F / S
  ```

A pass/fail count without a coverage line is **not** a valid report. Any "Not
Run" entry for a covered pillar counts as a **fail** of the gate.

---

## 3. Hard-fail conditions you must never silence

(`STANDARD.md` §4 — copied here so you cannot miss them.)

1. Any browser console `error`.
2. Any React hydration warning.
3. Any uncaught `TypeError: Cannot read properties of undefined (reading 'call')`
   or other unhandled exception.
4. Any 5xx from a first-party route, tRPC procedure, or webhook.
5. Any axe-core `serious`/`critical` violation on a touched route.
6. Any PHI field (SSN, DOB, home address, raw DEA) appearing in a response
   served to a role that should not see it.
7. Any broken first-party link.
8. Any contract drift in OpenAPI / tRPC snapshots.
9. Any compliance-tagged regression (`@hipaa`, `@ncqa`, `@cms-0057-f`,
   `@jc-npg-12`).
10. `scripts/qa/check-coverage.ts` reporting any orphaned route, link, API,
    tRPC procedure, bot, webhook, job, or form.
11. **Pending Prisma migrations** against the dev DB (`npm run qa:migrations`
    — Pillar S Surface 2).
12. **Any seeded staff role unable to sign in** via the live CSRF +
    `/api/auth/callback/credentials` round-trip on the deployed stack
    (`npm run qa:live-stack` — Pillar S Surface 3).
13. **Cold Dockerfile rebuild failure** for any app service in any compose
    file (`npm run qa:dockerfile -- --cold` — Pillar S Surface 6 prerequisite).
14. **Named-volume staleness** — host `prisma/schema.prisma` SHA1 ≠ container
    `node_modules/.prisma/client/schema.prisma` SHA1, OR
    `.next/build-manifest.json` older than the latest `master` commit
    (Pillar S Surface 6).
15. **Lazy-compile dev-loop regression** — Pillar S Surface 7 measured
    re-fetch p100 > 2000 ms across the warmed deterministic route mix
    (`npm run qa:live-stack:perf`). The structural baseline is binding:
    `next dev --turbo` is the default compiler; `npm run dev:warm` is the
    dev container command and warms every static AND every dynamic route
    in `route-inventory.json`; `next.config.mjs` sets
    `onDemandEntries: { maxInactiveAge: 24h, pagesBufferLength: 200 }`.
    See ADR 0029 / DEF-0014 / STANDARD.md §11.

If your spec passes but one of these conditions fired during the run, mark the
spec as failing and fix the condition. Do not file it as a "warning" or a
"known issue".

---

## 4. PR description template (paste this every time)

```
## Summary
<what changed and why>

## Pillars touched (STANDARD.md §2)
- [ ] A — Functional smoke
- [ ] B — RBAC
- [ ] C — PHI scope
- [ ] D — E2E flows
- [ ] E — Accessibility
- [ ] F — Visual regression
- [ ] G — Cross-browser / responsive
- [ ] H — Performance / load
- [ ] I — Security / DAST
- [ ] J — API contract
- [ ] K — External integrations
- [ ] L — Time-shifted
- [ ] M — Data integrity / DR
- [ ] N — Concurrency / resilience
- [ ] O — Files / email / SMS / print / PDF
- [ ] P — Compliance
- [ ] Q — Documentation integrity
- [ ] R — Observability

## New / updated specs
- tests/e2e/<pillar>/<file>.spec.ts
- tests/contract/<file>.spec.ts

## QA report (headline first, per STANDARD.md §3)
Routes covered:    X of Y
Roles exercised:   X of N
Pillars touched:   <A–S IDs>
Pillars green:     <A–S IDs>
Pillars not run:   <A–S IDs>
Live stack:        <commit SHA running in container> | migrations: 0 pending | sign-in matrix: ADMIN/MANAGER/SPECIALIST/COMMITTEE_MEMBER all green | dev-perf: p100 <Nms> (<2000ms budget)
Pass / Fail / Skip: P / F / S

## Per-screen / per-flow cards
- docs/qa/per-screen/<slug>.md
- docs/qa/per-flow/<slug>.md

## Definition of Done
See docs/qa/definition-of-done.md — every box checked or annotated `n/a`.
```

---

## 4.1 Fix-Until-Green loop (BINDING — `docs/qa/STANDARD.md` §4.1)

If any spec fails or any §3 hard-fail condition fires, you MUST enter this
loop and stay in it until the pillar is green. You MUST NOT report results,
mark the work done, or hand the branch back while red.

```
Capture evidence → File DEF card → Diagnose root cause →
Apply minimum fix → Re-run the FULL pillar → green? exit. red? loop.
```

Required at each step:

1. **Capture**: spec name + path, console error, stack trace, `trace.zip`,
   screenshot, video, network HAR (for any 5xx), browser, role, route.
2. **File DEF card** at `docs/qa/defects/DEF-####.md` (template at
   `docs/qa/defects/_TEMPLATE.md`). Link from the PR.
3. **Diagnose**. Fix priority: (a) production code → (b) genuinely-wrong
   assertion → (c) flaky fixture. Never weaken the assertion.
4. **Apply minimum fix.** One root cause per commit. Update the DEF card.
5. **Re-run the full pillar.** Not just the single spec. The smoke pillar (A)
   re-runs on every fix regardless. Cross-cutting fixes (auth / layout /
   middleware / schema) re-run every pillar that exercises the touched layer.
6. **Loop** until green OR until 3 attempts on the same root cause have
   failed.

**Attempt cap: N=3 per root cause.** After 3 unsuccessful attempts on the
same root cause: STOP. Update the DEF card with every attempt and every
output. Escalate to the user with the evidence. Do **not** mark the work
done. Do **not** report green.

A loop that exits because you ran out of context, time, tokens, or patience
is **not** a legitimate exit. Escalate.

### 4.2 Anti-weakening — never use any of these to "fix" a red spec

(`docs/qa/STANDARD.md` §4.2 — full list. Each one is, by itself, a violation
and grounds for revert.)

- Weakening assertions (`toBe` → `toBeTruthy`, `toHaveLength(N)` →
  `toBeGreaterThan(0)`, etc.).
- Deleting / renaming out of glob / `.skip` / `.todo` / `.fixme` / `xtest` /
  `xit` / `describe.skip` the spec.
- Widening selectors (`page.locator('a')`, `getByRole('button')` without
  name) to dodge the assertion.
- Swallowing errors (`try { } catch {}`, `.catch(() => {})`, `expect.soft`,
  `test.fail`).
- Silencing the signal with `@ts-expect-error` or
  `eslint-disable-next-line`.
- Mocking out the failing path without proving the mock matches production.
- Raising timeouts to mask races.
- Softening strict equality to substring / regex.
- Lowering a coverage threshold in any config.
- Editing `scripts/qa/check-coverage.ts` or pillar inventories to silence a
  complaint.

The only legitimate fixes: (1) fix the production code, (2) fix a
genuinely-wrong assertion (cite the doc / ADR in the DEF card),
(3) fix a flaky fixture (prove with 3 consecutive green runs in the DEF
card).

---

## 5. When the user says "test the app", "run QA", or similar

Default behavior:

1. Re-read `STANDARD.md` and the four inventory files under
   `docs/qa/inventories/`.
2. Run `npm run qa:inventory` first; abort if it fails.
3. Run the smoke pillar (A) across every inventoried route, in a real browser,
   for every role. Record console output, hydration warnings, and network 5xx.
4. Produce the headline reporting block from §3 BEFORE producing per-spec
   pass/fail. The block goes at the TOP of your final message.
5. Any "Not Run" entry is a fail of the gate. Say so explicitly.

If you cannot run the browser layer in this environment, say so explicitly,
do not fall back to an HTTP-only probe and call it "passing". The
HTTP-only probe failure mode is named in `STANDARD.md` §10 and is the reason
this standard exists.

---

## 6. When you finish a feature

Before you say "done":

- [ ] At least one new spec exists under the right pillar's folder.
- [ ] `scripts/qa/check-coverage.ts` is green.
- [ ] Per-screen card exists for any new route.
- [ ] Per-flow card exists for any new user flow.
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`.
- [ ] PR description includes the §4 template above.

---

## 7. Forbidden behavior

You MUST NOT:

- Mark a feature "tested" without automation AND a per-screen / per-flow card.
- Report "all tests pass" without quoting the headline block from §3.
- Silently treat a console error, hydration warning, 5xx, or PHI leak as a
  warning.
- Add a code path that bypasses the audit log for any mutation.
- Add a code path that returns PHI to the public API or to roles that should
  not see it (Operations, RCM/Billing, providers viewing other providers).
- Push to `master` without satisfying the Definition of Done.

---

## 8. How to evolve this file

If you, the agent, believe a clause is wrong or incomplete: **do not change
the rule on your own**. Surface it to the user, propose an ADR under
`docs/dev/adr/`, and only edit this file (and `CLAUDE.md`,
`docs/qa/STANDARD.md`, `.cursor/rules/qa-standard.mdc`,
`~/.cursor/rules/qa-standard-global.mdc`) once the user approves. Bump
`STANDARD.md`'s `Version:` line per its §11.
