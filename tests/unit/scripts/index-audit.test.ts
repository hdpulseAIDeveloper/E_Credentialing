/**
 * tests/unit/scripts/index-audit.test.ts
 *
 * Wave 4.2 — pure-helper coverage for the Postgres index audit. The
 * live-DB path is exercised via `npx tsx scripts/db/index-audit.ts`
 * in CI; here we lock down the deterministic logic.
 */

import { describe, it, expect } from "vitest";
import {
  findMissingFkIndexes,
  findUnusedIndexes,
  findSeqScanHotspots,
  buildAuditReport,
  renderText,
  renderMarkdown,
} from "../../../scripts/db/index-audit";

describe("findMissingFkIndexes", () => {
  it("flags FK columns with no leading-column index", () => {
    const out = findMissingFkIndexes(
      [
        { table_name: "expirables", column_name: "provider_id", constraint_name: "expirables_provider_id_fkey" },
        { table_name: "expirables", column_name: "document_id", constraint_name: "expirables_document_id_fkey" },
      ],
      [
        { table_name: "expirables", index_name: "expirables_provider_id_idx", column_list: "provider_id" },
      ],
    );
    expect(out).toEqual([
      {
        table: "expirables",
        column: "document_id",
        fkConstraint: "expirables_document_id_fkey",
      },
    ]);
  });

  it("treats a composite index covering the FK as the leading column as 'covered'", () => {
    const out = findMissingFkIndexes(
      [
        { table_name: "audits", column_name: "actor_id", constraint_name: "audits_actor_id_fkey" },
      ],
      [
        { table_name: "audits", index_name: "audits_actor_ts_idx", column_list: "actor_id,timestamp" },
      ],
    );
    expect(out).toEqual([]);
  });

  it("does NOT count a composite index whose FK col is NOT leading", () => {
    const out = findMissingFkIndexes(
      [
        { table_name: "audits", column_name: "actor_id", constraint_name: "audits_actor_id_fkey" },
      ],
      [
        { table_name: "audits", index_name: "audits_ts_actor_idx", column_list: "timestamp,actor_id" },
      ],
    );
    expect(out).toHaveLength(1);
    expect(out[0].column).toBe("actor_id");
  });

  it("returns empty when there are no FKs", () => {
    expect(findMissingFkIndexes([], [])).toEqual([]);
  });
});

describe("findUnusedIndexes", () => {
  it("flags zero-scan secondary indexes but excludes _pkey", () => {
    const out = findUnusedIndexes([
      {
        schemaname: "public",
        relname: "providers",
        indexrelname: "providers_pkey",
        idx_scan: 0,
        idx_tup_read: 0,
      },
      {
        schemaname: "public",
        relname: "providers",
        indexrelname: "providers_dead_idx",
        idx_scan: 0,
        idx_tup_read: 0,
      },
      {
        schemaname: "public",
        relname: "providers",
        indexrelname: "providers_npi_idx",
        idx_scan: 5000,
        idx_tup_read: 50000,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].index).toBe("providers_dead_idx");
  });
});

describe("findSeqScanHotspots", () => {
  it("ignores small tables", () => {
    expect(
      findSeqScanHotspots([
        {
          schemaname: "public",
          relname: "small_lookup",
          seq_scan: 9999,
          idx_scan: 0,
          n_live_tup: 50,
        },
      ]),
    ).toEqual([]);
  });

  it("flags large tables with seq:idx ratio above threshold", () => {
    const out = findSeqScanHotspots([
      {
        schemaname: "public",
        relname: "audit_logs",
        seq_scan: 5000,
        idx_scan: 100,
        n_live_tup: 1_500_000,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].table).toBe("audit_logs");
    expect(out[0].ratio).toBe(50);
  });

  it("never divides by zero on idx_scan = 0", () => {
    const out = findSeqScanHotspots([
      {
        schemaname: "public",
        relname: "huge_table",
        seq_scan: 100,
        idx_scan: 0,
        n_live_tup: 1_000_000,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(Number.isFinite(out[0].ratio)).toBe(true);
  });
});

describe("renderers", () => {
  it("text renderer prints OK lines when nothing is wrong", () => {
    const report = buildAuditReport({
      foreignKeys: [],
      indexes: [],
      indexUsage: [],
      scanStats: [],
      now: new Date("2026-04-18T00:00:00Z"),
    });
    const out = renderText(report);
    expect(out).toContain("Missing FK indexes (0)");
    expect(out).toContain("OK — every FK column has a leading index.");
  });

  it("markdown renderer emits a table for missing FK indexes", () => {
    const report = buildAuditReport({
      foreignKeys: [
        { table_name: "expirables", column_name: "document_id", constraint_name: "expirables_document_id_fkey" },
      ],
      indexes: [],
      indexUsage: [],
      scanStats: [],
      now: new Date("2026-04-18T00:00:00Z"),
    });
    const md = renderMarkdown(report);
    expect(md).toContain("| Table | Column | FK Constraint |");
    expect(md).toContain("| `expirables` | `document_id` | `expirables_document_id_fkey` |");
  });
});
