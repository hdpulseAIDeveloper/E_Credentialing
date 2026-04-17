import { db } from "@/server/db";
import {
  authorizeFhir,
  auditFhir,
  buildSearchsetLinks,
  fhirJson,
  parsePaging,
  searchsetBundle,
} from "@/lib/fhir/helpers";
import { buildPractitionerResource } from "@/lib/fhir/resources";

export async function GET(request: Request) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const npi = url.searchParams.get("identifier");
  const name = url.searchParams.get("name");
  const { count, offset } = parsePaging(url);

  const where: Record<string, unknown> = { status: "APPROVED" };
  if (npi) where.npi = npi;
  if (name) {
    where.OR = [
      { legalFirstName: { contains: name, mode: "insensitive" } },
      { legalLastName: { contains: name, mode: "insensitive" } },
    ];
  }

  const [total, providers] = await Promise.all([
    db.provider.count({ where }),
    db.provider.findMany({
      where,
      include: {
        providerType: true,
        profile: true,
        licenses: { where: { status: "ACTIVE" } },
      },
      skip: offset,
      take: count,
      orderBy: { legalLastName: "asc" },
    }),
  ]);

  const baseUrl = `${url.origin}/api/fhir/Practitioner`;
  const links = buildSearchsetLinks(baseUrl, url.searchParams, total, offset, count);

  const entries = providers.map((p) => ({
    fullUrl: `Practitioner/${p.id}`,
    resource: buildPractitionerResource(p),
  }));

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: "/api/fhir/Practitioner",
    status: 200,
    resultCount: entries.length,
    query: { identifier: npi, name, _count: String(count), _offset: String(offset) },
  });

  return fhirJson(searchsetBundle({ total, links, resources: entries }));
}
