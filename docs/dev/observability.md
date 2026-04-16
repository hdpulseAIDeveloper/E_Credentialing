# Observability

## Structured logs

`src/lib/logger.ts` exposes a `logger` (pino) and `childLogger(context)` helper.

### Rules

- Always use the logger; never `console.log` in application code.
- Pass structured fields, not string-interpolated values: `logger.info({ providerId }, "created provider")`.
- Errors: `logger.error({ err }, "message")`. The `err` key serializes stack traces via `pino.stdSerializers.err`.
- PHI: redacted automatically via `redact.paths`. If you add a new PHI field, update the redaction list in the same commit (the reviewer should catch this).

### Levels

| Level | When |
|-------|------|
| `fatal` | Process is about to exit |
| `error` | A request or job failed |
| `warn` | Recoverable issue or degraded behavior |
| `info` | Lifecycle events, mutations, scheduled job start/finish |
| `debug` | Local/dev diagnostic only; off in prod |
| `trace` | Very verbose, off unless explicitly enabled |

### Correlation

Every HTTP request picks up an `x-request-id` header (or generates one). Middleware sets `logger = childLogger({ requestId })` in the request context; all downstream logs carry the ID.

Workers carry `{ jobId, queue }` in their child logger.

## Health and probes

| Route | Purpose | Behavior |
|-------|---------|----------|
| `/api/live` | Liveness | Always 200 if the Node process is responsive. No deps. |
| `/api/ready` | Readiness | 200 only if Postgres + Redis reachable. 503 otherwise. |
| `/api/health` | Legacy alias | Same as `/api/ready`. |

Container orchestrators (Azure Container Apps) should use `/api/live` for liveness and `/api/ready` for readiness.

## Metrics (planned)

Prometheus scrape endpoint at `/api/metrics`. Emitted:

- `http_requests_total{method,route,status}`
- `http_request_duration_seconds` (histogram)
- `bot_runs_total{bot_type,outcome}`
- `bot_run_duration_seconds`
- `queue_jobs_total{queue,status}`
- `audit_entries_total{action}`
- `encrypt_decrypt_errors_total`

Implementation plan: add `prom-client`, wire middleware, scrape from Azure Monitor.

## Distributed tracing (planned)

OpenTelemetry SDK, OTLP exporter to Azure Monitor Application Insights.
Spans from:

- HTTP requests (auto-instrumented via `@opentelemetry/instrumentation-http`)
- Prisma (instrumentation package)
- BullMQ (custom wrapper)
- Playwright (custom wrapper; one span per bot)

Baggage: `providerId`, `botType`, `jobId`.

## Error tracking (planned)

Sentry with PHI scrubbing at the edge. `sentry.server.config.ts` and `sentry.client.config.ts`. `beforeSend` drops payload for HTTP bodies by default and applies the same redact list as `pino`.

## Logs in production

Azure Container Apps collects stdout/stderr into Azure Monitor Logs. Pino's JSON lines make parsing trivial.

Log retention: 90 days by default; 7 years for anything tagged `compliance: true` (audit entries still primarily live in the DB, but duplicate logs are useful).

## Debugging a production incident

Start here:

1. Open Azure Portal → Container App → Logs.
2. Filter by `requestId` (grab from the failing client response headers).
3. Look for the last `error` log in the chain.
4. If the error references a bot, jump to Bull Board for that run.
5. If the error references DB, inspect the Audit Log for the preceding operations.

See also [runbooks/](runbooks/).
