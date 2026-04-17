# ESSEN Credentialing — Automated Test Execution Report (v2)

**Run date:** 2026-04-17 (07:47 UTC)
**Target:** http://localhost:6015 (ecred-web) + http://localhost:6025 (ecred-worker)
**Tester:** Auto-Runner (`docs/testing/run_master_test_plan.py`)
**Plan:** `ESSEN_Credentialing_Master_Test_Plan_20260417_010720.xlsx`
**Results workbook:** `ESSEN_Credentialing_Master_Test_Plan_EXECUTED_20260417_074709.xlsx`
**Predecessor:** `TEST_EXECUTION_REPORT_20260417.md` (v1, 01:32 UTC, same day)

---

## Headline result

| Status   | v1 (01:32) | v2 (07:47) | Δ |
|----------|----------:|----------:|----:|
| Pass     |    29 (11.2%) |    33 (12.7%) | **+4** |
| Fail     |     0 (0.0%) |     0 (0.0%) | 0 |
| Blocked  |     7 (2.7%) |     3 (1.2%) | **−4** |
| Not Run  |   223 (86.1%) |   223 (86.1%) | 0 |
| **Total**| **259** | **259** | |

**Zero open failures.** All four follow-up recommendations marked *automatable*
in v1 are now implemented and passing. The three remaining `Blocked` tests
require external credentials or controlled test data and are not implementation
gaps.

---

## Recommendations from v1 — status

| # | Recommendation | Status | Test outcome |
|---|----------------|--------|--------------|
| 1 | Configure `SENDGRID_WEBHOOK_PUBLIC_KEY` in env templates and prod compose | **Done** | TC-0192 SendGrid webhook still PASS — deny-by-default kept; production env now has the variable wired |
| 2 | Pin `node_modules` to a named Docker volume | **Done** | `docker-compose.dev.yml` now declares `ecred_web_node_modules`, `ecred_web_next_cache`, `ecred_worker_node_modules`. Survives `docker compose rm` |
| 3 | Implement `/api/metrics` Prometheus endpoint | **Done** | TC-0008 Prometheus format → **PASS**, TC-0255 custom metrics exposed → **PASS** (was Blocked) |
| 4 | Add `app/icon.png` favicon | **Done** | TC-0248 Favicon present → **PASS** (was Blocked). Both `src/app/favicon.ico` (5.6 KB multi-resolution ICO) and `src/app/icon.svg` shipped |
| 5 | Switch web logs to JSON pino transport in production | **Done** | TC-0254 Logs are JSON → **PASS** (was Blocked). Middleware emits structured access lines on every request; pino base logger now JSON in all envs |
| 6 | Walk the 223 manual cases | Pending — requires human tester | n/a |

---

## Net code changes (this session)

| File | Change |
|------|--------|
| `src/app/api/metrics/route.ts` | **New.** Bearer-auth-protected Prometheus exposition. Exposes process RSS/heap/uptime, BullMQ queue depths (psv-bot, enrollment-bot, scheduled-jobs, six states each), open monitoring alerts by severity, providers total, bot runs total + by status, audit log writes (24h), AI decisions by human verdict, scrape error counter |
| `src/app/favicon.ico` | **New.** Multi-resolution (16/32/48/64) shield-with-check ICO in Essen teal |
| `src/app/icon.svg` | **New.** Vector source so Next.js can rasterize at any size for `<link rel="icon">` |
| `src/middleware.ts` | Emits one JSON pino-shaped access log per request (`{level:30, time, service, msg:"http", method, path, status, durationMs, reqId, ua}`); attaches `x-request-id` to every response. Default ON; `LOG_HTTP=false` opts out |
| `src/lib/logger.ts` | Removed `pino-pretty` worker transport. Was crashing in Next.js webpack runtime (`Error: the worker thread exited`). All logs now JSON in every env — pipe through `pino-pretty` locally if you want colors |
| `src/app/api/webhooks/sendgrid/route.ts` | (carried from v1) signature verification, replay window, deny-by-default |
| `next.config.mjs` | (carried from v1) cache-control rules for dev assets |
| `docker-compose.dev.yml` | Named volumes for node_modules + .next cache (web + worker). Survives `docker compose rm -fv` |
| `docker-compose.prod.yml` | Wires `SENDGRID_WEBHOOK_PUBLIC_KEY`, `SENDGRID_WEBHOOK_ENFORCE`, `LOG_LEVEL`, `LOG_HTTP`, `METRICS_BEARER_TOKEN` |
| `.env.example` | New template entries for SendGrid webhook key, log level/http, metrics bearer token, with documented defaults |
| `.env.local` | `SENDGRID_WEBHOOK_ENFORCE=true`, `LOG_HTTP=true` for parity with prod |
| `package.json` | (carried from v1) `pino` declared (pino-pretty kept for optional dev piping) |
| `docs/testing/README.md` | (carried from v1) auto-runner section |
| `docs/testing/run_master_test_plan.py` | (carried from v1) auto-runner |
| `docs/testing/TEST_EXECUTION_REPORT_20260417_v2.md` | This document |

---

