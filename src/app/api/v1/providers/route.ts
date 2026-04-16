import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey } from "../middleware";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.valid) return auth.error;

  if (!auth.permissions?.["providers:read"]) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const npi = url.searchParams.get("npi");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (npi) where.npi = npi;

  const [total, providers] = await Promise.all([
    db.provider.count({ where }),
    db.provider.findMany({
      where,
      select: {
        id: true,
        legalFirstName: true,
        legalLastName: true,
        npi: true,
        status: true,
        providerType: { select: { name: true, abbreviation: true } },
        approvedAt: true,
        createdAt: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    data: providers,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
