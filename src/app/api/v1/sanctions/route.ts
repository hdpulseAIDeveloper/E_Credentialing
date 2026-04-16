import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey } from "../middleware";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.valid) return auth.error;

  if (!auth.permissions?.["sanctions:read"]) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const url = new URL(request.url);
  const providerId = url.searchParams.get("providerId");
  const result = url.searchParams.get("result");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));

  const where: Record<string, unknown> = {};
  if (providerId) where.providerId = providerId;
  if (result) where.result = result;

  const [total, checks] = await Promise.all([
    db.sanctionsCheck.count({ where }),
    db.sanctionsCheck.findMany({
      where,
      select: {
        id: true,
        source: true,
        result: true,
        runDate: true,
        triggeredBy: true,
        provider: { select: { id: true, legalFirstName: true, legalLastName: true, npi: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { runDate: "desc" },
    }),
  ]);

  return NextResponse.json({
    data: checks,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
