/**
 * scripts/qa/check-postman-drift.ts
 *
 * Wave 11 (2026-04-18). Companion to `check-sdk-drift.ts`. Rebuilds
 * the Postman collection in memory from the current OpenAPI spec
 * and compares (deep-equal, ignoring the `_postman_id` field which
 * Postman auto-injects) against the checked-in
 * `data/api/v1/postman.json`. Non-zero exit on any drift.
 *
 * Anti-weakening
 * --------------
 * - Drift fix is ALWAYS `npm run postman:gen` then commit. NEVER
 *   hand-edit `data/api/v1/postman.json`.
 * - The script ignores `info._postman_id` (Postman injects this on
 *   import; the generator deliberately doesn't emit it). All other
 *   keys are deep-compared.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "./build-postman-collection";

const REPO_ROOT = process.cwd();
const COMMITTED = join(REPO_ROOT, "data", "api", "v1", "postman.json");

function stripVolatile(c: unknown): unknown {
  if (!c || typeof c !== "object") return c;
  if (Array.isArray(c)) return c.map(stripVolatile);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c as Record<string, unknown>)) {
    if (k === "_postman_id") continue;
    out[k] = stripVolatile(v);
  }
  return out;
}

function main(): number {
  let committed: unknown;
  try {
    committed = JSON.parse(readFileSync(COMMITTED, "utf-8"));
  } catch (err) {
    console.error(
      `postman:check ERROR — cannot read ${COMMITTED}: ${(err as Error).message}\n` +
        "Fix:  npm run postman:gen && git add data/api/v1/postman.json",
    );
    return 2;
  }

  const fresh = build();

  const a = JSON.stringify(stripVolatile(fresh));
  const b = JSON.stringify(stripVolatile(committed));

  if (a === b) {
    console.log(
      "postman:check OK — data/api/v1/postman.json matches the spec.",
    );
    return 0;
  }

  console.error(
    [
      "postman:check FAIL — the checked-in Postman collection is out of",
      "sync with docs/api/openapi-v1.yaml.",
      "",
      "Fix:",
      "  npm run postman:gen",
      "  git add data/api/v1/postman.json",
      "  git commit -m 'chore(api): regenerate Postman collection'",
      "",
      "DO NOT hand-edit data/api/v1/postman.json — it is",
      "auto-generated and any manual changes WILL be overwritten.",
    ].join("\n"),
  );
  return 1;
}

process.exit(main());
