/**
 * Wave 5.2 — public sandbox API: FHIR R4 CapabilityStatement.
 *
 * Mirrors the shape of /api/fhir/metadata but is hard-coded with the
 * sandbox base URL so a FHIR client can be pointed at it directly.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESOURCES = [
  {
    type: "Practitioner",
    profile: "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-Practitioner",
    interaction: [{ code: "read" }, { code: "search-type" }],
    searchParam: [
      { name: "name", type: "string" },
      { name: "identifier", type: "token" },
      { name: "_lastUpdated", type: "date" },
    ],
  },
  {
    type: "PractitionerRole",
    profile: "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-PractitionerRole",
    interaction: [{ code: "read" }, { code: "search-type" }],
    searchParam: [
      { name: "practitioner", type: "reference" },
      { name: "organization", type: "reference" },
      { name: "specialty", type: "token" },
    ],
  },
  {
    type: "HealthcareService",
    profile: "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-HealthcareService",
    interaction: [{ code: "read" }, { code: "search-type" }],
  },
  {
    type: "InsurancePlan",
    profile: "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-InsurancePlan",
    interaction: [{ code: "read" }, { code: "search-type" }],
  },
  {
    type: "Endpoint",
    profile: "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-Endpoint",
    interaction: [{ code: "read" }],
  },
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = `${url.origin}/api/sandbox/v1/fhir`;

  return NextResponse.json(
    {
      resourceType: "CapabilityStatement",
      status: "active",
      date: new Date().toISOString(),
      kind: "instance",
      software: {
        name: "E-Credentialing CVO Platform — sandbox",
        version: "v1",
      },
      implementation: {
        description: "Sandbox FHIR R4 — synthetic data only",
        url: base,
      },
      fhirVersion: "4.0.1",
      format: ["application/fhir+json"],
      rest: [
        {
          mode: "server",
          resource: RESOURCES,
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/fhir+json; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "X-Sandbox": "ecred-v1",
      },
    },
  );
}
