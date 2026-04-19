import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey, requireScope } from "../../middleware";
import { applyRateLimitHeaders } from "@/lib/api/rate-limit";
import { applyRequestIdHeader, resolveRequestId } from "@/lib/api/request-id";
import {
  applyEtagHeader,
  evaluateConditionalGet,
  notModifiedResponse,
} from "@/lib/api/etag";
import { applyDeprecationByRoute } from "@/lib/api/deprecation";
import { auditApiRequest } from "@/lib/api/audit-api";

const ROUTE_PATH = "/api/v1/providers/{id}";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const provider = await db.provider.findUnique({
    where: { id },
    select: {
      // PHI is never returned via the public API. Excluded fields: ssn,
      // dateOfBirth, deaNumber (until tokenized), notes.
      id: true,
      legalFirstName: true,
      legalLastName: true,
      legalMiddleName: true,
      npi: true,
      caqhId: true,
      status: true,
      approvedAt: true,
      createdAt: true,
      updatedAt: true,
      providerType: { select: { name: true, abbreviation: true } },
      profile: {
        select: {
          specialtyPrimary: true,
          facilityAssignment: true,
          jobTitle: true,
        },
      },
      licenses: {
        select: {
          id: true,
          state: true,
          licenseType: true,
          status: true,
          expirationDate: true,
        },
      },
      enrollments: { select: { id: true, payerName: true, status: true, effectiveDate: true } },
      expirables: { select: { id: true, expirableType: true, status: true, expirationDate: true } },
    },
  });

  if (!provider) {
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: `/api/v1/providers/${id}`,
      status: 404,
      requestId,
    });
    return applyDeprecationByRoute(
      applyRequestIdHeader(
        applyRateLimitHeaders(
          NextResponse.json(
            { error: { code: "not_found", message: "Provider not found" } },
            { status: 404 },
          ),
          auth.rateLimit,
        ),
        requestId,
      ),
      "GET",
      ROUTE_PATH,
    );
  }

  const responseBody = { data: provider };
  const conditional = evaluateConditionalGet(request, responseBody);

  if (conditional.status === "not-modified") {
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: `/api/v1/providers/${id}`,
      status: 304,
      resultCount: 0,
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
    path: `/api/v1/providers/${id}`,
    status: 200,
    resultCount: 1,
    requestId,
  });

  return applyDeprecationByRoute(
    applyRequestIdHeader(
      applyRateLimitHeaders(
        applyEtagHeader(
          NextResponse.json(responseBody),
          conditional.etag,
        ),
        auth.rateLimit,
      ),
      requestId,
    ),
    "GET",
    ROUTE_PATH,
  );
}
