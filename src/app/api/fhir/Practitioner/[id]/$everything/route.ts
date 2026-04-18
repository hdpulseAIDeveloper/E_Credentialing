/**
 * GET /api/fhir/Practitioner/[id]/$everything
 *
 * Wave 3.3 — FHIR R4 instance-level operation that returns a `searchset`
 * Bundle containing the practitioner and every directory resource that
 * references them. Modeled after the Patient/$everything operation, this
 * is the canonical CMS-0057-F surveyor flow: one URL, one Bundle, every
 * piece of evidence the regulator needs to spot-check.
 *
 * Bundle contents (in this order):
 *   1. The Practitioner resource itself.
 *   2. Every active DirectoryPractitionerRole for the practitioner.
 *   3. Every Organization referenced by the roles above.
 *   4. Every Location referenced by the roles above.
 *   5. Every Endpoint owned by those Organizations.
 *   6. Every derived HealthcareService backed by those roles.
 *   7. Every derived InsurancePlan backed by ENROLLED Enrollments
 *      for this practitioner.
 *
 * Audit row records the practitioner id and total resource count.
 */

import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  fhirError,
  fhirJson,
} from "@/lib/fhir/helpers";
import {
  buildEndpointResource,
  buildLocationResource,
  buildOrganizationResource,
  buildPractitionerResource,
  buildPractitionerRoleResource,
} from "@/lib/fhir/resources";
import {
  buildHealthcareServiceResource,
  buildInsurancePlanResource,
  deriveHealthcareServices,
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
  const url = new URL(request.url);

  const practitioner = await db.provider.findUnique({
    where: { id },
    include: {
      providerType: true,
      profile: true,
      licenses: true,
    },
  });
  if (!practitioner) {
    auditFhir({
      auth: auth.auth,
      method: "GET",
      path: `/api/fhir/Practitioner/${id}/$everything`,
      status: 404,
    });
    return fhirError(404, "not-found", `Practitioner/${id} not found`);
  }

  const [roles, enrollments] = await Promise.all([
    db.directoryPractitionerRole.findMany({
      where: { providerId: id, active: true },
      include: { provider: true, organization: true, location: true },
    }),
    db.enrollment.findMany({
      where: { providerId: id, status: "ENROLLED" },
      select: { payerName: true, status: true },
    }),
  ]);

  const orgIds = Array.from(new Set(roles.map((r) => r.organizationId)));
  const locIds = Array.from(
    new Set(roles.map((r) => r.locationId).filter((x): x is string => !!x)),
  );

  const [orgs, locs, endpoints] = await Promise.all([
    orgIds.length
      ? db.directoryOrganization.findMany({ where: { id: { in: orgIds } } })
      : Promise.resolve([]),
    locIds.length
      ? db.directoryLocation.findMany({ where: { id: { in: locIds } } })
      : Promise.resolve([]),
    orgIds.length
      ? db.directoryEndpoint.findMany({
          where: { managingOrgId: { in: orgIds } },
        })
      : Promise.resolve([]),
  ]);

  // HealthcareServices for THIS practitioner: derive from this
  // practitioner's roles only. Plans for THIS practitioner: derive from
  // their APPROVED enrollments only.
  const services = deriveHealthcareServices(
    roles.map((r) => ({
      organizationId: r.organizationId,
      locationId: r.locationId,
      specialty: r.specialty,
      active: r.active,
      acceptingNewPatients: r.acceptingNewPatients,
    })),
  );
  const plans = deriveInsurancePlans(enrollments);

  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const locName = new Map(locs.map((l) => [l.id, l.name]));

  // Order matches the FHIR convention for $everything: focal resource
  // first, then every related resource.
  type Entry = { fullUrl: string; resource: Record<string, unknown> };
  const entries: Entry[] = [];

  entries.push({
    fullUrl: `Practitioner/${practitioner.id}`,
    resource: buildPractitionerResource(practitioner),
  });
  for (const r of roles) {
    entries.push({
      fullUrl: `PractitionerRole/${r.id}`,
      resource: buildPractitionerRoleResource(r),
    });
  }
  for (const o of orgs) {
    entries.push({
      fullUrl: `Organization/${o.id}`,
      resource: buildOrganizationResource(o),
    });
  }
  for (const l of locs) {
    entries.push({
      fullUrl: `Location/${l.id}`,
      resource: buildLocationResource(l),
    });
  }
  for (const e of endpoints) {
    entries.push({
      fullUrl: `Endpoint/${e.id}`,
      resource: buildEndpointResource(e),
    });
  }
  for (const hs of services) {
    entries.push({
      fullUrl: `HealthcareService/${hs.id}`,
      resource: buildHealthcareServiceResource(hs, {
        organizationName: orgName.get(hs.organizationId) ?? null,
        locationName: hs.locationId ? (locName.get(hs.locationId) ?? null) : null,
      }),
    });
  }
  for (const p of plans) {
    entries.push({
      fullUrl: `InsurancePlan/${p.id}`,
      resource: buildInsurancePlanResource(p),
    });
  }

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: `/api/fhir/Practitioner/${id}/$everything`,
    status: 200,
    resultCount: entries.length,
  });

  return fhirJson({
    resourceType: "Bundle",
    type: "searchset",
    timestamp: new Date().toISOString(),
    total: entries.length,
    link: [{ relation: "self", url: url.toString() }],
    entry: entries,
  });
}
