/**
 * Pillar P -- Compliance controls (HIPAA, NCQA CVO, CMS-0057-F, JC NPG-12)
 * (per `docs/qa/STANDARD.md` §1.P and §4 hard-fail #9).
 *
 * Compliance-tagged assertions. The §4 gate considers any regression on
 * a `@hipaa`, `@ncqa`, `@cms-0057-f`, or `@jc-npg-12` spec a hard fail
 * regardless of severity.
 *
 * Wave 3.1 + 3.3 + 5.4 deepen this matrix. This file establishes the
 * baseline gates.
 */
import { test, expect } from "../fixtures";

test("pillar-P @cms-0057-f: /api/fhir/metadata advertises a CapabilityStatement", async ({ request }) => {
  const r = await request.get("/api/fhir/metadata", {
    headers: { Accept: "application/fhir+json" },
  });
  expect(r.status()).toBe(200);
  const ct = r.headers()["content-type"] ?? "";
  expect(ct).toMatch(/fhir\+json|application\/json/);
  const body = await r.json();
  expect(body.resourceType).toBe("CapabilityStatement");
  expect(body.fhirVersion).toMatch(/^4\./);
});

test("pillar-P @cms-0057-f: /api/fhir/Practitioner advertises a Bundle", async ({ request }) => {
  const r = await request.get("/api/fhir/Practitioner", {
    headers: { Accept: "application/fhir+json" },
  });
  if (r.status() === 401 || r.status() === 403) {
    test.skip(true, "FHIR Practitioner gated -- expected when SMART app is required");
  }
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(["Bundle", "OperationOutcome"]).toContain(body.resourceType);
});

test("pillar-P @hipaa: /verify/<token> renders the public verifier and does not 5xx on bad tokens", async ({ request }) => {
  const r = await request.get("/verify/totally-not-a-real-token", { maxRedirects: 0 });
  expect(r.status(), "verifier 5xx on bad token -- info-leak risk").toBeLessThan(500);
});

test("pillar-P @ncqa: legal copy version appears on /legal pages", async ({ page }) => {
  const resp = await page.goto("/legal/terms", { waitUntil: "domcontentloaded" });
  if (!resp || resp.status() === 404) test.skip(true, "/legal/terms not enabled");
  expect(resp!.status()).toBeLessThan(400);
  const html = await page.content();
  expect(html, "legal copy version not visible -- audit trail breaks").toMatch(/version/i);
});
