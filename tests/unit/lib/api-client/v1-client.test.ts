/**
 * Unit tests for the public REST v1 SDK shim.
 *
 * Wave 10 (2026-04-18). The SDK is intentionally trivial — these
 * tests exist mostly to lock the auth header, error envelope, and
 * URL composition contract so a future refactor can't quietly drop
 * them.
 */

import { describe, it, expect, vi } from "vitest";
import {
  V1Client,
  V1ApiError,
  parseRateLimit,
  parseLinkHeader,
  parseEtag,
  parseDeprecation,
  conditionalGetWith,
  type V1Deprecation,
  type V1DeprecationContext,
} from "../../../../src/lib/api-client/v1";

interface MockResponse {
  status?: number;
  body?: BodyInit;
  headers?: Record<string, string>;
}

function makeFetch(responses: MockResponse[]) {
  let i = 0;
  const impl = async (
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> => {
    const r: MockResponse = responses[i++] ?? { status: 200 };
    const status = r.status ?? 200;
    // 1xx / 204 / 304 cannot have a body per the Fetch spec.
    const allowsBody = status >= 200 && status !== 204 && status !== 304;
    return new Response(allowsBody ? (r.body ?? JSON.stringify({})) : null, {
      status,
      headers: r.headers ?? { "content-type": "application/json" },
    });
  };
  return vi.fn(impl);
}

describe("V1Client", () => {
  it("requires an apiKey", () => {
    expect(() =>
      new V1Client({
        baseUrl: "https://api.example.com",
        apiKey: "",
        fetch: globalThis.fetch,
      }),
    ).toThrow(/apiKey/);
  });

  it("attaches Bearer Authorization on every request", async () => {
    const fetchSpy = makeFetch([
      {
        status: 200,
        body: JSON.stringify({
          data: [],
          pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com/",
      apiKey: "k_test_123",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await client.listProviders();
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer k_test_123");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("trims trailing slash off baseUrl", async () => {
    const fetchSpy = makeFetch([
      {
        status: 200,
        body: JSON.stringify({
          data: [],
          pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com/",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await client.listProviders();
    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/v1/providers");
  });

  it("serialises query params into the URL", async () => {
    const fetchSpy = makeFetch([
      {
        status: 200,
        body: JSON.stringify({
          data: [],
          pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await client.listProviders({ page: 2, limit: 10, status: "APPROVED" });
    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toContain("page=2");
    expect(url).toContain("limit=10");
    expect(url).toContain("status=APPROVED");
  });

  it("URL-encodes the {id} path segment", async () => {
    const fetchSpy = makeFetch([
      {
        status: 200,
        body: JSON.stringify({
          id: "prov 1",
          legalFirstName: "A",
          legalLastName: "B",
          status: "APPROVED",
          createdAt: new Date().toISOString(),
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await client.getProvider("prov 1");
    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/v1/providers/prov%201");
  });

  it("throws V1ApiError with status + code on a structured error", async () => {
    const fetchSpy = makeFetch([
      {
        status: 404,
        body: JSON.stringify({
          error: { code: "PROVIDER_NOT_FOUND", message: "Provider not found" },
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await expect(client.getProvider("nope")).rejects.toThrowError(V1ApiError);
    try {
      await client.getProvider("nope");
    } catch (e) {
      const err = e as V1ApiError;
      expect(err.status).toBe(404);
      expect(err.code).toBe("PROVIDER_NOT_FOUND");
      expect(err.message).toBe("Provider not found");
    }
  });

  it("health() calls GET /api/v1/health and returns the typed envelope", async () => {
    const fetchSpy = makeFetch([
      {
        status: 200,
        body: JSON.stringify({
          ok: true,
          keyId: "ck_test_abc",
          apiVersion: "1.1.0",
          time: "2026-04-18T20:45:00.000Z",
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    const result = await client.health();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/v1/health");
    expect((init as RequestInit).method).toBe("GET");
    expect(result.ok).toBe(true);
    expect(result.keyId).toBe("ck_test_abc");
    expect(result.apiVersion).toBe("1.1.0");
  });

  it("me() calls GET /api/v1/me and returns the typed envelope", async () => {
    const fetchSpy = makeFetch([
      {
        status: 200,
        body: JSON.stringify({
          keyId: "ck_test_abc",
          name: "Production prod-east",
          scopes: ["providers:read", "sanctions:read"],
          createdAt: "2026-01-15T10:30:00.000Z",
          expiresAt: "2027-01-15T10:30:00.000Z",
          lastUsedAt: "2026-04-18T22:14:33.123Z",
          rateLimit: {
            limit: 120,
            remaining: 117,
            resetUnixSeconds: 1739887200,
          },
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    const result = await client.me();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/v1/me");
    expect((init as RequestInit).method).toBe("GET");
    expect(result.keyId).toBe("ck_test_abc");
    expect(result.name).toBe("Production prod-east");
    expect(result.scopes).toEqual(["providers:read", "sanctions:read"]);
    expect(result.rateLimit?.limit).toBe(120);
  });

  it("parseRateLimit returns the decoded headers when present", () => {
    const h = new Headers({
      "x-ratelimit-limit": "120",
      "x-ratelimit-remaining": "117",
      "x-ratelimit-reset": "1739887200",
    });
    const rl = parseRateLimit(h);
    expect(rl).toEqual({
      limit: 120,
      remaining: 117,
      resetUnixSeconds: 1739887200,
      retryAfterSeconds: 0,
    });
  });

  it("parseRateLimit returns undefined when headers are absent (older deployments)", () => {
    expect(parseRateLimit(new Headers({}))).toBeUndefined();
  });

  it("V1ApiError exposes the parsed rate-limit on a 429 (RateLimitProblem)", async () => {
    const fetchSpy = makeFetch([
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1739887260",
          "retry-after": "12",
        },
        body: JSON.stringify({
          error: {
            code: "rate_limited",
            message: "Rate limit of 60 requests/min exceeded. Retry in 12s.",
            retryAfterSeconds: 12,
          },
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    try {
      await client.listProviders();
      throw new Error("expected V1ApiError");
    } catch (e) {
      const err = e as V1ApiError;
      expect(err.status).toBe(429);
      expect(err.code).toBe("rate_limited");
      expect(err.rateLimit).toEqual({
        limit: 60,
        remaining: 0,
        resetUnixSeconds: 1739887260,
        retryAfterSeconds: 12,
      });
    }
  });

  it("forwards X-Request-Id from requestIdFactory on every request (v1.3.0)", async () => {
    const fetchSpy = makeFetch([
      {
        status: 200,
        body: JSON.stringify({
          data: [],
          pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
      requestIdFactory: () => "req_abcdef0123456789",
    });
    await client.listProviders();
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get("X-Request-Id")).toBe("req_abcdef0123456789");
  });

  it("does not forward an invalid X-Request-Id (silently drops malformed factory output)", async () => {
    const fetchSpy = makeFetch([
      {
        status: 200,
        body: JSON.stringify({
          data: [],
          pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
      requestIdFactory: () => "bad id with spaces",
    });
    await client.listProviders();
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get("X-Request-Id")).toBeNull();
  });

  it("captures server-assigned X-Request-Id onto V1ApiError (v1.3.0)", async () => {
    const fetchSpy = makeFetch([
      {
        status: 404,
        headers: {
          "content-type": "application/json",
          "x-request-id": "req_server_assigned_999",
        },
        body: JSON.stringify({
          error: { code: "PROVIDER_NOT_FOUND", message: "Provider not found" },
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    try {
      await client.getProvider("nope");
      throw new Error("expected V1ApiError");
    } catch (e) {
      const err = e as V1ApiError;
      expect(err.requestId).toBe("req_server_assigned_999");
    }
  });

  it("parseEtag returns the raw ETag token from response headers", () => {
    const headers = new Headers({ etag: 'W/"deadbeef"' });
    expect(parseEtag(headers)).toBe('W/"deadbeef"');
  });

  it("parseEtag returns undefined when no ETag header is present", () => {
    expect(parseEtag(new Headers())).toBeUndefined();
  });

  it("conditionalGetWith returns 'fresh' on 200 with parsed ETag (v1.6.0)", async () => {
    const fetchSpy = makeFetch([
      {
        status: 200,
        body: JSON.stringify({ ok: true }),
        headers: {
          "content-type": "application/json",
          etag: 'W/"abc123"',
        },
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    const result = await conditionalGetWith<{ ok: boolean }>(
      client,
      "/api/v1/health",
      undefined,
    );
    expect(result.status).toBe("fresh");
    if (result.status === "fresh") {
      expect(result.etag).toBe('W/"abc123"');
      expect(result.data).toEqual({ ok: true });
    }
  });

  it("conditionalGetWith forwards If-None-Match when supplied", async () => {
    const fetchSpy = makeFetch([
      { status: 304, headers: { etag: 'W/"abc123"' } },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    const result = await conditionalGetWith(
      client,
      "/api/v1/health",
      'W/"abc123"',
    );
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get("If-None-Match")).toBe('W/"abc123"');
    expect(result.status).toBe("not-modified");
    if (result.status === "not-modified") {
      expect(result.etag).toBe('W/"abc123"');
    }
  });

  it("conditionalGetWith throws V1ApiError on non-200/304 (e.g. 401)", async () => {
    const fetchSpy = makeFetch([
      {
        status: 401,
        body: JSON.stringify({
          error: { code: "unauthenticated", message: "missing key" },
        }),
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await expect(
      conditionalGetWith(client, "/api/v1/health", undefined),
    ).rejects.toBeInstanceOf(V1ApiError);
  });

  it("parseLinkHeader returns the decoded {rel: url} map (v1.5.0)", () => {
    const v =
      '<https://x/api/v1/providers?page=1&limit=25>; rel="first", ' +
      '<https://x/api/v1/providers?page=2&limit=25>; rel="next", ' +
      '<https://x/api/v1/providers?page=4&limit=25>; rel="last"';
    expect(parseLinkHeader(v)).toEqual({
      first: "https://x/api/v1/providers?page=1&limit=25",
      next: "https://x/api/v1/providers?page=2&limit=25",
      last: "https://x/api/v1/providers?page=4&limit=25",
    });
  });

  it("parseLinkHeader returns an empty object for null (older deployments)", () => {
    expect(parseLinkHeader(null)).toEqual({});
  });

  // ---- Wave 18: Deprecation + Sunset header parsing ----

  it("parseDeprecation returns undefined when no Deprecation header is set", () => {
    expect(parseDeprecation(new Headers())).toBeUndefined();
  });

  it("parseDeprecation parses the @<unix-seconds> form into a Date", () => {
    const headers = new Headers({
      Deprecation: "@1796083200",
      Sunset: "Sun, 11 Nov 2030 23:59:59 GMT",
      Link:
        '<https://app.example.com/changelog#legacy-thing>; rel="deprecation", ' +
        '<https://api.example.com/api/v1/new-thing>; rel="successor-version"',
    });
    const info = parseDeprecation(headers);
    expect(info).toBeDefined();
    expect(info!.deprecatedAt.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(info!.sunsetAt?.toISOString()).toBe("2030-11-11T23:59:59.000Z");
    expect(info!.infoUrl).toBe("https://app.example.com/changelog#legacy-thing");
    expect(info!.successorUrl).toBe("https://api.example.com/api/v1/new-thing");
  });

  it("parseDeprecation rejects malformed Deprecation values", () => {
    expect(parseDeprecation(new Headers({ Deprecation: "1796083200" }))).toBeUndefined();
    expect(parseDeprecation(new Headers({ Deprecation: "@bad" }))).toBeUndefined();
    expect(parseDeprecation(new Headers({ Deprecation: "@-1" }))).toBeUndefined();
  });

  it("parseDeprecation tolerates Deprecation present without Sunset/Link", () => {
    const info = parseDeprecation(new Headers({ Deprecation: "@1796083200" }));
    expect(info).toBeDefined();
    expect(info!.sunsetAt).toBeUndefined();
    expect(info!.infoUrl).toBeUndefined();
    expect(info!.successorUrl).toBeUndefined();
  });

  it("V1Client invokes onDeprecated exactly once per operation per process", async () => {
    const fetchSpy = makeFetch([
      {
        status: 200,
        body: JSON.stringify({ ok: true }),
        headers: {
          "content-type": "application/json",
          Deprecation: "@1796083200",
          Sunset: "Sun, 11 Nov 2030 23:59:59 GMT",
          Link: '<https://x/upgrade>; rel="deprecation"',
        },
      },
      {
        status: 200,
        body: JSON.stringify({ ok: true }),
        headers: {
          "content-type": "application/json",
          Deprecation: "@1796083200",
          Sunset: "Sun, 11 Nov 2030 23:59:59 GMT",
          Link: '<https://x/upgrade>; rel="deprecation"',
        },
      },
    ]);
    const onDeprecated = vi.fn(
      (_info: V1Deprecation, _ctx: V1DeprecationContext) => undefined,
    );
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
      onDeprecated,
    });
    await client.health();
    await client.health();
    expect(onDeprecated).toHaveBeenCalledTimes(1);
    const [info, ctx] = onDeprecated.mock.calls[0]!;
    expect(info.deprecatedAt.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(info.infoUrl).toBe("https://x/upgrade");
    expect(ctx.method).toBe("GET");
    expect(ctx.path).toBe("/api/v1/health");
    expect(ctx.status).toBe(200);
  });

  it("V1Client surfaces Deprecation on V1ApiError when a deprecated op errors", async () => {
    const fetchSpy = makeFetch([
      {
        status: 401,
        body: JSON.stringify({
          error: { code: "missing_authorization", message: "no key" },
        }),
        headers: {
          "content-type": "application/json",
          Deprecation: "@1796083200",
          Sunset: "Sun, 11 Nov 2030 23:59:59 GMT",
          Link: '<https://x/upgrade>; rel="deprecation"',
        },
      },
    ]);
    const onDeprecated = vi.fn();
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
      onDeprecated,
    });
    try {
      await client.health();
      throw new Error("expected V1ApiError");
    } catch (e) {
      const err = e as V1ApiError;
      expect(err.deprecation).toBeDefined();
      expect(err.deprecation!.infoUrl).toBe("https://x/upgrade");
    }
    expect(onDeprecated).toHaveBeenCalledTimes(1);
  });

  it("conditionalGetWith forwards a parsed deprecation envelope on 200 + 304", async () => {
    const headers = {
      "content-type": "application/json",
      Deprecation: "@1796083200",
      Sunset: "Sun, 11 Nov 2030 23:59:59 GMT",
      Link: '<https://x/upgrade>; rel="deprecation"',
    };
    const fetchSpy = makeFetch([
      { status: 200, body: JSON.stringify({ ok: true }), headers },
      { status: 304, headers },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
      onDeprecated: () => undefined,
    });
    const fresh = await conditionalGetWith<{ ok: boolean }>(
      client,
      "/api/v1/health",
      undefined,
    );
    expect(fresh.deprecation?.infoUrl).toBe("https://x/upgrade");
    const cached = await conditionalGetWith<{ ok: boolean }>(
      client,
      "/api/v1/health",
      'W/"x"',
    );
    expect(cached.status).toBe("not-modified");
    expect(cached.deprecation?.infoUrl).toBe("https://x/upgrade");
  });

  it("falls back to a generic error message when body is non-JSON", async () => {
    const fetchSpy = makeFetch([
      {
        status: 502,
        body: "<html>Bad Gateway</html>",
        headers: { "content-type": "text/html" },
      },
    ]);
    const client = new V1Client({
      baseUrl: "https://api.example.com",
      apiKey: "k",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await expect(client.listSanctions()).rejects.toThrowError(
      /HTTP 502 on GET \/api\/v1\/sanctions/,
    );
  });
});
