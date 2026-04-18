# Changelog

All notable changes to the ESSEN Credentialing Platform are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semantic versioning is used for public-facing APIs; internal changes are grouped by release.

## [Unreleased]

### Added
- **Wave 5.5 — public `/changelog` page + RSS feed (2026-04-18):**
  - `docs/changelog/public.md` — curated, customer-facing release notes
    in Keep-a-Changelog style. Hand-edited; engineering noise stays in
    this `CHANGELOG.md`.
  - `src/lib/changelog/parser.ts` — pure parser turning the Markdown
    file into a typed `Release[]`; unknown sub-sections fall back to
    `Other` (anti-weakening: never silently drop content).
  - `src/lib/changelog/rss.ts` — pure RSS 2.0 renderer; deterministic
    slugs, full XML escaping, per-entry `<item>` granularity.
  - `src/lib/changelog/loader.ts` — server-only file loader cached for
    process lifetime.
  - `/changelog` Server Component page: anchor-stable release cards,
    category badges, RSS subscribe link.
  - `/changelog.rss` route handler returning `application/rss+xml`.
  - Marketing nav (`src/app/page.tsx`) gets a top-level "Changelog" link
    in the header (footer link already existed).
  - `docs/dev/adr/0018-public-changelog.md` — ADR documenting the
    decision, anti-weakening rules, and alternatives considered.
  - `docs/qa/per-pillar/pillar-u-changelog.md` — Pillar U coverage map.
  - `docs/qa/per-screen/{changelog,cvo,pricing,sandbox,settings__billing,settings__compliance}.md` —
    per-screen cards updated/created with accurate role-gating notes.
  - **15 new unit tests** across `tests/unit/lib/changelog/` (parser:
    8, RSS: 7). Total suite: **404 passed / 51 files**.
- **HDPulseAI QA Standard — Fix-Until-Green amendment v1.1.0 (2026-04-17):**
  the standard now binds the agent (and human) to a procedural failure-response
  loop, not just descriptive pass criteria.
  - `docs/qa/STANDARD.md` bumped to **v1.1.0**. New §4.1 **Failure Response
    Loop ("fix until green")** — capture → DEF card → diagnose → minimum
    fix → re-run the FULL pillar → loop. Hard cap **N=3 attempts per root
    cause**, after which the contributor MUST escalate with full evidence
    and MUST NOT mark the work done. New §4.2 **Anti-weakening rules** —
    enumerates ten patterns (weakened assertions, `.skip`/`.todo`/`.fixme`,
    widened selectors, swallowed errors, `@ts-expect-error`,
    `eslint-disable-next-line`, mocking out the failing path, raised
    timeouts, softened strict equality, lowered coverage thresholds, or
    silencing the coverage check) that may NOT be used to turn a red spec
    green. Each is, by itself, a violation and grounds for revert.
  - `docs/qa/definition-of-done.md` — new §7 **If your run is red** with
    Fix-Until-Green checklist, anti-weakening attestation, and loop-exit
    criteria.
  - `CLAUDE.md`, `AGENTS.md`, and `.cursor/rules/qa-standard.mdc` — added
    Fix-Until-Green and anti-weakening sections so every agent (Claude
    Code, Cursor, Codex, others) is on the loop contract.
  - `docs/qa/defects/_TEMPLATE.md` and `docs/qa/defects/index.md` — new
    defect-card template (with anti-weakening attestation block on close)
    and the index of opened cards. DEF-0003 / DEF-0004 reserved for the
    sidebar hydration + webpack-factory failures named in `STANDARD.md` §10.
  - `.github/workflows/qa-fix-until-green.yml` — new active CI workflow:
    anti-weakening static scan against the PR diff (fails on `.skip`,
    `.todo`, `@ts-expect-error`, `eslint-disable-next-line`, swallowed
    catches, raised timeouts, `expect.soft`, `test.fail`, `toBeTruthy`,
    `waitForTimeout`); typecheck/lint/forbidden-terms; inventory drift
    check; coverage gate; build; Playwright smoke pillar with
    `PLAYWRIGHT_HARD_FAIL_CONSOLE`/`HYDRATION`/`5XX` set; uploads
    `playwright-report/` + `test-results/` for DEF-card evidence; nightly
    full-pillar sweep (B–R) on `0 6 * * *`.
