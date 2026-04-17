import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  buildSearchsetLinks,
  fhirJson,
  parsePaging,
  searchsetBundle,
} from "@/lib/fhir/helpers";
import { buildPractitionerRoleResource } from "@/lib/fhir/resources";

export async function GET(request: Request) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const practitioner = url.searchParams.get("practitioner");
  const organization = url.searchParams.get("organization");
  const specialty = url.searchParams.get("specialty");
  const { count, offset } = parsePaging(url);

  const where: Record<string, unknown> = { active: true };
  if (practitioner) where.providerId = practitioner;
  if (organization) where.organizationId = organization;
  if (specialty) where.specialty = { contains: specialty, mode: "insensitive" };

  const [total, roles] = await Promise.all([
    db.directoryPractitionerRole.count({ where }),
    db.directoryPractitionerRole.findMany({
      where,
      include: {
        provider: true,
        organization: true,
        location: true,
      },
      skip: offset,
      take: count,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const baseUrl = `${url.origin}/api/fhir/PractitionerRole`;
  const links = buildSearchsetLinks(baseUrl, url.searchParams, total, offset, count);

  const entries = roles.map((r) => ({
    fullUrl: `PractitionerRole/${r.id}`,
    resource: buildPractitionerRoleResource(r),
  }));

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: "/api/fhir/PractitionerRole",
    status: 200,
    resultCount: entries.length,
    query: { practitioner, organization, specialty, _count: String(count), _offset: String(offset) },
  });

  return fhirJson(searchsetBundle({ total, links, resources: entries }));
}
