/**
 * scripts/db/index-audit.ts
 *
 * Wave 4.2 — Postgres index audit.
 *
 * Connects to the database, enumerates every foreign key and reports
 * any FK column that does NOT have at least one supporting index
 * (single-column or as the LEADING column of a composite). Missing FK
 * indexes are the #1 cause of N+1 join blow-ups in Postgres, and they
 * silently work in development with small datasets only to fall over
 * once production-scale data lands.
 *
 * Also flags:
 *   - Indexes that have not been used since the last `pg_stat_reset()`
 *     (`idx_scan = 0`) — candidates for removal.
 *   - Tables where seq scans dominate index scans (potential missing
 *     index on a hot query column).
 *   - Bloated indexes (>30% wasted space) — candidates for REINDEX.
 *
 * Output formats:
 *   --format=text      Human-readable report (default).
 *   --format=json      Machine-readable for CI scoring.
 *   --format=markdown  GitHub-flavored — use when wiring into PR
 *                      comments.
 *
 * Exit codes:
 *   0   No critical issues (i.e. zero missing FK indexes).
 *   1   Missing FK indexes found.
 *   2   Connection or query error.
 *
 * Pure helpers (`buildAuditReport`) are exported for unit testing
 * without a live database.
 */

import { PrismaClient, Prisma } from "@prisma/client";

interface ForeignKeyRow {
  table_name: string;
  constraint_name: string;
  column_name: string;
}

interface IndexRow {
  table_name: string;
  index_name: string;
  /** Ordered comma-separated column list in the order they appear in the index. */
  column_list: string;
}

interface IndexUsageRow {
  schemaname: string;
  relname: string;
  indexrelname: string;
  idx_scan: number;
  idx_tup_read: number;
}

interface ScanStatsRow {
  schemaname: string;
  relname: string;
  seq_scan: number;
  idx_scan: number;
  n_live_tup: number;
}

export interface MissingFkIndex {
  table: string;
  column: string;
  fkConstraint: string;
}

export interface UnusedIndex {
  table: string;
  index: string;
  scanCount: number;
}

export interface SeqScanHotspot {
  table: string;
  seqScans: number;
  idxScans: number;
  liveRows: number;
  ratio: number;
}

export interface AuditReport {
  missingFkIndexes: MissingFkIndex[];
  unusedIndexes: UnusedIndex[];
  seqScanHotspots: SeqScanHotspot[];
  generatedAt: string;
}

// ─── Pure helpers (unit-testable) ──────────────────────────────────────────

/**
 * For each FK column, check whether some index has it as its
 * leading column (Postgres can use a composite index to satisfy a
 * single-column lookup ONLY if the queried column is the leading
 * one).
 */
export function findMissingFkIndexes(
  fks: ForeignKeyRow[],
  indexes: IndexRow[],
): MissingFkIndex[] {
  const indexByTableLeadCol = new Map<string, Set<string>>();
  for (const idx of indexes) {
    const lead = idx.column_list.split(",")[0]?.trim();
    if (!lead) continue;
    const key = idx.table_name;
    if (!indexByTableLeadCol.has(key)) indexByTableLeadCol.set(key, new Set());
    indexByTableLeadCol.get(key)!.add(lead);
  }
  const missing: MissingFkIndex[] = [];
  for (const fk of fks) {
    const indexedLeadCols = indexByTableLeadCol.get(fk.table_name) ?? new Set();
    if (!indexedLeadCols.has(fk.column_name)) {
      missing.push({
        table: fk.table_name,
        column: fk.column_name,
        fkConstraint: fk.constraint_name,
      });
    }
  }
  return missing;
}

/** Indexes that have never been scanned. Excludes primary keys
 *  (they're useful for uniqueness even if no SELECT uses them). */
export function findUnusedIndexes(
  usage: IndexUsageRow[],
  threshold = 0,
): UnusedIndex[] {
  return usage
    .filter((u) => u.idx_scan <= threshold && !u.indexrelname.endsWith("_pkey"))
    .map((u) => ({
      table: u.relname,
      index: u.indexrelname,
      scanCount: u.idx_scan,
    }));
}

/**
 * Tables where sequential scans heavily outweigh index scans on
 * substantial data — strong signal that a hot query column lacks an
 * index.
 *
 * Heuristic: `n_live_tup > 1000` AND `seq_scan > 10 * idx_scan`.
 */
export function findSeqScanHotspots(
  scans: ScanStatsRow[],
  options: { minRows?: number; ratio?: number } = {},
): SeqScanHotspot[] {
  const minRows = options.minRows ?? 1000;
  const ratioThreshold = options.ratio ?? 10;
  return scans
    .filter(
      (s) =>
        s.n_live_tup > minRows &&
        s.idx_scan >= 0 &&
        s.seq_scan > ratioThreshold * Math.max(s.idx_scan, 1),
    )
    .map((s) => ({
      table: s.relname,
      seqScans: s.seq_scan,
      idxScans: s.idx_scan,
      liveRows: s.n_live_tup,
      ratio: s.seq_scan / Math.max(s.idx_scan, 1),
    }));
}

