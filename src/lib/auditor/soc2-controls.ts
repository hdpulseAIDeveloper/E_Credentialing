/**
 * Wave 5.4 — SOC 2 Type I control catalog (gap analysis).
 *
 * The five Trust Services Categories (TSC) for SOC 2 are Security
 * (Common Criteria), Availability, Processing Integrity,
 * Confidentiality, and Privacy. SOC 2 Type I attests that controls
 * are *designed* appropriately at a point in time; Type II adds
 * effectiveness over a period (3-12 months).
 *
 * This file is the pre-Type-I gap analysis. Each entry maps a
 * specific control to:
 *   - The application/code surface that implements it
 *   - The artifact in the auditor package that proves it
 *   - The current `status` ("implemented" | "partial" | "gap")
 *
 * Anti-weakening:
 *   - Statuses MUST reflect reality. Aspirational marking ("partial"
 *     when it's actually a gap) is a SOC 2 audit failure waiting to
 *     happen — and worse, it lies to the customer.
 *   - When a control moves from "gap" to "partial" or "partial" to
 *     "implemented", record the commit/PR in `notes`.
 */

export type ControlStatus = "implemented" | "partial" | "gap";

export interface SocControl {
  /** AICPA TSC ref, e.g. CC6.1, A1.2, C1.1. */
  ref: string;
  category:
    | "Security (Common Criteria)"
    | "Availability"
    | "Processing Integrity"
    | "Confidentiality"
    | "Privacy";
  title: string;
  description: string;
  status: ControlStatus;
  /** Where this is implemented in the codebase or operationally. */
  implementation: string[];
  /** Path inside the auditor package zip where evidence lives. */
  evidence: string[];
  notes?: string;
}

export const SOC2_CONTROLS: ReadonlyArray<SocControl> = [
  {
    ref: "CC6.1",
    category: "Security (Common Criteria)",
    title: "Logical access — authentication",
    description:
      "The entity restricts logical access to information assets, including authentication of authorized users prior to granting access.",
    status: "implemented",
    implementation: [
      "Auth.js v5 with Microsoft Entra ID (Azure AD) — see ADR 0009",
      "MFA enforced via Conditional Access; verified by scripts/ops/entra-mfa-status.py",
    ],
    evidence: [
      "controls/CC6.1-authentication.md",
      "controls/CC6.1-mfa-status.csv",
    ],
  },
  {
    ref: "CC6.2",
    category: "Security (Common Criteria)",
    title: "Logical access — provisioning + deprovisioning",
    description:
      "The entity authorizes new users prior to provisioning and removes access when users leave.",
    status: "partial",
    implementation: [
      "Entra ID is the source of truth for users; Auth.js syncs role on sign-in",
      "Manual deprovisioning runbook in docs/dev/runbooks/user-offboarding.md",
    ],
    evidence: ["controls/CC6.2-provisioning.md"],
    notes:
      "Gap: SCIM auto-deprovisioning not yet wired. Roadmap: Wave 5.6.",
  },
  {
    ref: "CC6.6",
    category: "Security (Common Criteria)",
    title: "Network — encryption in transit",
    description:
      "The entity implements logical access security measures to protect against threats from sources outside its system boundaries.",
    status: "implemented",
    implementation: [
      "TLS 1.2+ enforced at Azure Container Apps ingress",
      "scripts/ops/prod-tls-check.py validates cert + cipher posture nightly",
    ],
    evidence: ["controls/CC6.6-tls-posture.md"],
  },
  {
    ref: "CC6.7",
    category: "Security (Common Criteria)",
    title: "Data at rest — encryption",
    description:
      "The entity restricts the transmission, movement, and removal of information through encryption and other secure protocols.",
    status: "implemented",
    implementation: [
      "PHI fields encrypted at column level via src/lib/encryption.ts (ADR 0004)",
      "Postgres TDE managed by Azure Database for PostgreSQL Flexible Server",
      "Blob storage uses Azure-managed keys (server-side encryption)",
    ],
    evidence: [
      "controls/CC6.7-phi-encryption.md",
    ],
  },
  {
    ref: "CC7.1",
    category: "Security (Common Criteria)",
    title: "Detection of unauthorized changes — audit logging",
    description:
      "The entity uses detection and monitoring procedures to identify changes to configurations and unauthorized access.",
    status: "implemented",
    implementation: [
      "Tamper-evident audit log (HMAC-chained) — ADR 0011",
      "DB triggers block UPDATE/DELETE/TRUNCATE on audit_logs",
    ],
    evidence: [
      "audit-log.csv",
      "controls/CC7.1-audit-chain.md",
    ],
  },
  {
    ref: "CC7.2",
    category: "Security (Common Criteria)",
    title: "Monitoring of system anomalies",
    description:
      "The entity monitors system components for anomalies that are indicative of malicious acts.",
    status: "implemented",
    implementation: [
      "Sentry + Application Insights + Prometheus + Grafana (ADR 0013)",
      "OWASP ZAP baseline + active scans (Wave 4.3)",
    ],
    evidence: ["controls/CC7.2-monitoring.md"],
  },
  {
    ref: "CC8.1",
    category: "Security (Common Criteria)",
    title: "Change management",
    description:
      "The entity authorizes, designs, develops, configures, documents, tests, approves, and implements changes.",
    status: "implemented",
    implementation: [
      "Pull-request review gate; CI runs vitest + tsc + lint + visual regression",
      "Pre-deploy bundle (scripts/qa/e2e-prod-bundle.mjs) — DEF-INFRA-0001",
    ],
    evidence: ["controls/CC8.1-change-management.md"],
  },
  {
    ref: "A1.2",
    category: "Availability",
    title: "Recoverability + DR",
    description:
      "The entity authorizes, designs, develops, implements, operates, approves, maintains, and monitors environmental protections, software, data backup processes, and recovery infrastructure.",
    status: "partial",
    implementation: [
      "Postgres point-in-time restore via Azure Flexible Server (7-day window)",
      "Recover script: scripts/ops/prod-recover.py",
    ],
    evidence: ["controls/A1.2-backup-recovery.md"],
    notes:
      "Gap: Cross-region warm-standby not yet provisioned. Roadmap: Wave 6 IaC delta.",
  },
  {
    ref: "C1.1",
    category: "Confidentiality",
    title: "Confidential information identification + handling",
    description:
      "The entity identifies and maintains confidential information to meet the entity's objectives related to confidentiality.",
    status: "implemented",
    implementation: [
      "Pino logger with PHI field redaction (ADR 0010)",
      "Tenant Prisma extension auto-injects organizationId (ADR 0014)",
    ],
    evidence: ["controls/C1.1-phi-handling.md"],
  },
  {
    ref: "P3.1",
    category: "Privacy",
    title: "Notice + consent",
    description:
      "The entity provides notice about its privacy practices and obtains consent before processing personal information when required.",
    status: "implemented",
    implementation: [
      "Privacy notice + terms of service rendered from src/lib/legal/copy.ts",
      "Provider attestation flow logged to audit chain",
    ],
    evidence: ["controls/P3.1-privacy-notice.md"],
  },
];

