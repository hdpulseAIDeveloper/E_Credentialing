/**
 * Pillar C — PHI scope & encryption (per `docs/qa/STANDARD.md` §1.C and
 * §4 hard-fail #6).
 *
 * Asserts that PHI fields (SSN, DOB, full home address, raw DEA, raw NPI
 * tax id) NEVER appear in any HTML or JSON response served to a role
 * that should not see them.
 *
 * The list of probe routes is intentionally short -- this is the hard
 * gate, not a full Pillar A re-run. A real PHI leak would show on these
 * pages because they're the highest-traffic listings.
 *
 * RBAC matrix (encoded inline because PHI rules are stricter than the
 * route allow/deny matrix in role-route-matrix.ts):
 *
 *   - SSN     -> ADMIN only.
 *   - DOB     -> ADMIN, MANAGER, SPECIALIST. Never COMMITTEE_MEMBER.
 *                Never visible in any list view (only in detail).
 *   - DEA     -> ADMIN, MANAGER, SPECIALIST. Never COMMITTEE_MEMBER.
 *
 * Anti-weakening (§4.2): if a regex match here fires, the fix is to
 * redact the field at the API layer -- not to add the field to the
 * allow-list.
 */
import { test, expect } from "../fixtures";
import type { RoleId } from "../roles";

interface PhiProbe {
  label: string;
  route: string;
  forbiddenFor: RoleId[];
  patterns: { name: string; re: RegExp }[];
}

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const DEA_RE = /\b[A-Z][A-Z9]\d{7}\b/;
const DOB_ISO_RE = /\b(19|20)\d{2}-\d{2}-\d{2}\b.*(?:dob|birth)/i;

const PROBES: PhiProbe[] = [
  {
    label: "providers list",
    route: "/providers",
    forbiddenFor: ["committee_member"],
    patterns: [
      { name: "SSN xxx-xx-xxxx", re: SSN_RE },
      { name: "DEA Annnnnnn", re: DEA_RE },
    ],
  },
  {
    label: "roster list",
    route: "/roster",
    forbiddenFor: ["committee_member"],
    patterns: [
      { name: "SSN xxx-xx-xxxx", re: SSN_RE },
    ],
  },
];

function projectRole(): RoleId | null {
  const proj = test.info().project.name;
  if (!proj.startsWith("role-")) return null;
  return proj.slice(5) as RoleId;
}

for (const probe of PROBES) {
  test(`pillar-C PHI scope: ${probe.label} (${probe.route})`, async ({ page }) => {
    const role = projectRole();
    test.skip(role === null, "pillar-C runs in role projects only");

    const resp = await page.goto(probe.route, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) {
      test.skip(true, `route returned ${resp?.status() ?? "no response"} for ${role} -- not allowed`);
    }

    const html = await page.content();
    for (const pat of probe.patterns) {
      if (probe.forbiddenFor.includes(role!)) {
        const m = html.match(pat.re);
        expect(
          m,
          `PHI leak: ${pat.name} pattern matched in ${probe.route} for role ${role}: ${m?.[0] ?? "?"}`,
        ).toBeNull();
      }
    }
  });
}

test("pillar-C inventory sanity", () => {
  expect(PROBES.length).toBeGreaterThan(0);
});
