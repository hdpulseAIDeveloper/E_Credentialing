# Performance & Scalability

**Audience:** Engineers and architects sizing the platform.

## 1. Targets

| Surface | Metric | Target | Hard fail |
|---|---|---|---|
| Staff page | TTFB | p50 < 500 ms; p95 < 1 s | p95 > 3 s |
| Staff page | LCP | p95 < 2.5 s | p95 > 4 s |
| tRPC mutation | latency | p95 < 800 ms | p95 > 2 s |
| Public REST | latency | p95 < 200 ms @ 50 RPS | p95 > 500 ms |
| FHIR | latency | p95 < 400 ms @ 20 RPS | p95 > 1 s |
| Bot run end-to-end | duration | typical < 90 s; outliers < 5 min | > 10 min |
| Queue depth | bot | < 50 backlog | > 200 backlog |

## 2. Current measurements (last verified 2026-04-15)

- Staff dashboard p95 TTFB: 740 ms (within target).
- tRPC `provider.list` p95: 480 ms.
- License-verification bot median: 62 s.
- API key REST `provider.summary` p95: 145 ms at 30 RPS.
- DB CPU: 25–40% steady; 60% during expirables sweep.

## 3. Bottlenecks identified

1. Document OCR queue throughput — Azure AI DI single endpoint; mitigation in
   Phase 4 with second endpoint + retry pool.
2. Sanctions sweep runtime — currently ~25 minutes; partition by list type in
   Phase 5.
3. Roster generation for large payers — CPU-bound; stream output instead of
   buffering in Phase 4.

## 4. Scale-out plan

- **Web tier:** containerize stateless; add replicas behind Nginx; sticky
  sessions not required (JWT cookies).
- **Worker tier:** add replicas; BullMQ supports many consumers per queue.
- **DB:** vertical first; introduce read replicas for reports & FHIR in
  Phase 5; partition `AuditLog` by month if > 50M rows.
- **Redis:** Azure Cache standard tier; upgrade to premium if eviction
  observed.
- **Blob:** GRS already; tier policy: hot for ≤ 90 days, cool after.

## 5. Load-test playbook

- k6 scripts under `tests/load/`. Run nightly against staging in Phase 5.
- Scenarios: dashboard browse, provider create + bots, public REST burst,
  FHIR pagination.
- Pass criteria mirror § 1 targets.

## 6. Cost guardrails

- Azure DI per-page billing — alert if > 2× monthly baseline.
- BullMQ retry storms — alert on > 3× normal job count / hour.
- Outbound SMS — daily cap configured in `.env` (`SMS_DAILY_CAP`).

## 7. Caching policy

- Server: no Prisma cache (correctness > speed).
- Client: React Query default; mutations invalidate explicit keys, never
  blanket invalidations.
- HTTP: `Cache-Control: no-store` for staff pages; `public, max-age=86400`
  for static assets with content hashing.
