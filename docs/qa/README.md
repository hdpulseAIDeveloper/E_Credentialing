# QA Documentation

**Audience:** QA engineers, developers writing tests, UAT participants, AI agents
acting on the codebase.

## Start here (BINDING)

| Document | Purpose |
|---|---|
| **[STANDARD.md](STANDARD.md)** | The HDPulseAI QA Standard — 18 testing pillars, hard-fail conditions, headline reporting rule, governance. Versioned. **This is the binding contract for every PR.** |
| **[definition-of-done.md](definition-of-done.md)** | The per-PR checklist derived from `STANDARD.md`. Every PR must satisfy it before merge. |

## Contents

| Document | Purpose |
|---|---|
| [Test Strategy](test-strategy.md) | Layers, coverage targets, tooling, environments |
| [Unit Testing Criteria](unit-testing.md) | What developers must test before merge |
| [Functional Testing Plan](functional-testing.md) | Module-by-module functional tests |
| [UAT Plan](uat-plan.md) | End-user acceptance criteria & scripts |
| [Defect Management](defect-management.md) | Severity, triage, SLAs |
| [Test Data Plan](test-data.md) | Fixtures, seeding, redaction |

## Operational artifacts (generated and curated)

| Path | Purpose |
|---|---|
| `docs/qa/inventories/route-inventory.md` | Auto-generated list of every route the app exposes |
| `docs/qa/inventories/link-inventory.md` | Auto-generated list of every first-party link rendered |
| `docs/qa/inventories/api-inventory.md` | Auto-generated list of every REST/HTTP endpoint |
| `docs/qa/inventories/trpc-inventory.md` | Auto-generated list of every tRPC procedure |
| `docs/qa/coverage-matrix.md` | Screens × 8 roles allow / redirect / 403 matrix |
| `docs/qa/per-screen/<slug>.md` | One card per route — required by `STANDARD.md` §5 |
| `docs/qa/per-flow/<slug>.md` | One card per user flow — required by `STANDARD.md` §5 |
| `docs/qa/defects/DEF-####.md` | Defect cards (one file per defect) |
| `docs/qa/results/<date>/SUMMARY.md` | Headline-formatted test report (coverage first) |

## Companion documents

- [testing/README.md](../testing/README.md) — Master Test Plan (XLSX) and execution log.
- [dev/testing.md](../dev/testing.md) — developer how-to (run tests, write tests).
- [testing/strategy.md](../testing/strategy.md) — original strategy reference.

## For AI agents (Claude, Cursor, others)

Before producing any code change in this repo:

1. Read [STANDARD.md](STANDARD.md) — the 18 pillars are not optional.
2. Read [definition-of-done.md](definition-of-done.md) — your PR description
   must include the headline reporting block at the end of the DoD.
3. Read the project-level Cursor rule `.cursor/rules/qa-standard.mdc` and the
   root `AGENTS.md` for tool-agnostic agent expectations.
4. Treat any browser console error, hydration warning, or
   `Cannot read properties of undefined (reading 'call')` as a **hard failure**
   (`STANDARD.md` §4) — never as a warning to be reported.
