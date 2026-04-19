# Development Plan — E-Credentialing CVO Platform

**Status:** REQUIRED. Keep current with every scope or schedule change.
**Audience:** Project Manager, Tech Lead, Sponsors, Steering Committee.
**Last Updated:** 2026-04-19

---

## 1. Executive summary

The **E-Credentialing CVO platform** (Credentialing Verification
Organization platform) is in production at
`credentialing.hdpulseai.com`. All 21 functional modules have
implemented at least their P0 surface; the focus has shifted from build
to **integration activation**, **operational hardening**, **organizational
rollout**, **commercial readiness** (multi-tenancy shim, public marketing,
pricing, billing scaffolding, public sandbox API, auditor-package export,
and a public changelog), **public-API hardening** (OpenAPI v1 contract,
TypeScript SDK, Schemathesis fuzz harness, RFC 9457 Problem Details,
public Error Catalog), and **continuous compliance**.

| Phase | Name | Window | Status |
|---|---|---|---|
| 1 | Core Platform Build | Apr 2026 (4 weeks) | **Complete** |
| 1.5 | Commercial-Readiness Band (Waves 0–6) | Apr 16–18 2026 | **Complete** |
| 1.6 | Public-API Hardening (Waves 7–21 + 21.5) | Apr 18–19 2026 | **Complete** |
| 1.7 | QA-Hardening Wave (Pillar S + DEF-0008/0010/0011/0012/0013/0014) | Apr 19 2026 | **Complete** |
| 2 | Integration Activation | May–Jun 2026 (8 weeks) | In progress |
| 3 | Training & Pilot | Jul–Aug 2026 (8 weeks) | Planned |
| 4 | Full Rollout & PARCS Sunset | Sep–Oct 2026 (8 weeks) | Planned |
| 5 | Optimization & Roadmap | Nov 2026 → ongoing | Planned |

Phases 2–5 below contain explicit tasks, owners, dependencies, and acceptance
criteria. Use the [pm/status-reporting.md](pm/status-reporting.md) template to
report against this plan every Friday.

---

## 2. Phase 1 — Core Platform Build (complete)

Delivered in April 2026. Outcomes:

- All 20 modules built; tRPC routers, pages, and Prisma models in place.
- Two-container architecture (web + worker) running locally and in production.
- Auth.js v5 with Entra ID; provider invite tokens with single-active enforcement.
- AES-256-GCM PHI encryption at the application layer.
- HMAC-chained, tamper-evident `AuditLog` with DB triggers blocking DELETE/TRUNCATE.
- PSV bots: License, DEA, Boards, Education (AMA / ECFMG / ACGME), OIG, SAM.
- Sanctions weekly sweep; expirables daily outreach; recredentialing daily initiation; roster monthly generation.
- Public REST v1 (read-only) + FHIR R4 `Practitioner` endpoint.
- NCQA CVO criterion catalog + compliance dashboard.
- 234 automated tests, all green.
- Master Test Plan workbook + automated runner.
- Production deployed to VPS; SSL via Certbot; deploy through `python .claude/deploy.py`.

Detailed Phase 1 deliverables are preserved in
[planning/scope.md](planning/scope.md) and the prior implementation plan now
mirrored in the `docs/pm/` PM artifacts (charter, status reporting, decision log).

---

## 2.5 Phase 1.5 — Commercial-Readiness Band (Waves 0–6, complete)

**Window:** 2026-04-16 → 2026-04-18 (autonomous Cursor execution).
**Goal:** Take the platform from "in production for one customer" to
"commercially shippable as a CVO platform to external medical groups
and ACOs" without deploying to production until human sign-off. Every
change committed and pushed to `master`; zero prod deploys.

The band is fully delivered. See
[docs/status/shipped.md](status/shipped.md) for the per-wave index
with links to the ADRs, runbooks, and resolver scripts. Summary:

