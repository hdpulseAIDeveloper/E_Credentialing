# Changelog

All notable changes to the ESSEN Credentialing Platform are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semantic versioning is used for public-facing APIs; internal changes are grouped by release.

## [Unreleased]

### Added
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