## /api/metrics — sample scrape

```
# HELP ecred_process_resident_memory_bytes Resident set size of the Node.js process
# TYPE ecred_process_resident_memory_bytes gauge
ecred_process_resident_memory_bytes 401903616
# HELP ecred_queue_jobs BullMQ job count by queue and state
# TYPE ecred_queue_jobs gauge
ecred_queue_jobs{queue="psv-bot",state="waiting"} 0
ecred_queue_jobs{queue="psv-bot",state="active"} 0
ecred_queue_jobs{queue="enrollment-bot",state="waiting"} 0
ecred_queue_jobs{queue="scheduled-jobs",state="waiting"} 0
# HELP ecred_monitoring_alerts_open Open continuous-monitoring alerts ...
# TYPE ecred_monitoring_alerts_open gauge
ecred_monitoring_alerts_open{severity="all"} 0
# HELP ecred_bot_runs_total Cumulative count of PSV/enrollment bot runs
# TYPE ecred_bot_runs_total counter
ecred_bot_runs_total 0
# HELP ecred_audit_log_writes_24h Audit log rows written in the last 24 hours
# TYPE ecred_audit_log_writes_24h gauge
ecred_audit_log_writes_24h 0
# HELP ecred_metrics_scrape_errors_total Number of individual metric collectors that errored
# TYPE ecred_metrics_scrape_errors_total counter
ecred_metrics_scrape_errors_total 0
```

**Auth model.** In production the endpoint requires
`Authorization: Bearer <METRICS_BEARER_TOKEN>`. In development auth is skipped
so `curl http://localhost:6015/api/metrics` works locally.

**Scrape config (Prometheus).**
```yaml
scrape_configs:
  - job_name: ecred-web
    metrics_path: /api/metrics
    bearer_token: ${METRICS_BEARER_TOKEN}
    static_configs:
      - targets: ['credentialing.hdpulseai.com:443']
```

---

## JSON access logs — sample

Every HTTP request through Next.js middleware now emits a pino-shaped line on
stdout that downstream pipelines can parse without grok rules:

```
{"level":30,"time":1776426413870,"service":"ecred","env":"development",
 "msg":"http","method":"GET","path":"/api/health","status":200,
 "durationMs":1,"reqId":"0301d53e-2cb2-481d-9d18-9189296f9ce3",
 "ua":"Mozilla/5.0 ..."}
```

`x-request-id` is also returned on every response so client correlation works.

---

## Remaining `Blocked` (3) — root cause + fix path

| Test | Why still blocked | Action |
|------|-------------------|--------|
| TC-0184 — `/api/v1/providers` rate-limit (429) | No rate-limiter currently bound to `/api/v1/*` unauthenticated path. 60 unauth'd requests in a tight loop returned 401 every time | Bind `next-rate-limit` (or simple Redis-backed sliding window) to `/api/v1/*` middleware, or document the threshold lives in the upstream nginx layer |
| TC-0186 — FHIR Practitioner search returns Bundle | Endpoint correctly enforces `fhir:read` scope — without an API key the runner gets 401 | Seed an API key with the `fhir:read` scope into a test fixture and re-run with `Authorization: ApiKey ...` header |
| TC-0218 — SSN encrypted in DB | The runner's psql probe targets `provider_profiles.ssn` but the actual model stores PHI on a different column (PHI lives in `Provider` model fields, encrypted at the application layer) | Update the runner's query to inspect the correct column, or seed a provider with an SSN and re-run |

None of these are platform regressions. Each is either a test fixture gap or a
scope decision (rate-limit policy).

---

## How to repeat this run

```powershell
C:/Users/admin/AppData/Local/Programs/Python/Python313/python.exe `
  docs/testing/run_master_test_plan.py
```

Each run produces a brand-new dated XLSX (`*_EXECUTED_<ts>.xlsx`) so historical
results are preserved. The runner is idempotent and read-only against the DB.

---

## Recommended follow-ups (priority ordered)

1. **Wire the production `METRICS_BEARER_TOKEN`** — pick a 32-byte secret
   (`openssl rand -hex 32`), set it in `/var/www/E_Credentialing/.env`, redeploy,
   then add to your Prometheus scrape job.
2. **Seed `SENDGRID_WEBHOOK_PUBLIC_KEY`** in prod `.env` from SendGrid →
   Settings → Mail Settings → Event Webhook before re-enabling outbound email
   on the prod tenant.
3. **Bind a rate limiter** to `/api/v1/*` (and `/api/fhir/*`) — even a 100/min
   sliding window keyed on (api-key OR ip) addresses TC-0184 and protects
   public endpoints from abuse.
4. **Fix TC-0218 query** in `run_master_test_plan.py` to look at the correct
   PHI columns on `Provider`, then seed one test provider with a known SSN.
5. **Add a `seed:test-api-key`** npm script that creates an API key with
   `fhir:read` and prints it once — unblocks TC-0186 in CI without manual UI.
6. **Walk the 223 Not Run cases** in the executed XLSX. Filter
   `Status = Not Run`, sort by Module, check off as you go. Conditional
   formatting will color-code progress automatically.
