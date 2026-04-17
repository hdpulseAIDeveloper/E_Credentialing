/**
 * Pillar B — RBAC enforcement (per `docs/qa/STANDARD.md` §1.B)
 *
 * For every (route × role) cell that the matrix marks as DENY, this spec:
 *   1. Navigates to the route with the role's authenticated storageState.
 *   2. Asserts the final URL is /dashboard (or /auth/signin for unauth).
 *   3. Asserts no 200 was returned for the exact route URL (otherwise the
 *      page leaked content before the redirect — which is a real RBAC bug
 *      even if the user can't see it because of the immediate redirect).
 *
 * Hard-fail conditions (§1.3) inherited from the fixture:
 *   - any console.error, page error, or first-party 5xx fails the test.
 *
 * ANTI-WEAKENING (§4.2): the deny cells are derived from `role-route-matrix`
 * and the static-route inventory. Adding a route that the matrix forgets
 * about is caught by the missing-coverage gate, NOT silenced here.
 */

import inventory from "../../../docs/qa/inventories/route-inventory.json";
import { test, expect } from "../fixtures";
import { expectedAccessFor } from "../role-route-matrix";
import { STAFF_ROLES, type RoleId } from "../roles";

interface RouteEntry {
  route: string;
  file: string;
  dynamic: boolean;
  group: string;
}

const ROUTES = (inventory as RouteEntry[]).filter(
  (r) =>
    !r.dynamic &&
    !r.route.startsWith("/application") &&
    !r.route.startsWith("/api"),
);

function projectRole(): RoleId | null {
  const proj = test.info().project.name;
  if (!proj.startsWith("role-")) return null;
  return proj.slice(5) as RoleId;
}

// Build the deny matrix per role at module load. We log it via the sanity
// test so the run record contains the exact deny-set the suite covered.
const DENY_BY_ROLE: Record<RoleId, string[]> = {
  admin: [],
  manager: [],
  specialist: [],
  committee_member: [],
  provider: [],
};
for (const role of STAFF_ROLES) {
  for (const r of ROUTES) {
    if (expectedAccessFor(r.route, role) !== "allow") {
      DENY_BY_ROLE[role].push(r.route);
    }
  }
}

for (const route of ROUTES) {
  test(`pillar-B RBAC deny: ${route.route}`, async ({ page, baseURL }) => {
    const role = projectRole();
    test.skip(role === null, "pillar-B runs in role projects only");

    const expected = expectedAccessFor(route.route, role!);
    test.skip(
      expected === "allow",
      `${route.route} is allowed for ${role} — pillar A covers allow cells`,
    );

    // Track every response for the exact route URL. We must NEVER see a 200
    // here for a deny cell (that would mean content leaked before redirect).
    const exactRouteResponses: number[] = [];
    page.on("response", (r) => {
      const u = r.url();
      const target = `${baseURL}${route.route}`;
      if (u === target || u.startsWith(`${target}?`)) {
        exactRouteResponses.push(r.status());
      }
    });

    await page.goto(route.route, { waitUntil: "domcontentloaded", timeout: 30_000 });

    const finalPath = new URL(page.url()).pathname;
    if (expected === "redirect-dashboard") {
      expect(
        finalPath,
        `expected /dashboard redirect for deny cell (${route.route} as ${role}); ended at ${finalPath}`,
      ).toBe("/dashboard");
    } else if (expected === "redirect-signin") {
      expect(
        finalPath.startsWith("/auth/signin"),
        `expected /auth/signin redirect for deny cell (${route.route} as ${role}); ended at ${finalPath}`,
      ).toBe(true);
    }

    // No 200 to the exact URL — middleware should have responded with a 3xx.
    const got200 = exactRouteResponses.includes(200);
    expect(
      got200,
      `${route.route} returned 200 for ${role} BEFORE redirect — RBAC content leak. Status chain: ${exactRouteResponses.join(", ")}`,
    ).toBe(false);
  });
}

test("pillar-B RBAC deny matrix sanity", () => {
  const role = projectRole();
  if (role === null) test.skip(true, "role-project only");

  const denies = DENY_BY_ROLE[role!];
  test.info().annotations.push({
    type: "deny-set",
    description: `${role}: ${denies.length} deny cells — ${denies.join(", ") || "(none)"}`,
  });

  // Sanity: specialist + committee_member must each have at least one deny
  // cell (admin/* exists). Admin and manager have none. If the matrix
  // produces zero denies for specialist, it's been flattened.
  if (role === "specialist") {
    expect(denies.length, "specialist must have ≥1 deny cell").toBeGreaterThan(0);
  }
  if (role === "committee_member") {
    expect(denies.length, "committee_member must have ≥1 deny cell").toBeGreaterThan(0);
  }
});
