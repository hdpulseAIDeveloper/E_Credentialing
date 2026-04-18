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
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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
import { isIteratorSpec } from "./iterator-coverage";

/**
 * The 18 pillars from STANDARD.md §2. Each pillar has at least one canonical
 * directory the gate scans for spec files. A pillar with zero discovered specs
 * is a hard-fail per §4.10 (NOT-RUN ≠ PASS) and §3 (Pillars not run = fail).
 *
 * Anti-weakening (§4.2): do not delete a pillar from this list, do not change
 * its directory to a directory you know is non-empty, and do not relax the
 * "no specs => fail" check below.
 */
const PILLARS: ReadonlyArray<{ id: string; name: string; dirs: string[] }> = [
  { id: "A", name: "Functional smoke", dirs: ["tests/e2e/smoke", "tests/e2e/all-roles"] },
  { id: "B", name: "RBAC matrix", dirs: ["tests/e2e/rbac", "tests/e2e/all-roles"] },
  { id: "C", name: "PHI scope & encryption", dirs: ["tests/e2e/phi-scope"] },
  { id: "D", name: "Deep end-to-end flows", dirs: ["tests/e2e/flows"] },
  { id: "E", name: "Accessibility", dirs: ["tests/e2e/a11y", "tests/e2e/all-roles"] },
  { id: "F", name: "Visual regression", dirs: ["tests/e2e/visual"] },
  { id: "G", name: "Cross-browser & responsive", dirs: ["tests/e2e/responsive"] },
  { id: "H", name: "Performance, load & soak", dirs: ["tests/perf"] },
  { id: "I", name: "Security & DAST", dirs: ["tests/security"] },
  { id: "J", name: "API contract", dirs: ["tests/contract"] },
  { id: "K", name: "External integration", dirs: ["tests/external"] },
  { id: "L", name: "Time-shifted scenarios", dirs: ["tests/e2e/time"] },
  { id: "M", name: "Data integrity, migrations, backup & DR", dirs: ["tests/data"] },
  { id: "N", name: "Concurrency, idempotency & resilience", dirs: ["tests/e2e/concurrency"] },
  { id: "O", name: "File / email / SMS / print / PDF", dirs: ["tests/e2e/files"] },
  { id: "P", name: "Compliance controls", dirs: ["tests/e2e/compliance"] },
  { id: "Q", name: "Documentation integrity", dirs: ["tests/docs"] },
  { id: "R", name: "Observability", dirs: ["tests/observability"] },
];

interface PillarStatus {
  id: string;
  name: string;
  specCount: number;
  searchedDirs: string[];
}

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
  pillars: PillarStatus[];
  pillarsMissing: string[];
  cardsExpected: number;
  cardsPresent: number;
  cardsMissing: string[];
}

