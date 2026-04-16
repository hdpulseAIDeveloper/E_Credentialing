# Performance and Load Testing

## Targets (SLOs)

| Endpoint / Operation | p50 | p95 | p99 |
|----------------------|-----|-----|-----|
| Dashboard page load | 300 ms | 800 ms | 1.5 s |
| Provider detail page | 250 ms | 700 ms | 1.3 s |
| tRPC list queries (authenticated) | 100 ms | 250 ms | 500 ms |
| tRPC mutations | 150 ms | 400 ms | 800 ms |
| Public API GET /providers | 80 ms | 200 ms | 400 ms |
| FHIR Practitioner search | 120 ms | 350 ms | 700 ms |
| Bot job enqueue → start | 500 ms | 2 s | 5 s |
| Bot job typical duration | — | 45 s | 90 s |

## Load profile

Normal week:

- 20 concurrent staff users, mostly browsing and light editing.
- 50 provider sessions completing applications.
- 200 bot jobs per day, peaking 40/hour during business hours.
- 50 public API calls per hour (roster partners).

Peak day (post-open-enrollment surge):

- 80 concurrent staff users.
- 500 provider sessions.
- 1,000 bot jobs per day, peaking 150/hour.
- 300 API calls per hour.

## Tooling

- [k6](https://k6.io/) scripts under `tests/load/`.
- Runs against a staging environment sized equivalently to prod.
- Executed before each quarterly release.

## Scenarios

### 1. Steady-state

- 20 VUs hitting the dashboard, provider list, and a random provider detail page for 10 minutes.
- Asserts: error rate < 0.5%, p95 within SLO.

### 2. Burst of API callers

- 5 VUs each with a distinct API key, issuing `GET /providers?limit=50` every 5 s for 5 minutes.
- Asserts: rate limiter kicks in as configured, 429s include `retry-after`, no 5xx.

### 3. Bot surge

- 200 jobs enqueued within 10 seconds.
- Asserts: worker drains queue within 30 minutes; no jobs stuck in `waiting` for >5 minutes; no failed runs from resource contention.

### 4. CSV export

- 10 concurrent managers exporting 5,000-row reports.
- Asserts: p95 < 15 s; no OOM on the web pod.

## Database performance

- Every new query reviewed for:
  - Appropriate indexes (EXPLAIN on prod-sized data).
  - N+1 avoidance (use Prisma `select` and `include` intentionally).
  - Avoiding full table scans on audit_logs (always filter by actor or created_at range).
- Slow query log enabled (>500 ms).
- pg_stat_statements reviewed monthly.

## Front-end performance

Budgets:

- First Contentful Paint < 1.5 s on a mid-tier laptop.
- Largest Contentful Paint < 2.5 s.
- Cumulative Layout Shift < 0.05.
- Total Blocking Time < 300 ms.

Measured via Lighthouse CI on key pages on PR. Regressions > 10% block merge.

## Profiling

- Node: `clinic.js` for CPU profiles of the worker when bots are slow.
- Web: Chrome DevTools Performance panel for anecdotal slow pages.
- DB: `pg_stat_statements` + `EXPLAIN ANALYZE`.

## Backpressure

- BullMQ: max concurrency per worker = 5.
- Azure Blob: parallel upload concurrency = 4.
- External PSV sites: per-site concurrency = 1 (polite; avoids getting blocked).

## Capacity planning

Numbers above are baseline. Re-measure after every major module release and update this doc.
