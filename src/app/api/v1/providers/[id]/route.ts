import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey } from "../../middleware";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request);
  if (!auth.valid) return auth.error;

  if (!auth.permissions?.["providers:read"]) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const provider = await db.provider.findUnique({
    where: { id },
    include: {
      providerType: true,
      profile: true,
      licenses: true,
      enrollments: { select: { id: true, payerName: true, status: true, effectiveDate: true } },
      expirables: { select: { id: true, expirableType: true, status: true, expirationDate: true } },
    },
  });

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  return NextResponse.json({ data: provider });
}