- **QA Standard rolled out to sibling EssenWebsites repos (2026-04-17):**
  the same `STANDARD.md` v1.1.0, `definition-of-done.md`, `AGENTS.md`,
  `.cursor/rules/qa-standard.mdc`, defect template + index, PR template,
  `CODEOWNERS`, and `qa-fix-until-green.yml` workflow were dropped into all
  four sibling repos under `HDPulseAI/EssenWebsites/`:
  `BronxTreatmentCenter`, `EssenHealthcare`, `IntentionHealthcare`,
  `NYReach`. Each sibling's `CLAUDE.md` was extended (or created) with a
  Testing Standard (BINDING) section and the Fix-Until-Green clause. The
  sibling copy of `STANDARD.md` is the framework-agnostic edition (PII /
  sensitive-data wording instead of PHI/NCQA-specific) and treats this
  repo's `STANDARD.md` as canonical for version bumps.
- **Global Cursor rule updated (2026-04-17):** `~/.cursor/rules/qa-standard-global.mdc`
  now carries the Fix-Until-Green loop and anti-weakening clauses, so every
  HDPulseAI repository opened in Cursor on this workstation inherits the
  procedural rules by default until the repo lands its own `STANDARD.md`.
- **HDPulseAI QA Standard adopted (2026-04-17):** the
  **Comprehensive QA Test Layer** is now the binding testing standard for this
  repo and the default for every future HDPulseAI project. New documents:
  - `docs/qa/STANDARD.md` — versioned (`v1.0.0`) master spec covering the 18
    testing pillars (A–R), hard-fail conditions, headline reporting rule
    (coverage FIRST, pass/fail second), per-screen and per-flow card
    requirements, inventory/coverage gate, roles & governance, and the named
    failure mode this standard prevents (the prior "Pass: 33 / Not Run: 223"
    HTTP-only probe).
  - `docs/qa/definition-of-done.md` — per-PR checklist derived from
    `STANDARD.md`. Every box must be checked or annotated `n/a`.
  - `AGENTS.md` (root) — tool-agnostic agent contract (Claude, Cursor, Codex,
    others).
  - `.cursor/rules/qa-standard.mdc` — project-level always-apply Cursor rule
    pointing every Cursor session at the standard.
  - `~/.cursor/rules/qa-standard-global.mdc` — global Cursor rule installed on
    this workstation so every HDPulseAI repo opened in Cursor inherits the
    standard by default until the repo lands its own `STANDARD.md`.
  - `.github/CODEOWNERS` — gates the standard documents to the QA Standard
    Owner team.
  Updated documents:
  - `CLAUDE.md` — new top-level **Testing Standard (BINDING)** section
    referencing `STANDARD.md` and listing the hard-fail conditions verbatim.
  - `docs/system-prompt.md` — operating instruction §6 now requires
    `STANDARD.md` compliance for every change; module-completion checklist
    requires per-screen / per-flow cards and green inventory coverage.
  - `docs/qa/README.md` — start-here pointers to `STANDARD.md` and
    `definition-of-done.md`.
  - `.github/pull_request_template.md` — pillar checklist (A–R), hard-fail
    confirmations, coverage/inventories gates, and the mandatory headline
    reporting block.
- **Documentation overhaul (2026-04-17):**
  - New audience-organized taxonomy under `docs/`: `product/`, `functional/`, `technical/`, `pm/`, `qa/`, plus existing `user/`, `training/`, `dev/`, `api/`, `compliance/`, `testing/`, `planning/`, `status/`, `releases/`, `upload/`, and a new `archive/`.
  - **REQUIRED documents** that must be kept current: `docs/system-prompt.md` (regenerate-from-scratch prompt) and `docs/development-plan.md` (phased delivery plan).
  - Functional documentation: BRD, FRD, use cases, UI/UX style guide, messaging catalog, status workflows, validation rules.
  - Technical documentation: TRD, architecture, data model, API surface, security, deployment & operations, performance.
  - Product documentation: overview, value proposition, market analysis with competitive grid, personas, glossary, roadmap.
  - PM documentation: charter, RACI, risk register, status reporting, change-log policy, decision log, stakeholder map, communication plan.
  - QA documentation: test strategy, unit-testing criteria, functional testing plan, UAT plan with 20 scenarios, defect management, test data plan.
  - User guide refreshed with a "Capability highlights" section and a new `quick-reference.md` cheat sheet.
  - Single canonical training deck (`docs/training/user-training.pptx`) and pitch deck (`docs/product/pitch-deck.pptx`) — version-era framing ("v2 / v3 / What's New Since…") removed because the platform is in active development and everything is current. Migration script: `docs/scripts/normalize-deck-versions.py`.
  - Detailed verbose speaker notes added to all 23 slides of the pitch deck (purpose, talking points, backup detail, anticipated Q&A, transitions; ~5,200 words total). Notes are regenerated by `docs/scripts/add-pitch-deck-notes.py` and are the canonical presenter script.
  - Detailed verbose trainer / speaker notes added to the platform-capabilities section of the user training deck (slides 25–39), bringing every slide in the deck to a structured trainer-notes format (opening, walk-through, live demo, hands-on exercise, common Q&A, pacing). New notes total ~5,400 words across 15 slides; existing trainer notes on slides 1–24 were preserved unchanged. Notes are regenerated by `docs/scripts/add-training-deck-notes.py` and are the canonical trainer script.
  - **Pitch deck — operations-feedback incorporation (2026-04-17):** the canonical pitch deck (`docs/product/pitch-deck.pptx`) now reflects April 2026 feedback from the platform's primary internal user. Visible-slide edits cover slides 1, 2, 4, 5, 6, 9, 10, and 11 — adding end-to-end task tracking framing (slide 1), expanded problem cards for committee-prep manualness, K:/O: drive split with no SharePoint integration, and competitor enrollment/direct-application bots (slide 2), the Task & Pipeline Dashboard callout (slide 4), the field-by-field OCR confirmation pop-up + automated renewal-doc outreach + per-provider verification packet (slide 5), expanded Committee Prep and Enrollment Follow-Up rows including hand-built rosters, single-provider entry, one-click roster generation, and bulk participation / ETIN uploads (slide 6), a new PECOS - Medicare enrollment integration bullet (slide 9), faster TAT for payer participation and end-to-end HRIS-to-RCM/EHR integration framing (slide 10), and Operations + RCM/Billing scoped permission tiers in the user-types card (slide 11). Speaker notes for the same eight slides were rewritten end-to-end (~3,200 words) to carry the full narrative. The named source contributor is not identified anywhere in the deck. Migration script: `docs/scripts/incorporate-pitch-feedback.py` (idempotent; re-runs are no-ops). The source-of-feedback PowerPoint is preserved as `docs/archive/legacy-decks/pitch-deck-feedback-2026-04-16.pptx`.
