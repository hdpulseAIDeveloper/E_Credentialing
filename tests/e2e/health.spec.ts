import { test, expect } from "@playwright/test";

test.describe("health endpoints", () => {
  test("GET /api/health returns 200", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
  });

  test("GET /api/socket returns the polling-mode sentinel", async ({ request }) => {
    const res = await request.get("/api/socket");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { realtime: string };
    expect(body.realtime).toMatch(/polling/i);
  });
});
