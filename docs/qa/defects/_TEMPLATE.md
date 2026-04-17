# DEF-#### — <one-line title of the defect>

> Copy this file to `docs/qa/defects/DEF-####.md` (next free number from
> `index.md`) when you open a defect during the Fix-Until-Green loop
> (`docs/qa/STANDARD.md` §4.1).

## Metadata

- **DEF ID:**            DEF-####
- **Opened:**            YYYY-MM-DD by <agent or human handle>
- **Severity:**          critical | high | medium | low
- **Pillar (A–R):**      A — Functional smoke   (etc.)
- **Affected route(s):** /…
- **Affected role(s):**  Provider | Operations | Committee | RCM/Billing | Admin | …
- **Browser:**           Chromium | Firefox | WebKit | all
- **Spec(s) failing:**   tests/e2e/<pillar>/<file>.spec.ts:<line>
- **Linked PR:**         #<n>
- **Linked per-screen card:** docs/qa/per-screen/<slug>.md
- **Linked per-flow card:**   docs/qa/per-flow/<slug>.md
- **Status:**            Open | In progress | Fixed | Wont-fix | Escalated

## Captured evidence (REQUIRED — per STANDARD.md §4.1 step 1)

- Console error / stack trace:

  ```
  <paste verbatim>
  ```

- Trace.zip path (CI artifact):              `playwright-report-…/trace.zip`
- Screenshot path:                           `test-results/.../screenshot.png`
- Video path:                                `test-results/.../video.webm`
- Network HAR (for any 5xx):                 `test-results/.../network.har`
- Hard-fail condition tripped (STANDARD.md §4):
  - [ ] §4.1 console error
  - [ ] §4.2 hydration warning
  - [ ] §4.3 uncaught TypeError / unhandled exception
  - [ ] §4.4 5xx
  - [ ] §4.5 axe serious/critical
  - [ ] §4.6 PHI leakage
  - [ ] §4.7 broken first-party link
  - [ ] §4.8 contract drift
  - [ ] §4.9 compliance regression (`@hipaa` / `@ncqa` / `@cms-0057-f` / `@jc-npg-12`)
  - [ ] §4.10 orphaned inventory entry

## Root-cause analysis

<what was actually broken — not just the symptom>

## Fix-Until-Green attempts (STANDARD.md §4.1.1 — cap N=3)

### Attempt 1 — YYYY-MM-DD HH:MM by <handle>

- Hypothesis:
- Fix applied (commit SHA):
- Pillar(s) re-run:
- Result: green | red
- Output excerpt:

  ```
  <paste>
  ```

### Attempt 2 — YYYY-MM-DD HH:MM by <handle>

- Hypothesis:
- Fix applied (commit SHA):
- Pillar(s) re-run:
- Result: green | red

### Attempt 3 — YYYY-MM-DD HH:MM by <handle>

- Hypothesis:
- Fix applied (commit SHA):
- Pillar(s) re-run:
- Result: green | red

> **If attempt 3 is also red:** STOP. Do not loop again. Update the section
> below and escalate to the user.

## Escalation (only if 3 attempts failed on the same root cause)

- Escalated:        YYYY-MM-DD HH:MM by <handle>
- Best hypothesis:
- Recommended next step (architectural / out-of-band investigation / …):
- Specs left disabled?  **NO** — disabling specs to ship green is forbidden
  (STANDARD.md §4.2). The pillar stays red until the user decides.

## Anti-weakening attestation (REQUIRED on close — STANDARD.md §4.2)

The contributor closing this card attests that the fix did NOT use any of:

- [ ] weakening assertions
- [ ] deleting / renaming / `.skip` / `.todo` / `.fixme` / `xtest` / `xit` /
      `describe.skip`
- [ ] widening selectors to dodge assertions
- [ ] swallowing errors (`try { } catch {}`, `.catch(() => {})`,
      `expect.soft`, `test.fail`)
- [ ] `@ts-expect-error` / `eslint-disable-next-line`
- [ ] mocking the failing path without proving the mock matches production
- [ ] raising timeouts to mask races
- [ ] softening strict equality to substring / regex
- [ ] lowering coverage thresholds
- [ ] editing `scripts/qa/check-coverage.ts` or inventories to silence

The fix used:

- [ ] (1) production code fix
- [ ] (2) corrected assertion — cite doc/ADR: __________________
- [ ] (3) flaky-fixture fix — 3 consecutive green runs recorded:
      run 1 ___, run 2 ___, run 3 ___

## Closure

- **Closed:**       YYYY-MM-DD by <handle>
- **Fix commit:**   <SHA>
- **Pillar(s) green again:** A | …
- **Per-screen / per-flow card updated:** [ ] yes
