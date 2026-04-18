/**
 * GET /api/fhir/HealthcareService
 *
 * Wave 3.3 — searchset of derived HealthcareService resources. One
 * HealthcareService is emitted per unique
 * (organizationId, locationId, specialty) tuple across all *active*
 * DirectoryPractitionerRole rows.
 *
 * Search params:
 *   - organization (reference) — filter by managing org id
 *   - location     (reference) — filter by location id
 *   - specialty    (token)     — case-insensitive contains match
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
  buildHealthcareServiceResource,
  deriveHealthcareServices,
} from "@/lib/fhir/derived";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const orgFilter = url.searchParams.get("organization");
  const locFilter = url.searchParams.get("location");
  const specFilter = url.searchParams.get("specialty");
  const { count, offset } = parsePaging(url);

  const where: Record<string, unknown> = { active: true };
  if (orgFilter) where.organizationId = orgFilter;
  if (locFilter) where.locationId = locFilter;
  if (specFilter) {
    where.specialty = { contains: specFilter, mode: "insensitive" };
  }

  const roles = await db.directoryPractitionerRole.findMany({
    where,
    select: {
      organizationId: true,
      locationId: true,
      specialty: true,
      active: true,
      acceptingNewPatients: true,
    },
  });
  const services = deriveHealthcareServices(roles);
  const total = services.length;
  const window = services.slice(offset, offset + count);

  // Hydrate names for nicer references in the bundle. Keep this to a
  // single round-trip per resource type.
  const orgIds = Array.from(new Set(window.map((s) => s.organizationId)));
  const locIds = Array.from(
    new Set(window.map((s) => s.locationId).filter((x): x is string => !!x)),
  );
  const [orgs, locs] = await Promise.all([
    orgIds.length
      ? db.directoryOrganization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    locIds.length
      ? db.directoryLocation.findMany({
          where: { id: { in: locIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const locName = new Map(locs.map((l) => [l.id, l.name]));

  const baseUrl = `${url.origin}/api/fhir/HealthcareService`;
  const links = buildSearchsetLinks(baseUrl, url.searchParams, total, offset, count);
  const entries = window.map((hs) => ({
    fullUrl: `HealthcareService/${hs.id}`,
    resource: buildHealthcareServiceResource(hs, {
      organizationName: orgName.get(hs.organizationId) ?? null,
      locationName: hs.locationId ? (locName.get(hs.locationId) ?? null) : null,
    }),
  }));

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: "/api/fhir/HealthcareService",
    status: 200,
    resultCount: entries.length,
    query: {
      organization: orgFilter,
      location: locFilter,
      specialty: specFilter,
      _count: String(count),
      _offset: String(offset),
    },
  });

  return fhirJson(searchsetBundle({ total, links, resources: entries }));
}
