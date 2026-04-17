/**
 * P2 Gap #16 — Shared helpers for the CMS-0057-F FHIR R4 Provider Directory.
 *
 * All endpoints share the same auth flow, search-result envelope, and
 * OperationOutcome wrapping, so we centralize them here.
 */

import { NextResponse } from "next/server";
import { authenticateApiKey, type ApiKeyAuthResult } from "@/app/api/v1/middleware";
import { auditApiRequest } from "@/lib/api/audit-api";

export const FHIR_CONTENT_TYPE = "application/fhir+json";

export function operationOutcome(
  severity: "error" | "warning",
  code: string,
  diagnostics: string
) {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity, code, diagnostics }],
  };
}

export function fhirError(
  status: number,
  code: string,
  diagnostics: string
): NextResponse {
  return NextResponse.json(operationOutcome("error", code, diagnostics), {
    status,
    headers: { "Content-Type": FHIR_CONTENT_TYPE },
  });
}

export function fhirJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": FHIR_CONTENT_TYPE },
  });
}

export interface AuthorizeResult {
  ok: true;
  auth: ApiKeyAuthResult;
}
export interface AuthorizeFail {
  ok: false;
  response: NextResponse;
}

/**
 * Authorize a FHIR request and surface failures as OperationOutcome JSON.
 */
export async function authorizeFhir(
  request: Request,
  scope: string
): Promise<AuthorizeResult | AuthorizeFail> {
  const auth = await authenticateApiKey(request);
  if (!auth.valid) {
    const original = auth.error!;
    return {
      ok: false,
      response: fhirError(
        original.status,
        original.status === 429 ? "throttled" : "security",
        `auth_${original.status}`
      ),
    };
  }
  if (!auth.permissions?.[scope]) {
    return {
      ok: false,
      response: fhirError(403, "forbidden", `API key lacks ${scope} permission`),
    };
  }
  return { ok: true, auth };
}

/**
 * Parse the standard `_count` and `_offset` paging params.
 */
export function parsePaging(url: URL): { count: number; offset: number } {
  return {
    count: Math.min(100, Math.max(1, parseInt(url.searchParams.get("_count") || "20", 10))),
    offset: Math.max(0, parseInt(url.searchParams.get("_offset") || "0", 10)),
  };
}

/**
 * Build pagination links for a search Bundle.
 */
export function buildSearchsetLinks(
  baseUrl: string,
  searchParams: URLSearchParams,
  total: number,
  offset: number,
  count: number
): Array<{ relation: string; url: string }> {
  const buildLink = (newOffset: number) => {
    const u = new URL(baseUrl);
    for (const [key, value] of searchParams) {
      if (key === "_offset" || key === "_count") continue;
      u.searchParams.set(key, value);
    }
    u.searchParams.set("_count", String(count));
    u.searchParams.set("_offset", String(newOffset));
    return u.toString();
  };

  const links: Array<{ relation: string; url: string }> = [
    { relation: "self", url: buildLink(offset) },
  ];
  if (offset > 0) {
    links.push({ relation: "previous", url: buildLink(Math.max(0, offset - count)) });
  }
  if (offset + count < total) {
    links.push({ relation: "next", url: buildLink(offset + count) });
  }
  return links;
}

export function searchsetBundle(opts: {
  total: number;
  links: Array<{ relation: string; url: string }>;
  resources: Array<{ fullUrl: string; resource: Record<string, unknown> }>;
}) {
  return {
    resourceType: "Bundle",
    type: "searchset",
    timestamp: new Date().toISOString(),
    total: opts.total,
    link: opts.links,
    entry: opts.resources,
  };
}

export interface AuditedFhirRequest {
  auth: ApiKeyAuthResult;
  method: string;
  path: string;
  status: number;
  resultCount?: number;
  query?: Record<string, string | null | undefined>;
}

export function auditFhir(req: AuditedFhirRequest): void {
  // Normalize undefined -> null so the audit signature accepts it.
  const normalizedQuery: Record<string, string | null> | undefined = req.query
    ? Object.fromEntries(
        Object.entries(req.query).map(([k, v]) => [k, v ?? null])
      )
    : undefined;

  void auditApiRequest({
    apiKeyId: req.auth.keyId!,
    method: req.method,
    path: req.path,
    status: req.status,
    resultCount: req.resultCount,
    query: normalizedQuery,
  });
}