- **Legal / policy copy bundle (B-007 partial unblock, 2026-04-17):**
  - New canonical runtime module `src/lib/legal/copy.ts` exporting `LEGAL_COPY_VERSION` (`v1.0-draft`), `LEGAL_COPY_STATUS` (`DRAFT`), `ATTESTATION_QUESTIONS` (8 numbered statements with stable IDs), `ESIGN_DISCLOSURE` (7 sections), `PSV_CONSENT_INLINE` + `PSV_CONSENT_FULL`, `PRIVACY_NOTICE_SUMMARY` + `PRIVACY_NOTICE`, `TERMS_OF_SERVICE_SUMMARY` + `TERMS_OF_SERVICE`, `COOKIE_NOTICE_SUMMARY` + `COOKIE_NOTICE`, `HIPAA_NOTICE_POINTER`, and `LEGAL_FOOTER_LINKS`. Mirrors the markdown drafts in `docs/legal/`; both are kept in sync per the change procedure in `docs/legal/README.md`.
  - `/application/attestation` now renders the canonical attestation statements, signature disclaimer, and ESIGN disclosure (collapsible) from the module — no inline legal copy in the page anymore. Includes inline links to `/legal/terms` and `/legal/privacy` and shows the legal copy version that will be bound to the signature.
  - Provider portal footer (`src/app/(provider)/layout.tsx`) gains links to Privacy Notice, Terms of Service, Cookie Notice, and HIPAA Notice.
  - New public legal pages `/legal/privacy`, `/legal/terms`, `/legal/cookies`, and `/legal/hipaa` (pointer) under a self-contained `src/app/legal/` route segment with shared `LegalDocumentRenderer` (`src/components/legal/`). No new dependencies; structured `LegalBlock` primitives render headings, paragraphs, lists, callouts, and tables. New markdown stub `docs/legal/hipaa-notice.md` mirrors the runtime pointer.
  - `POST /api/attestation` now rejects partial acknowledgements server-side, captures client IP and user-agent, and writes an enriched `afterState` to the audit log: `legalCopyVersion`, `legalCopyStatus`, and `acknowledgements` (verbatim text + per-question accepted boolean). The endpoint also returns 409 when the client sends a stale `legalCopyVersion`. No schema migration required — uses existing `writeAuditLog`.
  - `docs/status/blocked.md` B-007 downgraded from "blocked on Legal authorship" to "blocked on Legal **review** of drafts". When Legal flips each markdown `Status:` from `DRAFT` to `APPROVED`, bump `LEGAL_COPY_VERSION` to `v1.0` and set `LEGAL_COPY_EFFECTIVE_DATE` — no further code change required to publish.
  - Archived superseded documents to `docs/archive/` (legacy MD files and decks) with a README explaining replacements.
  - Added a root `README.md` pointing to `docs/` and pointer pages for the root `CLAUDE.md` and `CHANGELOG.md`.
