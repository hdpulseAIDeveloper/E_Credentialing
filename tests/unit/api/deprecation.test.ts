/**
 * Unit tests for `src/lib/api/deprecation.ts` (Wave 18).
 *
 * Covers the registry lookup (exact + path-template + method
 * matching), header value formatting (RFC 9745 `@<seconds>` +
 * RFC 9110 IMF-fixdate), header parsing (round-trip), and the
 * `applyDeprecationHeaders` composition behaviour (Link header
 * append, no-op for undefined policy).
 */

import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";

import {
  DEPRECATION_HEADER,
  LINK_HEADER,
  SUNSET_HEADER,
  applyDeprecationByRoute,
  applyDeprecationHeaders,
  findDeprecation,
  formatDeprecationValue,
  formatHttpDate,
  parseDeprecationValue,
  parseSunset,
  type DeprecationPolicy,
} from "../../../src/lib/api/deprecation";

const REGISTRY: DeprecationPolicy[] = [
  {
    path: "/api/v1/legacy-thing",
    method: "GET",
    deprecatedAt: new Date("2026-06-01T00:00:00Z"),
    sunsetAt: new Date("2030-11-11T23:59:59Z"),
    infoUrl: "https://app.example.com/changelog#legacy-thing",
    successor: {
      url: "https://api.example.com/api/v1/new-thing",
      label: "v1 new-thing",
    },
  },
  {
    path: "/api/v1/things/{id}",
    method: "*",
    deprecatedAt: new Date("2026-07-01T12:00:00Z"),
    sunsetAt: new Date("2027-01-01T00:00:00Z"),
    infoUrl: "https://app.example.com/changelog#things-id",
  },
];

