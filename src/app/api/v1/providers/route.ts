import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authenticateApiKey, requireScope } from "../middleware";
import { applyRateLimitHeaders } from "@/lib/api/rate-limit";
import { applyRequestIdHeader, resolveRequestId } from "@/lib/api/request-id";
import { applyPaginationLinkHeader } from "@/lib/api/pagination-links";
import { auditApiRequest } from "@/lib/api/audit-api";

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await authenticateApiKey(request);
  if (!auth.valid) return applyRequestIdHeader(auth.error!, requestId);

  const scopeError = requireScope(auth, "providers:read");
  if (scopeError) return applyRequestIdHeader(scopeError, requestId);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const npi = url.searchParams.get("npi");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));

  const where: Prisma.ProviderWhereInput = {};
  if (status) where.status = status as Prisma.ProviderWhereInput["status"];
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

  void auditApiRequest({
    apiKeyId: auth.keyId!,
    method: "GET",
    path: "/api/v1/providers",
    status: 200,
    resultCount: providers.length,
    query: { status, npi, page: String(page), limit: String(limit) },
    requestId,
  });

  const totalPages = Math.ceil(total / limit);
  return applyRequestIdHeader(
    applyPaginationLinkHeader(
      applyRateLimitHeaders(
        NextResponse.json({
          data: providers,
          pagination: { page, limit, total, totalPages },
        }),
        auth.rateLimit,
      ),
      request.url,
      { page, limit, total, totalPages },
    ),
    requestId,
  );
}
