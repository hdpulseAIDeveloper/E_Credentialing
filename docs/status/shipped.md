# Shipped — Wave-by-Wave Delivery Index (Phase 1.5)

**Status:** Required reference. Append-only.
**Audience:** Tech Lead, PM, Sponsors, Auditors, Future Engineers.
**Last updated:** 2026-04-18

This file is the canonical index of what was delivered during the
Phase 1.5 Commercial-Readiness Band (Waves 0–6) of the local
"unblock + commercialize" Cursor plan. Every wave below was authored
autonomously by the Cursor agent on 2026-04-16…2026-04-18, committed
and pushed to `master`, with **zero production deploys**.

If you need to know what version of any feature is on disk, the
[CHANGELOG.md](../../CHANGELOG.md) is the source of truth. This file
is the *roadmap-to-reality* cross-reference: it ties each wave to its
ADR, runbook, ops script, defect card, and per-screen card.

For the engineering plan that produced these waves, see
[`docs/development-plan.md`](../development-plan.md) §2.5.

---

## Wave 0 — Unblock the blockers (2026-04-18)

**Goal:** Convert every B-001…B-011 blocker from "human action
required, no automation" into either (a) a one-shot resolver script,
or (b) a single yes/no decision for the named owner.

| Deliverable | File | Closes |
|---|---|---|
| Production-server SSH recovery | [`scripts/ops/prod-recover.py`](../../scripts/ops/prod-recover.py) | B-001 |
| First-time `prisma migrate deploy` bootstrap | [`scripts/ops/prod-migrate-bootstrap.py`](../../scripts/ops/prod-migrate-bootstrap.py) | B-009a, B-010, B-011 |
| Production `.env` doctor (names only, never values) | [`scripts/ops/prod-env-doctor.py`](../../scripts/ops/prod-env-doctor.py) | B-009 |
| TLS bootstrap (certbot + nginx) | [`scripts/ops/prod-tls-bootstrap.py`](../../scripts/ops/prod-tls-bootstrap.py) | B-008 |
| TLS posture verifier (cert validity, expiry, HSTS) | [`scripts/ops/prod-tls-check.py`](../../scripts/ops/prod-tls-check.py) | B-008 |
| Azure Blob private-only verifier | [`scripts/azure/verify-blob-private.ts`](../../scripts/azure/verify-blob-private.ts) | B-002 |
| Entra ID MFA-policy verifier (read-only Graph) | [`scripts/ops/entra-mfa-status.py`](../../scripts/ops/entra-mfa-status.py) | B-004 |
| Typed Key Vault `SECRETS` catalog | [`src/lib/secrets/index.ts`](../../src/lib/secrets/index.ts) + [unit test](../../tests/unit/lib/secrets/index.test.ts) | B-005 |
| NCQA criterion baseline (`v0-public-baseline`, 30 rows) | [`scripts/seed/ncqa-baseline.csv`](../../scripts/seed/ncqa-baseline.csv) | B-006 |
| Legal review packet builder | [`scripts/legal/build-review-packet.ts`](../../scripts/legal/build-review-packet.ts) | B-007 |

Status reference: [`docs/status/resolved.md`](resolved.md) §"Wave 0 unblock pass".

---

## Wave 1 — QA gate solidified (2026-04-18)

**Goal:** Stop the QA gate from being optional. Real production-bundle
E2E, every pillar at least one spec, every route a per-screen card.

| Deliverable | File | Notes |
|---|---|---|
| Production-bundle E2E orchestrator | [`scripts/qa/e2e-prod-bundle.mjs`](../../scripts/qa/e2e-prod-bundle.mjs) + [`playwright.prod.config.ts`](../../playwright.prod.config.ts) | Closes [DEF-INFRA-0001](../qa/defects/DEF-INFRA-0001.md) — no more `next dev` flake. |
| Pillar specs C/D/F/G/H/I/J/K/L/M/N/O/P/Q/R | `tests/e2e/**`, `tests/contract/**`, `tests/perf/**`, `tests/security/**`, `tests/data/**`, `tests/observability/**`, `tests/docs/**`, `tests/external/**` | Pillars no longer "Not run". |
| Per-screen card scaffolder + 60-card backfill | [`scripts/qa/scaffold-cards.ts`](../../scripts/qa/scaffold-cards.ts), [`docs/qa/per-screen/`](../qa/per-screen/) | One card per inventoried route. |
| Coverage gate fails on zero-spec pillars + missing cards | [`scripts/qa/check-coverage.ts`](../../scripts/qa/check-coverage.ts) | NOT-RUN ≠ PASS. |

