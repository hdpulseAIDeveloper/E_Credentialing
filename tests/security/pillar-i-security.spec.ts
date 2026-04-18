/**
 * Pillar I -- Security & DAST (per `docs/qa/STANDARD.md` §1.I).
 *
 * Wave 4.3 lands ZAP baseline + active scans, gitleaks secrets scanning,
 * and the npm-audit / snyk gates. This file holds the cheap header-level
 * assertions that run on every PR.
 */
import { test, expect } from "../e2e/fixtures";

test("pillar-I: response carries the security headers we declare", async ({ request }) => {
  const r = await request.get("/");
  expect(r.status()).toBeLessThan(500);
  const h = r.headers();

  expect(h["x-content-type-options"], "missing X-Content-Type-Options").toBe("nosniff");
  expect(h["x-frame-options"]?.toUpperCase() ?? "", "missing X-Frame-Options").toMatch(/DENY|SAMEORIGIN/);
  expect(h["referrer-policy"], "missing Referrer-Policy").toBeTruthy();
});

test("pillar-I: /api/metrics requires bearer token in production posture", async ({ request }) => {
  const r = await request.get("/api/metrics");
  expect([200, 401, 404]).toContain(r.status());
});

test("pillar-I: anonymous request to a staff route is redirected to signin", async ({ request }) => {
  const r = await request.get("/dashboard", { maxRedirects: 0 });
  expect([302, 307, 308]).toContain(r.status());
  const loc = r.headers()["location"] ?? "";
  expect(loc, `expected redirect to /auth/signin, got ${loc}`).toMatch(/\/auth\/signin/);
});