| Wave | Theme | Headline outcome |
|---|---|---|
| 0 | Unblock the blockers | Every B-001…B-011 blocker now has a one-shot resolver script under `scripts/ops/`, `scripts/azure/`, `scripts/legal/`, or `scripts/seed/`, or has been collapsed to a single yes/no decision for the named owner. See [`docs/status/resolved.md`](status/resolved.md). |
| 1 | QA gate solidified | DEF-INFRA-0001 closed (`npm run qa:e2e:prod` runs against a real production bundle); pillar specs landed for C/D/F/G/H/I/J/K/L/M/N/O/P/Q/R; 60 per-screen cards backfilled; coverage gate fails on zero-spec pillars and missing cards. |
| 2 | Architecture cleanup + design system | Five tRPC routers refactored behind dedicated services (`Document`, `Bot`, `Sanctions`, `Recredentialing`, `Roster`); TanStack-powered `<DataTable>` with `ThemeProvider`/`ThemeToggle`; `no-raw-color` ESLint rule + RuleTester; lite Storybook harness. ADR 0015. |
| 3 | Compliance polish | OPPE/FPPE polish + Joint Commission NPG-12 spec; CME aggregator + auto-generated CV PDF (`/api/v1/providers/:id/cv.pdf`); FHIR `HealthcareService`, `InsurancePlan`, `$everything` operation, updated `CapabilityStatement`; Telehealth coverage-gap UI + IMLC LoQ + Expirables wiring. |
| 4 | Observability, performance, security, IaC | Sentry + Application Insights + Prometheus + Grafana dashboard; k6 perf suites + Postgres index audit; OWASP ZAP baseline/active + gitleaks; per-browser Playwright visual baselines; full Azure Bicep IaC with `azd up`. ADR 0013 (telemetry). |
| 5 | Commercial readiness | Multi-tenancy shim (`Organization` model + `AsyncLocalStorage` tenant scoping) — ADR 0014; CVO-positioned marketing landing + `/cvo`/`/pricing`/`/sandbox`; Stripe billing scaffolding behind `BILLING_ENABLED` flag — ADR 0016; one-click auditor-package export + SOC 2 Type I gap analysis — ADR 0017; customer-facing `/changelog` page + RSS feed — ADR 0018. |
| 6 | Iterator-aware coverage gate | `qa:gate` reaches PASS for the first time in the project's history (66/66 routes, 52/52 API cells, 219/219 tRPC procedures, 18/18 pillars). 1064 named per-cell / per-procedure tests added. ADR 0019 documents the four anti-weakening invariants. |
| Cross-cutting | CVO positioning sweep | Eleven core docs (root README, docs/README, system-prompt, FRD, BRD, TRD, product/user/dev README) re-titled and re-introduced as the "E-Credentialing CVO Platform". |

Aggregate impact:

- **Test count:** 234 → 1477 (+1243), 100 % green.
- **Coverage gate:** failing → PASS.
- **Defect ledger:** all DEFs (0003 / 0004 / 0005 / 0006 / INFRA-0001) closed.
- **Blockers:** every B-001…B-011 has a resolver script or one-line yes/no.
- **Public surfaces shipped:** `/`, `/cvo`, `/pricing`, `/sandbox`,
  `/changelog`, `/changelog.rss`, `/legal/{privacy,terms,cookies,hipaa}`,
  `/api/v1/*` (read-only REST), `/api/fhir/*` (R4 directory).
- **Commercial features behind flags:** Stripe billing
  (`BILLING_ENABLED`), multi-tenancy (`MULTI_TENANT_ENABLED`),
  auditor-package export (always on for admins).

Phase 1.5 carried no production deploys. The next step (still
gated on human action) is one production deploy that activates the
new feature flags one at a time per the rollout plan in
[docs/status/shipped.md](status/shipped.md).

---

## 2.6 Phase 1.6 — Public-API Hardening (Waves 7–21 + 21.5, complete)

**Window:** 2026-04-18 → 2026-04-19 (autonomous Cursor execution).
**Goal:** Take the public REST/FHIR surface from "shipped" to
"contract-stable, RFC-aligned, dereferencable, and SDK-publishable" so
external integrators (payers, partners, sandbox evaluators) can build
against a versioned, documented, machine-readable contract.

