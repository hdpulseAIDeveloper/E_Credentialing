/**
 * GET /api/v1/providers/[id]/cv.pdf
 *
 * Wave 3.2 — public CVO API endpoint that streams a complete provider
 * Curriculum Vitae as `application/pdf`. Requires an API key with the
 * `providers:cv` scope. Audited like every other v1 request.
 *
 * Response contract:
 *   - 200: `application/pdf` body, `Content-Disposition: attachment`,
 *          `Content-Length: <bytes>`. Filename embeds the provider id
 *          short-hash so deduplication-by-name in customer document
 *          systems is preserved.
 *   - 401: missing / invalid / expired Bearer key.
 *   - 403: key lacks the `providers:cv` scope.
 *   - 404: provider does not exist.
 *
 * No PHI is leaked beyond what is already part of a CV (name, NPI,
 * provider type, education, licensure, board certs, hospital
 * privileges, work history, CME credit log). SSN / DOB / DEA /
 * personal addresses are NOT in the snapshot loader.
 */

import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey, requireScope, v1ErrorResponse } from "../../../middleware";
import { applyRateLimitHeaders } from "@/lib/api/rate-limit";
import { applyRequestIdHeader, resolveRequestId } from "@/lib/api/request-id";
import { auditApiRequest } from "@/lib/api/audit-api";
import { CmeService } from "@/server/services/cme";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = resolveRequestId(request);
  const auth = await authenticateApiKey(request);
  if (!auth.valid) return applyRequestIdHeader(auth.error!, requestId);
  const scopeError = requireScope(auth, "providers:cv", request);
  if (scopeError) return applyRequestIdHeader(scopeError, requestId);

  const { id } = await params;
  const provider = await db.provider.findUnique({
    where: { id },
    select: { id: true, legalLastName: true },
  });
  if (!provider) {
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: `/api/v1/providers/${id}/cv.pdf`,
      status: 404,
      requestId,
    });
    return applyRequestIdHeader(
      applyRateLimitHeaders(
        v1ErrorResponse(404, "not_found", "Provider not found", {}, request),
        auth.rateLimit,
      ),
      requestId,
    );
  }

  const svc = new CmeService({
    db,
    audit: writeAuditLog,
    actor: { id: `apikey:${auth.keyId}`, role: "API_KEY" },
  });

  try {
    const bytes = await svc.renderProviderCvPdf(id);
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: `/api/v1/providers/${id}/cv.pdf`,
      status: 200,
      resultCount: 1,
      requestId,
    });
    const safeName = (provider.legalLastName ?? "provider")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .toLowerCase();
    return applyRequestIdHeader(
      applyRateLimitHeaders(
        new NextResponse(bytes as unknown as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="cv-${safeName}-${id.slice(0, 8)}.pdf"`,
            "Content-Length": String(bytes.byteLength),
            "Cache-Control": "no-store",
          },
        }) as NextResponse,
        auth.rateLimit,
      ),
      requestId,
    );
  } catch (err) {
    console.error(
      `[/api/v1/providers/:id/cv.pdf] generation failed (requestId=${requestId}):`,
      err,
    );
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: `/api/v1/providers/${id}/cv.pdf`,
      status: 500,
      requestId,
    });
    return applyRequestIdHeader(
      applyRateLimitHeaders(
        v1ErrorResponse(500, "cv_generation_failed", "Failed to generate CV PDF", {}, request),
        auth.rateLimit,
      ),
      requestId,
    );
  }
}
