import { describe, expect, it } from "vitest";
import {
  SOC2_CONTROLS,
  renderControlMarkdown,
  renderGapAnalysisMarkdown,
  summarizeSoc2,
} from "@/lib/auditor/soc2-controls";

describe("SOC2_CONTROLS catalog", () => {
  it("has at least one control in each TSC category we claim", () => {
    const cats = new Set(SOC2_CONTROLS.map((c) => c.category));
    expect(cats.has("Security (Common Criteria)")).toBe(true);
    expect(cats.has("Availability")).toBe(true);
    expect(cats.has("Confidentiality")).toBe(true);
    expect(cats.has("Privacy")).toBe(true);
  });

  it("each control has at least one implementation note and one evidence path", () => {
    for (const c of SOC2_CONTROLS) {
      expect(c.implementation.length, `${c.ref} implementation`).toBeGreaterThan(0);
      expect(c.evidence.length, `${c.ref} evidence`).toBeGreaterThan(0);
    }
  });

  it("partial / gap controls explain the delta in notes", () => {
    for (const c of SOC2_CONTROLS) {
      if (c.status === "partial" || c.status === "gap") {
        expect(c.notes, `${c.ref} requires notes for ${c.status}`).toBeTruthy();
      }
    }
  });

  it("control refs are unique", () => {
    const refs = SOC2_CONTROLS.map((c) => c.ref);
    expect(new Set(refs).size).toBe(refs.length);
  });
});

describe("summarizeSoc2", () => {
  it("counts statuses correctly", () => {
    const sum = summarizeSoc2([
      { ref: "A", category: "Availability", title: "t", description: "d", status: "implemented", implementation: ["x"], evidence: ["x"] },
      { ref: "B", category: "Availability", title: "t", description: "d", status: "partial", implementation: ["x"], evidence: ["x"], notes: "n" },
      { ref: "C", category: "Privacy", title: "t", description: "d", status: "gap", implementation: ["x"], evidence: ["x"], notes: "n" },
    ]);
    expect(sum.total).toBe(3);
    expect(sum.implemented).toBe(1);
    expect(sum.partial).toBe(1);
    expect(sum.gap).toBe(1);
    expect(sum.byCategory["Availability"]).toEqual({ implemented: 1, partial: 1, gap: 0 });
    expect(sum.byCategory["Privacy"]).toEqual({ implemented: 0, partial: 0, gap: 1 });
  });
});

describe("renderControlMarkdown", () => {
  it("includes ref, status badge, implementation, and evidence", () => {
    const md = renderControlMarkdown({
      ref: "CC6.1",
      category: "Security (Common Criteria)",
      title: "Auth",
      description: "desc",
      status: "implemented",
      implementation: ["impl-a"],
      evidence: ["evidence/a.md"],
    });
    expect(md).toContain("# CC6.1 — Auth");
    expect(md).toContain("Implemented");
    expect(md).toContain("impl-a");
    expect(md).toContain("`evidence/a.md`");
  });

  it("shows notes section for partial / gap controls", () => {
    const md = renderControlMarkdown({
      ref: "X1",
      category: "Availability",
      title: "T",
      description: "d",
      status: "partial",
      implementation: ["i"],
      evidence: ["e"],
      notes: "needs work",
    });
    expect(md).toContain("## Notes");
    expect(md).toContain("needs work");
  });
});

describe("renderGapAnalysisMarkdown", () => {
  it("renders a category table and per-control bullet list", () => {
    const md = renderGapAnalysisMarkdown();
    expect(md).toContain("# SOC 2 Type I — gap analysis");
    expect(md).toContain("| Category | Implemented | Partial | Gap |");
    for (const c of SOC2_CONTROLS) {
      expect(md).toContain(c.ref);
    }
  });
});
