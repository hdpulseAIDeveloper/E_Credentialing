/**
 * Unit tests for `src/lib/api/etag.ts` (Wave 17).
 *
 * Covers determinism + canonicalization, weak-format compliance,
 * `If-None-Match` parsing (single / list / wildcard / malformed),
 * weak comparison, header attachment, and the 304-response builder.
 */

import { describe, expect, it } from "vitest";

import {
  ETAG_HEADER,
  IF_NONE_MATCH_HEADER_NAME,
  applyEtagHeader,
  computeWeakEtag,
  computeWeakEtagFromBytes,
  evaluateConditionalGet,
  matchesEtag,
  notModifiedResponse,
  parseIfNoneMatch,
} from "../../../src/lib/api/etag";
import { NextResponse } from "next/server";

describe("etag helper (Wave 17)", () => {
  describe("computeWeakEtag", () => {
    it("returns a weak ETag in W/\"<40-hex>\" form", () => {
      const etag = computeWeakEtag({ a: 1 });
      expect(etag).toMatch(/^W\/"[a-f0-9]{40}"$/);
    });

    it("is deterministic across calls", () => {
      expect(computeWeakEtag({ a: 1, b: 2 })).toBe(
        computeWeakEtag({ a: 1, b: 2 }),
      );
    });

    it("is order-insensitive on object keys (canonicalization)", () => {
      expect(computeWeakEtag({ a: 1, b: 2 })).toBe(
        computeWeakEtag({ b: 2, a: 1 }),
      );
    });

    it("is order-SENSITIVE on arrays (semantic ordering preserved)", () => {
      expect(computeWeakEtag([1, 2])).not.toBe(computeWeakEtag([2, 1]));
    });

    it("treats undefined object values the same as missing keys", () => {
      expect(computeWeakEtag({ a: 1, b: undefined })).toBe(
        computeWeakEtag({ a: 1 }),
      );
    });

    it("differs when payloads differ", () => {
      expect(computeWeakEtag({ a: 1 })).not.toBe(computeWeakEtag({ a: 2 }));
    });

    it("handles deeply-nested objects", () => {
      const left = { x: { y: { z: [1, 2, 3] }, q: "k" } };
      const right = { x: { q: "k", y: { z: [1, 2, 3] } } };
      expect(computeWeakEtag(left)).toBe(computeWeakEtag(right));
    });
  });

  describe("computeWeakEtagFromBytes", () => {
    it("hashes raw strings without canonicalization", () => {
      const etag = computeWeakEtagFromBytes("hello");
      expect(etag).toMatch(/^W\/"[a-f0-9]{40}"$/);
    });

    it("differs when the raw bytes differ even if JSON-equivalent", () => {
      const a = computeWeakEtagFromBytes('{"a":1}');
      const b = computeWeakEtagFromBytes('{ "a" : 1 }');
      expect(a).not.toBe(b);
    });
  });

  describe("parseIfNoneMatch", () => {
    it("returns [] for null", () => {
      expect(parseIfNoneMatch(null)).toEqual([]);
    });

    it("returns [] for empty string", () => {
      expect(parseIfNoneMatch("")).toEqual([]);
    });

    it("returns ['*'] for the wildcard form", () => {
      expect(parseIfNoneMatch("*")).toEqual(["*"]);
    });

    it("parses a single strong tag", () => {
      expect(parseIfNoneMatch('"abc"')).toEqual(['"abc"']);
    });

    it("parses a single weak tag", () => {
      expect(parseIfNoneMatch('W/"abc"')).toEqual(['W/"abc"']);
    });

    it("parses a comma-separated list of mixed weak/strong tags", () => {
      expect(
        parseIfNoneMatch('"a", W/"b", "c"'),
      ).toEqual(['"a"', 'W/"b"', '"c"']);
    });

    it("tolerates extra whitespace", () => {
      expect(parseIfNoneMatch('  "a" ,  W/"b"  ')).toEqual(['"a"', 'W/"b"']);
    });

    it("ignores junk that doesn't look like an ETag token", () => {
      expect(parseIfNoneMatch("not an etag at all")).toEqual([]);
    });
  });

  describe("matchesEtag", () => {
    const current = 'W/"deadbeef"';

    it("returns false for an empty inbound list", () => {
      expect(matchesEtag(current, [])).toBe(false);
    });

    it("matches the wildcard token", () => {
      expect(matchesEtag(current, ["*"])).toBe(true);
    });

    it("matches an identical weak tag", () => {
      expect(matchesEtag(current, ['W/"deadbeef"'])).toBe(true);
    });

    it("matches the strong form of the same opaque value (weak comparison)", () => {
      expect(matchesEtag(current, ['"deadbeef"'])).toBe(true);
    });

    it("does NOT match a different opaque value", () => {
      expect(matchesEtag(current, ['W/"cafe"'])).toBe(false);
    });

    it("matches when current ETag appears anywhere in the inbound list", () => {
      expect(
        matchesEtag(current, ['"first"', 'W/"deadbeef"', '"third"']),
      ).toBe(true);
    });
  });

  describe("applyEtagHeader", () => {
    it("attaches the ETag header to a NextResponse", () => {
      const res = NextResponse.json({ ok: true });
      applyEtagHeader(res, 'W/"abc"');
      expect(res.headers.get(ETAG_HEADER)).toBe('W/"abc"');
    });

    it("is a no-op when etag is undefined", () => {
      const res = NextResponse.json({ ok: true });
      applyEtagHeader(res, undefined);
      expect(res.headers.get(ETAG_HEADER)).toBeNull();
    });

    it("returns the same response (composes cleanly)", () => {
      const res = NextResponse.json({ ok: true });
      expect(applyEtagHeader(res, 'W/"x"')).toBe(res);
    });
  });

  describe("notModifiedResponse", () => {
    it("returns a 304 with empty body and the ETag", async () => {
      const res = notModifiedResponse('W/"abc"');
      expect(res.status).toBe(304);
      expect(res.headers.get(ETAG_HEADER)).toBe('W/"abc"');
      const text = await res.text();
      expect(text).toBe("");
    });

    it("propagates X-Request-Id when supplied", () => {
      const res = notModifiedResponse('W/"x"', {
        requestId: "req_abcdef0123456789",
      });
      expect(res.headers.get("X-Request-Id")).toBe("req_abcdef0123456789");
    });

    it("propagates the rate-limit snapshot when supplied", () => {
      const res = notModifiedResponse('W/"x"', {
        rateLimit: {
          limit: 120,
          remaining: 117,
          resetUnixSeconds: 1739887200,
          allowed: true,
          retryAfterSeconds: 0,
        },
      });
      expect(res.headers.get("X-RateLimit-Limit")).toBe("120");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("117");
    });
  });

  describe("evaluateConditionalGet", () => {
    function reqWith(ifNoneMatch: string | null): Request {
      const headers = new Headers();
      if (ifNoneMatch !== null) {
        headers.set(IF_NONE_MATCH_HEADER_NAME, ifNoneMatch);
      }
      return new Request("https://x/api/v1/health", { headers });
    }

    it("returns 'fresh' when no If-None-Match header is sent", () => {
      const result = evaluateConditionalGet(reqWith(null), { ok: true });
      expect(result.status).toBe("fresh");
      expect(result.etag).toMatch(/^W\/"[a-f0-9]{40}"$/);
    });

    it("returns 'fresh' when the inbound tag does not match", () => {
      const result = evaluateConditionalGet(reqWith('W/"unrelated"'), {
        ok: true,
      });
      expect(result.status).toBe("fresh");
    });

    it("returns 'not-modified' when the inbound tag matches", () => {
      const payload = { ok: true };
      const etag = computeWeakEtag(payload);
      const result = evaluateConditionalGet(reqWith(etag), payload);
      expect(result.status).toBe("not-modified");
      expect(result.etag).toBe(etag);
    });

    it("returns 'not-modified' for the wildcard If-None-Match: *", () => {
      const result = evaluateConditionalGet(reqWith("*"), { ok: true });
      expect(result.status).toBe("not-modified");
    });
  });
});
