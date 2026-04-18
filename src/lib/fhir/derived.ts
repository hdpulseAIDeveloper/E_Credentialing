/**
 * src/lib/fhir/derived.ts
 *
 * Wave 3.3 — pure derivers for FHIR resources we expose at the public
 * directory but do *not* model as their own Prisma tables yet.
 *
 *   - HealthcareService is derived from DirectoryPractitionerRole rows by
 *     grouping on (organizationId, locationId, specialty). Each unique
 *     tuple becomes one HealthcareService instance. The id is a
 *     deterministic SHA-1 hash of the tuple so it is stable across
 *     requests, page refreshes, and consumers that cache by id.
 *
 *   - InsurancePlan is derived from the distinct `payerName` values on
 *     Enrollment rows whose status is ENROLLED (i.e. live in the payer
 *     directory). Each payer becomes one InsurancePlan. The id is a
 *     deterministic slug.
 *
 * Both derivers are pure functions that take already-fetched Prisma
 * rows so they're trivially unit-testable.
 *
 * In Wave 5.x we'll back both with proper modeled tables
 * (`DirectoryHealthcareService`, `DirectoryInsurancePlan`) so customers
 * can override the derived values; the public contract stays the same.
 */

import { createHash } from "crypto";

// ─── HealthcareService ──────────────────────────────────────────────────────

export interface PractitionerRoleSlim {
  organizationId: string;
  locationId: string | null;
  specialty: string | null;
  active: boolean;
  acceptingNewPatients: boolean | null;
}

export interface DerivedHealthcareService {
  id: string;
  organizationId: string;
  locationId: string | null;
  specialty: string | null;
  /** How many active practitioner-roles back this service. */
  practitionerRoleCount: number;
  acceptingNewPatients: boolean | null;
}

/**
 * Stable id for a derived HealthcareService. Same inputs always produce
 * the same id; never collides for distinct input tuples (SHA-1 truncated
 * to 16 hex chars = 64 bits of entropy, more than enough for a single
 * tenant's directory cardinality).
 */
export function healthcareServiceId(
  organizationId: string,
  locationId: string | null,
  specialty: string | null,
): string {
  const key = `${organizationId}|${locationId ?? "_"}|${specialty ?? "_"}`;
  return "hs-" + createHash("sha1").update(key).digest("hex").slice(0, 16);
}

/**
 * Given the active practitioner-role rows for a tenant, return the
 * deduplicated HealthcareService set. Roles whose `active=false` are
 * ignored (they should not appear in the public directory). Within a
 * group, `acceptingNewPatients` is `true` if *any* backing role accepts,
 * `false` if all explicitly refuse, and `null` if none have an opinion.
 */
export function deriveHealthcareServices(
  roles: PractitionerRoleSlim[],
): DerivedHealthcareService[] {
  const groups = new Map<
    string,
    {
      key: { organizationId: string; locationId: string | null; specialty: string | null };
      count: number;
      accepts: { yes: number; no: number };
    }
  >();
  for (const r of roles) {
    if (!r.active) continue;
    const id = healthcareServiceId(r.organizationId, r.locationId, r.specialty);
    let g = groups.get(id);
    if (!g) {
      g = {
        key: {
          organizationId: r.organizationId,
          locationId: r.locationId,
          specialty: r.specialty,
        },
        count: 0,
        accepts: { yes: 0, no: 0 },
      };
      groups.set(id, g);
    }
    g.count += 1;
    if (r.acceptingNewPatients === true) g.accepts.yes += 1;
    else if (r.acceptingNewPatients === false) g.accepts.no += 1;
  }

  const out: DerivedHealthcareService[] = [];
  for (const [id, g] of groups) {
    let accepting: boolean | null = null;
    if (g.accepts.yes > 0) accepting = true;
    else if (g.accepts.no > 0 && g.accepts.yes === 0) accepting = false;
    out.push({
      id,
      organizationId: g.key.organizationId,
      locationId: g.key.locationId,
      specialty: g.key.specialty,
      practitionerRoleCount: g.count,
      acceptingNewPatients: accepting,
    });
  }
  // Stable order so callers can paginate / cache by index.
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export function buildHealthcareServiceResource(
  hs: DerivedHealthcareService,
  ctx: {
    organizationName?: string | null;
    locationName?: string | null;
  } = {},
) {
  return {
    resourceType: "HealthcareService",
    id: hs.id,
    meta: {
      profile: [
        "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-HealthcareService",
      ],
    },
    active: true,
    providedBy: {
      reference: `Organization/${hs.organizationId}`,
      ...(ctx.organizationName ? { display: ctx.organizationName } : {}),
    },
    ...(hs.locationId
      ? {
          location: [
            {
              reference: `Location/${hs.locationId}`,
              ...(ctx.locationName ? { display: ctx.locationName } : {}),
            },
          ],
        }
      : {}),
    name: hs.specialty ?? "General services",
    ...(hs.specialty
      ? {
          specialty: [
            {
              text: hs.specialty,
              coding: [
                {
                  system: "http://nucc.org/provider-taxonomy",
                  display: hs.specialty,
                },
              ],
            },
          ],
        }
      : {}),
    extension: [
      {
        url: "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/newpatients",
        valueBoolean: hs.acceptingNewPatients ?? false,
      },
    ],
  };
}

// ─── InsurancePlan ─────────────────────────────────────────────────────────

export interface EnrollmentSlim {
  payerName: string;
  status: string;
}

export interface DerivedInsurancePlan {
  id: string;
  payerName: string;
  /** How many ENROLLED enrollments back this plan. */
  enrollmentCount: number;
}

/**
 * Stable, URL-safe id for an InsurancePlan derived from a payerName.
 * Format: `ip-<sha1-of-name-truncated>`. We don't slug the human name
 * itself because two payers can collide on slug (e.g. "Aetna Health"
 * vs "AetnaHealth").
 */
export function insurancePlanId(payerName: string): string {
  const normalized = payerName.trim().toLowerCase();
  return "ip-" + createHash("sha1").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Given the enrollment rows for a tenant, return the deduplicated
 * InsurancePlan list. Only `ENROLLED` enrollments contribute, since
 * an in-flight enrollment is not part of the publishable directory.
 */
export function deriveInsurancePlans(
  enrollments: EnrollmentSlim[],
): DerivedInsurancePlan[] {
  const groups = new Map<string, { name: string; count: number }>();
  for (const e of enrollments) {
    if (e.status !== "ENROLLED") continue;
    const id = insurancePlanId(e.payerName);
    let g = groups.get(id);
    if (!g) {
      g = { name: e.payerName, count: 0 };
      groups.set(id, g);
    }
    g.count += 1;
  }
  const out: DerivedInsurancePlan[] = [];
  for (const [id, g] of groups) {
    out.push({ id, payerName: g.name, enrollmentCount: g.count });
  }
  out.sort((a, b) => a.payerName.localeCompare(b.payerName));
  return out;
}

export function buildInsurancePlanResource(plan: DerivedInsurancePlan) {
  return {
    resourceType: "InsurancePlan",
    id: plan.id,
    meta: {
      profile: [
        "http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/plannet-InsurancePlan",
      ],
    },
    status: "active",
    name: plan.payerName,
    type: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/insurance-plan-type",
            code: "medical",
            display: "Medical",
          },
        ],
      },
    ],
    extension: [
      {
        url: "http://essen.health/fhir/StructureDefinition/enrollment-count",
        valueInteger: plan.enrollmentCount,
      },
    ],
  };
}
