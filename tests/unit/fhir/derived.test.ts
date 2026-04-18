/**
 * Wave 3.3 — pure-deriver unit tests for HealthcareService and
 * InsurancePlan. These functions are the heart of the public CMS-0057-F
 * directory: any bug here ripples into the surveyor evidence chain, so
 * we cover the dedup, sort, accepting-new-patients merge, status filter,
 * and resource shape exhaustively.
 */
import { describe, expect, it } from "vitest";
import {
  buildHealthcareServiceResource,
  buildInsurancePlanResource,
  deriveHealthcareServices,
  deriveInsurancePlans,
  healthcareServiceId,
  insurancePlanId,
  type EnrollmentSlim,
  type PractitionerRoleSlim,
} from "@/lib/fhir/derived";

// ─── healthcareServiceId / deriveHealthcareServices ─────────────────────────

describe("healthcareServiceId", () => {
  it("is deterministic for the same inputs", () => {
    expect(healthcareServiceId("o1", "l1", "Cardiology")).toBe(
      healthcareServiceId("o1", "l1", "Cardiology"),
    );
  });
  it("differs for different specialties on the same org/location", () => {
    expect(healthcareServiceId("o1", "l1", "Cardiology")).not.toBe(
      healthcareServiceId("o1", "l1", "Pediatrics"),
    );
  });
  it("differs for null vs non-null location", () => {
    expect(healthcareServiceId("o1", null, "Cardio")).not.toBe(
      healthcareServiceId("o1", "l1", "Cardio"),
    );
  });
  it("uses the `hs-` prefix and a stable length", () => {
    const id = healthcareServiceId("o1", "l1", "X");
    expect(id).toMatch(/^hs-[0-9a-f]{16}$/);
  });
});

function role(over: Partial<PractitionerRoleSlim> = {}): PractitionerRoleSlim {
  return {
    organizationId: "o1",
    locationId: "l1",
    specialty: "Cardiology",
    active: true,
    acceptingNewPatients: null,
    ...over,
  };
}

