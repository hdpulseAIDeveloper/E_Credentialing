# ESSEN Credentialing Platform — Documentation

This `docs/` folder is the single home for **all** documentation about the ESSEN
Credentialing Platform. Documents are organized **by audience** so each reader
can go straight to material written for them.

> **Documentation policy** — no documentation lives in the project root. The
> only top-level files retained at the root are operational concerns
> (`README.md` for the repo, `CLAUDE.md` for the AI build agent, `CHANGELOG.md`
> for release notes).

---

## Required documents

These two documents must always exist and must always be current. Treat any PR
that meaningfully changes the platform without updating both as incomplete.

| Document | Purpose | Owner |
|---|---|---|
| [System Prompt — Regenerate the Application](system-prompt.md) | A self-contained prompt that, given to a competent AI coding agent or engineering team, is sufficient to rebuild this application from scratch. | Tech Lead |
| [Development Plan](development-plan.md) | Phased plan from current state through full rollout, optimization, and roadmap. | Project Manager |

---

## Quick navigation by audience

### Users (staff and providers)

- [user/](user/) — Plain-language guides for every feature staff and providers use day-to-day.
- [training/](training/) — Role-based onboarding and ongoing training.
- [user/getting-started.md](user/getting-started.md) — First sign-in and platform tour.
- [user/provider-onboarding.md](user/provider-onboarding.md) — End-to-end provider experience.

### Functional (BAs, QA, Product, end users)

- [functional/README.md](functional/README.md) — Functional documentation index.
- [functional/business-requirements.md](functional/business-requirements.md) — **BRD**.
- [functional/functional-requirements.md](functional/functional-requirements.md) — **FRD** with per-screen UI/UX, validation, messages, alerts, and notifications.
- [functional/use-cases.md](functional/use-cases.md) — Primary use cases and actor flows.
- [functional/ui-ux-style-guide.md](functional/ui-ux-style-guide.md) — Visual standards and component library map.
- [functional/messaging-catalog.md](functional/messaging-catalog.md) — Standardized error, success, alert, and notification copy.

### Technical (developers, architects, DevOps, security)

- [technical/README.md](technical/README.md) — Technical documentation index.
- [technical/technical-requirements.md](technical/technical-requirements.md) — **TRD**.
- [technical/architecture.md](technical/architecture.md) — Comprehensive architecture & design reference.
- [technical/data-model.md](technical/data-model.md) — Database schema, ERD pointers, encryption map.
- [technical/security.md](technical/security.md) — Security architecture and controls.
- [dev/](dev/) — Day-to-day developer reference (local setup, subsystem deep-dives, ADRs, runbooks).
- [api/](api/) — REST v1 and FHIR R4 reference.
- [compliance/](compliance/) — NCQA CVO, HIPAA, CMS-0057-F, retention, policies & procedures.

### Project Management (PMs, sponsors, steering committee)

- [pm/README.md](pm/README.md) — Project management index.
- [pm/charter.md](pm/charter.md) — Project charter and governance.
- [development-plan.md](development-plan.md) — Phased plan (REQUIRED document; lives at the docs root).
- [pm/raci.md](pm/raci.md) — Roles and responsibilities.
- [pm/risk-register.md](pm/risk-register.md) — Risks and mitigations.
- [pm/status-reporting.md](pm/status-reporting.md) — Status report cadence + templates.
- [pm/decision-log.md](pm/decision-log.md) — Non-technical decision log (technical decisions live in [dev/adr/](dev/adr/)).
- [pm/change-log-policy.md](pm/change-log-policy.md) — Policy for the product `CHANGELOG.md`.
- [pm/stakeholder-map.md](pm/stakeholder-map.md) — Stakeholders and engagement levels.
- [pm/communication-plan.md](pm/communication-plan.md) — Communication channels and cadences.

### Product (executives, stakeholders, sales, partners)

- [product/README.md](product/README.md) — Product documentation index.
- [product/product-overview.md](product/product-overview.md) — One-page platform overview.
- [product/value-proposition.md](product/value-proposition.md) — Value, outcomes, differentiators.
- [product/market-analysis.md](product/market-analysis.md) — Competitive landscape and feature comparison.
- [product/personas.md](product/personas.md) — User personas and jobs-to-be-done.
- [product/glossary.md](product/glossary.md) — Domain glossary.
- [product/roadmap.md](product/roadmap.md) — Product roadmap.

### QA (testers and test engineers)