| Wave | Theme | Headline outcome | ADR |
|---|---|---|---|
| 7 | Iterator-aware coverage gate hardening | `qa:gate` honored as the binding deploy gate; iterator detection rule pinned by unit tests; anti-weakening invariants codified in `STANDARD.md`. | 0019 |
| 20 | OpenAPI v1 contract + SDK + fuzz harness | `docs/api/openapi-v1.yaml` (OAS 3.1) authored; TypeScript SDK generated; Postman collection synced; Schemathesis fuzz harness runs in CI; deprecation/sunset header policy formalized. | 0020, 0021, 0022, 0023, 0024 |
| 21 | RFC 9457 Problem Details + Public Error Catalog | Every REST v1 error response is now `application/problem+json` with a dereferencable `type` URI; the four catalog faces (TS registry → JSON list → JSON entry → public HTML pages) are live; `src/lib/api/error-catalog.ts` is the single source of truth; `/errors` and `/errors/[code]` HTML pages render anonymously per RFC 9457 §3.1.1. | 0025, 0026, 0027 |
| 21.5 | Anonymous-public-surface gate (DEF-0007 / DEF-0008) | DEF-0007 closed: `/errors` and `/errors/[code]` added to the middleware public allow-list; new iterator spec `tests/e2e/anonymous/pillar-a-public-smoke.spec.ts` iterates every `group: "public"` route in `route-inventory.json` and asserts an anonymous 200 (no 307 to `/auth/signin`). DEF-0008 escalated: pre-existing systemic drift on other public routes (`/legal/*`, `/cvo`, `/sandbox`) documented for a structural fix where middleware reads the inventory rather than a hand-maintained allow-list. | — |

Aggregate impact:

- **Public contract:** REST v1 now machine-readable end-to-end (OAS 3.1 +
  SDK + Postman + fuzz + RFC 9457 errors + dereferencable catalog).
- **Defect ledger:** DEF-0007 closed; DEF-0008 open and escalated to the
  next planning window.
- **Anti-weakening:** new pillar-A iterator spec absorbs every future
  public route without a code change to the test, removing the
  inventory/middleware drift class entirely once DEF-0008 is structurally
  fixed.

This phase carried no production deploys.

---

## 2.7 Phase 1.7 — QA-Hardening Wave (2026-04-19, complete)

**Window:** 2026-04-19 (single autonomous Cursor session).
**Goal:** Close the structural gap that allowed DEF-0009 (sign-in
dead on the deployed dev stack while every static gate was green)
to ship to a user, and use the new live-stack gate to surface and
fix every other class of "static-green / runtime-broken" defect
the platform was carrying. This phase carried zero production
deploys; every change landed on `master` and was validated against
the live dev stack before the user saw it.

| Sub-wave | Theme | Headline outcome | Defect / ADR |
|---|---|---|---|
| 1.7.0 | **Pillar S — Live-Stack Reality Gate** added as the 19th pillar (six initial surfaces). | `STANDARD.md` v1.2.0; new gate scripts (`live-stack-smoke.mjs`, `check-migration-drift.mjs`, `check-dockerfile-build.mjs`); `tests/e2e/live-stack/role-login-matrix.spec.ts`; `qa:gate` rewired to run live + static gates together; cold-Dockerfile + named-volume staleness become hard fails. | DEF-0009; [ADR 0028](dev/adr/0028-live-stack-reality-gate.md) |
| 1.7.1 | **Single source of truth for public routes.** | New `src/lib/public-routes.ts`; `src/middleware.ts` and `scripts/qa/build-route-inventory.ts` both read from it; runtime allow-list and inventory `group:public` can no longer drift. | DEF-0008, DEF-0011 |
| 1.7.2 | **Marketing homepage `<main>` landmark.** | `src/app/page.tsx` wraps hero / features / stats in `<main id="main">`; Pillar E + Pillar S Surface 5 invariant satisfied. | DEF-0010 |
| 1.7.3 | **Public-API delivery surface hardened.** | `.dockerignore` narrowed (`docs/**` blanket replaced by explicit un-excludes for `docs/changelog/`, `docs/api/`, `docs/planning/`); the auto-generated Postman collection moved from `public/api/v1/postman.json` to `data/api/v1/postman.json` to dodge Next.js's static-vs-route URL collision; `docker-compose.dev.yml` gained the matching bind mounts; Pillar S Surface 5 grew explicit probes for `/api/v1/openapi.{json,yaml}`, `/api/v1/postman.json`, `/changelog.rss`. | DEF-0012, DEF-0013 |
| 1.7.4 | **Pillar S Surface 7 — Dev-loop performance invariant.** | `STANDARD.md` v1.3.0 + new §11 "Dev-loop performance baseline" + new §4 hard-fail (15); Turbopack made the default `next dev` compiler; `scripts/dev/warm-routes.mjs` extended to also warm dynamic routes (sample id harvested from parent list page or synthetic UUID fallback); `scripts/qa/live-stack-smoke.mjs --dev-perf` enforces a 2000 ms re-fetch budget; new `qa:live-stack:perf` and rewritten `qa:live-stack:full` scripts. Mirrored into `.cursor/rules/qa-standard.mdc` and `~/.cursor/rules/qa-standard-global.mdc` so every sibling and future HDPulseAI repo inherits the standard automatically. | DEF-0014; [ADR 0029](dev/adr/0029-dev-loop-performance-baseline.md) |