async function readJson<T>(file: string): Promise<T> {
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as T;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mirror of scripts/qa/scaffold-cards.ts slugFor — kept duplicated (instead of
 * importing) so this gate has zero coupling to the scaffolder. If the slug
 * convention changes, both files must be updated; the docs gate (Pillar Q) and
 * a unit test will surface drift.
 */
function cardSlugFor(route: string): string {
  if (route === "/") return "root";
  const parts = route
    .split("/")
    .filter((p) => p.length > 0)
    .map((p) => p.replace(/^\[(.+)\]$/, "$1"));
  return parts.join("__").replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
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

  // Iterator-aware coverage (added 2026-04-18, Wave 6 / ADR 0019).
  //
  // Pillars A / B / E (`tests/e2e/all-roles/`), Pillar J contract
  // suites, and similar matrix specs cover every inventoried surface
  // by iterating the inventory JSON at runtime. The original gate was
  // string-literal only, so these specs registered as "0 routes
  // covered" even though every route was visited under every role.
  //
  // The detection rule lives in `iterator-coverage.ts` so it can be
  // unit-tested in isolation. See ADR 0019.
  const routeIteratorSpecs = specBlobs.filter((b) => isIteratorSpec(b.src, "route"));
  const apiIteratorSpecs = specBlobs.filter((b) => isIteratorSpec(b.src, "api"));
  const trpcIteratorSpecs = specBlobs.filter((b) => isIteratorSpec(b.src, "trpc"));

  // Routes — covered if (a) any iterator spec exists for the route
  // inventory, OR (b) any spec contains the route as a string literal /
  // template-literal substring.
  const routesMissing: string[] = [];
  let routesCovered = 0;
  for (const r of routes) {
    const target = normaliseRoute(r.route);
    const hitIterator = routeIteratorSpecs.length > 0;
    const hit = hitIterator || specBlobs.some(({ src }) => {
      const lower = src.toLowerCase();
      return lower.includes(`"${r.route.toLowerCase()}"`)
        || lower.includes(`'${r.route.toLowerCase()}'`)
        || lower.includes(target)
        || lower.includes(r.route.toLowerCase());
    });
    if (hit) routesCovered += 1;
    else routesMissing.push(r.route);
  }

  // API — covered if (a) any iterator spec exists for the API
  // inventory, OR (b) some spec mentions the method string AND the
  // route string.
  let apiCellsTotal = 0;
  let apiCellsCovered = 0;
  const apiCellsMissing: string[] = [];
  for (const a of apis) {
    for (const m of a.methods) {
      apiCellsTotal += 1;
      const hitIterator = apiIteratorSpecs.length > 0;
      const hit = hitIterator || specBlobs.some(({ src }) => {
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

  // tRPC — covered if (a) any iterator spec exists for the tRPC
  // inventory, OR (b) any spec mentions `<router>.<procedure>`.
  const trpcMissing: string[] = [];
  let trpcCovered = 0;
  for (const p of trpc) {
    const dotted = `${p.router}.${p.procedure}`;
    const hitIterator = trpcIteratorSpecs.length > 0;
    const hit = hitIterator || specBlobs.some(({ src }) => src.includes(dotted));
    if (hit) trpcCovered += 1;
    else trpcMissing.push(dotted);
  }

  // Pillar coverage — STANDARD.md §2 + §3 + §4.10. Each pillar must have at
  // least one spec on disk in one of its declared directories. Empty pillar =
  // hard-fail.
  const pillars: PillarStatus[] = [];
  const pillarsMissing: string[] = [];
  for (const p of PILLARS) {
    let count = 0;
    for (const d of p.dirs) {
      const found = await fg(["**/*.spec.ts", "**/*.test.ts"], {
        cwd: path.join(REPO_ROOT, d),
        absolute: true,
      });
      count += found.length;
    }
    pillars.push({ id: p.id, name: p.name, specCount: count, searchedDirs: p.dirs });
    if (count === 0) pillarsMissing.push(`${p.id} — ${p.name} (searched ${p.dirs.join(", ")})`);
  }

  // Per-screen card gate — STANDARD.md §5. Every inventoried route must have
  // a card on disk at docs/qa/per-screen/<slug>.md.
  const perScreenDir = path.join(REPO_ROOT, "docs", "qa", "per-screen");
  let cardsPresent = 0;
  const cardsMissing: string[] = [];
  for (const r of routes) {
    const slug = cardSlugFor(r.route);
    const file = path.join(perScreenDir, `${slug}.md`);
    if (await exists(file)) cardsPresent += 1;
    else cardsMissing.push(`${r.route} (expected ${path.relative(REPO_ROOT, file)})`);
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
    pillars,
    pillarsMissing,
    cardsExpected: routes.length,
    cardsPresent,
    cardsMissing,
  };

  // Headline block — exactly the §3 shape, coverage first.
  const pillarsTouched = result.pillars.filter((p) => p.specCount > 0).map((p) => p.id);
  const pillarsNotRun = result.pillars.filter((p) => p.specCount === 0).map((p) => p.id);
  const headline: string[] = [
    "## Coverage headline (per STANDARD.md §3)",
    "",
    "```",
    `Routes covered:    ${result.routesCovered} of ${result.routesTotal}`,
    `API cells covered: ${result.apiCellsCovered} of ${result.apiCellsTotal}`,
    `tRPC covered:      ${result.trpcCovered} of ${result.trpcTotal}`,
    `Per-screen cards:  ${result.cardsPresent} of ${result.cardsExpected}`,
    `Pillars touched:   ${pillarsTouched.join(", ") || "(none)"}`,
    `Pillars not run:   ${pillarsNotRun.join(", ") || "(none)"}`,
    "```",
    "",
  ];
  headline.push("### Pillar spec counts (STANDARD.md §2)");
  headline.push("");
  headline.push("| ID | Pillar | Spec files |");
  headline.push("| --- | --- | --- |");
  for (const p of result.pillars) {
    headline.push(`| ${p.id} | ${p.name} | ${p.specCount} |`);
  }
  headline.push("");
  if (result.pillarsMissing.length > 0) {
    headline.push("### Pillars with ZERO spec files (hard fail per §4.10)");
    headline.push("");
    for (const p of result.pillarsMissing) headline.push(`- ${p}`);
    headline.push("");
  }
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
  if (result.cardsMissing.length > 0) {
    headline.push("### Per-screen cards missing (STANDARD.md §5)");
    headline.push("");
    for (const c of result.cardsMissing) headline.push(`- ${c}`);
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
    result.trpcMissing.length === 0 &&
    result.pillarsMissing.length === 0 &&
    result.cardsMissing.length === 0;

  if (!allCovered && !reportOnly) {
    console.error(
      `\nCoverage gate FAILED: ${result.routesMissing.length} routes, ${result.apiCellsMissing.length} API cells, ${result.trpcMissing.length} tRPC procedures, ${result.pillarsMissing.length} pillars, ${result.cardsMissing.length} per-screen cards missing.`,
    );
    console.error(
      "Per STANDARD.md §3, §4.10, §5, §6 this is a hard gate. NOT-RUN ≠ PASS. Open DEF cards, add specs, or run `npx tsx scripts/qa/scaffold-cards.ts`.",
    );
    process.exit(1);
  }

  if (allCovered) {
    console.log(
      "\nCoverage gate PASS — every inventoried surface has at least one spec, every pillar has at least one spec file, and every route has a per-screen card.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

void TESTS_DIR; // re-export silencer for unused-import linters
