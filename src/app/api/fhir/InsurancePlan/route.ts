/**
 * GET /api/fhir/InsurancePlan
 *
 * Wave 3.3 — searchset of InsurancePlan resources derived from distinct
 * `Enrollment.payerName` values whose status is ENROLLED (live in the
 * payer directory).
 *
 * Search params:
 *   - name (string)            — case-insensitive contains match
 *   - _count, _offset          — paging (helpers.ts)
 */

import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  buildSearchsetLinks,
  fhirJson,
  parsePaging,
  searchsetBundle,
} from "@/lib/fhir/helpers";
import {
  buildInsurancePlanResource,
  deriveInsurancePlans,
} from "@/lib/fhir/derived";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const nameFilter = url.searchParams.get("name");
  const { count, offset } = parsePaging(url);

  // Always pull ENROLLED enrollments; further name-filter happens
  // post-derivation so the deduplicated id remains stable regardless
  // of which substring the caller searches on.
  const enrollments = await db.enrollment.findMany({
    where: { status: "ENROLLED" },
    select: { payerName: true, status: true },
  });
  let plans = deriveInsurancePlans(enrollments);
  if (nameFilter) {
    const needle = nameFilter.toLowerCase();
    plans = plans.filter((p) => p.payerName.toLowerCase().includes(needle));
  }
  const total = plans.length;
  const window = plans.slice(offset, offset + count);

  const baseUrl = `${url.origin}/api/fhir/InsurancePlan`;
  const links = buildSearchsetLinks(baseUrl, url.searchParams, total, offset, count);
  const entries = window.map((p) => ({
    fullUrl: `InsurancePlan/${p.id}`,
    resource: buildInsurancePlanResource(p),
  }));

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: "/api/fhir/InsurancePlan",
    status: 200,
    resultCount: entries.length,
    query: {
      name: nameFilter,
      _count: String(count),
      _offset: String(offset),
    },
  });

  return fhirJson(searchsetBundle({ total, links, resources: entries }));
}
