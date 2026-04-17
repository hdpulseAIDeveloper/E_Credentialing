import { NextResponse } from "next/server";
import { FHIR_CONTENT_TYPE } from "@/lib/fhir/helpers";

/**
 * P2 Gap #16 — FHIR R4 CapabilityStatement.
 *
 * Required by CMS-0057-F so consumers can discover what resources and
 * search parameters this provider directory supports. Conforms to the
 * DaVinci PDex Plan-Net IG.
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

export async function GET() {
  const capability = {
    resourceType: "CapabilityStatement",
    status: "active",
    date: "2026-04-16",
    publisher: "Essen Medical Associates",
    kind: "instance",
    software: {
      name: "Essen Credentialing Platform",
      version: "1.0.0",
    },
    implementation: {
      description: "Essen Credentialing FHIR R4 Provider Directory",
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
        ],
      },
    ],
  };

  return NextResponse.json(capability, {
    headers: { "Content-Type": FHIR_CONTENT_TYPE },
  });
}
