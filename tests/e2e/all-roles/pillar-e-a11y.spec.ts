/**
 * Pillar E — Accessibility (per `docs/qa/STANDARD.md` §1.E)
 *
 * For every static route allowed for the role, run @axe-core/playwright with
 * the WCAG 2.1 AA + best-practices tag set and HARD-FAIL on any violation
 * with impact `serious` or `critical`. Minor / moderate violations are
 * captured to the artifact attachment but do not block the run.
 *
 * ANTI-WEAKENING (§4.2): widening the impact filter, narrowing the rule
 * set, or adding `disableRules: [...]` here is a §4.2 violation. If a rule
 * fails legitimately, fix the markup. Only `axe.exclude(selector)` is
 * permitted, and only against third-party widgets we don't own.
 */

import AxeBuilder from "@axe-core/playwright";
import inventory from "../../../docs/qa/inventories/route-inventory.json";
import { test, expect } from "../fixtures";
import { expectedAccessFor } from "../role-route-matrix";
import { type RoleId } from "../roles";

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

const HARD_FAIL_IMPACTS = new Set(["serious", "critical"]);

for (const route of ROUTES) {
  test(`pillar-E a11y: ${route.route}`, async ({ page }) => {
    const role = projectRole();
    test.skip(role === null, "pillar-E runs in role projects only");

    const expected = expectedAccessFor(route.route, role!);
    test.skip(
      expected !== "allow",
      `${route.route} not allowed for ${role} — a11y is checked on rendered pages only`,
    );

    await page.goto(route.route, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    // Wait for the main landmark so axe sees the rendered tree, not the
    // pre-hydration shell.
    await page.locator("main, [role='main'], h1, h2").first().waitFor({
      state: "visible",
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      // Exclude Next.js dev-mode error overlay — it's not part of the app.
      .exclude("nextjs-portal")
      .analyze();

    const blocking = results.violations.filter((v) =>
      HARD_FAIL_IMPACTS.has(v.impact ?? ""),
    );
    const advisory = results.violations.filter(
      (v) => !HARD_FAIL_IMPACTS.has(v.impact ?? ""),
    );

    if (advisory.length > 0) {
      await test.info().attach("axe-advisory.json", {
        body: JSON.stringify(advisory, null, 2),
        contentType: "application/json",
      });
    }
    if (blocking.length > 0) {
      await test.info().attach("axe-blocking.json", {
        body: JSON.stringify(blocking, null, 2),
        contentType: "application/json",
      });
    }

    const summary = blocking
      .map(
        (v) =>
          `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`,
      )
      .join("\n");
    expect(
      blocking,
      `axe found ${blocking.length} serious/critical violation(s) on ${route.route} as ${role}:\n${summary}`,
    ).toEqual([]);
  });
}
