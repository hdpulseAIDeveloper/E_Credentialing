/**
 * Unit tests for the RFC 8288 pagination Link header helper.
 *
 * Wave 16 (2026-04-18). Locks the format gate (`first | prev |
 * next | last`), the absolute-URL contract, the
 * filter-preservation contract, and the empty-set behaviour so a
 * future refactor can't silently regress them. See
 * `src/lib/api/pagination-links.ts` for the full anti-weakening
 * contract.
 */

import { describe, it, expect } from "vitest";
import {
  buildPaginationLinkHeader,
  applyPaginationLinkHeader,
  parseLinkHeader,
} from "../../../src/lib/api/pagination-links";
import { NextResponse } from "next/server";

const URL_ROOT = "https://api.example.com/api/v1/providers";

describe("buildPaginationLinkHeader", () => {
  it("emits first + last + next on page 1 of 4", () => {
    const v = buildPaginationLinkHeader(URL_ROOT, {
      page: 1,
      limit: 25,
      total: 100,
      totalPages: 4,
    });
    expect(v).toBeTruthy();
    const m = parseLinkHeader(v);
    expect(m.first).toBe(`${URL_ROOT}?page=1&limit=25`);
    expect(m.last).toBe(`${URL_ROOT}?page=4&limit=25`);
    expect(m.next).toBe(`${URL_ROOT}?page=2&limit=25`);
    expect(m.prev).toBeUndefined();
  });

  it("emits first + prev + next + last in the middle of the result set", () => {
    const v = buildPaginationLinkHeader(URL_ROOT, {
      page: 3,
      limit: 25,
      total: 100,
      totalPages: 4,
    });
    const m = parseLinkHeader(v);
    expect(m.first).toBe(`${URL_ROOT}?page=1&limit=25`);
    expect(m.prev).toBe(`${URL_ROOT}?page=2&limit=25`);
    expect(m.next).toBe(`${URL_ROOT}?page=4&limit=25`);
    expect(m.last).toBe(`${URL_ROOT}?page=4&limit=25`);
  });

  it("emits first + prev + last on the final page (no next)", () => {
    const v = buildPaginationLinkHeader(URL_ROOT, {
      page: 4,
      limit: 25,
      total: 100,
      totalPages: 4,
    });
    const m = parseLinkHeader(v);
    expect(m.first).toBeDefined();
    expect(m.prev).toBe(`${URL_ROOT}?page=3&limit=25`);
    expect(m.last).toBeDefined();
    expect(m.next).toBeUndefined();
  });

  it("emits first + last only on a single-page result", () => {
    const v = buildPaginationLinkHeader(URL_ROOT, {
      page: 1,
      limit: 25,
      total: 5,
      totalPages: 1,
    });
    const m = parseLinkHeader(v);
    expect(m.first).toBe(`${URL_ROOT}?page=1&limit=25`);
    expect(m.last).toBe(`${URL_ROOT}?page=1&limit=25`);
    expect(m.next).toBeUndefined();
    expect(m.prev).toBeUndefined();
  });

  it("returns null when totalPages is 0 (empty result set)", () => {
    expect(
      buildPaginationLinkHeader(URL_ROOT, { page: 1, limit: 25, total: 0, totalPages: 0 }),
    ).toBeNull();
  });

  it("preserves existing query parameters on every link (filter context)", () => {
    const url = `${URL_ROOT}?status=APPROVED&npi=1234567893&page=2&limit=10`;
    const v = buildPaginationLinkHeader(url, {
      page: 2,
      limit: 10,
      total: 50,
      totalPages: 5,
    });
    const m = parseLinkHeader(v);
    for (const link of [m.first, m.prev, m.next, m.last]) {
      expect(link).toBeTruthy();
      expect(link).toContain("status=APPROVED");
      expect(link).toContain("npi=1234567893");
      expect(link).toContain("limit=10");
    }
  });

  it("emits absolute URLs (RFC 8288 + reverse-proxy safe)", () => {
    const v = buildPaginationLinkHeader(URL_ROOT, {
      page: 1,
      limit: 25,
      total: 100,
      totalPages: 4,
    });
    expect(v).toBeTruthy();
    expect(v!.startsWith("<https://api.example.com/")).toBe(true);
  });

  it("uses RFC 8288 syntax: <url>; rel=\"...\" comma-separated", () => {
    const v = buildPaginationLinkHeader(URL_ROOT, {
      page: 2,
      limit: 25,
      total: 100,
      totalPages: 4,
    });
    expect(v).toMatch(/<[^>]+>; rel="first"/);
    expect(v).toMatch(/<[^>]+>; rel="prev"/);
    expect(v).toMatch(/<[^>]+>; rel="next"/);
    expect(v).toMatch(/<[^>]+>; rel="last"/);
  });
});

describe("applyPaginationLinkHeader", () => {
  it("attaches the Link header on a non-empty result set", () => {
    const res = NextResponse.json({ ok: true });
    applyPaginationLinkHeader(res, URL_ROOT, {
      page: 1,
      limit: 25,
      total: 100,
      totalPages: 4,
    });
    expect(res.headers.get("Link")).toBeTruthy();
  });

  it("is a no-op on an empty result set (no header added)", () => {
    const res = NextResponse.json({ ok: true });
    applyPaginationLinkHeader(res, URL_ROOT, {
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
    });
    expect(res.headers.get("Link")).toBeNull();
  });
});

describe("parseLinkHeader", () => {
  it("returns an empty object for null/undefined/empty inputs", () => {
    expect(parseLinkHeader(null)).toEqual({});
    expect(parseLinkHeader(undefined)).toEqual({});
    expect(parseLinkHeader("")).toEqual({});
  });

  it("tolerates extra whitespace around segments", () => {
    const v = '  <https://x/?page=1>;  rel="first" ,  <https://x/?page=2>;rel="next"  ';
    const m = parseLinkHeader(v);
    expect(m.first).toBe("https://x/?page=1");
    expect(m.next).toBe("https://x/?page=2");
  });

  it("lowercases the rel token", () => {
    const m = parseLinkHeader('<https://x/?page=1>; rel="FIRST"');
    expect(m.first).toBe("https://x/?page=1");
  });

  it("preserves unknown rel tokens (forward-compat)", () => {
    const m = parseLinkHeader('<https://x/?page=1>; rel="self"');
    expect(m.self).toBe("https://x/?page=1");
  });
});
