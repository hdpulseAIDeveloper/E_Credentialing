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

## Metrics (Wave 4.1 — landed)

Prometheus scrape endpoint at `/api/metrics`. Auth: `Authorization: Bearer ${METRICS_BEARER_TOKEN}` in production; open in dev.

Currently emitted (text exposition):

- `ecred_process_resident_memory_bytes`, `ecred_process_heap_used_bytes`, `ecred_process_uptime_seconds`
- `ecred_queue_jobs{queue,state}` — BullMQ depth across all queues
- `ecred_monitoring_alerts_open{severity}` — open continuous-monitoring alerts
- `ecred_bot_runs_total`, `ecred_bot_runs_by_status{status}`
- `ecred_providers_total`
- `ecred_audit_log_writes_24h`
- `ecred_ai_decisions_total{decision}`
- `ecred_metrics_scrape_errors_total`
- `ecred_trpc_calls_total{path,type,result}` *(Wave 4.1)*
- `ecred_trpc_duration_ms{path,type,result}` *(Wave 4.1)*

The `ecred_trpc_*` series come from the in-process counter registry
maintained by `src/lib/telemetry/index.ts`. Anything you record via
`recordCounter()` / `recordHistogram()` automatically appears in the
next scrape — no Prometheus client lib required for the basic case.

When `prom-client` is installed in staging/prod (`npm i prom-client`)
the registry will be replaced with the proper histogram-bucket
implementation; the metric names and labels are stable.

A pre-built Grafana dashboard ships at
`infra/grafana/dashboards/ecred-platform-health.json` — see
`infra/grafana/README.md` for provisioning steps.

## Error tracking + APM (Wave 4.1 — landed)

`src/lib/telemetry/index.ts` is the single integration point for
Sentry and Azure Application Insights. Both SDKs are **lazy-loaded**:

- Install in staging/prod only: `npm i @sentry/nextjs applicationinsights`
- Set env vars: `SENTRY_DSN`, `APPLICATIONINSIGHTS_CONNECTION_STRING`
- Next.js `instrumentation.ts.register()` calls `initTelemetry()`
  on every Node-runtime cold start
- The worker bootstrap (`src/workers/index.ts`) does the same with
  `serviceName: "ecred-worker"` so Application Insights' cloud-role
  filter splits app vs. worker dependency graphs.

When SDKs aren't installed or env vars are unset, the wrapper degrades
to a pure no-op (the in-process Prometheus registry still works). This
keeps `npm run test` and local dev light.

PHI safety: `captureException(err, context)` scrubs known PHI keys
(`ssn`, `dob`, `mrn`, `personalEmail`, `mobilePhone`, etc.) from the
context before forwarding to either sink.

## Distributed tracing (planned, Wave 4.2)

OpenTelemetry SDK, OTLP exporter to Azure Monitor / Tempo. Spans from
HTTP requests, Prisma, BullMQ, Playwright (one span per bot run).
Baggage: `providerId`, `botType`, `jobId`.

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
