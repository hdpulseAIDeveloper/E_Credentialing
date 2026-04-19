/**
 * Pillar J — OpenAPI 3.1 contract test (per `docs/qa/STANDARD.md` §1.J).
 *
 * Wave 8 (2026-04-18). Three guarantees:
 *
 *   1. The hand-edited `docs/api/openapi-v1.yaml` parses as valid YAML
 *      and declares OpenAPI 3.1.
 *   2. Every public REST v1 route in `api-inventory.json` (`/api/v1/*`)
 *      appears in the spec's `paths` (templated form, e.g. `{id}`),
 *      and every method declared in the inventory is documented.
 *   3. The spec contains no PHI field names that would silently
 *      contradict the platform's "no PHI in v1" promise — the
 *      ANTI_PHI_FIELDS list MUST NOT appear anywhere in the spec.
 *
 * Anti-weakening: do NOT relax the inventory↔spec match. Adding a new
 * /api/v1/* route without backfilling the spec MUST fail this suite.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import apiInventory from "../../docs/qa/inventories/api-inventory.json";

interface ApiEntry {
  route: string;
  methods: string[];
  file: string;
  dynamic: boolean;
}

const SPEC_PATH = join(process.cwd(), "docs", "api", "openapi-v1.yaml");
const RAW = readFileSync(SPEC_PATH, "utf-8");
const SPEC = yaml.load(RAW) as {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, unknown> };
};

/** Templated routes use `{id}` in OpenAPI but `[id]` in the inventory. */
function inventoryRouteToOpenApi(route: string): string {
  return route.replace(/\[([^\]]+)\]/g, "{$1}");
}

// The OpenAPI document does not describe its own delivery channels:
//   - `/api/v1/openapi.yaml` (Wave 8 — RFC 9512 source of truth)
//   - `/api/v1/openapi.json` (Wave 9 — JSON mirror)
//   - `/api/v1/postman.json` (Wave 11 — Postman v2.1 collection)
// Documenting them in the spec would be a circular reference. The
// list below is the SOLE permitted exclusion. Adding any other entry
// here is a code-smell review item.
const SPEC_DELIVERY_ROUTES = new Set([
  "/api/v1/openapi.yaml",
  "/api/v1/openapi.json",
  "/api/v1/postman.json",
]);

const V1_ROUTES = (apiInventory as ApiEntry[]).filter(
  (e) => e.route.startsWith("/api/v1/") && !SPEC_DELIVERY_ROUTES.has(e.route),
);

const ANTI_PHI_FIELDS = [
  "ssn",
  "socialSecurityNumber",
  "dateOfBirth",
  "dob",
  "deaNumber",
  "personalAddress",
  "homeAddress",
  "personalEmail",
  "personalPhone",
];

