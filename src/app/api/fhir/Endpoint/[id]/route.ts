import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  fhirError,
  fhirJson,
} from "@/lib/fhir/helpers";
import { buildEndpointResource } from "@/lib/fhir/resources";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: RouteContext) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const ep = await db.directoryEndpoint.findUnique({ where: { id } });

  if (!ep) {
    auditFhir({
      auth: auth.auth,
      method: "GET",
      path: `/api/fhir/Endpoint/${id}`,
      status: 404,
    });
    return fhirError(404, "not-found", `Endpoint/${id} not found`);
  }

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: `/api/fhir/Endpoint/${id}`,
    status: 200,
  });

  return fhirJson(buildEndpointResource(ep));
}