- Comprehensive user-facing documentation under `docs/user/`.
- Role-based training plans under `docs/training/`.
- Developer documentation under `docs/dev/`, including architecture, subsystem guides, 10 ADRs, and 8 operational runbooks.
- Public API and FHIR reference docs under `docs/api/`.
- Compliance documentation under `docs/compliance/` covering NCQA CVO, HIPAA, CMS-0057-F, PHI data map, retention policy, and internal policy alignment.
- Test strategy and plans under `docs/testing/` (unit, integration, E2E, performance, accessibility, security, manual plans).
- Liveness probe `/api/live` and readiness probe `/api/ready`.
- Structured logging via `pino` with PHI redaction paths.
- Forbidden-terms linter (`scripts/forbidden-terms.mjs`) enforcing the "new Credentialing application" framing in user-facing docs.
- GitHub Actions workflows: CI (`ci.yml`), security (`security.yml`), CD (`cd-prod.yml`).
- Dependabot configuration and pull request template.
- Authenticated document download endpoint `/api/documents/[id]/download` returning short-lived SAS redirects.
- Provider invite token verifier (`src/lib/auth/provider-token.ts`) with single-active-token enforcement.
- API rate limiter (`src/lib/api/rate-limit.ts`) and API audit helper (`src/lib/api/audit-api.ts`).
- FHIR Practitioner endpoint pagination, accurate `Bundle.total`, and `OperationOutcome` error responses.
- Vitest + Playwright test foundation with coverage gates.
- Pino-based logger with PHI redaction; unit test verifies redaction.
- Tamper-evident audit log: HMAC-SHA256 chain (`previous_hash`, `hash`, `sequence`) over each row, with `ip_address`, `user_agent`, and `request_id` captured per entry. DB triggers block DELETE and TRUNCATE and allow UPDATE only for the one-time NULL→value transition on `hash`. `verifyAuditChain()` exported for compliance reporting. ADR 0011 captures the decision.
- `AUDIT_HMAC_KEY` env var (32+ char secret); production refuses to start without it.

### Changed
- Bot lifecycle in `BotBase.run` now respects `REQUIRES_MANUAL` status and skips automatic completion.
- Consolidated `sanctions-monthly` + `sanctions-weekly` into a single `sanctions-recheck` job with 24-hour idempotency.
- `TRIGGERABLE_BOT_TYPES` restricted to user-triggerable types; system-only bots cannot be triggered via the API.
- Real-time bot status updates now use tRPC polling (5-second interval while active); Socket.io removed.
- Public API v1 explicitly filters PHI fields (ssn, dateOfBirth, home address) from responses.
- `providers.uploadedById` is now nullable with a new `uploaderType` column to accommodate provider-via-token and bot uploads.
- Document download via UI now routes through the authenticated download endpoint; blob URLs are not exposed in the client.
- PHI fields (homeAddressLine1/2, homeCity, homeState, homeZip, homePhone) are encrypted at the application layer during `save-section`.
- `.claude/deploy.py` is guarded by `ALLOW_DEPLOY=1` to prevent accidental deploys.
- Prisma migrations are tracked in Git; `migrate deploy` runs from a web container entrypoint.
- `Dockerfile.web.prod` now includes Prisma CLI and runs migrations before starting Next.js; healthcheck start_period extended to 120s.

### Removed
- `socket.io` and `socket.io-client` dependencies.
- Unused `providerProcedure` in tRPC (providers authenticate via token, not session).
- Redundant `00000000000000_init` Prisma migration.

### Security
- Closed IDOR risks on `/api/application/save-section`, `/api/attestation`, `/api/upload`, and `/api/documents/[id]/download` by verifying the token's `providerId` matches the target resource.
- Attestation now revokes the provider invite token after successful submission.
- FHIR and REST v1 routes authenticate, rate-limit, audit, and surface structured errors.
- `AuditLog` write on every public API request; no plaintext key material is logged.

## [Policy]

### No breaking changes to public APIs

The REST v1 and FHIR R4 endpoints are considered stable. Breaking changes require a version bump (REST v2) or a published FHIR profile change, and follow the communication process in `docs/api/changelog.md`.

### Semantic versioning applies to

- REST v1 response shapes.
- FHIR Practitioner resource shape and search parameters.

### Semantic versioning does NOT apply to

- Internal tRPC procedure shapes (versioned implicitly with the client).
- Database schema (migrations are additive and managed via `prisma migrate`).
- UI components.

## How releases are tagged

- Tags: `vYYYY.MM.DD` (calendar versioning for the product as a whole).
- Git tag triggers `cd-prod.yml`.
- Each tag's notes include:
  - Commit log since previous tag
  - Migrations applied
  - Config/env changes required
  - Manual test plan sign-offs
  - Known issues

Release notes are published in `docs/releases/` per tag.