export interface Soc2GapSummary {
  total: number;
  implemented: number;
  partial: number;
  gap: number;
  byCategory: Record<string, { implemented: number; partial: number; gap: number }>;
}

export function summarizeSoc2(
  controls: ReadonlyArray<SocControl> = SOC2_CONTROLS,
): Soc2GapSummary {
  const summary: Soc2GapSummary = {
    total: controls.length,
    implemented: 0,
    partial: 0,
    gap: 0,
    byCategory: {},
  };
  for (const c of controls) {
    summary[c.status]++;
    const cat = (summary.byCategory[c.category] ??= {
      implemented: 0,
      partial: 0,
      gap: 0,
    });
    cat[c.status]++;
  }
  return summary;
}

export function renderControlMarkdown(c: SocControl): string {
  const statusBadge =
    c.status === "implemented"
      ? ":white_check_mark: Implemented"
      : c.status === "partial"
      ? ":warning: Partial"
      : ":x: Gap";
  return [
    `# ${c.ref} — ${c.title}`,
    ``,
    `**Category:** ${c.category}`,
    `**Status:** ${statusBadge}`,
    ``,
    `## Description`,
    c.description,
    ``,
    `## How we implement it`,
    ...c.implementation.map((i) => `- ${i}`),
    ``,
    `## Evidence in this package`,
    ...c.evidence.map((e) => `- \`${e}\``),
    ...(c.notes ? [``, `## Notes`, c.notes] : []),
    ``,
  ].join("\n");
}

export function renderGapAnalysisMarkdown(
  controls: ReadonlyArray<SocControl> = SOC2_CONTROLS,
): string {
  const sum = summarizeSoc2(controls);
  const lines: string[] = [
    `# SOC 2 Type I — gap analysis`,
    ``,
    `Total controls assessed: **${sum.total}** ` +
      `(implemented: ${sum.implemented}, partial: ${sum.partial}, gap: ${sum.gap})`,
    ``,
    `## By category`,
    ``,
    `| Category | Implemented | Partial | Gap |`,
    `| --- | --- | --- | --- |`,
  ];
  for (const [cat, stats] of Object.entries(sum.byCategory)) {
    lines.push(`| ${cat} | ${stats.implemented} | ${stats.partial} | ${stats.gap} |`);
  }
  lines.push(``, `## Detail`, ``);
  for (const c of controls) {
    const badge =
      c.status === "implemented" ? "OK" : c.status === "partial" ? "PARTIAL" : "GAP";
    lines.push(`- **${c.ref}** [${badge}] — ${c.title}`);
    if (c.notes) lines.push(`  - _${c.notes}_`);
  }
  lines.push(``);
  return lines.join("\n");
}
