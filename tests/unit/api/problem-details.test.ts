import { describe, expect, it } from "vitest";

import {
  buildProblem,
  JSON_CONTENT_TYPE,
  negotiateProblemContentType,
  problemResponse,
  problemTitleFor,
  problemTypeUri,
  PROBLEM_CONTENT_TYPE,
  PROBLEM_TITLES,
} from "@/lib/api/problem-details";

describe("problem-details helper (RFC 9457)", () => {
  describe("problemTypeUri", () => {
    it("emits a stable URI per error code (kebab-case path)", () => {
      expect(problemTypeUri("not_found")).toBe(
        "https://essen-credentialing.example/errors/not-found",
      );
      expect(problemTypeUri("rate_limited")).toBe(
        "https://essen-credentialing.example/errors/rate-limited",
      );
      expect(problemTypeUri("insufficient_scope")).toBe(
        "https://essen-credentialing.example/errors/insufficient-scope",
      );
    });
  });

  describe("problemTitleFor", () => {
    it("returns the explicit title for known codes", () => {
      expect(problemTitleFor("not_found")).toBe(PROBLEM_TITLES.not_found);
      expect(problemTitleFor("rate_limited")).toBe(PROBLEM_TITLES.rate_limited);
      expect(problemTitleFor("insufficient_scope")).toBe(
        PROBLEM_TITLES.insufficient_scope,
      );
    });

    it("falls back to a Title-Cased rendering for unknown codes", () => {
      expect(problemTitleFor("custom_unmapped_code")).toBe(
        "Custom Unmapped Code",
      );
      expect(problemTitleFor("foo")).toBe("Foo");
    });
  });

  describe("buildProblem", () => {
    it("includes all RFC 9457 standard members", () => {
      const body = buildProblem({
        status: 404,
        code: "not_found",
        message: "Provider not found",
        instance: "/api/v1/providers/abc",
      });
      expect(body.type).toBe(
        "https://essen-credentialing.example/errors/not-found",
      );
      expect(body.title).toBe("Resource not found");
      expect(body.status).toBe(404);
      expect(body.detail).toBe("Provider not found");
      expect(body.instance).toBe("/api/v1/providers/abc");
    });

    it("preserves the legacy { error: { code, message, ...extras } } envelope", () => {
      const body = buildProblem({
        status: 403,
        code: "insufficient_scope",
        message: "missing providers:read",
        extras: { required: "providers:read" },
      });
      expect(body.error.code).toBe("insufficient_scope");
      expect(body.error.message).toBe("missing providers:read");
      expect(body.error.required).toBe("providers:read");
    });

    it("merges extras at the top level too (RFC 9457 §3.2 extension members)", () => {
      const body = buildProblem({
        status: 429,
        code: "rate_limited",
        message: "Rate limit exceeded",
        extras: { retryAfterSeconds: 7 },
      });
      expect(body.retryAfterSeconds).toBe(7);
      expect(body.error.retryAfterSeconds).toBe(7);
    });

    it("omits instance when not provided", () => {
      const body = buildProblem({
        status: 401,
        code: "unauthorized",
        message: "Unauthorized",
      });
      expect("instance" in body).toBe(false);
    });

    it("emits status as the numeric value (not a string)", () => {
      const body = buildProblem({
        status: 401,
        code: "unauthorized",
        message: "Unauthorized",
      });
      expect(typeof body.status).toBe("number");
      expect(body.status).toBe(401);
    });
  });

  describe("negotiateProblemContentType", () => {
    it("returns problem+json when Accept includes it explicitly", () => {
      const req = new Request("https://h/x", {
        headers: { accept: "application/problem+json" },
      });
      expect(negotiateProblemContentType(req)).toBe(PROBLEM_CONTENT_TYPE);
    });

    it("returns problem+json when Accept is application/json", () => {
      const req = new Request("https://h/x", {
        headers: { accept: "application/json" },
      });
      expect(negotiateProblemContentType(req)).toBe(PROBLEM_CONTENT_TYPE);
    });

    it("returns problem+json when Accept is */*", () => {
      const req = new Request("https://h/x", { headers: { accept: "*/*" } });
      expect(negotiateProblemContentType(req)).toBe(PROBLEM_CONTENT_TYPE);
    });

    it("returns problem+json when Accept is missing entirely", () => {
      const req = new Request("https://h/x");
      expect(negotiateProblemContentType(req)).toBe(PROBLEM_CONTENT_TYPE);
    });

    it("falls back to application/json when Accept excludes JSON variants", () => {
      const req = new Request("https://h/x", {
        headers: { accept: "text/html, text/plain" },
      });
      expect(negotiateProblemContentType(req)).toBe(JSON_CONTENT_TYPE);
    });

    it("returns problem+json when no request is provided", () => {
      expect(negotiateProblemContentType(null)).toBe(PROBLEM_CONTENT_TYPE);
      expect(negotiateProblemContentType(undefined)).toBe(PROBLEM_CONTENT_TYPE);
    });

    it("is case-insensitive", () => {
      const req = new Request("https://h/x", {
        headers: { accept: "APPLICATION/PROBLEM+JSON" },
      });
      expect(negotiateProblemContentType(req)).toBe(PROBLEM_CONTENT_TYPE);
    });
  });

  describe("problemResponse", () => {
    it("returns a NextResponse with the negotiated content type", async () => {
      const req = new Request("https://h/api/v1/providers/abc", {
        headers: { accept: "application/problem+json" },
      });
      const res = problemResponse(req, {
        status: 404,
        code: "not_found",
        message: "Provider not found",
        instance: "/api/v1/providers/abc",
      });
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toBe(PROBLEM_CONTENT_TYPE);
      const body = await res.json();
      expect(body.type).toBe(
        "https://essen-credentialing.example/errors/not-found",
      );
      expect(body.title).toBe("Resource not found");
      expect(body.status).toBe(404);
      expect(body.detail).toBe("Provider not found");
      expect(body.instance).toBe("/api/v1/providers/abc");
      expect(body.error.code).toBe("not_found");
      expect(body.error.message).toBe("Provider not found");
    });

    it("falls back to application/json for non-JSON-accepting clients", async () => {
      const req = new Request("https://h/x", {
        headers: { accept: "text/html" },
      });
      const res = problemResponse(req, {
        status: 401,
        code: "unauthorized",
        message: "Unauthorized",
      });
      expect(res.headers.get("content-type")).toBe(JSON_CONTENT_TYPE);
      const body = await res.json();
      expect(body.type).toBe(
        "https://essen-credentialing.example/errors/unauthorized",
      );
      expect(body.error.code).toBe("unauthorized");
    });

    it("works without a request object (defaults to problem+json)", async () => {
      const res = problemResponse(null, {
        status: 500,
        code: "internal_error",
        message: "Boom",
      });
      expect(res.headers.get("content-type")).toBe(PROBLEM_CONTENT_TYPE);
      const body = await res.json();
      expect(body.detail).toBe("Boom");
    });

    it("body is valid JSON regardless of content-type chosen", async () => {
      const reqA = new Request("https://h/x", {
        headers: { accept: "application/problem+json" },
      });
      const reqB = new Request("https://h/x", {
        headers: { accept: "text/html" },
      });
      const a = problemResponse(reqA, {
        status: 400,
        code: "invalid_request",
        message: "Bad",
      });
      const b = problemResponse(reqB, {
        status: 400,
        code: "invalid_request",
        message: "Bad",
      });
      const aBody = await a.json();
      const bBody = await b.json();
      expect(aBody).toEqual(bBody);
    });
  });
});
