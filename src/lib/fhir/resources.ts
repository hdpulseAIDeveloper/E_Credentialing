/**
 * P2 Gap #16 — FHIR R4 resource builders for the CMS-0057-F provider directory.
 *
 * Each builder takes a Prisma row and returns the matching FHIR R4 resource.
 * Conformance target: DaVinci PDex Plan-Net IG (the CMS-recommended profile
 * for provider directory).
 */

import type {
  DirectoryEndpoint,
  DirectoryLocation,
  DirectoryOrganization,
  DirectoryPractitionerRole,
  License,
  Provider,
  ProviderProfile,
  ProviderType,
} from "@prisma/client";

const NPI_SYSTEM = "http://hl7.org/fhir/sid/us-npi";
const TAX_ID_SYSTEM = "http://hl7.org/fhir/sid/us-tin";

export function buildPractitionerResource(
  p: Provider & {
    providerType: ProviderType;
    profile: ProviderProfile | null;
    licenses: License[];
  }
) {
  return {
    resourceType: "Practitioner",
    id: p.id,
    meta: {
      profile: [
        "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-Practitioner",
      ],
    },
    identifier: [
      ...(p.npi ? [{ system: NPI_SYSTEM, value: p.npi }] : []),
    ],
    active: p.status === "APPROVED",
    name: [
      {
        use: "official",
        family: p.legalLastName,
        given: [
          p.legalFirstName,
          ...(p.legalMiddleName ? [p.legalMiddleName] : []),
        ],
      },
    ],
    qualification: p.licenses.map((lic) => ({
      identifier: [{ value: lic.licenseNumber }],
      code: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0360",
            code: p.providerType.abbreviation,
          },
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
  };
}

export function buildPractitionerRoleResource(
  role: DirectoryPractitionerRole & {
    provider: Provider;
    organization: DirectoryOrganization;
    location: DirectoryLocation | null;
  }
) {
  return {
    resourceType: "PractitionerRole",
    id: role.id,
    meta: {
      profile: [
        "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-PractitionerRole",
      ],
    },
    active: role.active,
    period: {
      start: role.startDate?.toISOString().split("T")[0],
      end: role.endDate?.toISOString().split("T")[0],
    },
    practitioner: {
      reference: `Practitioner/${role.providerId}`,
      display: `${role.provider.legalFirstName} ${role.provider.legalLastName}`,
    },
    organization: {
      reference: `Organization/${role.organizationId}`,
      display: role.organization.name,
    },
    ...(role.location && {
      location: [
        {
          reference: `Location/${role.locationId}`,
          display: role.location.name,
        },
      ],
    }),
    ...(role.specialty && {
      specialty: [
        {
          text: role.specialty,
          coding: [{ system: "http://nucc.org/provider-taxonomy", display: role.specialty }],
        },
      ],
    }),
    ...(role.acceptingNewPatients !== null && {
      extension: [
        {
          url: "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/newpatients",
          valueBoolean: role.acceptingNewPatients,
        },
      ],
    }),
  };
}

export function buildOrganizationResource(o: DirectoryOrganization) {
  return {
    resourceType: "Organization",
    id: o.id,
    meta: {
      profile: [
        "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-Organization",
      ],
    },
    active: o.active,
    type: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/organization-type",
            code: o.type === "PROV" ? "prov" : o.type.toLowerCase(),
          },
        ],
      },
    ],
    name: o.name,
    ...(o.alias && { alias: [o.alias] }),
    identifier: [
      ...(o.npi ? [{ system: NPI_SYSTEM, value: o.npi }] : []),
      ...(o.taxId ? [{ system: TAX_ID_SYSTEM, value: o.taxId }] : []),
    ],
    telecom: [
      ...(o.phone ? [{ system: "phone", value: o.phone }] : []),
      ...(o.email ? [{ system: "email", value: o.email }] : []),
      ...(o.website ? [{ system: "url", value: o.website }] : []),
    ],
    ...(o.partOfId && {
      partOf: { reference: `Organization/${o.partOfId}` },
    }),
  };
}

export function buildLocationResource(l: DirectoryLocation) {
  return {
    resourceType: "Location",
    id: l.id,
    meta: {
      profile: [
        "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-Location",
      ],
    },
    status: l.status,
    name: l.name,
    ...(l.alias && { alias: [l.alias] }),
    ...(l.description && { description: l.description }),
    telecom: [
      ...(l.phone ? [{ system: "phone", value: l.phone }] : []),
      ...(l.fax ? [{ system: "fax", value: l.fax }] : []),
    ],
    address:
      l.street || l.city || l.state || l.postalCode
        ? {
            use: "work",
            type: "physical",
            line: l.street ? [l.street] : undefined,
            city: l.city ?? undefined,
            state: l.state ?? undefined,
            postalCode: l.postalCode ?? undefined,
            country: l.country ?? undefined,
          }
        : undefined,
    ...(l.managingOrgId && {
      managingOrganization: { reference: `Organization/${l.managingOrgId}` },
    }),
  };
}

export function buildEndpointResource(e: DirectoryEndpoint) {
  return {
    resourceType: "Endpoint",
    id: e.id,
    meta: {
      profile: [
        "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-Endpoint",
      ],
    },
    status: e.status,
    connectionType: {
      system: "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
      code:
        e.connectionType === "FHIR_BASE"
          ? "hl7-fhir-rest"
          : e.connectionType === "DIRECT_SECURE_MESSAGING"
            ? "direct-project"
            : e.connectionType === "EHR_API"
              ? "hl7-fhir-rest"
              : "other",
    },
    name: e.name,
    ...(e.managingOrgId && {
      managingOrganization: { reference: `Organization/${e.managingOrgId}` },
    }),
    payloadType: [
      {
        text: e.payloadType ?? "any",
      },
    ],
    payloadMimeType: ["application/fhir+json"],
    address: e.address,
  };
}