Aggregate impact:

- **Pillar count:** 18 → 19 (added Pillar S).
- **Hard-fail conditions:** 10 → 15 (added 11–15: schema/migration drift, dead seed account, cold Dockerfile build, named-volume staleness, lazy-compile dev loop).
- **Defect ledger:** DEF-0008/0010/0011/0012/0013/0014 closed with anti-weakening attestations; DEF-0009 closed structurally.
- **Live-stack gate output (post-fix):** `pass=32  fail=0  warn=0  notrun=0  EXIT=0` for `npm run qa:live-stack:full` against the dev stack with all seven surfaces green.
- **Dev-loop p95:** Surface 7 measured re-fetch on a deterministic route mix is **425–989 ms** (vs the user-reported pre-fix `/providers/[id]` cold compile of **14,968 ms** — a 25–30× speedup that is now structurally pinned by the gate budget).
- **Standards portability:** the global Cursor rule (`alwaysApply: true`) now carries the framework-agnostic dev-loop perf baseline, so every Cursor / Claude / Codex agent in any HDPulseAI repo on the development machine inherits the rule on the next invocation without per-repo opt-in.

This phase carried no production deploys.

---

## 3. Phase 2 — Integration Activation (May–June 2026, 8 weeks)

**Goal:** Connect every external system, validate every PSV bot against real
endpoints, and prove the platform end-to-end with production credentials.

### Week 1–2 — Azure infrastructure

| Task | Owner | Acceptance |
|---|---|---|
| Provision Azure Key Vault (production) | DevOps | Vault reachable from prod containers via Managed Identity |
| Store all integration credentials in Key Vault | DevOps + Credentialing Manager | Zero plaintext credentials in env or code |
| Provision Azure Blob Storage container `essen-credentialing` | DevOps | Container is **Private** (no public access); SAS-only download path verified |
| Configure Managed Identity for `ecred-web-prod` and `ecred-worker-prod` | DevOps | Containers authenticate to Key Vault and Blob via MI |
| Install Azure CLI on dev machine | Developer | `az login` works; local dev can read Key Vault |
| Set `AUDIT_HMAC_KEY` and `ENCRYPTION_KEY` in prod env | DevOps | Server boots; `verifyAuditChain()` returns OK on existing rows |

### Week 3–4 — Data integrations

| Task | Owner | Acceptance |
|---|---|---|
| iCIMS OAuth credentials live in Key Vault | IT / iCIMS Admin | API returns provider data for known iCIMS ID |
| iCIMS webhook configured | Developer | New hire in iCIMS triggers `Provider` row creation |
| CAQH UPDS API credentials live | Credentialing Manager | CAQH application data ingested for known CAQH ID |
| CAQH ProView 2026 connector | Developer | Practice updates push from platform to CAQH; alerts on failure |
| Entra ID production app registration | IT | Staff SSO works against the prod tenant; MFA enforced |
| SendGrid sender authentication | IT / DevOps | Email from `@essenmed.com` arrives without spam flags |
| Azure Communication Services (SMS) live | IT | Test SMS delivered to staff phone |
| SFTP per-payer credentials | DevOps | `ssh2-sftp-client` connects with payer-specific config |

### Week 5–6 — Bot activation against production endpoints