---

## Wave 2 — Architecture cleanup + design system (2026-04-18)

**Goal:** Pay down architectural debt before piling more features on
top. Move PHI-touching logic into testable services; introduce a real
design system with anti-weakening guardrails.

| Deliverable | File | Notes |
|---|---|---|
| `DocumentService`, `BotService`, `SanctionsService`, `RecredentialingService`, `RosterService` | [`src/server/services/`](../../src/server/services/) | Routers now thin pass-throughs. |
| TanStack-powered `<DataTable>` v2 | [`src/components/ui/data-table.tsx`](../../src/components/ui/data-table.tsx) + [tests](../../tests/unit/components/data-table.test.tsx) | Sortable, filterable, virtualized. |
| `ThemeProvider` + `ThemeToggle` (light/dark/system) | [`src/components/theme-provider.tsx`](../../src/components/theme-provider.tsx) + [`src/components/ui/theme-toggle.tsx`](../../src/components/ui/theme-toggle.tsx) + [tests](../../tests/unit/components/theme-provider.test.tsx) | Wired into `app/layout.tsx`. |
| `no-raw-color` ESLint rule + RuleTester suite | [`eslint-rules/no-raw-color.js`](../../eslint-rules/no-raw-color.js) | Hex/rgb in `className` is a build error. |
| Lite Storybook (CSF + render harness) | [`stories/`](../../stories/) + [`tests/unit/stories/render-stories.test.tsx`](../../tests/unit/stories/render-stories.test.tsx) | Every story renders without throwing in CI. |
| ADR | [`docs/dev/adr/0015-design-system.md`](../dev/adr/0015-design-system.md) | |

---

## Wave 3 — Compliance polish (2026-04-18)

**Goal:** Take the regulated surfaces (Joint Commission, NCQA, FHIR,
telehealth, expirables) from "P0 in place" to "auditor-defensible".

| Sub-wave | Theme | Headlines |
|---|---|---|
| 3.1 | OPPE/FPPE polish + Joint Commission NPG-12 | New per-flow card [`docs/qa/per-flow/oppe-fppe-cycle.md`](../qa/per-flow/oppe-fppe-cycle.md) and matching e2e spec. |
| 3.2 | CME aggregator + auto-generated CV PDF | [`/api/v1/providers/:id/cv.pdf`](../../src/app/api/v1/providers/[id]/cv.pdf/route.ts) renders deterministic, signature-friendly CVs via `pdf-lib`. |
| 3.3 | FHIR R4 directory expansion | `HealthcareService`, `InsurancePlan`, instance-level `$everything`, refreshed `CapabilityStatement` (CMS-0057-F / DaVinci PDex Plan-Net IG). See [`docs/compliance/cms-0057.md`](../compliance/cms-0057.md). |
| 3.4 | Telehealth coverage gaps + IMLC LoQ + Expirables wiring | Coverage-gap UI on the telehealth dashboard; IMLC Letter-of-Qualification surfaced in the expirables daily outreach. |

---

## Wave 4 — Observability, perf, security, IaC (2026-04-18)

**Goal:** Make the platform operable: see it, prove it scales, prove
it's secure, and stand it up reproducibly.

| Sub-wave | Theme | Headlines |
|---|---|---|
| 4.1 | Telemetry stack | Sentry + Application Insights + Prometheus (`prom-client`) + Grafana dashboard. ADR [0013](../dev/adr/0013-observability-stack.md). [`docs/dev/observability.md`](../dev/observability.md). |
| 4.2 | Performance baseline | k6 perf suites under [`tests/perf/`](../../tests/perf/); Postgres index audit captured in [`docs/dev/performance.md`](../dev/performance.md). |
| 4.3 | Security baseline | OWASP ZAP baseline + active scans (`scripts/qa/zap-*`); gitleaks pre-commit hook; CI job on PRs. |
| 4.4 | Visual regression | Per-browser Playwright baselines under [`tests/e2e/visual/__screenshots__/`](../../tests/e2e/visual/). |
| 4.5 | Infra-as-Code | Full Azure Bicep modules under [`infra/`](../../infra/) ([`main.bicep`](../../infra/main.bicep) + [`modules/`](../../infra/modules/)); `azd up` provisions Container Apps, Postgres Flexible Server, Cache for Redis, Key Vault, ACR, Log Analytics. |

---

## Wave 5 — Commercial readiness (2026-04-18)

