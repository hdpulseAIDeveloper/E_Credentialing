/**
 * GET /api/providers/[id]/cv.pdf
 *
 * Wave 3.2 — staff-session-gated CV PDF download. Used by the in-app
 * "Download CV" button on `/cme` and `/providers/[id]?tab=cme`. Mirrors
 * the public `/api/v1/providers/[id]/cv.pdf` API-key-gated endpoint;
 * both ultimately call `CmeService.renderProviderCvPdf` so the audit
 * chain is identical regardless of caller.
 *
 * RBAC: any authenticated staff role. PROVIDERs are denied (a provider
 * may have multiple records they don't own).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { CmeService } from "@/server/services/cme";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "PROVIDER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const provider = await db.provider.findUnique({
    where: { id },
    select: { id: true, legalLastName: true },
  });
  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const svc = new CmeService({
    db,
    audit: writeAuditLog,
    actor: { id: session.user.id, role: session.user.role },
  });

  try {
    const bytes = await svc.renderProviderCvPdf(id);
    const safeName = (provider.legalLastName ?? "provider")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .toLowerCase();
    return new NextResponse(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cv-${safeName}-${id.slice(0, 8)}.pdf"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[CV PDF] Generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate CV PDF" },
      { status: 500 },
    );
  }
}
