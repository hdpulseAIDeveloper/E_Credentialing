import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey } from "../../v1/middleware";
import { auditApiRequest } from "@/lib/api/audit-api";

const FHIR_CONTENT_TYPE = "application/fhir+json";

function operationOutcome(severity: "error" | "warning", code: string, diagnostics: string) {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity, code, diagnostics }],
  };
}

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.valid) {
    // Re-wrap auth error as FHIR OperationOutcome.
    const original = auth.error!;
    return NextResponse.json(
      operationOutcome("error", original.status === 429 ? "throttled" : "security", `auth_${original.status}`),
      { status: original.status, headers: { "Content-Type": FHIR_CONTENT_TYPE } }
    );
  }

  if (!auth.permissions?.["fhir:read"]) {
    void auditApiRequest({ apiKeyId: auth.keyId!, method: "GET", path: "/api/fhir/Practitioner", status: 403 });
    return NextResponse.json(
      operationOutcome("error", "forbidden", "API key lacks fhir:read permission"),
      { status: 403, headers: { "Content-Type": FHIR_CONTENT_TYPE } }
    );
  }

  const url = new URL(request.url);
  const npi = url.searchParams.get("identifier");
  const name = url.searchParams.get("name");
  const _count = Math.min(100, Math.max(1, parseInt(url.searchParams.get("_count") || "20", 10)));
  const _offset = Math.max(0, parseInt(url.searchParams.get("_offset") || "0", 10));

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
      skip: _offset,
      take: _count,
      orderBy: { legalLastName: "asc" },
    }),
  ]);

  const baseUrl = `${url.origin}/api/fhir/Practitioner`;
  const buildLink = (offset: number, count: number) => {
    const u = new URL(baseUrl);
    if (npi) u.searchParams.set("identifier", npi);
    if (name) u.searchParams.set("name", name);
    u.searchParams.set("_count", String(count));
    u.searchParams.set("_offset", String(offset));
    return u.toString();
  };

  const link: Array<{ relation: string; url: string }> = [
    { relation: "self", url: buildLink(_offset, _count) },
  ];
  if (_offset > 0) {
    link.push({ relation: "previous", url: buildLink(Math.max(0, _offset - _count), _count) });
  }
  if (_offset + _count < total) {
    link.push({ relation: "next", url: buildLink(_offset + _count, _count) });
  }

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
          coding: [
            { system: "http://terminology.hl7.org/CodeSystem/v2-0360", code: p.providerType.abbreviation },
          ],
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
    total,
    link,
    entry: entries,
  };

  void auditApiRequest({
    apiKeyId: auth.keyId!,
    method: "GET",
    path: "/api/fhir/Practitioner",
    status: 200,
    resultCount: entries.length,
    query: { identifier: npi, name, _count: String(_count), _offset: String(_offset) },
  });

  return NextResponse.json(bundle, {
    headers: { "Content-Type": FHIR_CONTENT_TYPE },
  });
}
