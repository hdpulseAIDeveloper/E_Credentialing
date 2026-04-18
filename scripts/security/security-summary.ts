/**
 * scripts/security/security-summary.ts
 *
 * Wave 4.3 — consolidate ZAP + gitleaks output into a single
 * machine-readable + Markdown summary.
 *
 * CI feeds this two artifacts:
 *   - `--zap=/path/to/zap-baseline-report.json`     (ZAP traditional-json)
 *   - `--gitleaks=/path/to/gitleaks-report.json`     (gitleaks `--report-format=json`)
 *
 * Output to stdout — pipe into a file or use `--out=<path>`.
 *
 * Exit code is non-zero whenever either tool reports findings whose
 * severity exceeds the configured floor (default `--fail-on=high`).
 *
 * Pure helpers (`summarizeZap`, `summarizeGitleaks`,
 * `renderMarkdown`) are exported for unit testing.
 */

import { readFileSync, writeFileSync } from "fs";

// ─── ZAP types (subset of traditional-json) ────────────────────────────────

interface ZapSiteAlert {
  alert: string;
  riskdesc: string; // "High (Medium)" | "Medium (High)" | ...
  pluginid?: string;
  count?: string;
  desc?: string;
  solution?: string;
  reference?: string;
  cweid?: string;
}

interface ZapSite {
  "@name": string;
  alerts: ZapSiteAlert[];
}

interface ZapReport {
  site: ZapSite[];
}

// ─── Gitleaks types (subset of `--report-format=json`) ─────────────────────

interface GitleaksFinding {
  Description?: string;
  RuleID?: string;
  File?: string;
  StartLine?: number;
  EndLine?: number;
  Author?: string;
  Email?: string;
  Date?: string;
  Commit?: string;
  Tags?: string[];
}

// ─── Normalized severity ───────────────────────────────────────────────────

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface NormalizedFinding {
  source: "zap" | "gitleaks";
  severity: Severity;
  title: string;
  location: string;
  ruleId?: string;
  url?: string;
  count: number;
}

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function severityAtLeast(a: Severity, floor: Severity): boolean {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[floor];
}

// ─── Summarizers ───────────────────────────────────────────────────────────

/** Parse the ZAP `riskdesc` ("High (Medium)") into normalized severity. */
export function parseZapSeverity(riskdesc: string): Severity {
  const m = /^([A-Za-z]+)\s*\(/.exec(riskdesc.trim());
  const word = (m?.[1] ?? riskdesc.split(/\s+/)[0] ?? "").toLowerCase();
  switch (word) {
    case "informational":
    case "info":
      return "info";
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "critical":
      return "critical";
    default:
      return "info";
  }
}

export function summarizeZap(report: ZapReport): NormalizedFinding[] {
  const out: NormalizedFinding[] = [];
  for (const site of report.site ?? []) {
    for (const alert of site.alerts ?? []) {
      out.push({
        source: "zap",
        severity: parseZapSeverity(alert.riskdesc),
        title: alert.alert,
        location: site["@name"],
        ruleId: alert.pluginid,
        url: alert.reference,
        count: Number(alert.count ?? "1") || 1,
      });
    }
  }
  return out;
}

export function summarizeGitleaks(
  findings: GitleaksFinding[],
): NormalizedFinding[] {
  return findings.map((f) => ({
    source: "gitleaks" as const,
    severity: classifyGitleaksSeverity(f),
    title: f.Description ?? f.RuleID ?? "secret leak",
    location: `${f.File ?? "?"}:${f.StartLine ?? "?"}`,
    ruleId: f.RuleID,
    count: 1,
  }));
}

/**
 * gitleaks doesn't carry an explicit severity — every finding is
 * "you might have leaked a secret". We classify by tag: anything
 * tagged `phi` / `key` / `pem` / `bearer` is `critical`; everything
 * else is `high`.
 */
function classifyGitleaksSeverity(f: GitleaksFinding): Severity {
  const tags = (f.Tags ?? []).map((t) => t.toLowerCase());
  if (
    tags.includes("phi") ||
    tags.includes("key") ||
    tags.includes("pem") ||
    tags.includes("bearer")
  ) {
    return "critical";
  }
  return "high";
}

// ─── Renderers ─────────────────────────────────────────────────────────────

export interface Summary {
  generatedAt: string;
  totals: Record<Severity, number>;
  findings: NormalizedFinding[];
}

export function buildSummary(
  zap: NormalizedFinding[],
  gitleaks: NormalizedFinding[],
  now = new Date(),
): Summary {
  const all = [...zap, ...gitleaks];
  const totals: Record<Severity, number> = {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  for (const f of all) totals[f.severity] += f.count;
  return {
    generatedAt: now.toISOString(),
    totals,
    findings: all.sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        a.title.localeCompare(b.title),
    ),
  };
}

export function renderMarkdown(summary: Summary): string {
  const lines: string[] = [];
  lines.push(`# Security scan summary`);
  lines.push(`_Generated: ${summary.generatedAt}_\n`);
  lines.push("## Totals\n");
  lines.push("| Severity | Count |");
  lines.push("| --- | --- |");
  for (const sev of ["critical", "high", "medium", "low", "info"] as const) {
    lines.push(`| ${sev} | ${summary.totals[sev]} |`);
  }
  lines.push("");
  if (summary.findings.length === 0) {
    lines.push("**No findings.**");
    return lines.join("\n");
  }
  lines.push("## Findings\n");
  lines.push("| Severity | Source | Rule | Title | Location |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const f of summary.findings) {
    lines.push(
      `| ${f.severity} | ${f.source} | \`${f.ruleId ?? "-"}\` | ${f.title} | \`${f.location}\` |`,
    );
  }
  return lines.join("\n");
}

// ─── CLI ───────────────────────────────────────────────────────────────────

interface CliArgs {
  zap?: string;
  gitleaks?: string;
  out?: string;
  failOn: Severity;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { failOn: "high" };
  for (const a of argv) {
    const m = /^--([^=]+)=(.+)$/.exec(a);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "zap") out.zap = v;
    else if (k === "gitleaks") out.gitleaks = v;
    else if (k === "out") out.out = v;
    else if (k === "fail-on") out.failOn = v as Severity;
  }
  return out;
}

function loadJson<T>(path: string | undefined): T | null {
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (err) {
    console.error(`[security-summary] failed to read ${path}:`, err);
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const zapReport = loadJson<ZapReport>(args.zap);
  const gitleaksFindings = loadJson<GitleaksFinding[]>(args.gitleaks) ?? [];

  const zapNorm = zapReport ? summarizeZap(zapReport) : [];
  const glNorm = summarizeGitleaks(gitleaksFindings);
  const summary = buildSummary(zapNorm, glNorm);
  const md = renderMarkdown(summary);

  if (args.out) writeFileSync(args.out, md, "utf8");
  else console.log(md);

  const overFloor = summary.findings.some((f) =>
    severityAtLeast(f.severity, args.failOn),
  );
  process.exit(overFloor ? 1 : 0);
}

if (require.main === module) main();
