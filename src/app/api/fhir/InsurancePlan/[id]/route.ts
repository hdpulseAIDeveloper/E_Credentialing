/**
 * GET /api/fhir/InsurancePlan/[id]
 *
 * Wave 3.3 — single-instance read for a derived InsurancePlan.
 */

import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  fhirError,
  fhirJson,
} from "@/lib/fhir/helpers";
import {
  buildInsurancePlanResource,
  deriveInsurancePlans,
} from "@/lib/fhir/derived";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const enrollments = await db.enrollment.findMany({
    where: { status: "ENROLLED" },
    select: { payerName: true, status: true },
  });
  const plans = deriveInsurancePlans(enrollments);
  const plan = plans.find((p) => p.id === id);
  if (!plan) {
    auditFhir({
      auth: auth.auth,
      method: "GET",
      path: `/api/fhir/InsurancePlan/${id}`,
      status: 404,
    });
    return fhirError(404, "not-found", `InsurancePlan/${id} not found`);
  }
  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: `/api/fhir/InsurancePlan/${id}`,
    status: 200,
    resultCount: 1,
  });
  return fhirJson(buildInsurancePlanResource(plan));
}
