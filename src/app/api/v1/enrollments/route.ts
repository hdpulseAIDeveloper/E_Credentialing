import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authenticateApiKey, requireScope } from "../middleware";
import { auditApiRequest } from "@/lib/api/audit-api";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.valid) return auth.error;

  const scopeError = requireScope(auth, "enrollments:read");
  if (scopeError) return scopeError;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const payerName = url.searchParams.get("payer");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));

  const where: Prisma.EnrollmentWhereInput = {};
  if (status) where.status = status as Prisma.EnrollmentWhereInput["status"];
  if (payerName) where.payerName = { contains: payerName, mode: "insensitive" };

  const [total, enrollments] = await Promise.all([
    db.enrollment.count({ where }),
    db.enrollment.findMany({
      where,
      select: {
        id: true,
        payerName: true,
        enrollmentType: true,
        status: true,
        effectiveDate: true,
        submittedAt: true,
        provider: { select: { id: true, legalFirstName: true, legalLastName: true, npi: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  void auditApiRequest({
    apiKeyId: auth.keyId!,
    method: "GET",
    path: "/api/v1/enrollments",
    status: 200,
    resultCount: enrollments.length,
    query: { status, payer: payerName, page: String(page), limit: String(limit) },
  });

  return NextResponse.json({
    data: enrollments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