- [qa/README.md](qa/README.md) — QA documentation index.
- [qa/test-strategy.md](qa/test-strategy.md) — Comprehensive test strategy.
- [qa/unit-testing.md](qa/unit-testing.md) — Developer unit-testing criteria.
- [qa/functional-testing.md](qa/functional-testing.md) — QA functional testing per module.
- [qa/uat-plan.md](qa/uat-plan.md) — End-user acceptance scripts and criteria.
- [qa/defect-management.md](qa/defect-management.md) — Severity, triage, SLAs.
- [qa/test-data.md](qa/test-data.md) — Fixtures, seeding, redaction.
- [testing/](testing/) — Existing master test plan workbook + automation tools.

---

## Quick navigation by topic

| Topic | Entry point |
|---|---|
| Local development setup | [dev/getting-started.md](dev/getting-started.md) |
| Architecture | [technical/architecture.md](technical/architecture.md) |
| Authentication | [dev/auth.md](dev/auth.md) |
| PHI encryption | [dev/encryption.md](dev/encryption.md) |
| PSV bots | [dev/bots.md](dev/bots.md) |
| Public REST/FHIR API | [api/README.md](api/README.md) |
| NCQA CVO readiness | [compliance/ncqa-cvo.md](compliance/ncqa-cvo.md) |
| HIPAA summary | [compliance/hipaa.md](compliance/hipaa.md) |
| Test strategy | [qa/test-strategy.md](qa/test-strategy.md) |
| Release notes | [../CHANGELOG.md](../CHANGELOG.md) (and [pm/change-log-policy.md](pm/change-log-policy.md) for the policy) |
| Provider onboarding (user-facing) | [user/provider-onboarding.md](user/provider-onboarding.md) |
| Production deployment & ops | [technical/deployment-and-operations.md](technical/deployment-and-operations.md) and [dev/runbooks/](dev/runbooks/) |
| Pitch deck | [product/pitch-deck.pptx](product/pitch-deck.pptx) |
| Training deck | [training/user-training.pptx](training/user-training.pptx) |

---

## Folder map

```
docs/
├── README.md                     ← you are here
├── system-prompt.md              ← REQUIRED: regenerate-the-app prompt
├── development-plan.md           ← REQUIRED: phased delivery plan
│
├── product/                      ← Stakeholder-facing product docs
├── functional/                   ← BRD, FRD, use cases, UX, messaging
├── technical/                    ← TRD, architecture, data model, security
├── pm/                           ← Charter, RACI, risks, status, decisions
├── qa/                           ← Test strategy, unit/functional/UAT
│
├── user/                         ← End-user guides (staff + providers)
├── training/                     ← Role-based training plans & content
├── dev/                          ← Engineer reference + ADRs + runbooks
├── api/                          ← REST v1 and FHIR R4 reference
├── compliance/                   ← NCQA, HIPAA, CMS-0057-F, retention
├── testing/                      ← Existing master test plan + automation
│
├── planning/                     ← Original 20-module scope and design notes
├── status/                       ← Live status trackers (blockers, sessions)
├── releases/                     ← Per-release notes
├── upload/                       ← Source stakeholder documents (read-only)
└── archive/                      ← Superseded/obsolete documents
```

---

## Documentation governance

1. **Single source of truth** — every fact lives in exactly one document. Other
   documents link to it. Duplication is the path to drift.
2. **Audience-first** — pages are written for one audience at a time. The
   audience is named at the top of every document.
3. **Required docs are required** — `system-prompt.md` and `development-plan.md`
   must be updated whenever the architecture, scope, stack, or schedule changes.
4. **No docs in the repo root** — author or move documentation only inside
   `docs/`. Everything in the root is a build artifact, code, or a top-level
   README.
5. **Archive, don't delete** — when a document is superseded, move it to
   `archive/` with the date appended to the file name. Never delete history.
6. **Forbidden-terms linter** — user-facing pages are scanned by
   `scripts/forbidden-terms.mjs`. New, upgrade, migration, and PARCS-replacement
   wording must stay out of `docs/user/**` and `docs/training/**`.
7. **Diagrams** — prefer Mermaid blocks inside the markdown. Embedded `.png`
   diagrams must have a Mermaid source kept alongside them.

See [pm/change-log-policy.md](pm/change-log-policy.md) for the change-log
policy and [pm/decision-log.md](pm/decision-log.md) for non-technical
decisions. Technical decisions live as ADRs in [dev/adr/](dev/adr/).
