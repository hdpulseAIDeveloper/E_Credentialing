/**
 * Pillar R -- Observability (per `docs/qa/STANDARD.md` §1.R).
 *
 * /api/health, /api/ready, /api/live, /api/metrics return the shapes
 * downstream tools (orchestrator, Prometheus scraper, AppInsights
 * availability test) depend on.
 *
 * Wave 4.1 adds the Sentry beforeSend hook coverage and the AppInsights
 * trace-id propagation assertion. The cheap shape gates live here.
 */
import { test, expect } from "../e2e/fixtures";

test("pillar-R: /api/health returns the documented JSON shape", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body).toMatchObject({
    status: "ok",
    services: { database: "ok" },
  });
  expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(body.environment, "missing environment field").toBeTruthy();
});

test("pillar-R: /api/ready returns 200 or 503 with checks payload", async ({ request }) => {
  const r = await request.get("/api/ready");
  expect([200, 503]).toContain(r.status());
  const body = await r.json();
  expect(body.checks).toBeDefined();
  expect(typeof body.checks.database).toBe("boolean");
});

test("pillar-R: /api/metrics requires bearer in production-like config or works in dev", async ({ request }) => {
  const r = await request.get("/api/metrics");
  if (r.status() === 401) {
    expect(r.headers()["www-authenticate"], "401 without WWW-Authenticate").toMatch(/Bearer/i);
    return;
  }
  expect(r.status()).toBe(200);
  const body = await r.text();
  expect(body, "Prometheus exposition missing # HELP lines").toMatch(/# HELP /);
  expect(body, "Prometheus exposition missing # TYPE lines").toMatch(/# TYPE /);

  for (const required of [
    "ecred_process_resident_memory_bytes",
    "ecred_process_uptime_seconds",
    "ecred_queue_jobs",
    "ecred_providers_total",
    "ecred_audit_log_writes_24h",
  ]) {
    expect(body, `metric missing: ${required}`).toContain(required);
  }
});
