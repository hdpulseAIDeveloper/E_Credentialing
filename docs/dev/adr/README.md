# Architecture Decision Records (ADRs)

Each ADR records one significant technical decision, why we made it, and its consequences.

Process:

1. Open a new ADR as `NNNN-kebab-case-title.md` using the template below.
2. Number sequentially from the existing set.
3. Include a status header: Proposed → Accepted → Superseded.
4. Link from any supporting code or doc.

## Index

| # | Title | Status |
|---|-------|--------|
| 0001 | [Use Next.js App Router](0001-nextjs-app-router.md) | Accepted |
| 0002 | [Prisma as the single ORM](0002-prisma-orm.md) | Accepted |
| 0003 | [Drop Socket.io, use tRPC polling](0003-drop-socketio.md) | Accepted |
| 0004 | [AES-256-GCM at the application layer for PHI](0004-phi-encryption.md) | Accepted |
| 0005 | [Single-use provider invite tokens](0005-provider-invite-tokens.md) | Accepted |
| 0006 | [Private blob storage with short-lived SAS URLs](0006-blob-sas.md) | Accepted |
| 0007 | [Weekly sanctions sweep with 24-hour idempotency](0007-sanctions-weekly.md) | Accepted |
| 0008 | [Prisma migrations tracked in git, applied at container start](0008-prisma-migrations.md) | Accepted |
| 0009 | [Auth.js v5 with Entra ID for staff](0009-authjs-entra.md) | Accepted |
| 0010 | [Pino for structured logs with PHI redaction](0010-pino-redaction.md) | Accepted |
| 0011 | [Tamper-evident audit log (HMAC chain + DB triggers)](0011-audit-tamper-evidence.md) | Accepted |
| 0012 | [NCQA CVO criteria catalog + snapshots](0012-ncqa-catalog.md) | Accepted |
| 0013 | [Observability stack (Sentry + AppInsights + Prometheus + Grafana)](0013-observability-stack.md) | Accepted |
| 0014 | [Multi-tenancy shim (Organization + AsyncLocalStorage)](0014-multi-tenancy-shim.md) | Accepted |
| 0015 | [Design system (TanStack DataTable + Theme + `no-raw-color` rule)](0015-design-system.md) | Accepted |
| 0016 | [Stripe billing (`BILLING_ENABLED` flag, dynamic SDK)](0016-stripe-billing.md) | Accepted |
| 0017 | [Auditor-package one-click export](0017-auditor-package.md) | Accepted |
| 0018 | [Public changelog + RSS](0018-public-changelog.md) | Accepted |
| 0019 | [Iterator-aware coverage gate](0019-iterator-aware-coverage.md) | Accepted |
| 0020 | [OpenAPI v1 spec](0020-openapi-v1-spec.md) | Accepted |
| 0021 | [Schemathesis fuzz harness in CI](0021-schemathesis-fuzz-harness.md) | Accepted |
| 0022 | [Public REST v1 SDK (TypeScript) generated from OAS](0022-public-rest-v1-sdk.md) | Accepted |
| 0023 | [API versioning policy (semver + URL major)](0023-api-versioning-policy.md) | Accepted |
| 0024 | [Deprecation / Sunset headers (RFC 8594 + RFC 8288)](0024-deprecation-sunset-headers.md) | Accepted |
| 0025 | [Problem Details (RFC 9457) for REST v1 errors](0025-problem-details-rfc-9457.md) | Accepted |
| 0026 | [Server-side request validation surface](0026-server-side-request-validation.md) | Accepted |
| 0027 | [Public Error Catalog as the single source of truth](0027-error-catalog.md) | Accepted |
| 0028 | [Pillar S — Live-Stack Reality Gate](0028-live-stack-reality-gate.md) | Accepted |
| 0029 | [Dev-loop performance baseline (Turbopack + dynamic-route warmer + Surface 7 budget)](0029-dev-loop-performance-baseline.md) | Accepted |

## Template

```md
# NNNN. <Title>

- Status: Proposed | Accepted | Superseded by <ADR>
- Date: YYYY-MM-DD
- Deciders: <names/roles>

## Context

What problem are we solving? What constraints apply?

## Decision

What did we choose?

## Consequences

What becomes easier? What becomes harder? What follow-up work is needed?

## Alternatives considered

Options not chosen, with a one-line reason each.
```
