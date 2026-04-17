import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  fhirError,
  fhirJson,
} from "@/lib/fhir/helpers";
import { buildPractitionerRoleResource } from "@/lib/fhir/resources";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: RouteContext) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const role = await db.directoryPractitionerRole.findUnique({
    where: { id },
    include: { provider: true, organization: true, location: true },
  });

  if (!role) {
    auditFhir({
      auth: auth.auth,
      method: "GET",
      path: `/api/fhir/PractitionerRole/${id}`,
      status: 404,
    });
    return fhirError(404, "not-found", `PractitionerRole/${id} not found`);
  }

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: `/api/fhir/PractitionerRole/${id}`,
    status: 200,
  });

  return fhirJson(buildPractitionerRoleResource(role));
}
