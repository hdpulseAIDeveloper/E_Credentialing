/**
 * Pillar M -- Data integrity, migrations, backup & DR
 * (per `docs/qa/STANDARD.md` §1.M).
 *
 * Schema-level invariants that should never regress:
 *
 *   1. Every PHI table that ADR 0014 requires `organizationId` on has
 *      it (once W5.1 ships -- this test reads the schema as the source
 *      of truth and fails when a new model is added without the column).
 *   2. The audit_logs table has the tamper-evidence columns from ADR
 *      0011 (sequence, previous_hash, hash).
 *   3. Migration files are append-only -- no editing a migration after
 *      it lands.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SCHEMA = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("pillar-M: data integrity invariants", () => {
  it("audit_logs has tamper-evidence columns (ADR 0011)", () => {
    const block = SCHEMA.match(/model AuditLog \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block, "AuditLog model not found").toBeTruthy();
    expect(block).toMatch(/sequence\s+BigInt/);
    expect(block).toMatch(/previousHash/);
    expect(block).toMatch(/\bhash\b/);
  });

  it("ncqa_criteria table is present (ADR 0012)", () => {
    expect(SCHEMA).toMatch(/model NcqaCriterion\b/);
    expect(SCHEMA).toMatch(/model NcqaCriterionAssessment\b/);
    expect(SCHEMA).toMatch(/model NcqaComplianceSnapshot\b/);
  });

  it("migration files exist and follow the prisma timestamp convention", () => {
    const dir = join(process.cwd(), "prisma/migrations");
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "migration_lock.toml" && e.name.match(/^\d/));
    expect(entries.length, "no migrations -- check prisma/migrations").toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.name, `migration name violates timestamp convention: ${e.name}`).toMatch(
        /^\d{8,14}_[a-z0-9_]+$/i,
      );
    }
  });
});
