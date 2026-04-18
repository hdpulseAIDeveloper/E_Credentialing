/**
 * Unit tests for the local eslint-rules/no-raw-color.js rule.
 * Uses ESLint's built-in RuleTester (CJS require to bypass type defs).
 */
import { describe, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";

const requireRoot = createRequire(path.resolve(process.cwd(), "package.json"));
const { RuleTester } = requireRoot("eslint") as typeof import("eslint");
const rule = requireRoot(
  path.resolve(process.cwd(), "eslint-rules/no-raw-color.js"),
) as import("eslint").Rule.RuleModule;

const tester = new RuleTester({
  // ESLint 8 RuleTester accepts the legacy `parser` + `parserOptions` shape
  // but the typings model the flat-config form. Cast to bypass the mismatch.
  parser: requireRoot.resolve("@typescript-eslint/parser"),
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
} as never);

describe("eslint rule: no-raw-color", () => {
  it("accepts valid token-based usage and rejects raw colors", () => {
    tester.run("no-raw-color", rule, {
      valid: [
        { code: 'const cls = "bg-primary text-card-foreground";' },
        { code: 'const x = "currentColor";' },
        { code: 'const x = "transparent";' },
        { code: 'const x = "inherit";' },
        { code: 'const x = "none";' },
        { code: 'const empty = "";' },
        { code: 'const cls = "border-input rounded-md";' },
        { code: "const fn = () => `<svg fill='currentColor'/>`;" },
        // JSX with token-based className
        { code: 'const j = (<div className="bg-card text-foreground">x</div>);' },
        // CSS-var indirection (canonical shadcn pattern) is allowed
        { code: 'const x = "hsl(var(--primary))";' },
        { code: 'const x = "rgb(var(--ring) / 0.4)";' },
      ],
      invalid: [
        {
          code: 'const x = "#fff";',
          errors: [{ messageId: "raw" }],
        },
        {
          code: 'const x = "#0EA5E9";',
          errors: [{ messageId: "raw" }],
        },
        {
          code: 'const x = "rgb(14, 165, 233)";',
          errors: [{ messageId: "raw" }],
        },
        {
          code: 'const x = "rgba(0,0,0,0.5)";',
          errors: [{ messageId: "raw" }],
        },
        {
          code: 'const x = "hsl(217 91% 60%)";',
          errors: [{ messageId: "raw" }],
        },
        {
          code: 'const cls = "bg-[#0ea5e9] text-white";',
          errors: [{ messageId: "raw" }],
        },
        {
          code: 'const j = (<div style={{ color: "#fff" }}>x</div>);',
          errors: [{ messageId: "raw" }],
        },
        {
          code: 'const j = (<div className="bg-[#0ea5e9]">x</div>);',
          errors: [{ messageId: "raw" }],
        },
      ],
    });
  });
});
