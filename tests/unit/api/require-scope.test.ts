import { describe, expect, it } from "vitest";
import { requireScope, API_SCOPES } from "@/app/api/v1/middleware";

describe("requireScope", () => {
  it("returns 401 when auth is invalid", () => {
    const res = requireScope({ valid: false }, "providers:read");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("returns 401 when permissions object is missing", () => {
    const res = requireScope({ valid: true, keyId: "k1" }, "providers:read");
    expect(res!.status).toBe(401);
  });

  it("returns 403 when the required scope is not granted", async () => {
    const res = requireScope(
      { valid: true, keyId: "k1", permissions: { "providers:read": false } },
      "providers:read",
    );
    expect(res!.status).toBe(403);
    // Wave 13 standardised every v1 error to the OpenAPI envelope:
    //   { "error": { "code": "...", "message": "...", ...extras } }
    const body = (await res!.json()) as {
      error: { code: string; message: string; required: string };
    };
    expect(body.error.code).toBe("insufficient_scope");
    expect(body.error.required).toBe("providers:read");
  });

  it("returns 403 when the key has a different scope only", () => {
    const res = requireScope(
      { valid: true, keyId: "k1", permissions: { "sanctions:read": true } },
      "providers:read",
    );
    expect(res!.status).toBe(403);
  });

  it("returns null when the scope is granted", () => {
    const res = requireScope(
      { valid: true, keyId: "k1", permissions: { "providers:read": true } },
      "providers:read",
    );
    expect(res).toBeNull();
  });

  it("403 body is RFC 9457 Problem-shaped (since Wave 19 / spec v1.8.0)", async () => {
    const req = new Request("https://h/api/v1/providers", {
      headers: { accept: "application/problem+json" },
    });
    const res = requireScope(
      { valid: true, keyId: "k1", permissions: { "providers:read": false } },
      "providers:read",
      req,
    );
    expect(res!.status).toBe(403);
    expect(res!.headers.get("content-type")).toBe("application/problem+json");
    const body = (await res!.json()) as {
      type: string;
      title: string;
      status: number;
      detail: string;
      instance: string;
      error: { code: string; message: string; required: string };
    };
    expect(body.type).toContain("/errors/insufficient-scope");
    expect(body.title).toBe("Insufficient scope");
    expect(body.status).toBe(403);
    expect(body.detail).toContain("providers:read");
    expect(body.instance).toBe("/api/v1/providers");
    expect(body.error.code).toBe("insufficient_scope");
    expect(body.error.required).toBe("providers:read");
  });

  it("exposes every scope listed in docs/api/authentication.md", () => {
    expect(API_SCOPES).toContain("providers:read");
    expect(API_SCOPES).toContain("sanctions:read");
    expect(API_SCOPES).toContain("enrollments:read");
    expect(API_SCOPES).toContain("fhir:read");
  });
});
