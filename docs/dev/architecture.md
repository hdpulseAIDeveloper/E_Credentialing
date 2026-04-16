# Architecture Overview

## Topology

```
                      ┌───────────────────────────┐
                      │      Azure Entra ID       │
                      │  (staff SSO via OIDC)     │
                      └──────────────┬────────────┘
                                     │
 Provider magic link (JWT)           │ Staff sign-in
          │                          │
          ▼                          ▼
┌────────────────────────────────────────────────┐
│   Next.js App (web container, port 6015)       │
│   - App Router + Server Actions                │
│   - tRPC routers                               │
│   - REST v1 + FHIR R4 endpoints                │
│   - Auth.js (Entra ID, credentials, magic)     │
└──────┬──────────────────┬───────────────────┬──┘
       │                  │                   │
       │ Prisma           │ @azure/storage    │ BullMQ enqueue
       ▼                  ▼                   ▼
 ┌──────────┐     ┌────────────────┐    ┌──────────┐
 │ Postgres │     │ Azure Blob     │    │  Redis   │
 │  (RLS +  │     │  Storage       │    │  pub/sub │
 │  audit)  │     │  (private)     │    │          │
 └──────────┘     └────────────────┘    └────┬─────┘
                                             │
                                             ▼
                             ┌─────────────────────────────┐
                             │   Worker container (:6025)  │
                             │   - BullMQ consumers        │
                             │   - Playwright PSV bots     │
                             │   - Bull Board UI           │
                             └─────────────────────────────┘
```

## Containers and responsibilities

### Web (`ecred-web`)

- Renders all pages (App Router).
- Serves tRPC, REST v1, FHIR R4, and internal API routes.
- Handles file uploads (multipart → Azure Blob).
- Mints signed SAS URLs for downloads.
- Enqueues jobs for the worker.

### Worker (`ecred-worker`)

- BullMQ consumers for every queue.
- Executes Playwright bots.
- Runs scheduled jobs (sanctions weekly sweep, expirables outreach, recredentialing initiation, roster generation).
- Bull Board UI on :6025 for observability.

### Shared dependencies

- Postgres (schema in `prisma/schema.prisma`).
- Redis (BullMQ queues, rate-limit counters).
- Azure Blob Storage (uploaded documents + bot output PDFs).
- Azure Key Vault (integration secrets, encryption keys, DEA TOTP seeds).

## Data flow: provider onboarding

1. Staff creates a provider (tRPC mutation → DB insert + audit).
2. Platform emails a provider invite with a JWT in the URL.
3. Provider clicks → app verifies the token via `src/lib/auth/provider-token.ts` (signature + single-active-token + provider status).
4. Provider completes application → data saved via `/api/application/save-section`. PHI fields encrypted at the app layer before insert.
5. Provider uploads documents → multipart `/api/upload` → streamed to Azure Blob; only `blobPath` persisted; `AuditLog` entry created.
6. On submit, application locks and PSV bots are enqueued.

## Data flow: PSV bot

1. Worker pulls a job from the `bot-runs` queue.
2. `BotBase.run()` creates or updates a `BotRun` row, starts Playwright, and calls the subclass `execute()`.
3. Bot navigates external site, captures PDF to Blob, and either sets status to `COMPLETED` or (for intervention) `REQUIRES_MANUAL`. `BotBase.run()` respects `REQUIRES_MANUAL` and does not auto-transition.
4. On `COMPLETED`, a `VerificationRecord` row is written with the parsed fields and flag evaluation.
5. Redis publishes an update; the web container broadcasts (client-side) via tRPC polling invalidation.

## Data flow: enrollment (delegated)

1. On provider approval, delegated enrollment records created per payer.
2. Monthly scheduled job `roster-generation` builds CSVs per payer into draft state.
3. Roster Manager reviews; click Submit.
4. For Availity, submission goes via API; for others, manual/email flow.
5. Acknowledgement recorded → `EnrollmentStateEvent` rows → provider `enrollments` panel updates.

## Authentication

- **Staff**: Auth.js v5 with the Entra ID provider. JWT sessions. MFA enforced at Entra. Local dev supports credentials.
- **Providers**: No session. They hold a JWT (`provider-invite`) tied to `Provider.inviteToken`. Tokens are single-use (revoked on attestation). A new invite replaces the old one (`Provider.inviteToken` is updated atomically).
- **Public API**: API key in `Authorization: Bearer <key>` header. Key is SHA-256 hashed in DB. Middleware handles lookup, rate-limit (by key), `lastUsedAt` update, and audit entry.
- **FHIR**: Same API-key scheme but errors wrap in FHIR `OperationOutcome`.

## Real-time updates

Socket.io was evaluated and removed — it does not fit the Next.js standalone build. The platform uses tRPC polling (`refetchInterval`) for near-real-time UI updates. Typical polling:

- Bot status while queued/running: every 5 seconds.
- Dashboard counts: every 30 seconds.
- Report pages: on load only (explicit refresh).

Redis pub/sub still connects worker and web for internal event fan-out when useful (e.g., bulk roster generation completion), but the wire-layer to the browser is HTTP polling.

## Encryption

- At rest: AES-256-GCM at the application layer (`src/lib/encryption.ts`) for SSN, DOB, home address, home phone, any other PHI explicitly marked.
- In transit: TLS 1.2+ on every hop. Internal container-to-container traffic uses the private Docker network.
- Azure-level encryption (Azure Storage Service Encryption) is on by default for Blob and Database.

See [encryption.md](encryption.md) for details.

## Observability

- Structured logs via `pino` with PHI redaction. `src/lib/logger.ts` is the entry point.
- Health endpoints:
  - `/api/live` — liveness, never touches external deps.
  - `/api/ready` — readiness, checks Postgres and Redis.
  - `/api/health` — legacy alias for `/api/ready`.
- Metrics (planned): Prometheus scrape endpoint, OpenTelemetry traces. See [observability.md](observability.md).

## Background jobs

| Queue | Consumer | Schedule |
|-------|----------|----------|
| `bot-runs` | `botWorker` | On-demand |
| `scheduled` | `scheduledWorker` | Cron |
| `sanctions-recheck` | `scheduledWorker` | Weekly Monday 02:00 ET |
| `expirables-outreach` | `scheduledWorker` | Daily 07:00 ET |
| `recredentialing-initiation` | `scheduledWorker` | Daily 06:00 ET |
| `roster-generation` | `scheduledWorker` | Monthly, 1st 03:00 ET |

## Cross-cutting concerns

- **Audit logging**: Every mutation goes through a `writeAudit(...)` wrapper in the service layer (in progress). For API requests, `auditApiRequest()` in `src/lib/api/audit-api.ts` records method, path, user, query, result count, status.
- **Rate limiting**: Public API uses `src/lib/api/rate-limit.ts` — fixed-window in-process. Upgrade to Redis-backed when we move past a single web container.
- **Feature flags**: `Administration → Features` persists flags in DB. Read through a `useFeature(flag)` helper on the client.
