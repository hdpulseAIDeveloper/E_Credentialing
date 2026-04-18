/**
 * scripts/qa/scaffold-cards.ts
 *
 * Generates the per-screen card stubs required by STANDARD.md §5.
 *
 * For every entry in docs/qa/inventories/route-inventory.json, ensures
 * a docs/qa/per-screen/<route-slug>.md exists. Existing cards are NOT
 * overwritten -- the script only fills in missing ones, so hand-augmented
 * sections (Linked specs, Known defects, Last verified) are preserved
 * across regenerations.
 *
 * Usage:
 *   npx tsx scripts/qa/scaffold-cards.ts            # write missing cards
 *   npx tsx scripts/qa/scaffold-cards.ts --check    # exit 1 if any missing
 *   npx tsx scripts/qa/scaffold-cards.ts --report   # print plan, no writes
 *
 * Card slug convention:
 *   /                            -> root.md
 *   /providers                   -> providers.md
 *   /providers/[id]              -> providers__id.md
 *   /admin/users                 -> admin__users.md
 *   /admin/users/[id]/edit       -> admin__users__id__edit.md
 *
 * Anti-weakening (STANDARD.md §4.2): this script only ADDS cards; it
 * never removes a card on its own. Do not edit it to skip routes.
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { INVENTORY_DIR, REPO_ROOT } from "./lib";

interface RouteEntry {
  route: string;
  file: string;
  dynamic: boolean;
  group: string;
}

const PER_SCREEN_DIR = path.join(REPO_ROOT, "docs", "qa", "per-screen");
const TODAY = new Date().toISOString().slice(0, 10);

function slugFor(route: string): string {
  if (route === "/") return "root";
  const parts = route
    .split("/")
    .filter((p) => p.length > 0)
    .map((p) => p.replace(/^\[(.+)\]$/, "$1"));
  return parts.join("__").replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}

function rolesAllowedFor(route: string): { allowed: string; denied: string } {
  if (route === "/" || route.startsWith("/auth/") || route.startsWith("/legal/") || route.startsWith("/verify/")) {
    return { allowed: "anonymous, every authenticated role", denied: "(none)" };
  }
  if (route === "/admin" || route.startsWith("/admin/")) {
    return { allowed: "ADMIN, MANAGER", denied: "SPECIALIST, COMMITTEE_MEMBER, PROVIDER (redirect to /dashboard)" };
  }
  if (route === "/committee" || route.startsWith("/committee/")) {
    return { allowed: "ADMIN, MANAGER, COMMITTEE_MEMBER", denied: "SPECIALIST, PROVIDER (redirect to /dashboard)" };
  }
  if (route.startsWith("/application")) {
    return { allowed: "PROVIDER (token-authenticated)", denied: "all staff roles (redirect to signin)" };
  }
  return { allowed: "every authenticated staff role", denied: "PROVIDER (redirect to signin)" };
}

function phiHintFor(route: string): string {
  if (route.includes("provider") || route === "/roster" || route === "/credentialing") {
    return "Name, DOB, NPI, DEA, license. SSN ADMIN-only. Home address ADMIN/MANAGER only.";
  }
  if (route === "/dashboard") {
    return "Aggregate counts only -- NO row-level PHI on this surface.";
  }
  if (route.startsWith("/legal") || route.startsWith("/verify")) {
    return "(none -- public surface)";
  }
  return "Verify: enumerate every column the page renders and confirm role gating on each.";
}

function cardFor(entry: RouteEntry): string {
  const roles = rolesAllowedFor(entry.route);
  const phi = phiHintFor(entry.route);
  const slug = slugFor(entry.route);
  return `# Per-screen card: \`${entry.route}\`

> **STANDARD.md §5 stub.** Hand-augment the *Linked specs*,
> *Known defects*, and *Last verified* fields when you cover this
> route. The scaffold script will not overwrite this file once it
> exists.

| Field | Value |
| --- | --- |
| Route(s) | \`${entry.route}\` |
| Source file | \`${entry.file}\` |
| Dynamic | ${entry.dynamic ? "yes" : "no"} |
| Group | ${entry.group} |
| Roles allowed | ${roles.allowed} |
| Roles denied (must redirect/403) | ${roles.denied} |
| PHI fields rendered | ${phi} |

## Key actions / mutations

_TODO: enumerate the buttons, forms, and tRPC mutations this screen triggers._

## Linked specs

- \`tests/e2e/all-roles/pillar-a-smoke.spec.ts\` (Pillar A, every static route)
- \`tests/e2e/all-roles/pillar-b-rbac.spec.ts\` (Pillar B, every role)
- \`tests/e2e/all-roles/pillar-e-a11y.spec.ts\` (Pillar E, axe scan)
${
  roles.allowed.includes("PROVIDER") || phi.includes("PHI")
    ? "- `tests/e2e/phi-scope/pillar-c-phi-scope.spec.ts` (Pillar C, PHI scope)\n"
    : ""
}_TODO: add per-screen specs as they're written (e.g. \`tests/e2e/${entry.group}/${slug}.spec.ts\`)._

## Linked OpenAPI / tRPC procedures

_TODO: list every \`<router>.<procedure>\` this screen calls (see
\`docs/qa/inventories/trpc-inventory.json\`)._

## Known defects

_None recorded. Reference \`docs/qa/defects/index.md\` if a card opens._

## Last verified

${TODAY} by scaffold-cards.ts (stub only -- mark with your initials when you cover the screen).
`;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const reportOnly = process.argv.includes("--report");
  const checkOnly = process.argv.includes("--check");

  const raw = await readFile(path.join(INVENTORY_DIR, "route-inventory.json"), "utf8");
  const routes = JSON.parse(raw) as RouteEntry[];

  await mkdir(PER_SCREEN_DIR, { recursive: true });

  const created: string[] = [];
  const skipped: string[] = [];
  const wouldCreate: string[] = [];

  for (const r of routes) {
    const slug = slugFor(r.route);
    const file = path.join(PER_SCREEN_DIR, `${slug}.md`);
    if (await exists(file)) {
      skipped.push(r.route);
      continue;
    }
    if (reportOnly || checkOnly) {
      wouldCreate.push(r.route);
      continue;
    }
    await writeFile(file, cardFor(r), "utf8");
    created.push(r.route);
  }

  console.log("");
  console.log("scaffold-cards.ts result:");
  console.log(`  routes total:        ${routes.length}`);
  console.log(`  cards already on disk: ${skipped.length}`);
  if (reportOnly || checkOnly) {
    console.log(`  cards that WOULD be created: ${wouldCreate.length}`);
    if (wouldCreate.length > 0) {
      console.log("");
      console.log("  Missing cards:");
      for (const r of wouldCreate) console.log(`    - ${r}`);
    }
  } else {
    console.log(`  cards created this run: ${created.length}`);
    if (created.length > 0) {
      console.log("");
      console.log("  Created:");
      for (const r of created) console.log(`    - ${r}`);
    }
  }

  if (checkOnly && wouldCreate.length > 0) {
    console.error("");
    console.error(
      `STANDARD.md §5 gate FAILED: ${wouldCreate.length} routes have no per-screen card. Run \`npx tsx scripts/qa/scaffold-cards.ts\` to create stubs.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
