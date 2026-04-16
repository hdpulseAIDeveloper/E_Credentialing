import { describe, expect, it } from "vitest";
import { verifyCsrf, generateCsrfToken, CSRF_HEADER_NAME } from "@/lib/api/csrf";

function makeReq(cookieToken: string | undefined, headerToken: string | undefined): Request {
  const headers = new Headers();
  if (cookieToken !== undefined) {
    headers.set("cookie", `csrf-token=${cookieToken}; other=1`);
  }
  if (headerToken !== undefined) {
    headers.set(CSRF_HEADER_NAME, headerToken);
  }
  return new Request("http://test.local/api/x", {
    method: "POST",
    headers,
  });
}

describe("verifyCsrf", () => {
  it("returns 403 when no cookie is present", async () => {
    const result = verifyCsrf(makeReq(undefined, "abc"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = (await result!.json()) as { error: string };
    expect(body.error).toBe("csrf_missing");
  });

  it("returns 403 when no header is present", async () => {
    const result = verifyCsrf(makeReq("abc", undefined));
    expect(result!.status).toBe(403);
    const body = (await result!.json()) as { error: string };
    expect(body.error).toBe("csrf_missing");
  });

  it("returns 403 when tokens do not match", async () => {
    const result = verifyCsrf(makeReq("aaaa", "bbbb"));
    expect(result!.status).toBe(403);
    const body = (await result!.json()) as { error: string };
    expect(body.error).toBe("csrf_mismatch");
  });

  it("returns null when tokens match exactly", () => {
    const t = generateCsrfToken();
    expect(verifyCsrf(makeReq(t, t))).toBeNull();
  });

  it("returns 403 when tokens differ in length (no timing leak)", () => {
    const result = verifyCsrf(makeReq("a", "ab"));
    expect(result!.status).toBe(403);
  });

  it("generateCsrfToken produces a 64-char hex string", () => {
    const t = generateCsrfToken();
    expect(t).toMatch(/^[a-f0-9]{64}$/);
  });
});