| Task | Owner | Acceptance |
|---|---|---|
| DEA portal credentials + TOTP seed in Key Vault | DevOps + Manager | DEA bot signs in, completes TOTP, downloads PDF |
| License Verification bot validated for top 5 states | Developer + QA | All 5 states succeed end-to-end with stored PDFs |
| Board Certification bots (NCCPA, ABIM, ABFM) | Developer + QA | Each board returns parsed result + PDF |
| OIG sanctions bot | Developer + QA | Clear and flagged outcomes both produce PDFs |
| SAM.gov API key | DevOps | Bot returns expected exclusion data for known test NPI |
| NPDB initial query + Continuous Query enrollment | DevOps + Manager | Bot returns results for test provider; CQ enrollment tracked |
| Payer portal bots (Availity, My Practice Profile, Verity, EyeMed, eMedNY) | DevOps + Manager | Each bot signs in and reaches the enrollment section |
| Education PSV (AMA Masterfile, ECFMG, ACGME) | Developer | Each bot completes verification on a synthetic case |
| Malpractice carrier verification bot | Developer | Bot returns parsed coverage record |
| FSMB Practitioner Direct continuous monitoring | DevOps | Subscription created; events flow into `FsmbPdcEvent` |
| State Medicaid (NY OMIG) screening | DevOps | Bot returns clean / flagged result with PDF |
| End-to-end PSV suite for 3 test providers | QA | All 11 NCQA CVO products verified for each |

### Week 7–8 — Validation & hardening

| Task | Owner | Acceptance |
|---|---|---|
| Load test: 50 concurrent bot runs | Developer | No queue failures; all complete within 30 minutes |
| Validate Blob filename conventions | QA | Every output matches the legacy K: drive naming convention |
| Notification pipeline (email + in-app + SMS) | QA | Each notification type delivered correctly |
| Audit-trail completeness | QA | Every action has an audit row with chain integrity verified |
| `pino` PHI scrub | Security | `rg` against logs shows zero SSN/DOB values |
| Integration health dashboard | QA | All 21 integrations reported with green/yellow/red status |
| Per-integration runbook | Developer | Each runbook exists under [`dev/runbooks/`](dev/runbooks/) |

**Phase 2 exit criteria:** All bots run successfully against production
endpoints; all integrations show green on the integration health page;
penetration test scoping kickoff complete.

---

## 4. Phase 3 — Training & Pilot (July–August 2026, 8 weeks)

**Goal:** Train all credentialing staff and run a controlled pilot with 10–20
live providers to validate end-to-end workflows.

### Week 1–2 — Training preparation

| Task | Owner | Acceptance |
|---|---|---|
| Refresh user training guide (`docs/user/`) | Training Lead | All workflows current; screenshots match shipped UI |
| Role-specific quick reference cards | Training Lead | One-page card per role: Specialist, Manager, Committee, Roster Manager, Admin, Compliance Officer |
| Training environment seeded | Developer | 50 demo providers spanning every status; all bots in stub mode |
| Training calendar | Training Lead | 4 sessions scheduled; all attendees confirmed |
| Recorded short videos (5) | Training Lead | Login, onboarding, bots, committee, enrollments |

### Week 3–4 — Staff training

| Session | Audience | Length | Content |
|---|---|---|---|
| 1. Overview & Navigation | All staff | 2h | Login, dashboard, search, role permissions |
| 2. Onboarding Workflow | Specialist + Manager | 3h | Add provider, checklist, bots, tasks, communications |
| 3. Committee & Approvals | Manager + Committee | 2h | Sessions, agendas, approve/deny/defer |
| 4. Enrollments & Expirables | Specialist + Manager | 2h | Records, follow-ups, expirable monitoring |

Each session: live demo + hands-on practice + Q&A + post-session survey.

### Week 5–8 — Pilot

| Task | Owner | Acceptance |
|---|---|---|
| Select 10–20 pilot providers (new hires preferred) | Manager | Pilot list approved |
| Run pilots through full lifecycle | Specialists | All providers reach an outcome (approved / denied / deferred) |
| Run PSV bots on every pilot provider | Specialists | Verifications complete or flagged correctly |
| Process 2–3 through committee | Manager | Decisions recorded with attestations |
| Create enrollment records | Specialists | At least 5 enrollments with follow-up cadence |
| Daily standup (15 min) | Training Lead | Issues logged and triaged within 24 hours |

**Pilot success criteria:**

| Metric | Target |
|---|---|
| Time to credential (invite → committee ready) | < 20 days |
| Bot success rate (no manual fallback) | > 90% |
| Staff satisfaction | > 4.0 / 5.0 |
| Missed expirations | 0 |
| Data loss incidents | 0 |
| Audit completeness | 100% |

---

## 5. Phase 4 — Full Rollout & PARCS Sunset (September–October 2026, 8 weeks)

