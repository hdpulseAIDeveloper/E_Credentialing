/**
 * GET /api/v1/errors/{code}
 *
 * Wave 21 (2026-04-19). Single-entry version of the error
 * catalog. Returns one row from the catalog by `code`, or a
 * Problem-shaped 404 if the code is not in the catalog.
 *
 * Behaviour
 * ---------
 *   - Requires a valid Bearer API key (any scope, any key —
 *     consistent with `/health` and `/me`).
 *   - The path parameter is the raw snake_case code
 *     (e.g. `/api/v1/errors/insufficient_scope`). The kebab-case
 *     URL form (e.g. `/api/v1/errors/insufficient-scope`) is
 *     ALSO accepted as a convenience so callers can take the
 *     suffix of the `type` URI verbatim.
 *   - Conditional GETs (ETag + If-None-Match) work — the entry
 *     changes only when this codebase changes.
 *
 * Anti-weakening
 * --------------
 *   - Do NOT 200 with a synthesised body for unknown codes.
 *     Unknown means 404 — the catalog is the contract.
 */

import { NextResponse } from "next/server";
import {
  authenticateApiKey,
  v1ErrorResponse,
} from "../../middleware";
import { applyRateLimitHeaders } from "@/lib/api/rate-limit";
import {
  applyRequestIdHeader,
  resolveRequestId,
} from "@/lib/api/request-id";
import { auditApiRequest } from "@/lib/api/audit-api";
import {
  applyEtagHeader,
  evaluateConditionalGet,
  notModifiedResponse,
} from "@/lib/api/etag";
import { applyDeprecationByRoute } from "@/lib/api/deprecation";
import { findCatalogEntry } from "@/lib/api/error-catalog";

const ROUTE_PATH = "/api/v1/errors/[code]";

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const requestId = resolveRequestId(request);
  const auth = await authenticateApiKey(request);
  if (!auth.valid) {
    return applyDeprecationByRoute(
      applyRequestIdHeader(auth.error!, requestId),
      "GET",
      ROUTE_PATH,
    );
  }

  const { code: rawCode } = await context.params;
  // Accept both the snake_case form and the kebab-case URI suffix
  // form so callers can either pass `insufficient_scope` directly
  // or chop the `type` URI on the right of `/errors/` and pass
  // `insufficient-scope` as-is.
  const normalised = rawCode.replace(/-/g, "_").toLowerCase();
  const entry = findCatalogEntry(normalised);

  if (!entry) {
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: ROUTE_PATH,
      status: 404,
      resultCount: 0,
      requestId,
    });
    return applyDeprecationByRoute(
      applyRequestIdHeader(
        applyRateLimitHeaders(
          v1ErrorResponse(
            404,
            "not_found",
            `Unknown error code: ${rawCode}`,
            { requestedCode: rawCode },
            request,
          ),
          auth.rateLimit,
        ),
        requestId,
      ),
      "GET",
      ROUTE_PATH,
    );
  }

  const conditional = evaluateConditionalGet(request, entry);
  if (conditional.status === "not-modified") {
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: ROUTE_PATH,
      status: 304,
      resultCount: 0,
      requestId,
    });
    return applyDeprecationByRoute(
      notModifiedResponse(conditional.etag, {
        requestId,
        rateLimit: auth.rateLimit,
      }),
      "GET",
      ROUTE_PATH,
    );
  }

  void auditApiRequest({
    apiKeyId: auth.keyId!,
    method: "GET",
    path: ROUTE_PATH,
    status: 200,
    resultCount: 1,
    requestId,
  });

  return applyDeprecationByRoute(
    applyRequestIdHeader(
      applyRateLimitHeaders(
        applyEtagHeader(
          NextResponse.json(entry, {
            status: 200,
            headers: {
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            },
          }),
          conditional.etag,
        ),
        auth.rateLimit,
      ),
      requestId,
    ),
    "GET",
    ROUTE_PATH,
  );
}