describe("deprecation helper (Wave 18)", () => {
  describe("findDeprecation", () => {
    it("matches an exact path + method pair", () => {
      const hit = findDeprecation("GET", "/api/v1/legacy-thing", REGISTRY);
      expect(hit?.path).toBe("/api/v1/legacy-thing");
    });

    it("returns undefined when nothing matches", () => {
      expect(findDeprecation("GET", "/api/v1/never-deprecated", REGISTRY)).toBeUndefined();
    });

    it("respects HTTP method filtering", () => {
      expect(findDeprecation("POST", "/api/v1/legacy-thing", REGISTRY)).toBeUndefined();
    });

    it("matches `*` method against any verb", () => {
      expect(findDeprecation("GET", "/api/v1/things/abc", REGISTRY)?.path).toBe(
        "/api/v1/things/{id}",
      );
      expect(findDeprecation("DELETE", "/api/v1/things/abc", REGISTRY)?.path).toBe(
        "/api/v1/things/{id}",
      );
    });

    it("expands {id} as a single non-slash segment", () => {
      expect(findDeprecation("GET", "/api/v1/things/abc", REGISTRY)).toBeDefined();
      expect(findDeprecation("GET", "/api/v1/things/abc/sub", REGISTRY)).toBeUndefined();
    });

    it("is case-insensitive on the method", () => {
      expect(findDeprecation("get", "/api/v1/legacy-thing", REGISTRY)).toBeDefined();
    });

    it("uses the live DEPRECATION_REGISTRY when no override is supplied", () => {
      // Default registry is empty by design — no hit for any path.
      expect(findDeprecation("GET", "/api/v1/legacy-thing")).toBeUndefined();
    });
  });

  describe("formatDeprecationValue", () => {
    it("emits the RFC 9745 `@<unix-seconds>` form", () => {
      const v = formatDeprecationValue(new Date("2026-12-01T00:00:00Z"));
      expect(v).toBe("@1796083200");
    });

    it("truncates sub-second precision", () => {
      const v = formatDeprecationValue(new Date("2026-12-01T00:00:00.999Z"));
      expect(v).toBe("@1796083200");
    });

    it("round-trips with parseDeprecationValue", () => {
      const d = new Date("2027-03-15T14:30:00Z");
      expect(parseDeprecationValue(formatDeprecationValue(d))?.toISOString()).toBe(
        "2027-03-15T14:30:00.000Z",
      );
    });
  });

  describe("formatHttpDate", () => {
    it("emits IMF-fixdate per RFC 9110 §5.6.7", () => {
      const v = formatHttpDate(new Date("2030-11-11T23:59:59Z"));
      expect(v).toBe("Mon, 11 Nov 2030 23:59:59 GMT");
    });

    it("zero-pads day, hours, minutes, seconds", () => {
      const v = formatHttpDate(new Date("2026-01-02T03:04:05Z"));
      expect(v).toBe("Fri, 02 Jan 2026 03:04:05 GMT");
    });

    it("round-trips with parseSunset (date-only equality)", () => {
      const d = new Date("2030-11-11T23:59:59Z");
      const parsed = parseSunset(formatHttpDate(d));
      expect(parsed?.toISOString()).toBe("2030-11-11T23:59:59.000Z");
    });
  });

  describe("parseDeprecationValue", () => {
    it("returns undefined for null/empty/whitespace", () => {
      expect(parseDeprecationValue(null)).toBeUndefined();
      expect(parseDeprecationValue(undefined)).toBeUndefined();
      expect(parseDeprecationValue("")).toBeUndefined();
      expect(parseDeprecationValue("   ")).toBeUndefined();
    });

    it("returns undefined for non-`@`-prefixed values", () => {
      expect(parseDeprecationValue("1796083200")).toBeUndefined();
      expect(parseDeprecationValue("?1")).toBeUndefined();
    });

    it("returns undefined for malformed numerics", () => {
      expect(parseDeprecationValue("@abc")).toBeUndefined();
      expect(parseDeprecationValue("@-1")).toBeUndefined();
      expect(parseDeprecationValue("@0")).toBeUndefined();
    });
  });

  describe("parseSunset", () => {
    it("returns undefined for null/empty", () => {
      expect(parseSunset(null)).toBeUndefined();
      expect(parseSunset(undefined)).toBeUndefined();
      expect(parseSunset("")).toBeUndefined();
    });

    it("returns undefined for unparseable dates", () => {
      expect(parseSunset("not a date")).toBeUndefined();
    });

    it("parses an IMF-fixdate", () => {
      expect(parseSunset("Sun, 11 Nov 2030 23:59:59 GMT")?.toISOString()).toBe(
        "2030-11-11T23:59:59.000Z",
      );
    });
  });

  describe("applyDeprecationHeaders", () => {
    it("is a no-op when policy is undefined", () => {
      const res = NextResponse.json({ ok: true });
      applyDeprecationHeaders(res, undefined);
      expect(res.headers.get(DEPRECATION_HEADER)).toBeNull();
      expect(res.headers.get(SUNSET_HEADER)).toBeNull();
      expect(res.headers.get(LINK_HEADER)).toBeNull();
    });

    it("attaches Deprecation, Sunset, and Link headers when policy is present", () => {
      const res = NextResponse.json({ ok: true });
      applyDeprecationHeaders(res, REGISTRY[0]);
      expect(res.headers.get(DEPRECATION_HEADER)).toBe("@1780272000");
      expect(res.headers.get(SUNSET_HEADER)).toBe("Mon, 11 Nov 2030 23:59:59 GMT");
      const link = res.headers.get(LINK_HEADER) ?? "";
      expect(link).toContain('rel="deprecation"');
      expect(link).toContain('rel="sunset"');
      expect(link).toContain('rel="successor-version"');
      expect(link).toContain("https://app.example.com/changelog#legacy-thing");
      expect(link).toContain("https://api.example.com/api/v1/new-thing");
    });

    it("appends to an existing Link header rather than overwriting", () => {
      const res = NextResponse.json({ ok: true });
      res.headers.set(LINK_HEADER, '<https://api/x?page=2>; rel="next"');
      applyDeprecationHeaders(res, REGISTRY[0]);
      const link = res.headers.get(LINK_HEADER) ?? "";
      expect(link.startsWith('<https://api/x?page=2>; rel="next"')).toBe(true);
      expect(link).toContain('rel="deprecation"');
    });

    it("omits successor-version Link entry when no successor is configured", () => {
      const res = NextResponse.json({ ok: true });
      applyDeprecationHeaders(res, REGISTRY[1]);
      const link = res.headers.get(LINK_HEADER) ?? "";
      expect(link).toContain('rel="deprecation"');
      expect(link).toContain('rel="sunset"');
      expect(link).not.toContain('rel="successor-version"');
    });

    it("returns the same response object for chaining", () => {
      const res = NextResponse.json({ ok: true });
      const out = applyDeprecationHeaders(res, REGISTRY[0]);
      expect(out).toBe(res);
    });
  });

  describe("applyDeprecationByRoute", () => {
    it("is a no-op for non-deprecated paths (default registry)", () => {
      const res = NextResponse.json({ ok: true });
      applyDeprecationByRoute(res, "GET", "/api/v1/health");
      expect(res.headers.get(DEPRECATION_HEADER)).toBeNull();
    });

    it("fires headers when the supplied registry matches", () => {
      const res = NextResponse.json({ ok: true });
      applyDeprecationByRoute(res, "GET", "/api/v1/legacy-thing", REGISTRY);
      expect(res.headers.get(DEPRECATION_HEADER)).toBe("@1780272000");
      expect(res.headers.get(SUNSET_HEADER)).toBeTruthy();
    });

    it("works with `*`-method registry entries", () => {
      const res = NextResponse.json({ ok: true });
      applyDeprecationByRoute(res, "POST", "/api/v1/things/abc123", REGISTRY);
      expect(res.headers.get(DEPRECATION_HEADER)).toBeTruthy();
    });
  });
});
