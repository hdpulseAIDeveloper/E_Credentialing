import { NextResponse } from "next/server";
import { z } from "zod";
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
import { parseQuery } from "@/lib/api/validation";

const ROUTE_PATH = "/api/v1/enrollments";

const ENROLLMENT_STATUS_VALUES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_PAYER",
  "ENROLLED",
  "DENIED",
  "ERROR",
  "WITHDRAWN",
] as const;

const ENROLLMENTS_QUERY_SCHEMA = z.object({
  status: z.enum(ENROLLMENT_STATUS_VALUES).optional(),
  payer: z.string().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

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

  const queryResult = parseQuery(request, ENROLLMENTS_QUERY_SCHEMA);
  if (!queryResult.ok) {
    return applyDeprecationByRoute(
      applyRequestIdHeader(
        applyRateLimitHeaders(queryResult.response, auth.rateLimit),
        requestId,
      ),
      "GET",
      ROUTE_PATH,
    );
  }
  const { status, payer: payerName, page, limit } = queryResult.data;

  const where: Prisma.EnrollmentWhereInput = {};
  if (status) where.status = status;
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
      query: {
        status: status ?? null,
        payer: payerName ?? null,
        page: String(page),
        limit: String(limit),
      },
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
    query: {
      status: status ?? null,
      payer: payerName ?? null,
      page: String(page),
      limit: String(limit),
    },
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
