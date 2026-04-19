# HDPulseAI Standards — Prompt Library

> Canonical, copy-paste prompts for issuing work to **Cursor**,
> **VSCode + GitHub Copilot**, **Claude Code**, or any other AI agent
> running inside an HDPulseAI repo. Every prompt below applies the
> HDPulseAI QA Standard automatically because the propagation layers
> (`docs/standards/README.md`) make the standard binding on every
> agent invocation. The prompts you see here are the *task statements*
> — the standard wraps them.

Quick legend:

- **APPLY** prompts ask the agent to do work and meet the standard.
- **VERIFY** prompts ask the agent to prove the standard is met
  *without* changing code.
- Replace `<bracketed-placeholders>` with concrete values.
- Each prompt ends with an **acceptance block** the agent must
  satisfy; if it doesn't, push back with the matching VERIFY prompt.

---

## 0. Universal one-liners

### 0.1 The "default work request" prompt

Use this as the boilerplate when you don't have a more specific
prompt. It forces the standard at every hop.

> Apply the HDPulseAI QA Standard (see `docs/qa/STANDARD.md` in this
> repo, else `~/.cursor/rules/qa-standard-global.mdc`) to the
> following task: **<your task here>**.
>
> Required deliverables before you stop:
> 1. The change itself, satisfying every relevant pillar from A–S.
> 2. A spec under the relevant `tests/e2e/<pillar>/` folder, plus
>    per-screen and per-flow card updates.
> 3. The headline reporting block at the end of your response
>    (`Routes covered:`, `Roles exercised:`, `Live stack:`,
>    `migrations:`, `sign-in matrix:`, `dev-perf:`, `Pass/Fail/NotRun`,
>    `Pillars touched:`, `Hard-fails cleared:`).
> 4. Anti-weakening attestation per `STANDARD.md` §4.2.
> 5. A `Done.` line at the very end if (and only if) `npm run qa:gate`
>    (or the framework equivalent) is green.

### 0.2 The "verify standard" prompt

