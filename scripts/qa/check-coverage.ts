/**
 * scripts/qa/check-coverage.ts
 *
 * Hard gate per `docs/qa/STANDARD.md` §6. Reads the four inventories and the
 * spec corpus under tests/e2e/** and tests/contract/** , then fails (exit 1)
 * if any inventoried route / API (route, method) cell / tRPC procedure has no
 * matching spec. Anti-weakening (§4.2) — this script may NOT be edited to
 * lower the threshold or silence a missing spec.
 *
 * Output is the §3 headline block for coverage, written to
 * docs/qa/results/<date>/coverage.md and printed to stdout.
 *
 * Usage:
 *   npx tsx scripts/qa/check-coverage.ts            # fail-on-miss
 *   npx tsx scripts/qa/check-coverage.ts --report   # report only, no exit
 */

import fg from "fast-glob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  INVENTORY_DIR,
  REPO_ROOT,
  TESTS_DIR,
  normaliseRoute,
  readText,
  type ApiInventoryEntry,
  type RouteInventoryEntry,
  type TrpcInventoryEntry,
} from "./lib";

interface CoverageResult {
  routesTotal: number;
  routesCovered: number;
  routesMissing: string[];
  apiCellsTotal: number;
  apiCellsCovered: number;
  apiCellsMissing: string[];
  trpcTotal: number;
  trpcCovered: number;
  trpcMissing: string[];
}

async function readJson<T>(file: string): Promise<T> {
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as T;
}

async function main(): Promise<void> {
  const reportOnly = process.argv.includes("--report");

  const routes = await readJson<RouteInventoryEntry[]>(
    path.join(INVENTORY_DIR, "route-inventory.json"),
  );
  const apis = await readJson<ApiInventoryEntry[]>(
    path.join(INVENTORY_DIR, "api-inventory.json"),
  );
  const trpc = await readJson<TrpcInventoryEntry[]>(
    path.join(INVENTORY_DIR, "trpc-inventory.json"),
  );

  // Slurp every spec file once.
  const specFiles = await fg(
    [
      "tests/e2e/**/*.spec.ts",
      "tests/contract/**/*.spec.ts",
      "tests/unit/**/*.spec.ts",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
    ],
    { cwd: REPO_ROOT, absolute: true },
  );
  const specBlobs: { file: string; src: string }[] = [];
  for (const f of specFiles) {
    specBlobs.push({ file: f, src: await readText(f) });
  }

  // Routes — covered if any spec contains the templated route or the
  // normalised route as a string literal. We also accept the route in a
  // template-literal form like `${baseURL}/dashboard`.
  const routesMissing: string[] = [];
  let routesCovered = 0;
  for (const r of routes) {
    const target = normaliseRoute(r.route);
    const hit = specBlobs.some(({ src }) => {
      const lower = src.toLowerCase();
      return lower.includes(`"${r.route.toLowerCase()}"`)
        || lower.includes(`'${r.route.toLowerCase()}'`)
        || lower.includes(target)
        || lower.includes(r.route.toLowerCase());
    });
    if (hit) routesCovered += 1;
    else routesMissing.push(r.route);
  }

  // API — count one cell per (route, method). A spec covers a cell if it
  // mentions the method string AND the route string in the same file.
  let apiCellsTotal = 0;
  let apiCellsCovered = 0;
  const apiCellsMissing: string[] = [];
  for (const a of apis) {
    for (const m of a.methods) {
      apiCellsTotal += 1;
      const hit = specBlobs.some(({ src }) => {
        const lower = src.toLowerCase();
        return (
          lower.includes(a.route.toLowerCase()) &&
          new RegExp(`\\b${m}\\b`, "i").test(src)
        );
      });
      if (hit) apiCellsCovered += 1;
      else apiCellsMissing.push(`${m} ${a.route}`);
    }
  }

  // tRPC — covered if any spec mentions `<router>.<procedure>` or the
  // procedure name on a tRPC client.
  const trpcMissing: string[] = [];
  let trpcCovered = 0;
  for (const p of trpc) {
    const dotted = `${p.router}.${p.procedure}`;
    const hit = specBlobs.some(({ src }) => src.includes(dotted));
    if (hit) trpcCovered += 1;
    else trpcMissing.push(dotted);
  }

  const result: CoverageResult = {
    routesTotal: routes.length,
    routesCovered,
    routesMissing,
    apiCellsTotal,
    apiCellsCovered,
    apiCellsMissing,
    trpcTotal: trpc.length,
    trpcCovered,
    trpcMissing,
  };

  // Headline block — exactly the §3 shape, coverage first.
  const headline: string[] = [
    "## Coverage headline (per STANDARD.md §3)",
    "",
    "```",
    `Routes covered:    ${result.routesCovered} of ${result.routesTotal}`,
    `API cells covered: ${result.apiCellsCovered} of ${result.apiCellsTotal}`,
    `tRPC covered:      ${result.trpcCovered} of ${result.trpcTotal}`,
    "```",
    "",
  ];
  if (result.routesMissing.length > 0) {
    headline.push("### Routes missing a spec");
    headline.push("");
    for (const r of result.routesMissing) headline.push(`- \`${r}\``);
    headline.push("");
  }
  if (result.apiCellsMissing.length > 0) {
    headline.push("### API (route, method) cells missing a spec");
    headline.push("");
    for (const c of result.apiCellsMissing) headline.push(`- \`${c}\``);
    headline.push("");
  }
  if (result.trpcMissing.length > 0) {
    headline.push("### tRPC procedures missing a spec");
    headline.push("");
    for (const t of result.trpcMissing) headline.push(`- \`${t}\``);
    headline.push("");
  }

  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(REPO_ROOT, "docs", "qa", "results", today);
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "coverage.md");
  await writeFile(outFile, headline.join("\n"), "utf8");

  console.log(headline.join("\n"));

  const allCovered =
    result.routesMissing.length === 0 &&
    result.apiCellsMissing.length === 0 &&
    result.trpcMissing.length === 0;

  if (!allCovered && !reportOnly) {
    console.error(
      `\nCoverage gate FAILED: ${result.routesMissing.length} routes, ${result.apiCellsMissing.length} API cells, ${result.trpcMissing.length} tRPC procedures missing specs.`,
    );
    console.error(
      "Per STANDARD.md §6 this is a hard gate. NOT-RUN ≠ PASS. Open DEF cards or add specs.",
    );
    process.exit(1);
  }

  if (allCovered) {
    console.log("\nCoverage gate PASS — all inventoried surfaces have at least one spec.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

void TESTS_DIR; // re-export silencer for unused-import linters
