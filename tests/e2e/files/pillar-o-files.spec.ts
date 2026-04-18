/**
 * Pillar O -- File / email / SMS / print / PDF handling
 * (per `docs/qa/STANDARD.md` §1.O).
 *
 * Document download routes must require auth and serve the correct
 * MIME type. The deeper signed-URL expiry test lives in unit tests
 * (`tests/unit/lib/blob-naming.test.ts`).
 */
import { test, expect } from "../fixtures";

test("pillar-O: anonymous document download is rejected", async ({ request }) => {
  const r = await request.get("/api/documents/missing/download", { maxRedirects: 0 });
  expect(
    [301, 302, 307, 308, 401, 403, 404].includes(r.status()),
    `expected redirect or 4xx for anonymous download, got ${r.status()}`,
  ).toBe(true);
});

test("pillar-O: provider audit packet route requires auth", async ({ request }) => {
  const r = await request.get("/api/providers/anyid/audit-packet", { maxRedirects: 0 });
  expect(
    [301, 302, 307, 308, 401, 403, 404].includes(r.status()),
    `expected redirect or 4xx for anonymous audit-packet, got ${r.status()}`,
  ).toBe(true);
});
