/**
 * RFC 9457 Problem Details for HTTP APIs.
 *
 * Wave 19 — productize the v1 error contract:
 *   - Every error response now carries the standard RFC 9457 fields
 *     (`type`, `title`, `status`, `detail`, `instance`) **alongside**
 *     the existing `{ error: { code, message, ...extras } }` envelope.
 *     That keeps every existing client working unchanged while letting
 *     RFC 9457-aware tooling (Postman, IntelliJ HTTP client, browser
 *     devtools, internal SRE dashboards) parse a standard shape.
 *   - The Content-Type defaults to `application/problem+json` per the
 *     RFC, except for legacy `Accept: application/json` callers who
 *     get the same body but with `Content-Type: application/json`.
 *     Because the body is a strict superset of the legacy envelope,
 *     this is non-breaking either way.
 *
 * Anti-weakening (do not regress):
 *   1. The legacy `error.code` / `error.message` fields MUST stay in
 *      the body. The RFC 9457 fields are additive, not replacement.
 *      Removing the legacy envelope is a breaking change that requires
 *      a new major version (`/api/v2/...`) per `docs/api/versioning.md`
 *      §2.1.
 *   2. The `type` URI MUST be stable per error code — it is the
 *      machine-readable identifier RFC 9457 calls out as "the primary
 *      identifier for the problem type". If you change a `code` value
 *      you change the `type` URI; both moves are breaking.
 *   3. `status` MUST equal the HTTP response status. RFC 9457 §3.1.2
 *      makes this a SHOULD; we make it a MUST so consumers can rely
 *      on body-level dispatch when the response object is hidden by
 *      a proxy / SDK wrapper.
 *   4. The Content-Type negotiation logic MUST treat
 *      `application/problem+json` as a strict superset of
 *      `application/json` when matching. If both are acceptable we
 *      send `application/problem+json` (more specific = more useful).
 */

import { NextResponse } from "next/server";

/**
 * Base URL for the canonical `type` URIs. Overridable for local-dev /
 * sandbox environments via `PROBLEM_BASE_URL`. The path component
 * (`/errors/<code>`) is intentionally simple and stable; the page at
 * that URL SHOULD eventually serve human-readable docs for the code,
 * but the URI is the contract regardless of whether the page exists.
 */
const PROBLEM_BASE_URL =
  process.env.PROBLEM_BASE_URL ?? "https://essen-credentialing.example";

/** RFC 9457 official media type for Problem Details responses. */
export const PROBLEM_CONTENT_TYPE = "application/problem+json";

/** Standard JSON content type, used as the fallback. */
export const JSON_CONTENT_TYPE = "application/json";

/**
 * RFC 9457 problem object. All standard members are optional per the
 * RFC, but in this codebase `type`, `title`, `status`, and `detail`
 * are always present on v1 error responses.
 */
export interface Problem {
  /** RFC 9457 §3.1.1 — URI reference identifying the problem type. */
  type: string;
  /** RFC 9457 §3.1.3 — short, human-readable summary. */
  title: string;
  /** RFC 9457 §3.1.2 — the HTTP status code, mirrored. */
  status: number;
  /** RFC 9457 §3.1.4 — human-readable explanation specific to this occurrence. */
  detail: string;
  /** RFC 9457 §3.1.5 — URI reference identifying the specific occurrence. */
  instance?: string;
  /** Legacy `{ error: { code, message, ...extras } }` envelope (unchanged). */
  error: {
    code: string;
    message: string;
    [extra: string]: unknown;
  };
  /** RFC 9457 §3.2 extension members live at the top level too. */
  [extension: string]: unknown;
}

/**
 * Map of v1 error `code` -> human-readable `title`. The `title` is
 * supposed to be invariant for a given `type` per RFC 9457 §3.1.3 —
 * "It SHOULD NOT change from occurrence to occurrence of the
 * problem". Adding a new code requires a row here.
 *
 * Keep alphabetised. Codes not in this map fall back to a
 * Title-Cased version of the snake_case code, which is a safe
 * default but loses the editorial value.
 */
