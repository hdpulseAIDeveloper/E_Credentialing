/**
 * Unit tests for the public REST v1 SDK shim.
 *
 * Wave 10 (2026-04-18). The SDK is intentionally trivial — these
 * tests exist mostly to lock the auth header, error envelope, and
 * URL composition contract so a future refactor can't quietly drop
 * them.
 */

import { describe, it, expect, vi } from "vitest";
import { V1Client, V1ApiError } from "../../../../src/lib/api-client/v1";

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
    return new Response(r.body ?? JSON.stringify({}), {
      status: r.status ?? 200,
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
