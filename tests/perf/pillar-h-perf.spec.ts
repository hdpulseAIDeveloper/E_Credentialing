/**
 * Pillar H -- Performance, load & soak (per `docs/qa/STANDARD.md` §1.H).
 *
 * Wave 4.2 lands the k6 perf suites under tests/perf/k6/** and the
 * postgres index audit. This file holds the cheap continuous-perf
 * assertions that run on every PR -- the heavy load tests run nightly
 * via k6 directly.
 *
 * The scaffold here is intentionally lightweight; the meat moves in
 * Wave 4.2.
 */
import { test, expect } from "../e2e/fixtures";

test("pillar-H: /api/health returns under 500ms cold and under 100ms warm", async ({ request }) => {
  const cold = Date.now();
  const r1 = await request.get("/api/health");
  const coldMs = Date.now() - cold;
  expect(r1.status()).toBe(200);
  expect(coldMs, `cold /api/health took ${coldMs}ms`).toBeLessThan(2000);

  const warm = Date.now();
  const r2 = await request.get("/api/health");
  const warmMs = Date.now() - warm;
  expect(r2.status()).toBe(200);
  expect(warmMs, `warm /api/health took ${warmMs}ms`).toBeLessThan(500);
});

test("pillar-H: /api/ready returns under 1s", async ({ request }) => {
  const t0 = Date.now();
  const r = await request.get("/api/ready");
  const ms = Date.now() - t0;
  expect([200, 503]).toContain(r.status());
  expect(ms, `/api/ready took ${ms}ms`).toBeLessThan(2000);
});
