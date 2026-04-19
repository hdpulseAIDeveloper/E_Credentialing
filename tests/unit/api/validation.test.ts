/**
 * Unit tests for `src/lib/api/validation.ts` (Wave 20).
 *
 * Covers:
 *   - `parseQuery` happy path and failure path
 *   - `validationProblemResponse` body shape (RFC 9457 superset
 *     with `errors[]` extension + legacy `error` envelope preserved)
 *   - Content-Type negotiation (delegated to Wave 19's helper —
 *     verified end-to-end here)
 *   - `fieldPathFromZodIssue` joining semantics
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  fieldPathFromZodIssue,
  issuesToFieldErrors,
  parseQuery,
  VALIDATION_ERROR_CODE,
  validationProblemResponse,
} from "@/lib/api/validation";
import {
  PROBLEM_CONTENT_TYPE,
  JSON_CONTENT_TYPE,
} from "@/lib/api/problem-details";

function makeRequest(url: string, accept?: string): Request {
  return new Request(url, {
    headers: accept ? { Accept: accept } : undefined,
  });
}

describe("fieldPathFromZodIssue", () => {
  it("joins nested string segments with '.'", () => {
    expect(fieldPathFromZodIssue({ path: ["filters", "status"] } as never)).toBe(
      "filters.status",
    );
  });
  it("includes numeric segments as plain numbers", () => {
    expect(fieldPathFromZodIssue({ path: ["items", 2, "id"] } as never)).toBe(
      "items.2.id",
    );
  });
  it("returns empty string for the root path", () => {
    expect(fieldPathFromZodIssue({ path: [] } as never)).toBe("");
  });
});

describe("issuesToFieldErrors", () => {
  it("maps Zod issues to wire-shape field errors", () => {
    const schema = z.object({
      page: z.coerce.number().int().min(1),
      limit: z.enum(["10", "25", "50"]),
    });
    const result = schema.safeParse({ page: "0", limit: "999" });
    expect(result.success).toBe(false);
    const errors = issuesToFieldErrors(result.success ? [] : result.error.issues);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    const fields = errors.map((e) => e.field).sort();
    expect(fields).toContain("page");
    expect(fields).toContain("limit");
    for (const e of errors) {
      expect(typeof e.code).toBe("string");
      expect(e.code.length).toBeGreaterThan(0);
      expect(typeof e.message).toBe("string");
    }
  });
});

describe("validationProblemResponse", () => {
  it("emits a 400 Problem with errors[], legacy envelope, and instance", async () => {
    const request = makeRequest("https://api.example.com/api/v1/providers?page=0");
    const errors = [
      { field: "page", code: "too_small", message: "Number must be greater than or equal to 1" },
    ];
    const response = validationProblemResponse(request, errors);
    expect(response.status).toBe(400);

    const body = (await response.json()) as Record<string, unknown> & {
      errors: unknown;
      error: { code: string; message: string };
    };
    expect(body.type).toBe(
      "https://essen-credentialing.example/errors/invalid-request",
    );
    expect(body.title).toBe("Invalid request");
    expect(body.status).toBe(400);
    expect(body.detail).toBe("Request validation failed");
    expect(body.instance).toBe("/api/v1/providers");

    expect(body.errors).toEqual(errors);

    expect(body.error.code).toBe(VALIDATION_ERROR_CODE);
    expect(body.error.message).toBe("Request validation failed");
  });

  it("respects custom `detail`", async () => {
    const request = makeRequest("https://api.example.com/api/v1/providers");
    const response = validationProblemResponse(request, [], "Custom detail");
    const body = (await response.json()) as { detail: string };
    expect(body.detail).toBe("Custom detail");
  });

  it("returns application/problem+json when client accepts it explicitly", () => {
    const request = makeRequest(
      "https://api.example.com/api/v1/providers",
      "application/problem+json",
    );
    const response = validationProblemResponse(request, []);
    expect(response.headers.get("content-type")).toBe(PROBLEM_CONTENT_TYPE);
  });

  it("returns application/problem+json when client accepts application/json (RFC 9457 §3 — JSON variant)", () => {
    const request = makeRequest(
      "https://api.example.com/api/v1/providers",
      "application/json",
    );
    const response = validationProblemResponse(request, []);
    expect(response.headers.get("content-type")).toBe(PROBLEM_CONTENT_TYPE);
  });

  it("falls back to application/json when client explicitly excludes both JSON variants", () => {
    const request = makeRequest(
      "https://api.example.com/api/v1/providers",
      "text/html",
    );
    const response = validationProblemResponse(request, []);
    expect(response.headers.get("content-type")).toBe(JSON_CONTENT_TYPE);
  });

  it("omits instance when no request URL is available", async () => {
    const response = validationProblemResponse(null, []);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.instance).toBeUndefined();
  });
});

describe("parseQuery", () => {
  const schema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(["APPROVED", "DENIED"]).optional(),
  });

  it("returns parsed data on a valid query string", () => {
    const request = makeRequest(
      "https://api.example.com/api/v1/providers?page=2&limit=50&status=APPROVED",
    );
    const result = parseQuery(request, schema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ page: 2, limit: 50, status: "APPROVED" });
    }
  });

  it("applies defaults when keys are missing", () => {
    const request = makeRequest("https://api.example.com/api/v1/providers");
    const result = parseQuery(request, schema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ page: 1, limit: 25 });
    }
  });

  it("returns a 400 Problem on invalid coercion", async () => {
    const request = makeRequest(
      "https://api.example.com/api/v1/providers?limit=foo",
    );
    const result = parseQuery(request, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = (await result.response.json()) as {
        errors: { field: string }[];
      };
      expect(body.errors.some((e) => e.field === "limit")).toBe(true);
    }
  });

  it("returns a 400 Problem on enum violations", async () => {
    const request = makeRequest(
      "https://api.example.com/api/v1/providers?status=GARBAGE",
    );
    const result = parseQuery(request, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = (await result.response.json()) as {
        errors: { field: string; code: string }[];
      };
      const statusErr = body.errors.find((e) => e.field === "status");
      expect(statusErr).toBeTruthy();
      expect(statusErr!.code).toBe("invalid_enum_value");
    }
  });

  it("returns a 400 Problem with multiple errors when the query has multiple problems", async () => {
    const request = makeRequest(
      "https://api.example.com/api/v1/providers?page=0&limit=999&status=BAD",
    );
    const result = parseQuery(request, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = (await result.response.json()) as {
        errors: { field: string }[];
      };
      const fields = body.errors.map((e) => e.field).sort();
      expect(fields).toEqual(["limit", "page", "status"].sort());
    }
  });
});
