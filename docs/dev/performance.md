# Performance — load testing & index audit

Wave 4.2 — load test scaffolding and Postgres index health audits for
the E-Credentialing CVO platform.

## k6 load tests

Scenarios live under `tests/perf/k6/**`. See
`tests/perf/k6/README.md` for usage / CI wiring.

| npm script | Scenario | Default budget |
| --- | --- | --- |
| `npm run perf:k6:health` | `/api/live`, `/api/ready`, `/api/health` | p95 < 500ms |
| `npm run perf:k6:metrics` | Prometheus `/api/metrics` scrape latency | p95 < 1500ms |
| `npm run perf:k6:fhir` | FHIR public surface (CapabilityStatement + searches) | p95 < 1500ms |
| `npm run perf:k6:api` | Public REST API (providers, sanctions) | p95 < 1500ms |

The lightweight per-PR perf checks live in
`tests/perf/pillar-h-perf.spec.ts` (Playwright). The k6 suites are
intended for nightly runs against staging or a dedicated perf
environment; they run for >30s each and need a real BullMQ + Postgres
stack.

### Adding a scenario

1. New file in `tests/perf/k6/<name>.js`.
2. Export `options.thresholds` (`http_req_duration`, `http_req_failed`).
3. Add an `npm` script entry in `package.json` and update the table
   above.

## Postgres index audit

The audit script lives at `scripts/db/index-audit.ts`. Run it from
the app's environment so it can resolve the configured
`DATABASE_URL`:

```bash
npm run db:index-audit                       # human-readable text
npm run db:index-audit -- --format=json      # machine-readable
npm run db:index-audit -- --format=markdown  # for PR comments
```

### What the audit checks

| Check | Failure heuristic | Exit code |
| --- | --- | --- |
| Missing FK indexes | Any FK column without a leading-column index | `1` |
| Unused secondary indexes | `idx_scan = 0` since last `pg_stat_reset()`, excluding `_pkey` | informational |
| Seq-scan hotspots | `n_live_tup > 1000 AND seq_scan > 10 * idx_scan` | informational |

### Wiring into CI

Add a nightly job that:

1. Restores the latest staging snapshot into a disposable Postgres.
2. Runs `npm run db:index-audit -- --format=json > index-audit.json`.
3. Parses `missingFkIndexes.length`. Fail the build on > 0.
4. Uploads the JSON as an artifact for trend tracking.

### Acting on results

- **Missing FK index**: add a Prisma `@@index` and regenerate the
  client. New migration name should match
  `add_<table>_<column>_index`.
- **Unused index**: confirm the queries that originally needed it are
  still in use, then drop it via a migration. Don't drop indexes from
  external libraries (Auth.js, etc.) without coordination.
- **Seq-scan hotspot**: open `pg_stat_statements`, find the slow query
  hitting that table, add a composite index whose leading column
  matches the most selective predicate.
