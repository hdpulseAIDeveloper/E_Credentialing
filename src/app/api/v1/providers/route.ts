import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { authenticateApiKey, requireScope } from "../middleware";
import { applyRateLimitHeaders } from "@/lib/api/rate-limit";
import { applyRequestIdHeader, resolveRequestId } from "@/lib/api/request-id";
import { applyPaginationLinkHeader } from "@/lib/api/pagination-links";
import {
  applyEtagHeader,
  evaluateConditionalGet,
  notModifiedResponse,
} from "@/lib/api/etag";
import { applyDeprecationByRoute } from "@/lib/api/deprecation";
import { auditApiRequest } from "@/lib/api/audit-api";

const ROUTE_PATH = "/api/v1/providers";

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await authenticateApiKey(request);
  if (!auth.valid) {
    return applyDeprecationByRoute(
      applyRequestIdHeader(auth.error!, requestId),
      "GET",
      ROUTE_PATH,
    );
  }

  const scopeError = requireScope(auth, "providers:read");
  if (scopeError) {
    return applyDeprecationByRoute(
      applyRequestIdHeader(scopeError, requestId),
      "GET",
      ROUTE_PATH,
    );
  }

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

  const totalPages = Math.ceil(total / limit);
  const responseBody = {
    data: providers,
    pagination: { page, limit, total, totalPages },
  };
  const conditional = evaluateConditionalGet(request, responseBody);

  if (conditional.status === "not-modified") {
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: "/api/v1/providers",
      status: 304,
      resultCount: 0,
      query: { status, npi, page: String(page), limit: String(limit) },
      requestId,
    });
    return applyDeprecationByRoute(
      notModifiedResponse(conditional.etag, {
        requestId,
        rateLimit: auth.rateLimit,
      }),
      "GET",
      ROUTE_PATH,
    );
  }

  void auditApiRequest({
    apiKeyId: auth.keyId!,
    method: "GET",
    path: "/api/v1/providers",
    status: 200,
    resultCount: providers.length,
    query: { status, npi, page: String(page), limit: String(limit) },
    requestId,
  });

  return applyDeprecationByRoute(
    applyRequestIdHeader(
      applyPaginationLinkHeader(
        applyRateLimitHeaders(
          applyEtagHeader(
            NextResponse.json(responseBody),
            conditional.etag,
          ),
          auth.rateLimit,
        ),
        request.url,
        { page, limit, total, totalPages },
      ),
      requestId,
    ),
    "GET",
    ROUTE_PATH,
  );
}
