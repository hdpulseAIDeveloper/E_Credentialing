import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  buildSearchsetLinks,
  fhirJson,
  parsePaging,
  searchsetBundle,
} from "@/lib/fhir/helpers";
import { buildLocationResource } from "@/lib/fhir/resources";

export async function GET(request: Request) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  const state = url.searchParams.get("address-state");
  const organization = url.searchParams.get("organization");
  const { count, offset } = parsePaging(url);

  const where: Record<string, unknown> = { status: "active" };
  if (name) where.name = { contains: name, mode: "insensitive" };
  if (state) where.state = state.toUpperCase();
  if (organization) where.managingOrgId = organization;

  const [total, locations] = await Promise.all([
    db.directoryLocation.count({ where }),
    db.directoryLocation.findMany({
      where,
      skip: offset,
      take: count,
      orderBy: { name: "asc" },
    }),
  ]);

  const baseUrl = `${url.origin}/api/fhir/Location`;
  const links = buildSearchsetLinks(baseUrl, url.searchParams, total, offset, count);

  const entries = locations.map((l) => ({
    fullUrl: `Location/${l.id}`,
    resource: buildLocationResource(l),
  }));

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: "/api/fhir/Location",
    status: 200,
    resultCount: entries.length,
    query: { name, "address-state": state, organization, _count: String(count), _offset: String(offset) },
  });

  return fhirJson(searchsetBundle({ total, links, resources: entries }));
}
