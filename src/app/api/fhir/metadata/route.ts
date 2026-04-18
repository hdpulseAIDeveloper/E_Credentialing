import { NextResponse } from "next/server";
import { FHIR_CONTENT_TYPE } from "@/lib/fhir/helpers";

/**
 * P2 Gap #16 / Wave 3.3 — FHIR R4 CapabilityStatement.
 *
 * Required by CMS-0057-F so consumers can discover what resources and
 * search parameters this provider directory supports. Conforms to the
 * DaVinci PDex Plan-Net IG.
 *
 * Wave 3.3 additions:
 *   - HealthcareService (derived from DirectoryPractitionerRole tuples)
 *   - InsurancePlan (derived from APPROVED Enrollment.payerName)
 *   - Practitioner $everything operation
 *
 * The `/metadata` endpoint is intentionally **unauthenticated** — every
 * FHIR server must expose its capabilities publicly so clients can
 * discover them without first being provisioned a key.
 */

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:6015"
).replace(/\/+$/, "");

const PUBLISHED_DATE = "2026-04-18";
const SOFTWARE_VERSION = "1.1.0"; // Wave 3.3 bump.

export async function GET() {
  const capability = {
    resourceType: "CapabilityStatement",
    status: "active",
    date: PUBLISHED_DATE,
    publisher: "Essen Medical Associates",
    kind: "instance",
    software: {
      name: "Essen Credentialing Platform",
      version: SOFTWARE_VERSION,
    },
    implementation: {
      description: "Essen Credentialing FHIR R4 Provider Directory (CVO platform)",
      url: `${APP_URL}/api/fhir`,
    },
    fhirVersion: "4.0.1",
    format: ["application/fhir+json", "json"],
    implementationGuide: [
      "http://hl7.org/fhir/us/davinci-pdex-plan-net/ImplementationGuide/hl7.fhir.us.davinci-pdex-plan-net",
    ],
    rest: [
      {
        mode: "server",
        security: {
          cors: true,
          service: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
                  code: "OAuth",
                  display: "Bearer token (API key) authentication",
                },
              ],
            },
          ],
        },
        resource: [
          {
            type: "Practitioner",
            profile:
              "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-Practitioner",
            interaction: [{ code: "read" }, { code: "search-type" }],
            searchParam: [
              { name: "identifier", type: "token" },
              { name: "name", type: "string" },
              { name: "_count", type: "number" },
              { name: "_offset", type: "number" },
            ],
            operation: [
              {
                name: "everything",
                definition:
                  "http://hl7.org/fhir/OperationDefinition/Practitioner-everything",
              },
            ],
          },
          {
            type: "PractitionerRole",
            profile:
              "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-PractitionerRole",
            interaction: [{ code: "read" }, { code: "search-type" }],
            searchParam: [
              { name: "practitioner", type: "reference" },
              { name: "organization", type: "reference" },
              { name: "specialty", type: "token" },
            ],
          },
          {
            type: "Organization",
            profile:
              "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-Organization",
            interaction: [{ code: "read" }, { code: "search-type" }],
            searchParam: [
              { name: "name", type: "string" },
              { name: "identifier", type: "token" },
            ],
          },
          {
            type: "Location",
            profile:
              "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-Location",
            interaction: [{ code: "read" }, { code: "search-type" }],
            searchParam: [
              { name: "name", type: "string" },
              { name: "address-state", type: "string" },
              { name: "organization", type: "reference" },
            ],
          },
          {
            type: "Endpoint",
            profile:
              "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-Endpoint",
            interaction: [{ code: "read" }, { code: "search-type" }],
            searchParam: [{ name: "organization", type: "reference" }],
          },
          {
            type: "HealthcareService",
            profile:
              "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-HealthcareService",
            interaction: [{ code: "read" }, { code: "search-type" }],
            searchParam: [
              { name: "organization", type: "reference" },
              { name: "location", type: "reference" },
              { name: "specialty", type: "token" },
            ],
          },
          {
            type: "InsurancePlan",
            profile:
              "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-InsurancePlan",
            interaction: [{ code: "read" }, { code: "search-type" }],
            searchParam: [{ name: "name", type: "string" }],
          },
        ],
      },
    ],
  };

  return NextResponse.json(capability, {
    headers: { "Content-Type": FHIR_CONTENT_TYPE },
  });
}
