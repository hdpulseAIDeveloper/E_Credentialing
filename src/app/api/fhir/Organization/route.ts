import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  buildSearchsetLinks,
  fhirJson,
  parsePaging,
  searchsetBundle,
} from "@/lib/fhir/helpers";
import { buildOrganizationResource } from "@/lib/fhir/resources";

export async function GET(request: Request) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  const npi = url.searchParams.get("identifier");
  const { count, offset } = parsePaging(url);

  const where: Record<string, unknown> = { active: true };
  if (npi) where.npi = npi;
  if (name) where.name = { contains: name, mode: "insensitive" };

  const [total, orgs] = await Promise.all([
    db.directoryOrganization.count({ where }),
    db.directoryOrganization.findMany({
      where,
      skip: offset,
      take: count,
      orderBy: { name: "asc" },
    }),
  ]);

  const baseUrl = `${url.origin}/api/fhir/Organization`;
  const links = buildSearchsetLinks(baseUrl, url.searchParams, total, offset, count);

  const entries = orgs.map((o) => ({
    fullUrl: `Organization/${o.id}`,
    resource: buildOrganizationResource(o),
  }));

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: "/api/fhir/Organization",
    status: 200,
    resultCount: entries.length,
    query: { name, identifier: npi, _count: String(count), _offset: String(offset) },
  });

  return fhirJson(searchsetBundle({ total, links, resources: entries }));
}
