/**
 * scripts/compliance/build-auditor-package.ts
 *
 * CLI entry point for the auditor-package builder. Useful for nightly
 * automation, ad-hoc auditor requests, and local sanity checks.
 *
 * Usage:
 *   npx tsx scripts/compliance/build-auditor-package.ts \\
 *     --org=org_essen \\
 *     --from=2026-01-01 \\
 *     --to=2026-04-18 \\
 *     --out=./out/auditor-package.zip
 *
 * Defaults:
 *   --org   org_essen (the legacy single-tenant id)
 *   --out   ./out/auditor-package-<org>-<timestamp>.zip
 *   --from / --to omitted → all available history
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildAuditorPackage } from "../../src/lib/auditor/build-package";

interface CliArgs {
  org: string;
  from?: Date;
  to?: Date;
  out: string;
}

function parseArgs(argv: string[]): CliArgs {
  const opts: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    const [k, v] = arg.replace(/^--/, "").split("=");
    if (k && v !== undefined) opts[k] = v;
  }
  const org = opts.org ?? "org_essen";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = opts.out ?? `./out/auditor-package-${org}-${stamp}.zip`;
  const args: CliArgs = { org, out };
  if (opts.from) args.from = new Date(opts.from);
  if (opts.to) args.to = new Date(opts.to);
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const reportPeriod =
    args.from && args.to ? { from: args.from, to: args.to } : undefined;

  console.log(`[auditor-package] org=${args.org}`);
  if (reportPeriod) {
    console.log(`[auditor-package] period=${reportPeriod.from.toISOString()} → ${reportPeriod.to.toISOString()}`);
  } else {
    console.log(`[auditor-package] period=all available history`);
  }

  const result = await buildAuditorPackage({
    organizationId: args.org,
    reportPeriod,
  });

  const outPath = resolve(args.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, result.zipBytes);

  console.log(`[auditor-package] wrote ${result.zipBytes.byteLength.toLocaleString()} bytes`);
  console.log(`[auditor-package] sha256=${result.zipDigestSha256}`);
  console.log(`[auditor-package] auditChainOk=${result.manifest.summary.auditChainOk}`);
  console.log(`[auditor-package] -> ${outPath}`);
}

main().catch((err) => {
  console.error("[auditor-package] FAILED:", err);
  process.exit(1);
});
