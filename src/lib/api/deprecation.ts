/**
 * Deprecation + Sunset header machinery for the public REST/FHIR API.
 *
 * Wave 18 (2026-04-18). Implements the deprecation contract that the
 * versioning policy in `docs/api/versioning.md` has been promising
 * since spec v1.2.0:
 *
 *   - **Deprecation** (RFC 9745) advertises that an operation is on
 *     a deprecation path. Format: an `@`-prefixed Unix timestamp
 *     (`@1796083200`) — the structured-fields integer form.
 *   - **Sunset** (RFC 8594) advertises the wall-clock at which the
 *     operation will return 410 Gone. Format: an HTTP-date
 *     (IMF-fixdate per RFC 9110 §5.6.7). We always emit Sunset
 *     when Deprecation is set; an unbounded deprecation is a
 *     customer-hostile contract.
 *   - **Link rel=deprecation** (RFC 9745 §1.3) points at the
 *     human-readable upgrade guide.
 *   - **Link rel=sunset** (RFC 8594 §3) points at the same guide
 *     (we keep one URL per deprecation; splitting them is more
 *     ceremony than value).
 *   - **Link rel=successor-version** (RFC 5829) optionally points
 *     at the replacement endpoint when one exists.
 *
 * The registry below is **the single source of truth**. When we
 * deprecate something we add an entry here and the headers light
 * up on every response from that operation, automatically. The
 * SDK reads them via `parseDeprecation(headers)` and surfaces a
 * one-time console warning per process.
 *
 * Anti-weakening (do not regress without bumping `info.version`):
 *
 *   1. Header names MUST stay `Deprecation`, `Sunset`, `Link`. The
 *      RFCs are explicit; renaming would break every standard
 *      client (curl, GitHub Octokit, Stripe SDK, etc).
 *   2. The Deprecation value MUST stay the structured-fields
 *      `@<unix-seconds>` form. RFC 9745 also permits `?1` (true)
 *      but tooling support is uneven; the timestamp form is
 *      strictly more useful.
 *   3. Sunset MUST be a valid HTTP-date; never a Unix timestamp,
 *      never an ISO-8601 string. RFC 8594 is explicit.
 *   4. The infoUrl MUST resolve to a public, stable upgrade guide.
 *      We point at our published changelog by default so customers
 *      can land on context without an account.
 *   5. We do NOT short-circuit deprecated operations — they keep
 *      returning 200s (or whatever they used to) right up until
 *      the sunset date. The headers are an **advisory** contract,
 *      not an enforcement one. The 410 only fires after the
 *      sunset wall-clock has passed.
 */

import type { NextResponse } from "next/server";

/**
 * One deprecation entry. Keyed at lookup time by `(method, path)`.
 *
 * Path matching is exact-prefix-then-trailing-segment:
 *   - `/api/v1/providers` matches the literal path
 *   - `/api/v1/providers/{id}` matches `/api/v1/providers/<anything>`
 *
 * Method `*` matches any HTTP verb.
 */
export interface DeprecationPolicy {
  /** Path template — `{id}` is the only supported placeholder. */
  path: string;
  /** HTTP method, or `*` for any. */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "*";
  /** When the operation entered the deprecation window. */
  deprecatedAt: Date;
  /** When the operation will start returning 410 Gone. */
  sunsetAt: Date;
  /** Stable, public upgrade guide URL. */
  infoUrl: string;
  /**
   * Optional successor-version pointer. Surfaced as
   * `Link: rel="successor-version"` so SDKs can auto-rewrite
   * call sites once a customer opts in.
   */
  successor?: {
    /** Full URL of the replacement (must be absolute). */
    url: string;
    /** Free-text label, e.g. `"v2 list providers"`. */
    label?: string;
  };
}

/**
 * The active deprecation registry. Empty by default — every entry
 * here turns headers on for the matching operation. Adding an
 * entry is **not** a breaking change (additive informational
 * headers); removing the operation entirely IS, and must wait
 * until the sunset wall-clock has passed.
 *
 * Format used at the moment we ship the first real deprecation:
 *
 *   {
 *     path: "/api/v1/legacy-thing",
 *     method: "GET",
 *     deprecatedAt: new Date("2026-06-01T00:00:00Z"),
 *     sunsetAt:    new Date("2026-12-01T00:00:00Z"),
 *     infoUrl:     "https://app.example.com/changelog#legacy-thing",
 *     successor:   {
 *       url:   "https://api.example.com/api/v1/new-thing",
 *       label: "v1 new-thing",
 *     },
 *   }
 */
export const DEPRECATION_REGISTRY: DeprecationPolicy[] = [];

const PARAM_RE = /\{[^}/]+\}/g;
// Sentinel used to swap dynamic-segment placeholders out before
// regex-escaping the rest of the path. Picked to be a string that
// cannot appear in a URL path (NUL bytes are illegal).
const PARAM_SENTINEL = "\u0000PARAM\u0000";
const PARAM_SENTINEL_RE = new RegExp(PARAM_SENTINEL.replace(/[.+^${}()|[\]\\]/g, "\\$&"), "g");

