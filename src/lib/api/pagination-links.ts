/**
 * RFC 8288 `Link` pagination headers for the public REST v1 API.
 *
 * Wave 16 (2026-04-18). Every paginated list endpoint emits a
 * single `Link` header listing the relevant page navigation URLs
 * as a comma-separated value with quoted `rel` values. Customers
 * can navigate the result set without parsing the JSON envelope -
 * `curl --include`, browsers, log aggregators, and most HTTP
 * libraries already understand `Link` natively.
 *
 * Format (single header value, RFC 8288 §3):
 *
 *   Link: <https://host/api/v1/providers?page=2&limit=25>; rel="next",
 *         <https://host/api/v1/providers?page=4&limit=25>; rel="last",
 *         <https://host/api/v1/providers?page=1&limit=25>; rel="first"
 *
 * (whitespace shown for readability; the real header is a single line)
 *
 * Semantics:
 *   - `first` is always emitted when `totalPages >= 1`.
 *   - `prev` is emitted only when `page > 1`.
 *   - `next` is emitted only when `page < totalPages`.
 *   - `last` is always emitted when `totalPages >= 1`.
 *   - When `totalPages === 0` (empty result set), no `Link` header
 *     is emitted - there are no pages to navigate to.
 *
 * Anti-weakening (do not regress without bumping `info.version`):
 *
 *   1. The `rel` token vocabulary is fixed: `first | prev | next | last`.
 *      Adding `up`, `self`, `cite`, etc. is a contract change.
 *   2. URLs MUST be absolute (scheme://host/...) - relative URLs
 *      break clients sitting behind reverse proxies that rewrite paths.
 *   3. Existing query parameters MUST be preserved on every navigation
 *      URL (`status`, `npi`, `result`, `payer`, etc.) so that following
 *      a `next` link keeps the same filter context.
 *   4. The `page` and `limit` parameters MUST be set explicitly on the
 *      generated URL even when the caller used defaults; the URL is the
 *      contract, not "what the caller typed".
 */

import type { NextResponse } from "next/server";

/** Pagination state needed to build the Link header. */
export interface LinkPagination {
  /** 1-based current page. */
  page: number;
  /** Page size. */
  limit: number;
  /** Total result count across all pages (`>= 0`). */
  total: number;
  /** Total page count (`Math.ceil(total / limit)`). */
  totalPages: number;
}

/**
 * Build a single RFC 8288 `Link` header value for the given request
 * URL + pagination snapshot. Returns `null` when there are no pages
 * to navigate (empty result set) - callers SHOULD skip the header
 * in that case rather than emit an empty value.
 */
export function buildPaginationLinkHeader(
  requestUrl: string | URL,
  pagination: LinkPagination,
): string | null {
  if (pagination.totalPages < 1) return null;

  const base = new URL(typeof requestUrl === "string" ? requestUrl : requestUrl.toString());

  const buildUrl = (page: number): string => {
    const u = new URL(base.toString());
    u.searchParams.set("page", String(page));
    u.searchParams.set("limit", String(pagination.limit));
    return u.toString();
  };

  const parts: string[] = [];
  parts.push(`<${buildUrl(1)}>; rel="first"`);
  if (pagination.page > 1) {
    parts.push(`<${buildUrl(pagination.page - 1)}>; rel="prev"`);
  }
  if (pagination.page < pagination.totalPages) {
    parts.push(`<${buildUrl(pagination.page + 1)}>; rel="next"`);
  }
  parts.push(`<${buildUrl(pagination.totalPages)}>; rel="last"`);

  return parts.join(", ");
}

/**
 * Attach the `Link` header to a NextResponse using the request URL
 * and pagination snapshot. No-op when there are no pages to
 * navigate. Returns the same response so it composes inline:
 *
 *   return applyPaginationLinkHeader(
 *     applyRateLimitHeaders(NextResponse.json(...), rl),
 *     request.url,
 *     pagination,
 *   );
 */
export function applyPaginationLinkHeader<T extends NextResponse>(
  response: T,
  requestUrl: string | URL,
  pagination: LinkPagination,
): T {
  const value = buildPaginationLinkHeader(requestUrl, pagination);
  if (!value) return response;
  response.headers.set("Link", value);
  return response;
}

/**
 * Parse an inbound `Link` header value back into a `{ rel: url }`
 * map. Tolerant of whitespace, mixed case `rel` tokens, and unknown
 * `rel` values (returned as-is). Useful for the SDK's pagination
 * navigation helpers and contract-test assertions. Returns an
 * empty object for `null`/empty input.
 */
export function parseLinkHeader(value: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value) return out;
  for (const segment of value.split(",")) {
    const m = segment.match(/^\s*<([^>]+)>\s*;\s*rel=("([^"]+)"|([^;\s]+))\s*$/);
    if (!m) continue;
    const url = m[1]!;
    const rel = (m[3] ?? m[4] ?? "").toLowerCase();
    if (rel) out[rel] = url;
  }
  return out;
}
