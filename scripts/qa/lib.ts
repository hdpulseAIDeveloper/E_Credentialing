/**
 * Shared helpers for QA inventory + coverage scripts (`scripts/qa/*`).
 *
 * Per `docs/qa/STANDARD.md` §6 the inventory scripts are the single source of
 * truth for the §3 headline coverage block: "Routes covered: X of Y".
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

export const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const APP_DIR = path.join(REPO_ROOT, "src", "app");
export const ROUTERS_DIR = path.join(REPO_ROOT, "src", "server", "api", "routers");
export const TESTS_DIR = path.join(REPO_ROOT, "tests");

export const INVENTORY_DIR = path.join(REPO_ROOT, "docs", "qa", "inventories");

/**
 * Convert a Next.js App-Router file path under src/app/** /page.tsx to its URL
 * pathname. Route groups (parentheses) are stripped. Dynamic segments are kept
 * as `[param]` so the inventory carries the templated form; coverage matching
 * normalises both sides.
 *
 * Examples:
 *   src/app/page.tsx                            -> /
 *   src/app/(staff)/dashboard/page.tsx          -> /dashboard
 *   src/app/(staff)/providers/[id]/page.tsx     -> /providers/[id]
 *   src/app/legal/privacy/page.tsx              -> /legal/privacy
 */
export function pageFileToRoute(pageFile: string): string {
  const rel = path.relative(APP_DIR, pageFile).replaceAll("\\", "/");
  // Strip the trailing /page.tsx OR a bare page.tsx (root case).
  const withoutFile = rel.replace(/(?:^|\/)page\.tsx$/, "");
  const segments = withoutFile.split("/").filter((s) => s.length > 0);
  const cleaned = segments.filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")));
  if (cleaned.length === 0) return "/";
  return "/" + cleaned.join("/");
}

/**
 * Convert an api/** /route.ts file path to its URL pathname (kept templated).
 *
 * Examples:
 *   src/app/api/health/route.ts                 -> /api/health
 *   src/app/api/providers/[id]/audit-packet/route.ts -> /api/providers/[id]/audit-packet
 */
export function apiFileToRoute(routeFile: string): string {
  const rel = path.relative(APP_DIR, routeFile).replaceAll("\\", "/");
  const withoutFile = rel.replace(/\/route\.ts$/, "");
  return "/" + withoutFile;
}

/**
 * Normalise a route or href to a canonical key for coverage matching.
 * - lowercases
 * - collapses [param] / :param / {param} to {param}
 * - strips query and hash
 * - strips trailing slash (except root)
 */
export function normaliseRoute(input: string): string {
  let r = input.split("?")[0]!.split("#")[0]!;
  r = r.toLowerCase();
  r = r.replace(/\[[^\]]+\]/g, "{param}");
  r = r.replace(/:[a-z0-9_]+/g, "{param}");
  if (r.length > 1 && r.endsWith("/")) r = r.slice(0, -1);
  return r;
}

/**
 * Read a file as UTF-8 text; returns empty string on ENOENT so callers can
 * tolerate generated/missing files without crashing the inventory build.
 */
export async function readText(file: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

/**
 * Detected HTTP methods exported by an api/** /route.ts file.
 */
export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * Find which HTTP methods a route.ts file exports. Detects:
 *   export async function GET(...)
 *   export const GET = ...
 *   export { GET, POST }   (handler re-export)
 */
export function detectExportedMethods(source: string): HttpMethod[] {
  const found = new Set<HttpMethod>();
  for (const m of HTTP_METHODS) {
    const fn = new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`);
    const cnst = new RegExp(`export\\s+(const|let)\\s+${m}\\b`);
    const reExport = new RegExp(`export\\s*\\{[^}]*\\b${m}\\b[^}]*\\}`);
    // NextAuth-style: `export const { GET, POST } = handlers;`
    const destructured = new RegExp(
      `export\\s+(const|let|var)\\s*\\{[^}]*\\b${m}\\b[^}]*\\}\\s*=`,
    );
    if (
      fn.test(source) ||
      cnst.test(source) ||
      reExport.test(source) ||
      destructured.test(source)
    ) {
      found.add(m);
    }
  }
  return [...found];
}

export interface RouteInventoryEntry {
  /** Templated pathname, e.g. /providers/[id] */
  route: string;
  /** Path on disk relative to REPO_ROOT */
  file: string;
  /** Whether the route is dynamic (contains [param]) */
  dynamic: boolean;
  /** Route group it belongs to (for organising specs) */
  group: string;
}

export interface ApiInventoryEntry {
  route: string;
  file: string;
  methods: HttpMethod[];
  dynamic: boolean;
}

export interface LinkInventoryEntry {
  /** The href value as written in source (templated or static) */
  href: string;
  /** Source file the link came from */
  file: string;
  /** Whether the link looked external (had protocol) */
  external: boolean;
}

export interface TrpcInventoryEntry {
  /** Router file basename without extension (e.g. provider) */
  router: string;
  /** Procedure name (e.g. listMine) */
  procedure: string;
  /** query | mutation | subscription */
  kind: "query" | "mutation" | "subscription";
  file: string;
}
