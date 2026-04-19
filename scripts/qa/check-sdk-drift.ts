/**
 * scripts/qa/check-sdk-drift.ts
 *
 * Wave 10 (2026-04-18). Regenerates `src/lib/api-client/v1-types.ts`
 * into a temp file from the current `docs/api/openapi-v1.yaml` and
 * fails if the result differs (byte-for-byte) from the checked-in
 * file. This is the mechanical guard that keeps the TypeScript SDK
 * surface honest about what the OpenAPI spec promises.
 *
 * Anti-weakening
 * --------------
 * - The script MUST treat ANY diff as a failure. There is no
 *   "ignore whitespace", no "ignore comments". The generator is
 *   deterministic — drift is drift.
 * - The fix is ALWAYS to regenerate (`npm run sdk:gen`) and commit
 *   the result. NEVER hand-edit `v1-types.ts`.
 * - The script MUST exit with a non-zero status on drift so it can
 *   be wired into CI / pre-commit / qa:gate without further glue.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const SPEC = join(REPO_ROOT, "docs", "api", "openapi-v1.yaml");
const COMMITTED = join(REPO_ROOT, "src", "lib", "api-client", "v1-types.ts");

function main(): number {
  const tempDir = mkdtempSync(join(tmpdir(), "sdk-drift-"));
  const tempOut = join(tempDir, "v1-types.ts");

  try {
    // Windows requires `shell: true` to run `.cmd` shims via spawn-style
    // APIs (Node 18+ tightened CVE-2024-27980 mitigation). On POSIX a
    // direct exec is fine.
    execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["openapi-typescript", SPEC, "-o", tempOut],
      {
        stdio: ["ignore", "ignore", "inherit"],
        shell: process.platform === "win32",
      },
    );

    const fresh = readFileSync(tempOut, "utf-8");
    const committed = readFileSync(COMMITTED, "utf-8");

    if (fresh === committed) {
      console.log(
        "sdk:check OK — src/lib/api-client/v1-types.ts matches the spec.",
      );
      return 0;
    }

    console.error(
      [
        "sdk:check FAIL — the checked-in TypeScript SDK types are out of",
        "sync with docs/api/openapi-v1.yaml.",
        "",
        "Fix:",
        "  npm run sdk:gen",
        "  git add src/lib/api-client/v1-types.ts",
        "  git commit -m 'chore(sdk): regenerate v1 types'",
        "",
        "DO NOT hand-edit src/lib/api-client/v1-types.ts — it is",
        "auto-generated and any manual changes WILL be overwritten.",
      ].join("\n"),
    );
    return 1;
  } catch (err) {
    console.error(`sdk:check ERROR — ${(err as Error).message}`);
    return 2;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

process.exit(main());
