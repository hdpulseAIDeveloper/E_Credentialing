import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey } from "../../v1/middleware";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.valid) return auth.error;

  if (!auth.permissions?.["fhir:read"]) {
    return NextResponse.json(
      { resourceType: "OperationOutcome", issue: [{ severity: "error", code: "forbidden", diagnostics: "API key lacks fhir:read permission" }] },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const npi = url.searchParams.get("identifier");
  const name = url.searchParams.get("name");
  const _count = Math.min(50, Math.max(1, parseInt(url.searchParams.get("_count") || "20")));

  const where: Record<string, unknown> = { status: "APPROVED" };
  if (npi) where.npi = npi;
  if (name) {
    where.OR = [
      { legalFirstName: { contains: name, mode: "insensitive" } },
      { legalLastName: { contains: name, mode: "insensitive" } },
    ];
  }

  const providers = await db.provider.findMany({
    where,
    include: {
      providerType: true,
      profile: true,
      licenses: { where: { status: "ACTIVE" } },
    },
    take: _count,
  });

  const entries = providers.map((p) => ({
    fullUrl: `Practitioner/${p.id}`,
    resource: {
      resourceType: "Practitioner",
      id: p.id,
      identifier: [
        ...(p.npi ? [{ system: "http://hl7.org/fhir/sid/us-npi", value: p.npi }] : []),
      ],
      active: p.status === "APPROVED",
      name: [
        {
          use: "official",
          family: p.legalLastName,
          given: [p.legalFirstName, ...(p.legalMiddleName ? [p.legalMiddleName] : [])],
        },
      ],
      qualification: p.licenses.map((lic) => ({
        identifier: [{ value: lic.licenseNumber }],
        code: {
          coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0360", code: p.providerType.abbreviation }],
          text: lic.licenseType,
        },
        period: {
          start: lic.issueDate?.toISOString().split("T")[0],
          end: lic.expirationDate?.toISOString().split("T")[0],
        },
        issuer: { display: `${lic.state} Medical Board` },
      })),
      ...(p.profile?.specialtyPrimary && {
        extension: [
          {
            url: "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification",
            valueCodeableConcept: { text: p.profile.specialtyPrimary },
          },
        ],
      }),
    },
  }));

  const bundle = {
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries,
  };

  return NextResponse.json(bundle, {
    headers: { "Content-Type": "application/fhir+json" },
  });
}
