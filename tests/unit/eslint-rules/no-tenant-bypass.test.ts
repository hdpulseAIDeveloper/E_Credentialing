/**
 * tests/unit/eslint-rules/no-tenant-bypass.test.ts
 *
 * Wave 5.1 — RuleTester coverage for the ecred-local/no-tenant-bypass
 * lint rule.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RuleTester } = require("eslint");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rule = require("../../../eslint-rules/no-tenant-bypass.js");

const tester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
});

tester.run("no-tenant-bypass", rule, {
  valid: [
    {
      code: `import { getTenantId } from "@/server/db/tenant-context";\nconst x = getTenantId();`,
      filename: "src/app/dashboard/page.tsx",
    },
    {
      code: `import { dangerouslyBypassTenantScope } from "@/server/db/tenant-context";\ndangerouslyBypassTenantScope(() => 1);`,
      filename: "src/server/db/internal/billing-rollup.ts",
    },
    {
      code: `import { dangerouslyBypassTenantScope } from "../../tenant-context";\ndangerouslyBypassTenantScope(() => 1);`,
      filename: "tests/unit/server/db/billing.test.ts",
    },
  ],
  invalid: [
    {
      code: `import { dangerouslyBypassTenantScope } from "@/server/db/tenant-context";`,
      filename: "src/app/admin/page.tsx",
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { getTenantId, dangerouslyBypassTenantScope } from "@/server/db/tenant-context";`,
      filename: "src/server/api/routers/providers.ts",
      errors: [{ messageId: "banned" }],
    },
  ],
});

import { describe, it, expect } from "vitest";
describe("no-tenant-bypass", () => {
  it("RuleTester ran the cases without throwing", () => {
    expect(true).toBe(true);
  });
});
