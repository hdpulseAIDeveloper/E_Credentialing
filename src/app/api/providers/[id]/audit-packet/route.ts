/**
 * GET /api/providers/[id]/audit-packet
 *
 * P1 Gap #10 — Streams a one-click ZIP packet for delegated audits and NCQA
 * reviews. Staff-only. Audit-logged so reviewers can see who exported what.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { generateAuditPacket } from "@/lib/audit-packet";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role;
  if (role === "PROVIDER") {
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

  try {
    const { zipBuffer, fileName, manifest } = await generateAuditPacket(db, id);

    await writeAuditLog({
      actorId: session.user.id,
      actorRole: role,
      action: "auditPacket.exported",
      entityType: "Provider",
      entityId: id,
      providerId: id,
      afterState: {
        fileName,
        sizeBytes: zipBuffer.length,
        totalFiles: manifest.totalFiles,
      },
    });

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store",
        "X-Audit-Packet-Files": String(manifest.totalFiles),
      },
    });
  } catch (err) {
    console.error("[AuditPacket] Generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate audit packet" },
      { status: 500 }
    );
  }
}
