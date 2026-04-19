import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authenticateApiKey, requireScope } from "../middleware";
import { applyRateLimitHeaders } from "@/lib/api/rate-limit";
import { applyRequestIdHeader, resolveRequestId } from "@/lib/api/request-id";
import { auditApiRequest } from "@/lib/api/audit-api";

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await authenticateApiKey(request);
  if (!auth.valid) return applyRequestIdHeader(auth.error!, requestId);

  const scopeError = requireScope(auth, "sanctions:read");
  if (scopeError) return applyRequestIdHeader(scopeError, requestId);

  const url = new URL(request.url);
  const providerId = url.searchParams.get("providerId");
  const result = url.searchParams.get("result");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));

  const where: Prisma.SanctionsCheckWhereInput = {};
  if (providerId) where.providerId = providerId;
  if (result) where.result = result as Prisma.SanctionsCheckWhereInput["result"];

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

  void auditApiRequest({
    apiKeyId: auth.keyId!,
    method: "GET",
    path: "/api/v1/sanctions",
    status: 200,
    resultCount: checks.length,
    query: { providerId, result, page: String(page), limit: String(limit) },
    requestId,
  });

  return applyRequestIdHeader(
    applyRateLimitHeaders(
      NextResponse.json({
        data: checks,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }),
      auth.rateLimit,
    ),
    requestId,
  );
}
