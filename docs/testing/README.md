# Testing Strategy

This section documents the testing approach, coverage, and plans.

## Master Test Plan (XLSX)

The authoritative, executable QA tool for end-to-end manual + exploratory testing
lives in this folder as a timestamped Excel workbook:

- **Latest**: `ESSEN_Credentialing_Master_Test_Plan_<YYYYMMDD_HHMMSS>.xlsx`
- **Generator**: `generate_master_test_plan.py` — re-run after every release to
  regenerate a fresh, dated copy. Never overwrite history.

The workbook contains:

| Sheet | Purpose |
|-------|---------|
| Cover | Document metadata, mission, sign-off slots |
| Strategy | Scope, layers, types, roles, risk-based prioritization, exit criteria |
| Approach & Pattern | The 10-step streamlined execution pattern testers follow |
| Coverage Matrix | Module × Test-Type counts (Functional, Negative, Boundary, Security, UI, UX, A11y, Performance, Integration, API, Data, Regression) |
| Master Test Plan | The checklist — 250+ rows with ID, module, type, priority, role, title, preconditions, steps, inputs, expected, why-it-matters, and placeholders for actual/status/defect/tester/date/notes |
| Defect Log | 200 pre-formatted rows with severity/priority/status dropdowns and conditional formatting |
| Sign-off | Auto-counts pass/fail/blocked from the test plan; release recommendation; exec sign-off slots |

To regenerate:

```powershell
C:/Users/admin/AppData/Local/Programs/Python/Python313/python.exe `
  docs/testing/generate_master_test_plan.py
```

## Automated execution

`run_master_test_plan.py` loads the most recent (non-EXECUTED) Master Test
Plan, executes every check it can automate against the live
`http://localhost:6015` + `http://localhost:6025` instance, and writes the
results back into a new dated workbook:

- **Output**: `ESSEN_Credentialing_Master_Test_Plan_EXECUTED_<YYYYMMDD_HHMMSS>.xlsx`
- For each row the runner sets **Actual Result**, **Status** (Pass / Fail /
  Blocked / Not Run), **Tester** = `Auto-Runner`, **Test Date**, and **Notes**
  with a short rationale + evidence pointer.
- A condensed Markdown summary is written to
  `TEST_EXECUTION_REPORT_<YYYYMMDD>.md` after each meaningful run.

To execute:

```powershell
C:/Users/admin/AppData/Local/Programs/Python/Python313/python.exe `
  docs/testing/run_master_test_plan.py
```

The runner is idempotent and read-only against the database (no destructive
calls). Re-run as often as you like.

What it covers automatically:
container health, Prisma client/schema sync, migrations, all `/api/*` health
endpoints, FHIR `CapabilityStatement`, public REST API auth, security
headers, dev-mode cache headers, webhook signature enforcement, audit table
presence, PHI log redaction, dashboard P50/P95 latency, /providers burst
load, hydration mismatch detection in container logs, and page metadata.

What stays manual: anything that needs an authenticated browser session,
external sandbox systems (CAQH/NPDB/eMedNY/SendGrid live), drag-and-drop
UI, time-shifted scenarios, screen-reader / WCAG visual review, and
cross-browser smoke. ~86% of the plan falls into this bucket — the runner
marks them **Not Run** with a reason so a human tester can pick them up.

## Contents

- [Test strategy](strategy.md)
- [Unit tests](unit-tests.md)
- [Integration tests](integration-tests.md)
- [E2E plan](e2e-plan.md)
- [Performance & load](performance.md)
- [Accessibility](accessibility.md)
- [Security testing](security.md)
- [Manual test plans](manual-test-plans.md)

See also: [developer testing reference](../dev/testing.md) for day-to-day commands.

## Current coverage floors

Enforced in `vitest.config.ts`:

- Lines: 60%
- Functions: 50%
- Branches: 50%
- Statements: 60%

Targets (to be raised over time):

- Lines: 85%
- Functions: 80%
- Branches: 75%
- Statements: 85%

## CI enforcement

Every PR runs:

- Typecheck
- ESLint
- Vitest unit + integration with coverage
- Playwright E2E
- Accessibility checks
- Forbidden-terms lint on user-facing docs
- CodeQL security analysis
- Dependency review
- Gitleaks secret scanning