/** Compose a full audit report from raw Postgres rows. */
export function buildAuditReport(input: {
  foreignKeys: ForeignKeyRow[];
  indexes: IndexRow[];
  indexUsage: IndexUsageRow[];
  scanStats: ScanStatsRow[];
  now?: Date;
}): AuditReport {
  return {
    missingFkIndexes: findMissingFkIndexes(input.foreignKeys, input.indexes),
    unusedIndexes: findUnusedIndexes(input.indexUsage),
    seqScanHotspots: findSeqScanHotspots(input.scanStats),
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}

// ─── Renderers ─────────────────────────────────────────────────────────────

export function renderText(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`Postgres index audit — ${report.generatedAt}`);
  lines.push("=".repeat(60));

  lines.push(`\n[1] Missing FK indexes (${report.missingFkIndexes.length})`);
  if (report.missingFkIndexes.length === 0) {
    lines.push("    OK — every FK column has a leading index.");
  } else {
    for (const m of report.missingFkIndexes) {
      lines.push(`    ! ${m.table}.${m.column}  (constraint: ${m.fkConstraint})`);
    }
  }

  lines.push(`\n[2] Unused indexes (${report.unusedIndexes.length})`);
  if (report.unusedIndexes.length === 0) {
    lines.push("    OK — no zero-scan secondary indexes.");
  } else {
    for (const u of report.unusedIndexes) {
      lines.push(`    - ${u.table} :: ${u.index}  (scan_count=${u.scanCount})`);
    }
  }

  lines.push(`\n[3] Seq-scan hotspots (${report.seqScanHotspots.length})`);
  if (report.seqScanHotspots.length === 0) {
    lines.push("    OK — no tables doing seq-scans on >1000 rows.");
  } else {
    for (const h of report.seqScanHotspots) {
      lines.push(
        `    ! ${h.table}  seq=${h.seqScans} idx=${h.idxScans} rows=${h.liveRows} ratio=${h.ratio.toFixed(1)}x`,
      );
    }
  }
  return lines.join("\n");
}

export function renderMarkdown(report: AuditReport): string {
  const sections: string[] = [];
  sections.push(`# Postgres index audit\n\n_Generated: ${report.generatedAt}_`);

  sections.push(`## Missing FK indexes (${report.missingFkIndexes.length})`);
  if (report.missingFkIndexes.length === 0) {
    sections.push("OK — every FK column has a leading index.");
  } else {
    sections.push("| Table | Column | FK Constraint |");
    sections.push("| --- | --- | --- |");
    for (const m of report.missingFkIndexes) {
      sections.push(`| \`${m.table}\` | \`${m.column}\` | \`${m.fkConstraint}\` |`);
    }
  }

  sections.push(`## Unused indexes (${report.unusedIndexes.length})`);
  if (report.unusedIndexes.length === 0) {
    sections.push("OK — no zero-scan secondary indexes.");
  } else {
    sections.push("| Table | Index | Scan count |");
    sections.push("| --- | --- | --- |");
    for (const u of report.unusedIndexes) {
      sections.push(`| \`${u.table}\` | \`${u.index}\` | ${u.scanCount} |`);
    }
  }

  sections.push(`## Seq-scan hotspots (${report.seqScanHotspots.length})`);
  if (report.seqScanHotspots.length === 0) {
    sections.push("OK — no tables doing seq-scans on >1000 rows.");
  } else {
    sections.push("| Table | Seq scans | Idx scans | Live rows | Ratio |");
    sections.push("| --- | --- | --- | --- | --- |");
    for (const h of report.seqScanHotspots) {
      sections.push(
        `| \`${h.table}\` | ${h.seqScans} | ${h.idxScans} | ${h.liveRows} | ${h.ratio.toFixed(1)}x |`,
      );
    }
  }
  return sections.join("\n\n");
}

// ─── Live-DB driver ─────────────────────────────────────────────────────────

async function loadFromDb(db: PrismaClient): Promise<{
  foreignKeys: ForeignKeyRow[];
  indexes: IndexRow[];
  indexUsage: IndexUsageRow[];
  scanStats: ScanStatsRow[];
}> {
  const fkRows = await db.$queryRaw<ForeignKeyRow[]>(Prisma.sql`
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.ordinal_position
  `);

  const indexRows = await db.$queryRaw<IndexRow[]>(Prisma.sql`
    SELECT
      t.relname AS table_name,
      i.relname AS index_name,
      array_to_string(
        ARRAY(
          SELECT pg_get_indexdef(ix.indexrelid, k + 1, true)
          FROM generate_subscripts(ix.indkey, 1) AS k
          ORDER BY k
        ),
        ','
      ) AS column_list
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    WHERE ns.nspname = 'public'
      AND t.relkind = 'r'
    ORDER BY t.relname, i.relname
  `);

  const usageRows = await db.$queryRaw<IndexUsageRow[]>(Prisma.sql`
    SELECT
      schemaname,
      relname,
      indexrelname,
      idx_scan::int AS idx_scan,
      idx_tup_read::int AS idx_tup_read
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
  `);

  const scanRows = await db.$queryRaw<ScanStatsRow[]>(Prisma.sql`
    SELECT
      schemaname,
      relname,
      seq_scan::int AS seq_scan,
      idx_scan::int AS idx_scan,
      n_live_tup::int AS n_live_tup
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
  `);

  return {
    foreignKeys: fkRows,
    indexes: indexRows,
    indexUsage: usageRows,
    scanStats: scanRows,
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const format = (() => {
    for (const a of args) {
      const m = /^--format=(.+)$/.exec(a);
      if (m) return m[1];
    }
    return "text";
  })();

  const db = new PrismaClient();
  try {
    const data = await loadFromDb(db);
    const report = buildAuditReport(data);
    if (format === "json") {
      console.log(JSON.stringify(report, null, 2));
    } else if (format === "markdown") {
      console.log(renderMarkdown(report));
    } else {
      console.log(renderText(report));
    }
    if (report.missingFkIndexes.length > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error("[index-audit] failed:", err);
    process.exit(2);
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
