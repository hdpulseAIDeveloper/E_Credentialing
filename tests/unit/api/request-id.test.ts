/**
 * Unit tests for the X-Request-Id correlation helper.
 *
 * Wave 14 (2026-04-18). The helper is the floor of the v1.3.0
 * X-Request-Id contract; these tests lock the format gate and the
 * "honour-or-replace" inbound semantics so a future refactor can't
 * silently regress them. See `src/lib/api/request-id.ts` for the
 * full anti-weakening contract.
 */

import { describe, it, expect } from "vitest";
import {
  generateRequestId,
  resolveRequestId,
  applyRequestIdHeader,
  isValidRequestId,
  REQUEST_ID_HEADER,
} from "../../../src/lib/api/request-id";
import { NextResponse } from "next/server";

describe("request-id helper", () => {
  it("REQUEST_ID_HEADER is the canonical industry spelling", () => {
    expect(REQUEST_ID_HEADER).toBe("X-Request-Id");
  });

  it("generateRequestId emits an opaque req_<hex> id", () => {
    const id = generateRequestId();
    expect(id).toMatch(/^req_[0-9a-f]{16}$/);
    expect(isValidRequestId(id)).toBe(true);
  });

  it("generateRequestId returns a fresh id every call", () => {
    const a = generateRequestId();
    const b = generateRequestId();
    expect(a).not.toBe(b);
  });

  it("isValidRequestId accepts ULID, UUID, Stripe-style, and opaque tokens", () => {
    expect(isValidRequestId("01F8MECHZX3TBDSZ7XR8H8JHAF")).toBe(true);
    expect(isValidRequestId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidRequestId("req_abcdefgh")).toBe(true);
    expect(isValidRequestId("a".repeat(128))).toBe(true);
  });

  it("isValidRequestId rejects too-short, too-long, and unsafe characters", () => {
    expect(isValidRequestId("short")).toBe(false);
    expect(isValidRequestId("a".repeat(129))).toBe(false);
    expect(isValidRequestId("has spaces here")).toBe(false);
    expect(isValidRequestId("with/slash/here")).toBe(false);
    expect(isValidRequestId("inject\nnewline")).toBe(false);
    expect(isValidRequestId("semi;colon;here")).toBe(false);
  });

  it("resolveRequestId honours a valid inbound X-Request-Id header", () => {
    const req = new Request("https://example.com/api/v1/health", {
      headers: { "X-Request-Id": "req_customer_supplied_99" },
    });
    expect(resolveRequestId(req)).toBe("req_customer_supplied_99");
  });

  it("resolveRequestId silently replaces a malformed inbound header (no 400)", () => {
    const req = new Request("https://example.com/api/v1/health", {
      headers: { "X-Request-Id": "bad id with spaces" },
    });
    const id = resolveRequestId(req);
    expect(id).not.toBe("bad id with spaces");
    expect(isValidRequestId(id)).toBe(true);
  });

  it("resolveRequestId generates a fresh id when no header supplied", () => {
    const req = new Request("https://example.com/api/v1/health");
    const id = resolveRequestId(req);
    expect(id).toMatch(/^req_[0-9a-f]{16}$/);
  });

  it("applyRequestIdHeader stamps the id onto a NextResponse", () => {
    const res = NextResponse.json({ ok: true });
    applyRequestIdHeader(res, "req_test_id_value");
    expect(res.headers.get("X-Request-Id")).toBe("req_test_id_value");
  });

  it("applyRequestIdHeader is a no-op when the id is undefined", () => {
    const res = NextResponse.json({ ok: true });
    applyRequestIdHeader(res, undefined);
    expect(res.headers.get("X-Request-Id")).toBeNull();
  });
});