**Goal:** Take the platform from "internal product" to "managed CVO
service we can sell". Everything new ships behind a feature flag so
the existing customer is unaffected on the next deploy.

| Sub-wave | Theme | Headlines |
|---|---|---|
| 5.1 | Multi-tenancy shim | `Organization` model, `AsyncLocalStorage` tenant scoping, Prisma extensions enforcing `organizationId` on every read/write. ADR [0014](../dev/adr/0014-multi-tenancy-shim.md). Feature flag `MULTI_TENANT_ENABLED`. |
| 5.2 | Public marketing surfaces | Re-skinned marketing landing as the CVO platform; `/cvo` explainer page; `/pricing` (3 tiers); `/sandbox` interactive REST API explorer. Per-screen cards under [`docs/qa/per-screen/`](../qa/per-screen/). |
| 5.3 | Stripe billing scaffolding | Optional `stripe` SDK loaded dynamically; webhook receiver at `/api/webhooks/stripe`; `BILLING_ENABLED` feature flag. ADR [0016](../dev/adr/0016-stripe-billing.md). |
| 5.4 | Auditor-package one-click export | ZIP bundle of NCQA assessments, audit-log proofs, policy versions, and a SOC 2 Type I gap analysis. ADR [0017](../dev/adr/0017-auditor-package.md). |
| 5.5 | Public `/changelog` + RSS feed | Curated customer-facing release notes from a hand-edited Markdown source; `/changelog.rss` is RSS 2.0. ADR [0018](../dev/adr/0018-public-changelog.md). [Pillar U](../qa/per-pillar/pillar-u-changelog.md). |
| Cross-cutting | CVO positioning sweep | Eleven core docs re-titled and re-introduced as the "E-Credentialing CVO Platform". |

---

## Wave 6 — Iterator-aware coverage gate (2026-04-18)

**Goal:** Make the long-broken coverage gate honest enough to reach
PASS without lowering any threshold.

| Deliverable | File | Notes |
|---|---|---|
| Pure iterator detection helper | [`scripts/qa/iterator-coverage.ts`](../../scripts/qa/iterator-coverage.ts) | Imports + iteration construct = covers every entry. |
| Wired into the gate | [`scripts/qa/check-coverage.ts`](../../scripts/qa/check-coverage.ts) | ORs with the existing string-literal path. |
| 878 named per-procedure tRPC tests | [`tests/contract/pillar-j-trpc-iterator.spec.ts`](../../tests/contract/pillar-j-trpc-iterator.spec.ts) | `describe.each` over `trpc-inventory.json`. |
| 186 named per-cell API tests | [`tests/contract/pillar-j-api-iterator.spec.ts`](../../tests/contract/pillar-j-api-iterator.spec.ts) | `describe.each` over `api-inventory.json`. |
| 9 unit tests pinning the rule | [`tests/unit/scripts/iterator-coverage.test.ts`](../../tests/unit/scripts/iterator-coverage.test.ts) | Anti-weakening guard. |
| ADR + 4 anti-weakening invariants | [`docs/dev/adr/0019-iterator-aware-coverage.md`](../dev/adr/0019-iterator-aware-coverage.md) | |
| Documented in the standard | [`docs/qa/STANDARD.md`](../qa/STANDARD.md) §6.1 | |

**Headline result:** `qa:gate` PASS for the first time. 66/66 routes,
52/52 API cells, 219/219 tRPC procedures, 18/18 pillars, 66/66 per-screen
cards. Test count 234 → 1477 (+1243), all green.

---

## Activation order (post-deploy gate)

When the operator is ready for a production deploy, activate the new
feature flags one at a time. The order below was chosen so that each
step has its own rollback boundary:

1. Deploy the new image with **all flags off**. Smoke test the existing
   internal traffic. If green, proceed.
2. `MULTI_TENANT_ENABLED=true`. Verify tenant-scoped Prisma queries via
   `npm run qa:tenant-scope` and the tenant-bypass ESLint rule report.
3. `BILLING_ENABLED=true` (if and only if Stripe credentials are in
   Key Vault per `SECRETS` and the webhook endpoint has been registered).
4. Public surface activation (DNS): `/`, `/cvo`, `/pricing`, `/sandbox`,
   `/changelog`, `/changelog.rss` are static and harmless even before
   step 4, but do not announce them publicly until SOC 2 Type I gap
   analysis is reviewed by Compliance.

The Wave 0 resolver scripts make every prerequisite verifiable from
a single shell session before the deploy is initiated.
