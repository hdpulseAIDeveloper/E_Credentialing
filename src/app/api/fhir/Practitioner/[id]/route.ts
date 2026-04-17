import { db } from "@/server/db";
import {
  auditFhir,
  authorizeFhir,
  fhirError,
  fhirJson,
} from "@/lib/fhir/helpers";
import { buildPractitionerResource } from "@/lib/fhir/resources";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: RouteContext) {
  const auth = await authorizeFhir(request, "fhir:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const provider = await db.provider.findUnique({
    where: { id },
    include: {
      providerType: true,
      profile: true,
      licenses: { where: { status: "ACTIVE" } },
    },
  });

  if (!provider || provider.status !== "APPROVED") {
    auditFhir({
      auth: auth.auth,
      method: "GET",
      path: `/api/fhir/Practitioner/${id}`,
      status: 404,
    });
    return fhirError(404, "not-found", `Practitioner/${id} not found`);
  }

  auditFhir({
    auth: auth.auth,
    method: "GET",
    path: `/api/fhir/Practitioner/${id}`,
    status: 200,
  });

  return fhirJson(buildPractitionerResource(provider));
}
