/**
 * Wave 5.4 — one-click auditor-package export.
 *
 * GET  → 200 zip with everything an auditor needs (HMAC-chained audit
 *         log + NCQA snapshots + SOC 2 control evidence + manifest).
 * 401  → unauthenticated
 * 403  → caller is not an admin
 *
 * The endpoint streams a moderate-size zip; the heavy lifting is done
 * by `buildAuditorPackage()` which uses JSZip in memory. For very
 * large tenants we'll switch to a job-queue + signed-URL pattern in a
 * future wave.
 */
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";
import { buildAuditorPackage } from "@/lib/auditor/build-package";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "COMPLIANCE_OFFICER"]);

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const orgId = (session.user as { organizationId?: string }).organizationId ?? "org_essen";
  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const reportPeriod =
    fromParam && toParam
      ? { from: new Date(fromParam), to: new Date(toParam) }
      : undefined;

  const started = Date.now();
  let result;
  try {
    result = await buildAuditorPackage({
      organizationId: orgId,
      reportPeriod,
    });
  } catch (err) {
    logger.error({ err: String(err), orgId }, "auditor-package build failed");
    return NextResponse.json({ error: "build_failed", message: String(err) }, { status: 500 });
  }

  await writeAuditLog({
    actorId: session.user.id ?? null,
    actorRole: role,
    action: "AUDITOR_PACKAGE_EXPORTED",
    entityType: "Organization",
    entityId: orgId,
    metadata: {
      zipDigestSha256: result.zipDigestSha256,
      bytes: result.zipBytes.byteLength,
      auditLogRows: result.manifest.summary.auditLogRows,
      auditChainOk: result.manifest.summary.auditChainOk,
      durationMs: Date.now() - started,
    },
  }).catch((err) => logger.warn({ err }, "audit write failed for AUDITOR_PACKAGE_EXPORTED"));

  const filename = `auditor-package-${orgId}-${result.manifest.generatedAt.replace(/[:.]/g, "-")}.zip`;

  // Wrap the Uint8Array in a Buffer so the Next.js Response BodyInit
  // overload picks the binary path instead of attempting to coerce
  // into URLSearchParams.
  const body = Buffer.from(result.zipBytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Auditor-Package-Digest": result.zipDigestSha256,
    },
  });
}
