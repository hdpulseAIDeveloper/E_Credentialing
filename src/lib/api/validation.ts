/**
 * Server-side request validation for the public REST `/api/v1/*`
 * surface, emitting RFC 9457 Problem Details bodies on failure.
 *
 * Wave 20 (2026-04-19). Before this module, every list route silently
 * coerced bad input — `?limit=foo` became `NaN` and crashed Prisma,
 * `?status=GARBAGE` was passed straight through, `?page=-5` was
 * quietly rewritten to 1. None of those failure modes were
 * customer-visible in a useful way.
 *
 * Contract:
 *
 *   1. Each route declares a Zod schema for its query string.
 *   2. `parseQuery(request, schema)` returns either
 *      `{ ok: true, data }` or `{ ok: false, response }`. The
 *      response is a `400 Bad Request` Problem with
 *      `type=…/problems/invalid-request` and a stable
 *      `errors: [{ field, code, message }]` extension array.
 *   3. The legacy `error: { code, message }` envelope is preserved
 *      via the same `buildProblem` path used by every other v1
 *      error (Wave 19), so existing clients keep working.
 *
 * Anti-weakening: never widen a query schema by removing a
 * constraint. Schema bumps are SemVer minor (loosening) or major
 * (tightening); track them in `docs/api/versioning.md`.
 */

import { NextResponse } from "next/server";
import type { ZodIssue, ZodTypeAny, infer as ZodInfer } from "zod";
import { buildProblem, negotiateProblemContentType } from "./problem-details";

/** Stable validation-error code emitted on every 400. */
export const VALIDATION_ERROR_CODE = "invalid_request";

/**
 * One validation failure. The shape is intentionally narrow so we
 * can guarantee it across SDK versions.
 *
 * - `field` — dot-joined path inside the parsed object
 *   (e.g. `"limit"`, `"page"`, `"filters.status"`). Empty string
 *   when the failure is on the root.
 * - `code` — Zod issue code (`"too_small"`, `"invalid_enum_value"`,
 *   etc.). Stable across releases of zod 3.x.
 * - `message` — short human-readable English message.
 */
export interface ValidationFieldError {
  field: string;
  code: string;
  message: string;
}

/** Zod path → dot-string. Treats numeric segments as `.0`. */
export function fieldPathFromZodIssue(issue: ZodIssue): string {
  return issue.path.map((p) => String(p)).join(".");
}

/** Convert a list of Zod issues to our wire shape. */
export function issuesToFieldErrors(
  issues: readonly ZodIssue[],
): ValidationFieldError[] {
  return issues.map((issue) => ({
    field: fieldPathFromZodIssue(issue),
    code: issue.code,
    message: issue.message,
  }));
}

/**
 * Build a `400 Bad Request` Problem response from a list of
 * field-level validation errors. The Problem body looks like:
 *
 *   {
 *     "type": "…/problems/invalid-request",
 *     "title": "Invalid request",
 *     "status": 400,
 *     "detail": "Request validation failed",
 *     "instance": "/api/v1/providers",
 *     "errors": [{ "field": "limit", "code": "too_big", "message": "..." }],
 *     "error": { "code": "invalid_request", "message": "..." }
 *   }
 *
 * Content-type negotiation is delegated to
 * `negotiateProblemContentType` (Wave 19): clients that ask for
 * `application/problem+json` get it; everyone else gets
 * `application/json` with a byte-identical body.
 */
export function validationProblemResponse(
  request: Request | null | undefined,
  errors: ValidationFieldError[],
  detail = "Request validation failed",
): NextResponse {
  const instance =
    request?.url !== undefined ? safePath(request.url) : undefined;
  const body = buildProblem({
    status: 400,
    code: VALIDATION_ERROR_CODE,
    message: detail,
    instance,
    extras: { errors },
  });
  const contentType = negotiateProblemContentType(request ?? undefined);
  return NextResponse.json(body, {
    status: 400,
    headers: { "Content-Type": contentType },
  });
}

/** Result of `parseQuery`. */
export type ParseQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Parse and validate `request.url` query parameters against a Zod
 * schema. The schema MUST be an object schema (or a transform
 * thereof); the input is `Object.fromEntries(searchParams)`, so
 * each key is at most one string. For repeating keys (e.g.
 * `?tag=a&tag=b`) the caller can pre-process the request URL or
 * use `searchParams.getAll(...)` directly.
 *
 * On failure this function does NOT throw — it returns a structured
 * `400` Problem response so the route handler can `return result.response`.
 */
export function parseQuery<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): ParseQueryResult<ZodInfer<S>> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    raw[k] = v;
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const errors = issuesToFieldErrors(parsed.error.issues);
  return { ok: false, response: validationProblemResponse(request, errors) };
}

function safePath(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return undefined;
  }
}
