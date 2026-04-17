import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  buildSearchsetLinks,
  fhirJson,
  parsePaging,
  searchsetBundle,
} from "@/lib/fhir/helpers";
import { buildEndpointResource } from "@/lib/fhir/resources";

export async function GET(request: Request) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const organization = url.searchParams.get("organization");
  const { count, offset } = parsePaging(url);

  const where: Record<string, unknown> = { status: "active" };
  if (organization) where.managingOrgId = organization;

  const [total, endpoints] = await Promise.all([
    db.directoryEndpoint.count({ where }),
    db.directoryEndpoint.findMany({
      where,
      skip: offset,
      take: count,
      orderBy: { name: "asc" },
    }),
  ]);

  const baseUrl = `${url.origin}/api/fhir/Endpoint`;
  const links = buildSearchsetLinks(baseUrl, url.searchParams, total, offset, count);

  const entries = endpoints.map((e) => ({
    fullUrl: `Endpoint/${e.id}`,
    resource: buildEndpointResource(e),
  }));

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: "/api/fhir/Endpoint",
    status: 200,
    resultCount: entries.length,
    query: { organization, _count: String(count), _offset: String(offset) },
  });

  return fhirJson(searchsetBundle({ total, links, resources: entries }));
}
