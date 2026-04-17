/**
 * scripts/qa/build-all-inventories.ts
 *
 * Convenience entrypoint that runs the four inventory builders in series. CI
 * calls this via `npm run qa:inventory` before the coverage gate runs.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const SCRIPTS = [
  "build-route-inventory.ts",
  "build-api-inventory.ts",
  "build-link-inventory.ts",
  "build-trpc-inventory.ts",
];

let failed = false;
for (const s of SCRIPTS) {
  const file = path.join(__dirname, s);
  console.log(`\n--- ${s} ---`);
  const r = spawnSync(
    process.execPath,
    [path.join(__dirname, "..", "..", "node_modules", "tsx", "dist", "cli.mjs"), file],
    { stdio: "inherit" },
  );
  if ((r.status ?? 1) !== 0) {
    console.error(`FAIL: ${s} exited with ${r.status}`);
    failed = true;
  }
}

if (failed) process.exit(1);