> Run `npm run qa:gate` (or the project's equivalent) plus
> `npm run qa:live-stack:full` and report the headline block exactly
> as defined in `STANDARD.md` §3 — no narrative, no editorialization,
> just the block. If any pillar A–S is `Not Run`, list it explicitly.

---

## 1. Testing prompts (Pillars A–S)

### 1.1 APPLY — "Add functional smoke coverage for `<route or flow>`" (Pillar A)

> Add a Pillar A spec covering `<route, e.g. /providers/[id]/edit>` for
> the `<role, e.g. Provider | Operations | Committee | RCM/Billing |
> Admin>` role. The spec must:
> - Live at `tests/e2e/A-functional-smoke/<slug>.spec.ts`.
> - Authenticate via the real CSRF sign-in helper, never a mocked
>   session.
> - Assert at least one positive path AND one negative path (auth
>   redirect, 403, validation failure).
> - Be added to the route's per-screen card under
>   `docs/qa/per-screen/<slug>.md` (`Linked specs:` field).
> - Be added to the relevant per-flow card under
>   `docs/qa/per-flow/<slug>.md` if the route is part of a multi-step
>   flow.
> Then run `npm run test:e2e -- A-functional-smoke` and paste the
> full headline reporting block. Do not mark `Done.` until the
> coverage gate (`npm run qa:check-coverage`) is also green.

### 1.2 APPLY — "Add a role-by-role auth coverage matrix entry" (Pillar B)

> Extend the Pillar B role-matrix spec at
> `tests/e2e/B-rbac/role-matrix.spec.ts` to cover `<route>`. For each
> of the five roles (Provider, Operations, Committee, RCM/Billing,
> Admin), assert the expected status (`200`, `302→/login`, `403`).
> The expected matrix MUST come from
> `docs/qa/policies/role-matrix.md`; if the policy is silent on this
> route, edit the policy first (and cite ADR or a stakeholder
> decision) before writing the spec. Run
> `npm run test:e2e -- B-rbac` and paste the headline block.

### 1.3 APPLY — "Add accessibility coverage for `<route>`" (Pillar E)

> Add a Pillar E axe-core spec at
> `tests/e2e/E-accessibility/<slug>.spec.ts` for `<route>` that:
> - Loads the page in the authenticated state for the role normally
>   on this surface.
> - Runs `axe.run()` and asserts zero `serious` and zero `critical`
>   violations.
> - Asserts the route has exactly one `<main>` landmark, at least one
>   `<h1>`, and that every interactive control has an accessible name
>   (`aria-label`, `aria-labelledby`, or visible label association).
> - Captures the axe report as a CI artifact under
>   `playwright-report-pillar-e/`.
> Run `npm run test:e2e -- E-accessibility` and paste the headline
> block. The hard-fail rule is unconditional — `serious`/`critical`
> = 0, no exceptions.

### 1.4 APPLY — "Add API contract coverage for `<endpoint>`" (Pillar J)

> Add a Pillar J contract spec at
> `tests/e2e/J-api-contract/<slug>.spec.ts` that:
> - Hits `<endpoint>` against the live dev stack with the role's real
>   CSRF session.
> - Asserts the response shape against the OpenAPI 3.1 spec at
>   `docs/api/openapi-v1.yaml`.
> - Verifies the `application/problem+json` shape on every error
>   path per RFC 9457.
> - Confirms the endpoint is registered in `route-inventory.json` with
>   the correct `group:` (`public` | `authenticated` | `admin`).
> If the OpenAPI spec disagrees with the response, that is a contract
> drift hard-fail (§4 condition 8) — fix the API or the spec, do not
> weaken the assertion. Run `npm run test:e2e -- J-api-contract`
> and paste the headline block.

### 1.5 APPLY — "Add a Pillar S live-stack probe for `<surface>`"

> Extend `scripts/qa/live-stack-smoke.mjs` to add a probe for
> `<surface>`. Choose the right surface bucket (1 bring-up, 2
> migrations, 3 sign-in matrix, 4 authenticated session, 5 anonymous
> public, 6 named-volume, 7 dev-perf). The probe MUST:
> - Hit the deployed running stack on `localhost:<port>`, not a mock.
> - Time out at 90 seconds and report `NOTRUN` (not `FAIL`) if Docker
>   itself is unreachable.
> - Compare against a deterministic invariant — never a "looks
>   reasonable" assertion.
> Run `npm run qa:live-stack:full` and paste the headline block,
> including the `Live stack: <SHA> | migrations: …` line.

### 1.6 VERIFY — "Show me everything we have for Pillar `<X>`"

> List every spec under `tests/e2e/<X>-*/`, every per-screen card
> that links to it, every per-flow card that links to it, and the
> latest run results from CI. Do not run new tests. Output as a
> markdown table with columns: Spec | Linked screens | Linked flows |
> Last result | Last duration.

---

## 2. Documentation prompts (Pillar Q)

### 2.1 APPLY — "Update all documentation to reflect `<change>`"

> Update every required document affected by **<change>**. Required
> documents are listed in `docs/README.md` under "Quick navigation"
> and include at minimum: `docs/system-prompt.md`,
> `docs/development-plan.md`,
> `docs/technical/technical-requirements.md`,
> `docs/technical/architecture.md`,
> `docs/business/business-requirements.md`,
> `docs/functional/functional-requirements.md`,
> `docs/qa/STANDARD.md` (only if the standard itself changed),
> `docs/qa/definition-of-done.md`,
> `docs/qa/README.md`,
> `docs/product/stakeholder-brief.md`,
> `docs/dev/adr/README.md` and a new ADR if the change is
> architectural,
> `CLAUDE.md`, `AGENTS.md`, root `README.md`,
> `.github/pull_request_template.md`,
> and the `CHANGELOG.md`.
>
> Also update any per-screen card under `docs/qa/per-screen/` and
> per-flow card under `docs/qa/per-flow/` whose surface this change
> touches.
>
> Anti-weakening: do NOT collapse historical version references in
> the changelog or in old phase descriptions. v1.2.0 in a 2026-04-18
> phase row is a fact; the doc-update sweep replaces it with v1.3.0
> only where the row describes the *current* state.
>
> Run `node scripts/forbidden-terms.mjs` and `npm run linkcheck`
> after the sweep; both must be green. Then output the headline
> block.

### 2.2 APPLY — "Open an ADR for `<decision>`"

> Open a new ADR under `docs/dev/adr/` using the next free number
> (look at the index in `docs/dev/adr/README.md`). The ADR MUST cover:
> - Context (the trigger, including any DEF-#### that exposed it).
> - Decision (the binding rule going forward, with anti-weakening
>   bullets).
> - Alternatives considered, with reasons rejected.
> - Consequences (positive and negative).
> - Validation evidence (real numbers from the live stack).
> Then update `docs/dev/adr/README.md` to include the new ADR and
> output the headline block.

### 2.3 VERIFY — "Audit documentation drift for `<area>`"

> Compare every required doc that touches `<area>` against the
> current code. List every drift you find with `path:line — claim
> vs. reality` rows. Do not fix anything; this is a read-only audit.
> Output as a markdown table.

---

## 3. UI/UX prompts (Pillars E + F + G)

### 3.1 APPLY — "Audit and fix UI/UX for `<route or component>`"

> Audit `<route or component>` against the HDPulseAI UI/UX standard
> in `docs/technical/architecture.md` §"Design system" and the
> Pillar E hard-fail rules. Specifically:
> - WCAG 2.1 AA color contrast on every text + interactive element.
> - Single `<main>` landmark, exactly one `<h1>`, semantic heading
>   order with no skipped levels.
> - Every interactive control has an accessible name AND a visible
>   focus ring.
> - Forms have inline validation messages (not just toast); errors
>   carry `aria-describedby`.
> - All async operations show a loading state and an error state in
>   addition to the success state.
> - Mobile (375 wide) and tablet (768 wide) layouts are not broken
>   (Pillar G).
> - No hard-coded raw color hex outside the design tokens (the
>   `no-raw-color` ESLint rule).
>
> Fix every issue you find. For each fix, update or add the relevant
> per-screen card under `docs/qa/per-screen/<slug>.md`. Then run
> `npm run test:e2e -- E-accessibility F-visual G-cross-browser`
> and paste the headline block.

### 3.2 APPLY — "Add a visual regression baseline for `<route>`" (Pillar F)

> Add a Pillar F visual regression spec at
> `tests/e2e/F-visual/<slug>.spec.ts` that snapshots `<route>` in
> Chromium, Firefox, and WebKit at the three default viewports
> (375, 768, 1440). Update the per-screen card to link the new
> spec. Run `npm run test:e2e -- F-visual --update-snapshots` ONCE
> to seed baselines, commit the baseline images, then re-run
> `npm run test:e2e -- F-visual` (without `--update-snapshots`) to
> confirm it passes against itself. Paste both headline blocks.

### 3.3 VERIFY — "Show me the UI/UX gaps on `<route>`"

> Open `<route>` in the live dev stack, run axe-core, capture
> screenshots at the three default viewports, and report every
> Pillar E or F issue. Do not fix anything. Output as a markdown
> table: Issue | Severity (axe) | Viewport | WCAG criterion | Fix
> hint.

---

## 4. Live-stack & dev-loop prompts (Pillar S)

### 4.1 APPLY — "Bring up the dev stack and verify Pillar S green"

> Run `docker compose -f docker-compose.dev.yml up -d`, wait for
> healthy, then run `npm run qa:live-stack:full`. Paste the full
> headline block including `Live stack: <SHA> | migrations: N
> pending | sign-in matrix: …` and the per-surface PASS/FAIL/NOTRUN
> table. If any surface is FAIL, open a defect card per
> `STANDARD.md` §4.1 and start the Fix-Until-Green loop (cap N=3).

### 4.2 APPLY — "Diagnose and fix slow dev-loop compile" (Pillar S Surface 7)

> Run `npm run dev:warm` against the live dev stack. Capture the
> per-route compile times from the warmer log. If any cold compile
> exceeds 2000 ms OR any re-fetch (warmed) compile exceeds 2000 ms,
> diagnose the root cause from these candidates:
> 1. Compiler regressed off Turbopack (check `package.json#scripts.dev`).
> 2. Dynamic-route warmer skipped a route family
>    (check `scripts/dev/warm-routes.mjs` and `route-inventory.json`).
> 3. `onDemandEntries` cache evicted before re-fetch
>    (check `next.config.mjs`).
> 4. A route's data layer regressed (check the route handler).
> Fix the root cause, NOT the budget. Re-run
> `npm run qa:live-stack:full --dev-perf` and paste the headline
> block. The dev-perf p95 line is required.

### 4.3 VERIFY — "Show me the dev-loop performance numbers"

> Run `npm run qa:live-stack:perf` (or `npm run qa:live-stack:full
> --dev-perf` for the full surface set). Output the per-route
> table: route | compile ms | re-fetch ms | budget ms | status.
> Highlight any row that exceeds 80% of the budget as `WATCH`.

---

## 5. Security & compliance prompts (Pillars I, P)

### 5.1 APPLY — "Run security scan for `<surface>` and fix critical findings" (Pillar I)

> Run `npm run security:dast -- --target <surface>` (or the project's
> ZAP/Burp equivalent). For every Critical or High finding, fix the
> underlying issue — never suppress. Update the per-screen card with
> the security control reference. Open a defect card with `Pillar:
> I` for any finding that takes more than one PR to close. Run
> `npm run test:e2e -- I-security` and paste the headline block.

### 5.2 APPLY — "Add HIPAA / NCQA / CMS-0057-F / Joint-Commission compliance tag for `<spec>`" (Pillar P)

> Tag `<spec>` with the relevant compliance annotations
> (`@hipaa`, `@ncqa`, `@cms-0057-f`, `@jc-npg-12`) per
> `docs/compliance/`. The annotation is binding: regression of a
> tagged spec is a §4 condition-9 hard-fail. Update
> `docs/compliance/control-mapping.md` to link the tag to the
> control it satisfies. Run `npm run test:e2e -- P-compliance` and
> paste the headline block.

---

## 6. Defect handling prompts

### 6.1 APPLY — "Open a defect card for `<failure>`"

> Open the next free defect card under `docs/qa/defects/DEF-####.md`
> (look at the index for the next number). Use `_TEMPLATE.md`. Fill
> in:
> - Metadata (severity, pillar, affected routes, affected roles,
>   browser, failing spec).
> - Captured evidence (verbatim console error, trace.zip, screenshot,
>   network HAR for any 5xx).
> - Hard-fail conditions tripped (check the boxes in the template).
> - Root-cause analysis (what was actually broken, not just the
>   symptom).
> - Fix-Until-Green attempts (cap N=3).
>
> Add the new card to `docs/qa/defects/index.md`. Do not mark
> `Closed (fixed)` until the §4.2 anti-weakening attestation is
> filled in.

### 6.2 APPLY — "Close DEF-####"

> Close DEF-#### per `STANDARD.md` §4.2. The card MUST contain:
> - Anti-weakening attestation with every box checked
>   appropriately (no `.skip`, no `.todo`, no `@ts-expect-error`,
>   no widening selectors, no swallowed errors, no raised timeouts,
>   no lowered coverage thresholds, no edits to
>   `scripts/qa/check-coverage.ts` or any inventory to silence).
> - The fix commit SHA.
> - The pillar(s) green again.
> - Any "forward-looking hardening" follow-ups.
> Update `docs/qa/defects/index.md` to flip the status to
> `**Closed (fixed)**`. Output the headline block from the gate
> that closed it.

---

## 7. Deploy prompts

### 7.1 APPLY — "Push, commit, and deploy"

> 1. Run `npm run qa:gate` AND `npm run qa:live-stack:full` against
>    the local dev stack. Both must be green.
> 2. Stage every file you intend to ship (`git add -A`), confirm
>    `git status --short` matches the change you mean to commit.
> 3. Write a commit message in the HDPulseAI Conventional Commit
>    format: `<type>(<scope>): <imperative summary>` on line 1, then
>    a body covering symptom, root cause, fix-and-why, verification
>    numbers, anti-weakening attestation (§4.2), defect-ledger
>    update (if any).
> 4. Commit with `git commit -F .git/COMMIT_MSG.tmp` (or `-m` for
>    short messages). NEVER use `--amend` on a pushed commit.
> 5. `git push origin master`.
> 6. `$env:ALLOW_DEPLOY = "1"; python .claude/deploy.py`.
> 7. After the deploy, hit `/api/health` and assert `200`. Output
>    the deploy log tail and the post-deploy container ps with
>    health status.
>
> If the deploy fails at the build step, treat it as a §4
> hard-fail: open the next free defect card, fix the root cause,
> commit + push the fix, re-deploy. Do not retry-deploy without a
> code change.

### 7.2 VERIFY — "Confirm production is healthy"

> Run `python .claude/deploy.py "cd /var/www/<repo> && docker
> compose -f docker-compose.prod.yml ps && curl -sS -o /dev/null
> -w '%{http_code}' http://localhost:<port>/api/health"`. Report
> container health status and the HTTP code. No code changes.

---

## 8. Cross-tool, cross-repo prompts

### 8.1 APPLY — "Bootstrap a new repo with the HDPulseAI standard"

> Run `node <path-to-E_Credentialing>/scripts/standards/bootstrap-repo.mjs
> <absolute-path-to-this-new-repo>` from any shell. This drops the
> per-repo forwarders for Cursor, GitHub Copilot, Claude Code,
> AGENTS.md, and `.vscode/settings.json`. Confirm by running
> `node <path-to-E_Credentialing>/scripts/standards/audit-propagation.mjs`
> and pasting the row for the new repo.

### 8.2 APPLY — "Re-bootstrap every HDPulseAI repo on this machine"

> Run `node scripts/standards/bootstrap-repo.mjs --all` from the
> `E_Credentialing` repo. Then run
> `node scripts/standards/bootstrap-vscode-user.mjs`. Then re-run
> `node scripts/standards/audit-propagation.mjs` and paste the
> updated table. Commit any changes inside the canonical repo only;
> per-repo forwarders in sibling repos are local opt-ins.

### 8.3 VERIFY — "Audit propagation across all repos"

> Run `node scripts/standards/audit-propagation.mjs`. Paste the
> table verbatim. For every repo where the standard does not resolve
> (no L1 in-repo, no L2 forwarders, no L3/L4 reachable), flag it
> as `RED` and propose a one-line bootstrap remediation.

---

## 9. The "kitchen-sink" prompt

When you want to hand the agent everything in one go and walk away
for a few hours, use this. It is the closest single prompt to "do
the work, the right way, and prove it."

> Apply the HDPulseAI QA Standard to the following work:
> **<your task>**.
>
> Do all of:
> 1. Read `docs/qa/STANDARD.md` (or
>    `~/.cursor/rules/qa-standard-global.mdc` if absent).
> 2. Read every doc the change might touch
>    (`docs/system-prompt.md`, `docs/development-plan.md`,
>    `docs/technical/*.md`, `docs/qa/per-screen/*.md`,
>    `docs/qa/per-flow/*.md`, `docs/dev/adr/*.md`).
> 3. Make a TodoWrite list of every concrete sub-task before you
>    start writing code.
> 4. Implement the change, satisfying every relevant pillar A–S.
> 5. Add or update at least one spec per pillar touched, plus the
>    per-screen and per-flow cards.
> 6. Run `npm run typecheck`, `npm run lint`, `npm run test:e2e`,
>    `npm run qa:gate`, and `npm run qa:live-stack:full`. Every gate
>    must end at exit 0.
> 7. If anything fails, open a defect card per `STANDARD.md` §4.1
>    and run the Fix-Until-Green loop (cap N=3). Do not weaken
>    assertions, do not skip tests, do not raise timeouts.
> 8. Update every affected required doc.
> 9. Commit in the HDPulseAI Conventional Commit format with the
>    full body (symptom, root cause, fix-and-why, verification
>    numbers, anti-weakening attestation, defect updates).
> 10. Push to `master` and (if deploy was requested) run
>     `$env:ALLOW_DEPLOY = "1"; python .claude/deploy.py`.
> 11. Output a single final summary that begins with the headline
>     block from `STANDARD.md` §3 and ends with `Done.` (and ONLY if
>     every gate is green and every required doc is current).
>
> Do not stop until step 11 is satisfied.

---

## 10. Footnotes

- The agent will sometimes try to skip Pillar S because "the change
  is just docs" or "just config". Push back: STANDARD.md §3 requires
  the headline block on every report regardless. The dev-perf line
  is the most often-omitted one — ask for it explicitly.
- VSCode + Copilot only respects `.github/copilot-instructions.md`
  if `github.copilot.chat.codeGeneration.useInstructionFiles` is
  `true` in user settings. The bootstrap script sets that key. If
  Copilot is ignoring the standard, run
  `node scripts/standards/bootstrap-vscode-user.mjs` again and
  reload VSCode.
- Cursor reloads global rules at startup; per-repo rules reload on
  every chat. If a per-repo rule change is not visible, restart the
  chat (`Ctrl+Shift+P` → `Cursor: New Chat`).
