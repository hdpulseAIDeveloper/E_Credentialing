/**
 * Wave 3.3 — CapabilityStatement contract tests.
 *
 * The CapabilityStatement is the public, unauthenticated handshake every
 * CMS-0057-F consumer reads first. If we silently drop a resource from
 * it (or forget to advertise the $everything operation) any downstream
 * client may abandon the integration without error. The test pins the
 * shape so a regression is impossible.
 */
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/fhir/metadata/route";

interface SearchParam {
  name: string;
  type: string;
}
interface ResourceEntry {
  type: string;
  profile?: string;
  interaction: Array<{ code: string }>;
  searchParam?: SearchParam[];
  operation?: Array<{ name: string; definition: string }>;
}

describe("CapabilityStatement (/api/fhir/metadata)", () => {
  it("advertises FHIR R4 + the PDex Plan-Net IG", async () => {
    const res = await GET();
    const body = (await res.json()) as {
      resourceType: string;
      fhirVersion: string;
      implementationGuide: string[];
      software: { version: string };
    };
    expect(body.resourceType).toBe("CapabilityStatement");
    expect(body.fhirVersion).toBe("4.0.1");
    expect(body.implementationGuide.some((u) => u.includes("davinci-pdex-plan-net"))).toBe(
      true,
    );
    // Wave 3.3 software version bump.
    expect(body.software.version).toMatch(/^1\.[1-9]\d*\./);
  });

  it("advertises every resource type the CMS-0057-F surveyor expects, including HealthcareService and InsurancePlan", async () => {
    const res = await GET();
    const body = (await res.json()) as {
      rest: Array<{ resource: ResourceEntry[] }>;
    };
    const types = body.rest[0]!.resource.map((r) => r.type).sort();
    expect(types).toEqual(
      [
        "Endpoint",
        "HealthcareService",
        "InsurancePlan",
        "Location",
        "Organization",
        "Practitioner",
        "PractitionerRole",
      ].sort(),
    );
  });

  it("advertises the Practitioner $everything operation", async () => {
    const res = await GET();
    const body = (await res.json()) as {
      rest: Array<{ resource: ResourceEntry[] }>;
    };
    const practitioner = body.rest[0]!.resource.find((r) => r.type === "Practitioner")!;
    expect(practitioner.operation).toBeDefined();
    expect(practitioner.operation!.some((op) => op.name === "everything")).toBe(true);
  });

  it("advertises the PDex profile on every PDex resource", async () => {
    const res = await GET();
    const body = (await res.json()) as {
      rest: Array<{ resource: ResourceEntry[] }>;
    };
    for (const r of body.rest[0]!.resource) {
      expect(r.profile, `missing profile on ${r.type}`).toMatch(
        /davinci-pdex-plan-net/,
      );
    }
  });

  it("HealthcareService advertises the search params we implement", async () => {
    const res = await GET();
    const body = (await res.json()) as {
      rest: Array<{ resource: ResourceEntry[] }>;
    };
    const hs = body.rest[0]!.resource.find((r) => r.type === "HealthcareService")!;
    const names = (hs.searchParam ?? []).map((s) => s.name).sort();
    expect(names).toEqual(["location", "organization", "specialty"]);
    expect(hs.interaction.map((i) => i.code).sort()).toEqual(["read", "search-type"]);
  });
});
