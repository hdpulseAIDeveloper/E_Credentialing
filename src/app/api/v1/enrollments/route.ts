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

const ROUTE_PATH = "/api/v1/enrollments";

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

  const scopeError = requireScope(auth, "enrollments:read", request);
  if (scopeError) {
    return applyDeprecationByRoute(
      applyRequestIdHeader(scopeError, requestId),
      "GET",
      ROUTE_PATH,
    );
  }

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

  const totalPages = Math.ceil(total / limit);
  const responseBody = {
    data: enrollments,
    pagination: { page, limit, total, totalPages },
  };
  const conditional = evaluateConditionalGet(request, responseBody);

  if (conditional.status === "not-modified") {
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: "/api/v1/enrollments",
      status: 304,
      resultCount: 0,
      query: { status, payer: payerName, page: String(page), limit: String(limit) },
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
    path: "/api/v1/enrollments",
    status: 200,
    resultCount: enrollments.length,
    query: { status, payer: payerName, page: String(page), limit: String(limit) },
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
