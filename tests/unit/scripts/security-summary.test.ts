/**
 * tests/unit/scripts/security-summary.test.ts
 *
 * Wave 4.3 — pure-helper coverage for the ZAP + gitleaks summary tool.
 */

import { describe, it, expect } from "vitest";
import {
  parseZapSeverity,
  summarizeZap,
  summarizeGitleaks,
  buildSummary,
  renderMarkdown,
  severityAtLeast,
} from "../../../scripts/security/security-summary";

describe("parseZapSeverity", () => {
  it("strips the parenthesized confidence", () => {
    expect(parseZapSeverity("High (Medium)")).toBe("high");
    expect(parseZapSeverity("Medium (Low)")).toBe("medium");
    expect(parseZapSeverity("Informational (Confirmed)")).toBe("info");
  });
  it("handles bare severities", () => {
    expect(parseZapSeverity("Low")).toBe("low");
    expect(parseZapSeverity("Critical")).toBe("critical");
  });
  it("falls back to info for garbage", () => {
    expect(parseZapSeverity("nonsense")).toBe("info");
  });
});

describe("summarizeZap", () => {
  it("flattens site → alerts and normalizes severity + counts", () => {
    const out = summarizeZap({
      site: [
        {
          "@name": "https://staging.example.com",
          alerts: [
            {
              alert: "X-Frame-Options Header Not Set",
              riskdesc: "Medium (Medium)",
              pluginid: "10020",
              count: "3",
            },
            {
              alert: "Information Disclosure - Server Header",
              riskdesc: "Low (High)",
              pluginid: "10037",
            },
          ],
        },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].severity).toBe("medium");
    expect(out[0].count).toBe(3);
    expect(out[0].source).toBe("zap");
    expect(out[1].severity).toBe("low");
    expect(out[1].count).toBe(1);
  });

  it("returns empty for an empty report", () => {
    expect(summarizeZap({ site: [] })).toEqual([]);
  });
});

describe("summarizeGitleaks", () => {
  it("classifies tagged secrets as critical", () => {
    const out = summarizeGitleaks([
      {
        Description: "Encryption key",
        RuleID: "ecred-encryption-key",
        File: "src/secret.ts",
        StartLine: 5,
        Tags: ["key", "phi"],
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("critical");
    expect(out[0].location).toBe("src/secret.ts:5");
  });

  it("falls back to high for untagged findings", () => {
    const out = summarizeGitleaks([
      {
        Description: "Generic API Key",
        RuleID: "generic-api-key",
        File: "config.yaml",
        StartLine: 12,
      },
    ]);
    expect(out[0].severity).toBe("high");
  });
});

describe("buildSummary + renderMarkdown", () => {
  it("totals correctly and sorts critical → high → medium → low → info", () => {
    const summary = buildSummary(
      [
        {
          source: "zap",
          severity: "low",
          title: "Low ZAP",
          location: "x",
          count: 1,
        },
        {
          source: "zap",
          severity: "high",
          title: "High ZAP",
          location: "x",
          count: 1,
        },
      ],
      [
        {
          source: "gitleaks",
          severity: "critical",
          title: "Critical leak",
          location: "y",
          count: 1,
        },
      ],
      new Date("2026-04-18T00:00:00Z"),
    );
    expect(summary.totals.critical).toBe(1);
    expect(summary.totals.high).toBe(1);
    expect(summary.totals.low).toBe(1);
    expect(summary.findings[0].severity).toBe("critical");
    expect(summary.findings[1].severity).toBe("high");
    expect(summary.findings[2].severity).toBe("low");
  });

  it("renders a no-findings banner when nothing was detected", () => {
    const md = renderMarkdown(buildSummary([], [], new Date()));
    expect(md).toContain("**No findings.**");
  });

  it("renders a row per finding", () => {
    const md = renderMarkdown(
      buildSummary(
        [
          {
            source: "zap",
            severity: "high",
            title: "XSS",
            location: "https://x",
            ruleId: "40012",
            count: 1,
          },
        ],
        [],
        new Date(),
      ),
    );
    expect(md).toContain("| high | zap | `40012` | XSS | `https://x` |");
  });
});

describe("severityAtLeast", () => {
  it("respects the rank ordering", () => {
    expect(severityAtLeast("critical", "high")).toBe(true);
    expect(severityAtLeast("medium", "high")).toBe(false);
    expect(severityAtLeast("info", "info")).toBe(true);
  });
});
