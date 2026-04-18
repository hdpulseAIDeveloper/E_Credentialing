import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
      "tests/contract/**/*.spec.ts",
      "tests/contract/**/*.test.ts",
      "tests/data/**/*.test.ts",
      "tests/docs/**/*.test.ts",
      "tests/external/**/*.spec.ts",
      "tests/external/**/*.test.ts",
    ],
    exclude: [
      "tests/e2e/**",
      "tests/perf/**",
      "tests/security/**",
      "tests/observability/**",
      "node_modules/**",
    ],
    setupFiles: ["tests/setup/vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "src/lib/**/*.ts",
        "src/server/**/*.ts",
        "src/workers/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/__mocks__/**",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