**Goal:** Migrate all active providers from PARCS, transition all credentialing
operations, and decommission PARCS and the K: drive PCD folders.

### Week 1–2 — Data migration

| Task | Owner | Acceptance |
|---|---|---|
| Export all active provider data from PARCS | Developer + Manager | CSV/JSON export complete |
| Build PARCS → Platform migration script | Developer | Field map signed off; idempotent rerun supported |
| Dry-run migration on staging | Developer | All providers imported with zero data loss |
| Spot-check 20 providers | QA + Specialists | All match the source record |
| Production migration run | Developer | All active providers in platform; counts reconciled |

### Week 3–4 — Document migration

| Task | Owner | Acceptance |
|---|---|---|
| Inventory K: drive PCD folders | Developer | Per-provider counts captured |
| Build K: → Blob migration script | Developer | Filename convention preserved; checksums recorded |
| Run document migration in batches | Developer | All files in Blob, linked to provider records |
| Spot-check 20 providers | QA | All expected documents present and downloadable via SAS endpoint |

### Week 5–6 — Operational transition

| Task | Owner | Acceptance |
|---|---|---|
| All new providers onboarded through the platform | Manager | Zero new PARCS entries |
| All bot verifications run through the platform | Specialists | Zero manual website checks |
| All enrollment tracking in the platform | Specialists | PARCS enrollment sheets retired |
| All expirable tracking in the platform | Specialists | Spreadsheets retired |
| Committee sessions in the platform | Manager | No paper agendas or manual summary sheets |
| Daily PARCS ↔ Platform reconciliation | QA | Records match; no orphans |

### Week 7–8 — PARCS decommissioning

| Task | Owner | Acceptance |
|---|---|---|
| Final PARCS export (archival) | Developer / IT | Full archive stored |
| K: drive set read-only | IT | No new writes possible |
| PARCS access revoked for staff | IT / Manager | No staff signed in to PARCS |
| Sunset announcement | Manager | All stakeholders notified |
| 30-day hold | IT | Emergency rollback path remains for 30 days |
| PARCS decommissioned | IT | PARCS offline; archive retained |

---

## 6. Phase 5 — Optimization & Continuous Improvement (November 2026 → ongoing)

| Theme | Initiative | Priority | Window |
|---|---|---|---|
| Compliance | Quarterly NCQA dashboard reviews + auditor package generation | High | Quarterly |
| Compliance | HITRUST CSF v11 r2 / SOC 2 Type II readiness tracker | High | Q4 2026 → Q2 2027 |
| Compliance | AI governance maturity (model cards + decision audit logs) | High | Q4 2026 → ongoing |
| Bots | Self-healing selectors + visual diff fixtures | Medium | Q4 2026 |
| Bots | Autonomous AI agent orchestrator over Playwright bots | Medium | Q1 2027 |
| Compliance | JC NPG 12 alignment (peer-review minutes, auto-FPPE, semi-annual OPPE) | High | Q4 2026 |
| Provider experience | Provider self-service copilot (RAG over policies) | Medium | Q1 2027 |
| Staff experience | Compliance coach copilot (RAG over playbooks) | Medium | Q1 2027 |
| Public APIs | Add `PractitionerRole`, `Organization`, `Location`, `Endpoint` FHIR resources | High | Q1 2027 |
| Public APIs | OpenAPI spec served at `/api/v1/openapi.json` | Medium | Q1 2027 |
| Performance | Sentry + OpenTelemetry traces + Prometheus + Grafana dashboards | Medium | Q1 2027 |
| Performance | Move to Azure Container Apps via Bicep | Low | Q2 2027 |
| Performance | k6 perf environment with weekly run | Medium | Q1 2027 |
| Bots | NPDB Continuous Query webhook integration | Medium | Q1 2027 |
| Bots | Telehealth deepening (IMLC tracking, platform certs, coverage gap alerts) | Medium | Q1 2027 |
| UX | TanStack Table wrapper, shared `ThemeProvider`, ESLint color ban, Storybook coverage | Medium | Q1 2027 |
| Infrastructure | Visual regression in Storybook + Chromatic | Low | Q2 2027 |

Roadmap detail and rationale: [product/roadmap.md](product/roadmap.md).

---

