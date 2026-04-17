# Architecture

**Audience:** Developers, architects.
**Status:** Reflects the deployed system as of 2026-04-17.

This document is the long-form companion to the architecture summary in the
[TRD](technical-requirements.md#3-architecture-summary) and the practical
[dev/architecture.md](../dev/architecture.md). Read this when you need the
full picture; read the dev guide when you need to do the work.

---

## 1. Topology

```
                                ┌──────────────────────┐
        Internet ──TLS─────────►│       Nginx          │
                                │  (reverse proxy +    │
                                │   Let's Encrypt)     │
                                └──────────┬───────────┘
                                           │ HTTP
                       ┌───────────────────┴───────────────────┐
                       ▼                                       ▼
              ┌──────────────────┐                   ┌──────────────────┐
              │   ecred-web      │                   │   ecred-worker   │
              │   Next.js 14     │                   │   BullMQ + bots  │
              │   Auth.js / tRPC │                   │   Bull Board     │
              │   port 6015      │                   │   port 6025      │
              └─────┬─────┬──────┘                   └─────┬─────┬──────┘
                    │     │                                │     │
              ┌─────▼─┐ ┌─▼──────┐                  ┌──────▼┐ ┌──▼─────┐
              │  PG   │ │ Redis  │ ◄─── Same shared instances ──►        │
              │  16   │ │        │                  │       │ │        │
              └───────┘ └────────┘                  └───────┘ └────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ Azure Blob      │
                   │ Azure Key Vault │
                   │ Azure AI DI     │
                   │ SendGrid / ACS  │
                   └─────────────────┘
```

## 2. Container responsibilities

### `ecred-web`

- All HTTP traffic to / from users.
- Renders App Router pages (server components by default).
- Hosts tRPC, REST v1, FHIR R4, Auth.js routes.
- Handles upload streams.
- Enqueues bot/notification jobs.
- Runs `prisma migrate deploy` at startup via `scripts/web-entrypoint.sh`.
- Healthcheck `/api/ready` (DB + Redis + Blob).

### `ecred-worker`

- BullMQ consumers (bots, notifications, enrollment side-effects, sweeps).
- Playwright browsers preinstalled.
- Bull Board UI for queue inspection.
- No outward HTTP except to scraping targets, SendGrid, ACS, Azure SDKs.
- Healthcheck `/api/health`.

## 3. Data flows

### Provider onboarding (happy path)

1. iCIMS hire → webhook to `POST /api/integrations/icims/webhook`.
2. tRPC `provider.create` upserts provider, generates JWT invite token, hashes it,
   sends email via `notifications` queue.
3. Provider clicks link → magic-link verifies token → `(provider)/application`
   form is rendered.
4. Provider saves data → tRPC `enrollment.upsertSection`.
5. Provider attests → token revoked, status `INTAKE`.
6. Bot orchestrator enqueues PSV bots based on enabled bot configs.
7. Bots write `BotRun` rows; `RawSourceDoc` PDFs uploaded to blob.
8. Sanctions sweep runs nightly; matches surfaced for review.
9. Once "Ready for Committee" criteria met, file routed to committee module.

### Bot run

1. Web tier validates inputs and enqueues a `bot:<key>` job with provider id + bot id.
2. Worker picks up job; `BotBase.run()` loads context, opens Playwright page, calls subclass `execute()`.
3. Outputs persisted: `BotRun`, `RawSourceDoc`, parsed `Verification`.
4. Failure → retry up to 3 with exponential backoff; manual-only bots skip auto-retry.
5. UI polls `bot.recentRuns` every 5 s to update.

### Public API call

1. Client sends `Authorization: Bearer ck_…` to `/api/v1/...`.
2. `withApiKeyAuth` middleware loads key by SHA-256 hash, checks scope, increments rate limit, writes audit row.
3. Handler hits Prisma; PHI fields stripped per scope.
4. JSON returned.

## 4. Authentication & authorization

Three identity domains, three sign-in flows. Implementation in `src/lib/auth.ts`,
middleware in `src/middleware.ts`, role checks in tRPC procedures.

| Identity | Flow | Session | Authorization |
|---|---|---|---|
| Staff | Entra ID OIDC via Auth.js | encrypted JWT cookie | `Role` enum, group-mapped |
| Provider | One-time JWT magic link | session cookie scoped to `(provider)` | row-level: `provider.id === session.providerId` |
| Public API | API key (Bearer) | none (stateless) | `ApiKeyScope` enum |

See [dev/auth.md](../dev/auth.md) for a step-by-step reference.

## 5. Real-time updates

Polling-only; Socket.io was removed. tRPC queries with `refetchInterval`
provide near-real-time UI for:

- Bot status (5 s).
- Dashboard counters (30 s).
- Notifications bell (60 s).

## 6. Encryption & secrets

| Data | Mechanism |
|---|---|
| In transit | TLS 1.2+ |
| PHI at rest | AES-256-GCM (`src/lib/encryption.ts`) |
| Documents | Azure Blob server-side encryption (Microsoft-managed keys) |
| Secrets | Azure Key Vault; loaded at startup |
| Audit chain | HMAC-SHA256 (`AUDIT_HMAC_KEY`) |

Key rotation:

- `NEXTAUTH_SECRET`: rotate quarterly; coordinate downtime (invalidates sessions).
- `AUDIT_HMAC_KEY`: rotate per documented procedure (snapshot + new chain root).
- API keys: rotate per consumer schedule; old key valid until explicitly revoked.

## 7. Observability

- Logs — `pino` JSON, redaction paths in `src/lib/logger.ts`.
- HTTP access logs — `pino-http` on the App Router instrumentation hook.
- Metrics — `/api/metrics` Prometheus exposition; counters for HTTP, tRPC,
  BullMQ, bot success rates, sanctions matches, audit chain length.
- Probes — `/api/live`, `/api/ready`, legacy `/api/health`.
- Bull Board — worker `:6025/admin/queues`.
- Audit verifier — `npm run audit:verify` (and nightly worker job).

## 8. Background jobs

Queue catalog (BullMQ): `bot`, `enrollment`, `notifications`, `sweeps`,
`reports`, `monitoring`. See [dev/bots.md](../dev/bots.md). Each queue has
distinct concurrency, retry, and rate-limit settings.

Scheduled jobs (defined in `src/server/jobs`):

- `expirables.sweep` — daily 02:00.
- `sanctions.sweep` — Sunday 03:00.
- `npdb.cqQuery` — daily.
- `audit.verify` — daily 04:00.
- `cleanups.expiredTokens` — hourly.
- `sla.calc` — every 30 minutes.

## 9. Cross-cutting concerns

| Concern | Implementation |
|---|---|
| Validation | zod schemas next to each tRPC procedure |
| Caching | Redis for rate limits, Prisma query caching off (correctness > speed) |
| Background work | BullMQ |
| File storage | Azure Blob |
| OCR / classification | Azure AI Document Intelligence + LLM via internal facade |
| Email | SendGrid (transactional + Inbound Parse) |
| SMS | Azure Communication Services |
| Tracing | OpenTelemetry (planned Phase 5) |
| Errors to ops | Sentry (planned Phase 5) |

## 10. Failure modes

| Failure | Detection | Mitigation |
|---|---|---|
| DB unavailable | `/api/ready` 503 | Web returns 503; worker pauses queues |
| Redis unavailable | `/api/ready` 503 | Worker stops; web shows degraded notice |
| Bot site change | Bot retries fail x3 → `MANUAL` | Engineer updates selectors; backlog reprocessed |
| AV scan unavailable | Upload fails closed | Show user upload error; retry policy; queue offline scan |
| Blob unavailable | Upload / download error | Banner; document operations disabled |
| AUDIT_HMAC_KEY missing in prod | Boot fails | Set via Key Vault and restart |

## 11. Change history

- 2026-04-17 — Documentation refresh; pulled the deep architecture content out
  of the older `docs/technical.md` and aligned with current router / migration
  inventory.
- 2026-04-16 — Healthcheck timing tightened; observability endpoints documented.
- 2026-03 — Removed Socket.io; polling everywhere.