describe("deriveHealthcareServices", () => {
  it("dedupes (org, location, specialty) tuples", () => {
    const services = deriveHealthcareServices([role(), role(), role()]);
    expect(services).toHaveLength(1);
    expect(services[0]!.practitionerRoleCount).toBe(3);
  });

  it("keeps active=false rows out of the output", () => {
    const services = deriveHealthcareServices([
      role({ active: false }),
      role({ active: false, organizationId: "o2" }),
    ]);
    expect(services).toEqual([]);
  });

  it("emits one service per distinct tuple, in stable id order", () => {
    const services = deriveHealthcareServices([
      role({ specialty: "Cardiology" }),
      role({ specialty: "Pediatrics" }),
      role({ organizationId: "o2", specialty: "Cardiology" }),
    ]);
    expect(services).toHaveLength(3);
    const ids = services.map((s) => s.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it("merges acceptingNewPatients: any yes wins; all-no => false; mixed null => null", () => {
    const yesWins = deriveHealthcareServices([
      role({ acceptingNewPatients: true }),
      role({ acceptingNewPatients: false }),
    ])[0]!;
    expect(yesWins.acceptingNewPatients).toBe(true);

    const allNo = deriveHealthcareServices([
      role({ acceptingNewPatients: false }),
      role({ acceptingNewPatients: false }),
    ])[0]!;
    expect(allNo.acceptingNewPatients).toBe(false);

    const allNull = deriveHealthcareServices([role(), role()])[0]!;
    expect(allNull.acceptingNewPatients).toBeNull();
  });

  it("handles a null specialty without throwing", () => {
    const services = deriveHealthcareServices([
      role({ specialty: null }),
      role({ specialty: null }),
      role({ specialty: "Cardiology" }),
    ]);
    expect(services).toHaveLength(2);
  });
});

describe("buildHealthcareServiceResource", () => {
  it("emits the PDex Plan-Net profile and the providedBy reference", () => {
    const r = buildHealthcareServiceResource(
      {
        id: "hs-x",
        organizationId: "o1",
        locationId: "l1",
        specialty: "Cardio",
        practitionerRoleCount: 2,
        acceptingNewPatients: true,
      },
      { organizationName: "Acme Health", locationName: "Main Clinic" },
    );
    expect(r.resourceType).toBe("HealthcareService");
    expect(r.meta.profile?.[0]).toMatch(/plannet-HealthcareService$/);
    expect((r.providedBy as { reference: string }).reference).toBe(
      "Organization/o1",
    );
    expect((r.location as Array<{ reference: string }>)[0]!.reference).toBe(
      "Location/l1",
    );
    const ext = (r.extension as Array<{ valueBoolean: boolean }>)[0]!;
    expect(ext.valueBoolean).toBe(true);
  });

  it("omits location[] when locationId is null", () => {
    const r = buildHealthcareServiceResource({
      id: "hs-y",
      organizationId: "o1",
      locationId: null,
      specialty: null,
      practitionerRoleCount: 1,
      acceptingNewPatients: null,
    });
    expect(r.location).toBeUndefined();
    expect(r.name).toBe("General services");
  });
});

// ─── insurancePlanId / deriveInsurancePlans ─────────────────────────────────

describe("insurancePlanId", () => {
  it("is deterministic and case-insensitive", () => {
    expect(insurancePlanId("Aetna")).toBe(insurancePlanId("aetna"));
    expect(insurancePlanId("Aetna")).toBe(insurancePlanId(" Aetna "));
  });
  it("differs for different payers", () => {
    expect(insurancePlanId("Aetna")).not.toBe(insurancePlanId("Cigna"));
  });
  it("uses the `ip-` prefix and a stable length", () => {
    expect(insurancePlanId("United")).toMatch(/^ip-[0-9a-f]{16}$/);
  });
});

function enr(over: Partial<EnrollmentSlim> = {}): EnrollmentSlim {
  return { payerName: "Aetna", status: "ENROLLED", ...over };
}

describe("deriveInsurancePlans", () => {
  it("only keeps ENROLLED enrollments", () => {
    const plans = deriveInsurancePlans([
      enr({ status: "DRAFT" }),
      enr({ status: "SUBMITTED" }),
      enr({ status: "DENIED" }),
    ]);
    expect(plans).toEqual([]);
  });

  it("dedupes by case-insensitive normalized payerName", () => {
    const plans = deriveInsurancePlans([
      enr({ payerName: "Aetna" }),
      enr({ payerName: "AETNA" }),
      enr({ payerName: " aetna " }),
      enr({ payerName: "Cigna" }),
    ]);
    expect(plans).toHaveLength(2);
    const aetna = plans.find((p) => p.id === insurancePlanId("Aetna"))!;
    expect(aetna.enrollmentCount).toBe(3);
  });

  it("sorts the output alphabetically by payerName", () => {
    const plans = deriveInsurancePlans([
      enr({ payerName: "Zeta" }),
      enr({ payerName: "Alpha" }),
      enr({ payerName: "Mid" }),
    ]);
    expect(plans.map((p) => p.payerName)).toEqual(["Alpha", "Mid", "Zeta"]);
  });
});

describe("buildInsurancePlanResource", () => {
  it("emits the PDex Plan-Net profile and the enrollment-count extension", () => {
    const r = buildInsurancePlanResource({
      id: "ip-x",
      payerName: "Aetna",
      enrollmentCount: 7,
    });
    expect(r.resourceType).toBe("InsurancePlan");
    expect((r.meta as { profile: string[] }).profile[0]).toMatch(
      /plannet-InsurancePlan$/,
    );
    expect(r.name).toBe("Aetna");
    expect(r.status).toBe("active");
    const ext = (r.extension as Array<{ valueInteger: number }>)[0]!;
    expect(ext.valueInteger).toBe(7);
  });
});
