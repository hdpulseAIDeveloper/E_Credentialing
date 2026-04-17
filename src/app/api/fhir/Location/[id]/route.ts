import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  fhirError,
  fhirJson,
} from "@/lib/fhir/helpers";
import { buildLocationResource } from "@/lib/fhir/resources";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: RouteContext) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const loc = await db.directoryLocation.findUnique({ where: { id } });

  if (!loc) {
    auditFhir({
      auth: auth.auth,
      method: "GET",
      path: `/api/fhir/Location/${id}`,
      status: 404,
    });
    return fhirError(404, "not-found", `Location/${id} not found`);
  }

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: `/api/fhir/Location/${id}`,
    status: 200,
  });

  return fhirJson(buildLocationResource(loc));
}
