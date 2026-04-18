/**
 * GET /api/fhir/HealthcareService/[id]
 *
 * Wave 3.3 — single-instance read for a derived HealthcareService.
 * Walks the same deriver as the searchset endpoint and looks up the
 * matching id; 404s if none of the active practitioner-role tuples
 * hashes to that id.
 */

import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  fhirError,
  fhirJson,
} from "@/lib/fhir/helpers";
import {
  buildHealthcareServiceResource,
  deriveHealthcareServices,
} from "@/lib/fhir/derived";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const roles = await db.directoryPractitionerRole.findMany({
    where: { active: true },
    select: {
      organizationId: true,
      locationId: true,
      specialty: true,
      active: true,
      acceptingNewPatients: true,
    },
  });
  const services = deriveHealthcareServices(roles);
  const hs = services.find((s) => s.id === id);
  if (!hs) {
    auditFhir({
      auth: auth.auth,
      method: "GET",
      path: `/api/fhir/HealthcareService/${id}`,
      status: 404,
    });
    return fhirError(404, "not-found", `HealthcareService/${id} not found`);
  }

  const [org, loc] = await Promise.all([
    db.directoryOrganization.findUnique({
      where: { id: hs.organizationId },
      select: { name: true },
    }),
    hs.locationId
      ? db.directoryLocation.findUnique({
          where: { id: hs.locationId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: `/api/fhir/HealthcareService/${id}`,
    status: 200,
    resultCount: 1,
  });
  return fhirJson(
    buildHealthcareServiceResource(hs, {
      organizationName: org?.name ?? null,
      locationName: loc?.name ?? null,
    }),
  );
}
