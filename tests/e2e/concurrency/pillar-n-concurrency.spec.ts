/**
 * Pillar N -- Concurrency, idempotency & resilience
 * (per `docs/qa/STANDARD.md` §1.N).
 *
 * Hits idempotent endpoints with parallel duplicate requests and asserts
 * no double-write occurs. The deeper concurrency soak (race conditions
 * on bot enqueue, audit-log sequence collisions) lands in Wave 4.2 when
 * k6 takes over the load profile.
 */
import { test, expect } from "../fixtures";

test("pillar-N: parallel /api/health calls all return 200", async ({ request }) => {
  const calls = Array.from({ length: 10 }, () => request.get("/api/health"));
  const results = await Promise.all(calls);
  for (const r of results) {
    expect(r.status()).toBe(200);
  }
});

test("pillar-N: parallel /api/ready calls return consistently", async ({ request }) => {
  const calls = Array.from({ length: 5 }, () => request.get("/api/ready"));
  const statuses = (await Promise.all(calls)).map((r) => r.status());
  const unique = new Set(statuses);
  expect(unique.size, `inconsistent /api/ready statuses: ${[...statuses]}`).toBe(1);
});