export const PROBLEM_TITLES: Readonly<Record<string, string>> = {
  expired_api_key: "Expired API key",
  insufficient_scope: "Insufficient scope",
  invalid_api_key: "Invalid API key",
  invalid_request: "Invalid request",
  missing_authorization: "Missing authorization",
  not_found: "Resource not found",
  rate_limited: "Rate limit exceeded",
  unauthorized: "Unauthorized",
  upstream_unavailable: "Upstream unavailable",
};

/**
 * Compute the canonical `type` URI for an error code. Stable per code.
 * The path segment uses kebab-case for URL-friendliness while the
 * code itself stays snake_case for JS-friendliness.
 */
export function problemTypeUri(code: string): string {
  const slug = code.replace(/_/g, "-").toLowerCase();
  return `${PROBLEM_BASE_URL}/errors/${slug}`;
}

/** Resolve the human-readable title for a code, with a safe default. */
export function problemTitleFor(code: string): string {
  const explicit = PROBLEM_TITLES[code];
  if (explicit) return explicit;
  return code
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

/** Options for `buildProblem`. */
export interface BuildProblemOptions {
  status: number;
  code: string;
  message: string;
  /** Optional URI reference for the specific occurrence (typically the request path). */
  instance?: string;
  /** Extension members merged at top-level AND into `error`. */
  extras?: Record<string, unknown>;
}

/**
 * Build the canonical Problem body. The body is a strict superset of
 * the legacy `{ error: { code, message, ...extras } }` envelope, so
 * old SDKs keep working unchanged.
 */
export function buildProblem(opts: BuildProblemOptions): Problem {
  const { status, code, message, instance, extras = {} } = opts;
  return {
    type: problemTypeUri(code),
    title: problemTitleFor(code),
    status,
    detail: message,
    ...(instance !== undefined ? { instance } : {}),
    ...extras,
    error: {
      code,
      message,
      ...extras,
    },
  };
}

/**
 * Decide which Content-Type to emit based on the Accept header.
 *
 * Selection rules:
 *   1. If the caller explicitly accepts `application/problem+json`,
 *      use it.
 *   2. If the caller accepts `application/json` (or `* / *`), use
 *      `application/problem+json` anyway — RFC 9457 §3 names it as
 *      a JSON variant and the body is valid JSON. This makes the
 *      RFC the default for unsophisticated callers.
 *   3. If the caller explicitly does NOT accept `application/json`
 *      OR `application/problem+json` (e.g. `Accept: text/html`),
 *      fall back to `application/json`. The body is still valid JSON
 *      and RFC 9457 §3 explicitly permits this.
 *
 * The negotiation is intentionally permissive — we never 406. The
 * caller MUST be able to read JSON; if they pass an Accept header
 * we can't satisfy, returning `application/json` is friendlier than
 * blocking the response.
 */
export function negotiateProblemContentType(request?: Request | null): string {
  if (!request) return PROBLEM_CONTENT_TYPE;
  const accept = request.headers.get("accept");
  if (!accept) return PROBLEM_CONTENT_TYPE;
  const lower = accept.toLowerCase();
  if (lower.includes(PROBLEM_CONTENT_TYPE)) return PROBLEM_CONTENT_TYPE;
  if (lower.includes(JSON_CONTENT_TYPE)) return PROBLEM_CONTENT_TYPE;
  if (lower.includes("*/*")) return PROBLEM_CONTENT_TYPE;
  return JSON_CONTENT_TYPE;
}

/**
 * Build a NextResponse carrying a Problem body with the negotiated
 * content type.
 */
export function problemResponse(
  request: Request | null | undefined,
  opts: BuildProblemOptions,
): NextResponse {
  const body = buildProblem(opts);
  const contentType = negotiateProblemContentType(request);
  const response = NextResponse.json(body, { status: opts.status });
  response.headers.set("Content-Type", contentType);
  return response;
}

/**
 * Backwards-compatible bridge for code paths that don't have the
 * Request object handy. Defaults to `application/problem+json`.
 */
export function problemResponseDefault(opts: BuildProblemOptions): NextResponse {
  return problemResponse(null, opts);
}
