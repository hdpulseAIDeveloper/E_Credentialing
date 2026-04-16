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