describe("pillar-J: OpenAPI 3.1 contract", () => {
  it("docs/api/openapi-v1.yaml parses as valid YAML", () => {
    expect(SPEC).toBeTruthy();
    expect(typeof SPEC).toBe("object");
  });

  it("declares OpenAPI 3.1.x", () => {
    expect(SPEC.openapi).toMatch(/^3\.1\./);
  });

  it("declares an info.title and a semver info.version", () => {
    expect(SPEC.info?.title).toBeTruthy();
    expect(SPEC.info?.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("ships at least one /api/v1 route under v1 (not just stubs)", () => {
    expect(V1_ROUTES.length).toBeGreaterThan(0);
  });

  describe.each(V1_ROUTES)("inventory route $route", (entry) => {
    const oaPath = inventoryRouteToOpenApi(entry.route);

    it(`is present in OpenAPI paths as ${oaPath}`, () => {
      expect(
        SPEC.paths[oaPath],
        `OpenAPI spec missing path ${oaPath} for inventory route ${entry.route}`,
      ).toBeTruthy();
    });

    it("declares every method the inventory advertises", () => {
      const operations = SPEC.paths[oaPath] ?? {};
      for (const m of entry.methods) {
        const lower = m.toLowerCase();
        expect(
          operations[lower],
          `OpenAPI spec missing operation ${m} on ${oaPath} (inventory says it exists)`,
        ).toBeTruthy();
      }
    });
  });

  describe("Wave 13: rate-limit contract", () => {
    it("declares every X-RateLimit-* header as a reusable component", () => {
      const headers = (SPEC as { components?: { headers?: Record<string, unknown> } })
        .components?.headers ?? {};
      expect(headers.RateLimitLimit, "missing components.headers.RateLimitLimit").toBeTruthy();
      expect(headers.RateLimitRemaining, "missing components.headers.RateLimitRemaining").toBeTruthy();
      expect(headers.RateLimitReset, "missing components.headers.RateLimitReset").toBeTruthy();
      expect(headers.RetryAfter, "missing components.headers.RetryAfter").toBeTruthy();
    });

    it("declares the RateLimitProblem schema with const code='rate_limited'", () => {
      const schemas = SPEC.components?.schemas ?? {};
      const rlp = schemas["RateLimitProblem"] as
        | {
            properties?: { error?: { properties?: { code?: { const?: string } } } };
          }
        | undefined;
      expect(rlp, "RateLimitProblem schema missing").toBeTruthy();
      expect(rlp?.properties?.error?.properties?.code?.const).toBe("rate_limited");
    });

    it("references the RateLimited response from every JSON 200 operation", () => {
      // Find every operation whose 200 response is application/json (i.e.
      // not the binary CV PDF). All of them MUST also declare 429.
      const failures: string[] = [];
      for (const [path, ops] of Object.entries(SPEC.paths)) {
        for (const [method, op] of Object.entries(ops)) {
          const operation = op as {
            responses?: Record<
              string,
              { content?: Record<string, unknown>; $ref?: string }
            >;
          };
          const r200 = operation?.responses?.["200"];
          if (!r200) continue;
          const json = r200.content?.["application/json"];
          if (!json) continue;
          if (!operation.responses?.["429"]) {
            failures.push(`${method.toUpperCase()} ${path} (200 is JSON but no 429 declared)`);
          }
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });

    it("attaches X-RateLimit-* headers to every JSON 200 response", () => {
      const failures: string[] = [];
      for (const [path, ops] of Object.entries(SPEC.paths)) {
        for (const [method, op] of Object.entries(ops)) {
          const operation = op as {
            responses?: Record<
              string,
              {
                content?: Record<string, unknown>;
                headers?: Record<string, unknown>;
              }
            >;
          };
          const r200 = operation?.responses?.["200"];
          if (!r200?.content?.["application/json"]) continue;
          const headers = r200.headers ?? {};
          for (const h of [
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
          ]) {
            if (!headers[h]) failures.push(`${method.toUpperCase()} ${path} 200 missing header ${h}`);
          }
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  });

  describe("Wave 17: ETag + If-None-Match conditional GET contract", () => {
    it("declares components.headers.ETag", () => {
      const headers = (SPEC as { components?: { headers?: Record<string, unknown> } })
        .components?.headers ?? {};
      expect(headers.ETag, "missing components.headers.ETag").toBeTruthy();
    });

    it("declares components.parameters.IfNoneMatchHeader", () => {
      const params = (SPEC as { components?: { parameters?: Record<string, unknown> } })
        .components?.parameters ?? {};
      expect(
        params.IfNoneMatchHeader,
        "missing components.parameters.IfNoneMatchHeader",
      ).toBeTruthy();
    });

    it("declares components.responses.NotModified", () => {
      const responses = (SPEC as { components?: { responses?: Record<string, unknown> } })
        .components?.responses ?? {};
      expect(
        responses.NotModified,
        "missing components.responses.NotModified",
      ).toBeTruthy();
    });

    it("attaches ETag header + 304 response to every JSON GET operation", () => {
      // Routes that return non-JSON (binary) bodies are explicitly
      // out-of-scope for ETag this wave; the cv.pdf endpoint has its
      // own caching strategy.
      const NON_JSON_OPERATIONS = new Set(["getProviderCv"]);
      const failures: string[] = [];

      for (const [pathName, methods] of Object.entries(SPEC.paths)) {
        const get = (methods as Record<string, unknown>).get as
          | {
              operationId?: string;
              parameters?: Array<{ $ref?: string }>;
              responses?: Record<string, { headers?: Record<string, unknown> }>;
            }
          | undefined;
        if (!get) continue;
        if (NON_JSON_OPERATIONS.has(get.operationId ?? "")) continue;

        const has304 = !!get.responses?.["304"];
        if (!has304) {
          failures.push(`GET ${pathName} missing 304 response`);
          continue;
        }
        const has200 = !!get.responses?.["200"];
        if (has200 && !get.responses?.["200"]?.headers?.ETag) {
          failures.push(`GET ${pathName} 200 missing ETag header`);
        }
        const params = get.parameters ?? [];
        const hasIfNoneMatch = params.some(
          (p) => p?.$ref === "#/components/parameters/IfNoneMatchHeader",
        );
        if (!hasIfNoneMatch) {
          failures.push(`GET ${pathName} missing IfNoneMatchHeader parameter`);
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  });

  describe("Wave 16: RFC 8288 pagination Link header contract", () => {
    it("declares components.headers.Link", () => {
      const headers = (SPEC as { components?: { headers?: Record<string, unknown> } })
        .components?.headers ?? {};
      expect(headers.Link, "missing components.headers.Link").toBeTruthy();
    });

    it("attaches Link to every paginated list operation 200", () => {
      const failures: string[] = [];
      const PAGINATED_LISTS: Array<[string, string]> = [
        ["/api/v1/providers", "get"],
        ["/api/v1/sanctions", "get"],
        ["/api/v1/enrollments", "get"],
      ];
      for (const [path, method] of PAGINATED_LISTS) {
        const op = (SPEC.paths[path] as Record<string, unknown> | undefined)?.[method] as
          | { responses?: Record<string, { headers?: Record<string, unknown> }> }
          | undefined;
        const r200 = op?.responses?.["200"];
        if (!r200) {
          failures.push(`${method.toUpperCase()} ${path} missing 200 response`);
          continue;
        }
        if (!r200.headers?.Link) {
          failures.push(`${method.toUpperCase()} ${path} 200 missing Link header`);
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  });

  describe("Wave 14: X-Request-Id correlation contract", () => {
    it("declares components.headers.RequestId", () => {
      const headers = (SPEC as { components?: { headers?: Record<string, unknown> } })
        .components?.headers ?? {};
      expect(headers.RequestId, "missing components.headers.RequestId").toBeTruthy();
    });

    it("declares components.parameters.RequestIdHeader", () => {
      const params = (SPEC as { components?: { parameters?: Record<string, unknown> } })
        .components?.parameters ?? {};
      expect(
        params.RequestIdHeader,
        "missing components.parameters.RequestIdHeader",
      ).toBeTruthy();
    });

    it("attaches X-Request-Id to every 200 response (JSON or binary)", () => {
      const failures: string[] = [];
      for (const [path, ops] of Object.entries(SPEC.paths)) {
        for (const [method, op] of Object.entries(ops)) {
          const operation = op as {
            responses?: Record<
              string,
              {
                content?: Record<string, unknown>;
                headers?: Record<string, unknown>;
              }
            >;
          };
          const r200 = operation?.responses?.["200"];
          if (!r200) continue;
          const headers = r200.headers ?? {};
          if (!headers["X-Request-Id"]) {
            failures.push(`${method.toUpperCase()} ${path} 200 missing X-Request-Id header`);
          }
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });

    it("attaches X-Request-Id to every reusable error response", () => {
      const responses = (SPEC as {
        components?: {
          responses?: Record<
            string,
            { headers?: Record<string, unknown> }
          >;
        };
      }).components?.responses ?? {};
      const failures: string[] = [];
      for (const name of ["Unauthorized", "Forbidden", "NotFound", "RateLimited"]) {
        const r = responses[name];
        if (!r) {
          failures.push(`components.responses.${name} missing`);
          continue;
        }
        if (!r.headers?.["X-Request-Id"]) {
          failures.push(`components.responses.${name} missing X-Request-Id header`);
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  });

  describe("Wave 18: Deprecation + Sunset header contract (RFC 9745 / RFC 8594)", () => {
    it("declares components.headers.Deprecation with the @<unix-seconds> pattern", () => {
      const headers = (SPEC as { components?: { headers?: Record<string, unknown> } })
        .components?.headers ?? {};
      const dep = headers.Deprecation as { schema?: { pattern?: string } } | undefined;
      expect(dep, "missing components.headers.Deprecation").toBeTruthy();
      expect(dep?.schema?.pattern).toBe("^@[0-9]+$");
    });

    it("declares components.headers.Sunset", () => {
      const headers = (SPEC as { components?: { headers?: Record<string, unknown> } })
        .components?.headers ?? {};
      expect(headers.Sunset, "missing components.headers.Sunset").toBeTruthy();
    });

    it("Link header description references rel=deprecation/sunset/successor-version (Wave 18 widening)", () => {
      const link = (SPEC as { components?: { headers?: Record<string, { description?: string }> } })
        .components?.headers?.Link;
      const desc = link?.description ?? "";
      expect(desc).toMatch(/deprecation/i);
      expect(desc).toMatch(/sunset/i);
      expect(desc).toMatch(/successor-version/i);
    });

    it("attaches Deprecation + Sunset + Link headers to every JSON 200 response", () => {
      const failures: string[] = [];
      for (const [path, ops] of Object.entries(SPEC.paths)) {
        for (const [method, op] of Object.entries(ops)) {
          const operation = op as {
            responses?: Record<
              string,
              { content?: Record<string, unknown>; headers?: Record<string, unknown> }
            >;
          };
          const r200 = operation?.responses?.["200"];
          if (!r200?.content?.["application/json"]) continue;
          const headers = r200.headers ?? {};
          for (const h of ["Deprecation", "Sunset", "Link"]) {
            if (!headers[h]) {
              failures.push(`${method.toUpperCase()} ${path} 200 missing ${h} header`);
            }
          }
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });

    it("attaches Deprecation/Sunset/Link headers to every reusable error response", () => {
      const responses = (SPEC as {
        components?: {
          responses?: Record<string, { headers?: Record<string, unknown> }>;
        };
      }).components?.responses ?? {};
      const failures: string[] = [];
      for (const name of ["Unauthorized", "Forbidden", "NotFound", "RateLimited", "NotModified"]) {
        const r = responses[name];
        if (!r) {
          failures.push(`components.responses.${name} missing`);
          continue;
        }
        for (const h of ["Deprecation", "Sunset", "Link"]) {
          if (!r.headers?.[h]) {
            failures.push(`components.responses.${name} missing ${h} header`);
          }
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  });

  describe("Wave 19: RFC 9457 Problem Details contract", () => {
    it("declares an Error schema that includes the RFC 9457 standard members", () => {
      const error = (SPEC.components?.schemas?.Error as
        | { properties?: Record<string, unknown> }
        | undefined);
      expect(error, "missing components.schemas.Error").toBeTruthy();
      const props = error!.properties ?? {};
      for (const required of ["type", "title", "status", "detail", "error"]) {
        expect(
          required in props,
          `Error schema missing RFC 9457 member '${required}'`,
        ).toBe(true);
      }
    });

    it("declares a RateLimitProblem schema that includes RFC 9457 members + retryAfterSeconds", () => {
      const rlp = (SPEC.components?.schemas?.RateLimitProblem as
        | { properties?: Record<string, unknown> }
        | undefined);
      expect(rlp, "missing components.schemas.RateLimitProblem").toBeTruthy();
      const props = rlp!.properties ?? {};
      for (const required of ["type", "title", "status", "detail", "error", "retryAfterSeconds"]) {
        expect(
          required in props,
          `RateLimitProblem schema missing member '${required}'`,
        ).toBe(true);
      }
    });

    it("advertises application/problem+json on every reusable error response", () => {
      const responses = (SPEC as {
        components?: {
          responses?: Record<
            string,
            { content?: Record<string, unknown> }
          >;
        };
      }).components?.responses ?? {};
      const failures: string[] = [];
      for (const name of ["Unauthorized", "Forbidden", "NotFound", "RateLimited"]) {
        const r = responses[name];
        if (!r) {
          failures.push(`components.responses.${name} missing`);
          continue;
        }
        const ct = r.content ?? {};
        if (!ct["application/problem+json"]) {
          failures.push(
            `components.responses.${name} missing application/problem+json content`,
          );
        }
        if (!ct["application/json"]) {
          failures.push(
            `components.responses.${name} missing application/json content (legacy)`,
          );
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  });

  describe("Wave 20: server-side request validation contract (RFC 9457 + Zod)", () => {
    it("declares a ValidationFieldError schema with field/code/message strings", () => {
      const vfe = (SPEC.components?.schemas?.ValidationFieldError as
        | { properties?: Record<string, { type?: string }>; required?: string[] }
        | undefined);
      expect(vfe, "missing components.schemas.ValidationFieldError").toBeTruthy();
      const props = vfe!.properties ?? {};
      for (const required of ["field", "code", "message"]) {
        expect(
          required in props,
          `ValidationFieldError missing member '${required}'`,
        ).toBe(true);
        expect(props[required]?.type, `ValidationFieldError.${required} must be string`).toBe("string");
      }
      expect(vfe?.required ?? []).toEqual(
        expect.arrayContaining(["field", "code", "message"]),
      );
    });

    it("declares a ValidationProblem schema that extends Problem with a non-empty errors[] array", () => {
      const vp = SPEC.components?.schemas?.ValidationProblem as
        | {
            allOf?: Array<{ $ref?: string }>;
            properties?: Record<string, unknown>;
            required?: string[];
          }
        | undefined;
      expect(vp, "missing components.schemas.ValidationProblem").toBeTruthy();
      const props = (vp?.properties ?? {}) as Record<
        string,
        {
          type?: string;
          const?: number;
          items?: { $ref?: string };
          minItems?: number;
        }
      >;
      expect(props.errors, "ValidationProblem missing errors[] property").toBeTruthy();
      expect(props.errors?.type).toBe("array");
      expect(props.errors?.items?.$ref).toBe("#/components/schemas/ValidationFieldError");
      expect(props.status?.const).toBe(400);
      expect(vp?.required ?? []).toEqual(expect.arrayContaining(["errors"]));
    });

    it("declares a reusable BadRequest response with both JSON content types", () => {
      const responses = (SPEC as {
        components?: {
          responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
        };
      }).components?.responses ?? {};
      const br = responses.BadRequest;
      expect(br, "missing components.responses.BadRequest").toBeTruthy();
      const ct = br?.content ?? {};
      expect(ct["application/problem+json"], "BadRequest missing application/problem+json").toBeTruthy();
      expect(ct["application/json"], "BadRequest missing application/json (legacy)").toBeTruthy();
      expect(ct["application/problem+json"]?.schema?.$ref).toBe(
        "#/components/schemas/ValidationProblem",
      );
    });

    it("attaches 400 BadRequest to every paginated list operation", () => {
      const PAGINATED_LISTS: Array<[string, string]> = [
        ["/api/v1/providers", "get"],
        ["/api/v1/sanctions", "get"],
        ["/api/v1/enrollments", "get"],
      ];
      const failures: string[] = [];
      for (const [path, method] of PAGINATED_LISTS) {
        const op = (SPEC.paths[path] as Record<string, unknown> | undefined)?.[method] as
          | { responses?: Record<string, { $ref?: string }> }
          | undefined;
        const r400 = op?.responses?.["400"];
        if (!r400) {
          failures.push(`${method.toUpperCase()} ${path} missing 400 response`);
          continue;
        }
        if (r400.$ref !== "#/components/responses/BadRequest") {
          failures.push(
            `${method.toUpperCase()} ${path} 400 must $ref BadRequest, got ${JSON.stringify(r400)}`,
          );
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  });

  describe("anti-PHI guard", () => {
    /**
     * Walks the spec and collects every property name that appears
     * inside a JSON Schema object (`properties: { foo: ... }`). We
     * deliberately do NOT grep the raw YAML — the spec legitimately
     * describes what it *excludes* (`"never SSN, DOB, DEA"`) and that
     * descriptive prose MUST be allowed.
     */
    function collectPropertyNames(node: unknown, out: Set<string>): void {
      if (!node || typeof node !== "object") return;
      const obj = node as Record<string, unknown>;
      if (obj.properties && typeof obj.properties === "object") {
        for (const k of Object.keys(obj.properties as Record<string, unknown>)) {
          out.add(k);
        }
      }
      for (const v of Object.values(obj)) {
        collectPropertyNames(v, out);
      }
    }

    const propertyNames = (() => {
      const set = new Set<string>();
      collectPropertyNames(SPEC, set);
      return set;
    })();

    it.each(ANTI_PHI_FIELDS)(
      "no schema property is named '%s'",
      (field) => {
        const lowered = new Set([...propertyNames].map((p) => p.toLowerCase()));
        expect(
          lowered.has(field.toLowerCase()),
          `PHI field '${field}' appears as a schema property in the v1 OpenAPI spec — public REST v1 promises no PHI`,
        ).toBe(false);
      },
    );
  });
});