/**
 * Compile a path template (e.g. `/api/v1/providers/{id}`) into a
 * regex that matches the URL path. `{name}` is `[^/]+` — same
 * semantics as Next.js dynamic segments.
 *
 * Order matters: we swap `{name}` for a sentinel BEFORE escaping
 * the rest of the path, then expand the sentinel into the
 * single-segment matcher AFTER escaping. Otherwise the literal
 * `{` and `}` get escaped and the placeholder regex never matches.
 */
function compilePathTemplate(template: string): RegExp {
  const stamped = template.replace(PARAM_RE, PARAM_SENTINEL);
  const escaped = stamped.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const expanded = escaped.replace(PARAM_SENTINEL_RE, "[^/]+");
  return new RegExp(`^${expanded}$`);
}

/** Resolve the active deprecation policy for a (method, path), if any. */
export function findDeprecation(
  method: string,
  path: string,
  registry: readonly DeprecationPolicy[] = DEPRECATION_REGISTRY,
): DeprecationPolicy | undefined {
  const upper = method.toUpperCase();
  for (const entry of registry) {
    if (entry.method !== "*" && entry.method !== upper) continue;
    const re = compilePathTemplate(entry.path);
    if (re.test(path)) return entry;
  }
  return undefined;
}

/**
 * RFC 9745 Deprecation header value: structured-fields integer with
 * a leading `@` indicating Unix-seconds. Example: `@1796083200`.
 */
export function formatDeprecationValue(deprecatedAt: Date): string {
  const seconds = Math.floor(deprecatedAt.getTime() / 1000);
  return `@${seconds}`;
}

/**
 * RFC 9110 §5.6.7 IMF-fixdate (the only valid Sunset format per
 * RFC 8594). Example: `Sun, 11 Nov 2030 23:59:59 GMT`. Implemented
 * here rather than relying on `Date.prototype.toUTCString()` so
 * we have a hard contract test target across Node versions.
 */
export function formatHttpDate(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const d = date;
  const day = days[d.getUTCDay()]!;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mon = months[d.getUTCMonth()]!;
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${day}, ${dd} ${mon} ${yyyy} ${hh}:${mm}:${ss} GMT`;
}

/** Parse an RFC 9745 Deprecation value back into a Date. */
export function parseDeprecationValue(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed.startsWith("@")) return undefined;
  const n = Number(trimmed.slice(1));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return new Date(n * 1000);
}

/** Parse an RFC 8594 Sunset header (HTTP-date) back into a Date. */
export function parseSunset(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return undefined;
  return new Date(t);
}

/**
 * Compose the Link header segment for one rel/url pair. We append
 * to any existing Link header (the spec allows comma-separated
 * lists), so this is safe to call alongside the pagination Link
 * machinery.
 */
function appendLink(existing: string | null, url: string, rel: string): string {
  const segment = `<${url}>; rel="${rel}"`;
  if (!existing) return segment;
  return `${existing}, ${segment}`;
}

/**
 * Attach RFC 9745 + RFC 8594 + RFC 5829 headers to a response. No-op
 * when `policy` is undefined — designed to be called unconditionally
 * from every v1 route handler:
 *
 *   const policy = findDeprecation("GET", "/api/v1/providers");
 *   return applyDeprecationHeaders(response, policy);
 *
 * Composes cleanly with the pagination Link machinery: any
 * existing Link header is preserved and the deprecation/sunset
 * link entries are appended.
 */
export function applyDeprecationHeaders<T extends NextResponse>(
  response: T,
  policy: DeprecationPolicy | undefined,
): T {
  if (!policy) return response;
  response.headers.set("Deprecation", formatDeprecationValue(policy.deprecatedAt));
  response.headers.set("Sunset", formatHttpDate(policy.sunsetAt));

  let link = response.headers.get("Link");
  link = appendLink(link, policy.infoUrl, "deprecation");
  link = appendLink(link, policy.infoUrl, "sunset");
  if (policy.successor) {
    link = appendLink(link, policy.successor.url, "successor-version");
  }
  response.headers.set("Link", link);
  return response;
}

/**
 * Convenience helper for routes: looks up the registry and
 * applies headers in one call. Equivalent to
 * `applyDeprecationHeaders(response, findDeprecation(method, path))`.
 */
export function applyDeprecationByRoute<T extends NextResponse>(
  response: T,
  method: string,
  path: string,
  registry: readonly DeprecationPolicy[] = DEPRECATION_REGISTRY,
): T {
  return applyDeprecationHeaders(response, findDeprecation(method, path, registry));
}

/** Header name constants — exposed so tests can refer to them without re-typing literals. */
export const DEPRECATION_HEADER = "Deprecation";
export const SUNSET_HEADER = "Sunset";
export const LINK_HEADER = "Link";
