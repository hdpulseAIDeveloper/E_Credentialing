/**
 * Wave 5.4 — pure CSV/Markdown rendering helpers for the auditor
 * package. Kept dependency-free (no Prisma, no Stripe) so we can
 * snapshot-test them.
 */

export interface AuditLogRowForExport {
  id: string;
  sequence: bigint | number;
  timestamp: Date | string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  providerId: string | null;
  hash: string | null;
  previousHash: string | null;
}

export interface NcqaSnapshotForExport {
  id: string;
  takenAt: Date | string;
  totalCriteria: number;
  compliantCount: number;
  partialCount: number;
  nonCompliantCount: number;
  notApplicableCount: number;
  overallScore: number;
}

const CSV_HEADERS_AUDIT = [
  "sequence",
  "timestamp",
  "actorId",
  "actorRole",
  "action",
  "entityType",
  "entityId",
  "providerId",
  "previousHash",
  "hash",
] as const;

export function renderAuditLogCsv(rows: ReadonlyArray<AuditLogRowForExport>): string {
  const lines = [CSV_HEADERS_AUDIT.join(",")];
  for (const r of rows) {
    lines.push(
      [
        String(r.sequence),
        toIso(r.timestamp),
        csvField(r.actorId ?? ""),
        csvField(r.actorRole ?? ""),
        csvField(r.action),
        csvField(r.entityType),
        csvField(r.entityId),
        csvField(r.providerId ?? ""),
        csvField(r.previousHash ?? ""),
        csvField(r.hash ?? ""),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

const CSV_HEADERS_NCQA = [
  "takenAt",
  "overallScore",
  "totalCriteria",
  "compliantCount",
  "partialCount",
  "nonCompliantCount",
  "notApplicableCount",
] as const;

export function renderNcqaSnapshotsCsv(
  snapshots: ReadonlyArray<NcqaSnapshotForExport>,
): string {
  const lines = [CSV_HEADERS_NCQA.join(",")];
  for (const s of snapshots) {
    lines.push(
      [
        toIso(s.takenAt),
        String(s.overallScore),
        String(s.totalCriteria),
        String(s.compliantCount),
        String(s.partialCount),
        String(s.nonCompliantCount),
        String(s.notApplicableCount),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export interface CoverSheetInput {
  organizationName: string;
  organizationId: string;
  generatedAtIso: string;
  reportPeriod?: { fromIso: string; toIso: string };
  auditChainOk: boolean;
  auditChainNullHashes: number;
  auditLogRows: number;
  ncqaSnapshotCount: number;
  providerCount: number;
  licenseCount: number;
}

/**
 * Cover markdown is the first thing an auditor reads when they
 * unzip the package. Keep it short — the manifest is authoritative.
 */
export function renderCoverSheet(input: CoverSheetInput): string {
  const period = input.reportPeriod
    ? `**Reporting period:** ${input.reportPeriod.fromIso} → ${input.reportPeriod.toIso}`
    : `**Reporting period:** All available history (no window applied)`;
  const chain = input.auditChainOk
    ? `:white_check_mark: Audit chain verified (${input.auditChainNullHashes} legacy null-hash rows)`
    : `:x: Audit chain INTEGRITY FAILURE — see audit-log.csv and rerun verifyAuditChain`;
  return [
    `# Auditor package — ${input.organizationName}`,
    ``,
    `Generated **${input.generatedAtIso}** for organization \`${input.organizationId}\`.`,
    ``,
    `${period}`,
    ``,
    `## Snapshot`,
    ``,
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Audit log rows in package | ${input.auditLogRows.toLocaleString()} |`,
    `| Audit chain status | ${chain} |`,
    `| NCQA compliance snapshots | ${input.ncqaSnapshotCount} |`,
    `| Providers in tenant | ${input.providerCount} |`,
    `| Active licenses | ${input.licenseCount} |`,
    ``,
    `## Files`,
    ``,
    `- \`manifest.json\` — machine-readable index with SHA-256 of every file.`,
    `- \`audit-log.csv\` — chained audit log entries (HMAC + previous-hash columns).`,
    `- \`ncqa-snapshots.csv\` — quarterly compliance scores.`,
    `- \`controls/\` — SOC 2 control evidence (one .md per control).`,
    `- \`README.md\` — anti-weakening notes for downstream auditors.`,
    ``,
    `> _Anti-weakening:_ This file and the manifest are byte-stable.`,
    `> If the same period/org regenerates a different SHA-256 set, history`,
    `> has been mutated — investigate via the chained audit log.`,
    ``,
  ].join("\n");
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