## 7. Risk register (top risks)

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| External website changes break PSV bots | Medium | High | Resilient role-based selectors; snapshot fixture tests; `REQUIRES_MANUAL` fallback; alerting on success-rate drops |
| PARCS data export quality | Medium | Medium | Dry-run on staging; spot-check; manual correction buffer |
| Staff resistance to new system | Low | Medium | Hands-on pilot; quick feedback loops; champions in each role |
| Entra ID configuration delays | Low | High | Start app registration early in Phase 2; engage IT in week 1 |
| iCIMS API access delays | Medium | Medium | Manual provider creation as fallback; CAQH ingestion as alternative source |
| DEA portal MFA changes | Low | High | TOTP rotatable in Key Vault; manual fallback path |
| Document migration corruption | Low | High | Checksum validation; K: drive preserved read-only for 90 days |
| Production VPS limits as load grows | Medium | Medium | Migrate to Azure Container Apps via Bicep in Phase 5 |
| AUDIT_HMAC_KEY rotation invalidates chain | Low | High | Procedure: rotate ⇒ snapshot existing chain ⇒ start a new chain root with explicit `previous_hash = null` row + audit annotation |

The full register is maintained in [pm/risk-register.md](pm/risk-register.md).

---

## 8. Resource plan

| Role | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|---|---|---|---|---|
| Developer | 1.0 FTE | 0.5 FTE | 1.0 FTE | 0.5 FTE |
| QA / Tester | 0.5 FTE | 0.5 FTE | 1.0 FTE | 0.25 FTE |
| DevOps / IT | 0.25 FTE | — | 0.25 FTE | 0.25 FTE |
| Credentialing Manager | 0.25 FTE | 1.0 FTE | 1.0 FTE | 0.25 FTE |
| Training Lead | — | 1.0 FTE | 0.5 FTE | — |
| Compliance Officer | 0.1 FTE | 0.25 FTE | 0.5 FTE | 0.25 FTE |

---

## 9. Success metrics

| Metric | PARCS baseline | Platform target | Measurement |
|---|---|---|---|
| Average time to credential (invite → approved) | 45+ days | < 18 days | System timestamp delta |
| Manual PSV hours per provider | 3–4 hours | < 30 minutes | Bot run duration + manual fallback time |
| Expired credential discovery | Reactive (days/weeks late) | Proactive (90-day lead) | Expirable alert lead-time |
| Committee prep time per session | 2–3 hours | < 15 minutes | Auto-generation duration |
| Enrollment follow-up compliance | ~60% on time | > 95% on time | Cadence adherence rate |
| Audit completeness | Partial / manual | 100% automated | Random audit sampling |
| NCQA file completeness | TBD | 100% | Compliance dashboard tile |

---

## 10. Governance

- **Executive Sponsor:** TBD (CTO or VP of Operations).
- **Project Manager:** Credentialing Manager.
- **Technical Lead:** Lead Developer.
- **Status reporting:** Weekly, every Friday, using the
  [pm/status-reporting.md](pm/status-reporting.md) template, distributed to all
  stakeholders.
- **Steering Committee:** Monthly, Phases 2–4.
- **Go/No-Go decision points:** End of Phase 2 (proceed to pilot), End of
  Phase 3 (proceed to full rollout), End of Phase 4 (proceed to PARCS sunset).
- **Documentation governance:** [docs/README.md](README.md), section
  "Documentation governance".

---

## 11. Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-15 | HDPulse | Initial implementation plan (Phase 1 complete). |
| 2026-04-17 | Documentation refresh | Promoted to required document; added Phase 5 detail; aligned roadmap with shipped feature set; added governance and metric sections. |
| 2026-04-18 | Cursor (autonomous Wave 7) | Added Phase 1.5 (Commercial-Readiness Band, Waves 0–6) to executive summary and as a new full section between Phase 1 and Phase 2. Cross-linked to `docs/status/shipped.md` and ADRs 0013–0019. |
| 2026-04-19 | Documentation refresh (Wave 21 + 21.5) | Added Phase 1.6 (Public-API Hardening, Waves 7–21 + 21.5) to the executive summary and as a new full section. Documents the OpenAPI v1 contract + SDK + fuzz harness (Wave 20, ADRs 0020–0024), the RFC 9457 Problem Details + Public Error Catalog (Wave 21, ADRs 0025–0027), and the DEF-0007 closure / DEF-0008 escalation that resulted from the anonymous-public-surface audit. |
