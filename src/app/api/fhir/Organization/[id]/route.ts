import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  fhirError,
  fhirJson,
} from "@/lib/fhir/helpers";
import { buildOrganizationResource } from "@/lib/fhir/resources";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: RouteContext) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const org = await db.directoryOrganization.findUnique({ where: { id } });

  if (!org) {
    auditFhir({
      auth: auth.auth,
      method: "GET",
      path: `/api/fhir/Organization/${id}`,
      status: 404,
    });
    return fhirError(404, "not-found", `Organization/${id} not found`);
  }

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: `/api/fhir/Organization/${id}`,
    status: 200,
  });

  return fhirJson(buildOrganizationResource(org));
}
