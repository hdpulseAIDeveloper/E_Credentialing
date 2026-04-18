# Per-flow card: `Practitioner/$everything`

> **STANDARD.md §5 (per-flow).** Wave 3.3 added the FHIR R4 instance-level
> `$everything` operation on Practitioner. This is the canonical
> CMS-0057-F surveyor flow: one URL, one Bundle, every piece of
> directory evidence the regulator needs to spot-check.

| Field | Value |
| --- | --- |
| Flow id | `flow.fhir-practitioner-everything` |
| Owner | Engineering × Compliance |
| Standards covered | CMS-0057-F (Provider Directory), DaVinci PDex Plan-Net IG |
| Trigger surface | `GET /api/fhir/Practitioner/{id}/$everything` |
| Auth | Bearer API key with the `fhir:read` permission |
| Source file | `src/app/api/fhir/Practitioner/[id]/$everything/route.ts` |
| Pure derivers | `src/lib/fhir/derived.ts` |

## Bundle contents

The response is a `Bundle` of type `searchset`. Entries are emitted in
this order so a surveyor reading the JSON top-to-bottom encounters the
focal resource first and walks outward through references:

1. `Practitioner` — the focal resource (404 if the practitioner does not exist).
2. `PractitionerRole[]` — every active role for the practitioner.
3. `Organization[]` — every organization referenced by those roles.
4. `Location[]` — every location referenced by those roles.
5. `Endpoint[]` — every endpoint owned by those organizations.
6. `HealthcareService[]` — every derived service for those role tuples.
7. `InsurancePlan[]` — every derived plan for the practitioner's
   `ENROLLED` enrollments.

The Bundle's `total` field is the count of entries. There is no
pagination on this operation: the per-practitioner cardinality is
bounded (in practice a few dozen entries even for the most fragmented
provider).

## Derived resources

Two of the resource types in the Bundle are *derived* from existing
Prisma rows rather than backed by their own table:

- **HealthcareService** — one per unique
  `(organizationId, locationId, specialty)` tuple across the
  practitioner's active `DirectoryPractitionerRole` rows. Id is the
  deterministic SHA-1 of the tuple (see `healthcareServiceId`).
- **InsurancePlan** — one per distinct `Enrollment.payerName` whose
  status is `ENROLLED`. Id is the deterministic SHA-1 of the
  case-insensitive normalized payer name (see `insurancePlanId`).

Wave 5.x will introduce modeled `DirectoryHealthcareService` and
`DirectoryInsurancePlan` tables so customers can override the derived
fields. Ids will remain stable.

## Audit chain

Every successful response writes a single `api.get` audit row
(`actorRole = "API_KEY"`, `entityType = "ApiRequest"`) with
`afterState = { method, path, status: 200, resultCount }`. 404s are
audited identically with `status: 404, resultCount: undefined`.

## Failure modes

| Failure | Detection | Mitigation |
| --- | --- | --- |
| Missing / invalid Bearer | 401 OperationOutcome | Caller provisions a valid key |
| Key lacks `fhir:read` | 403 OperationOutcome | Customer rotates key with the new scope |
| Practitioner does not exist | 404 OperationOutcome | Caller checked stale id |
| Practitioner has zero roles / enrollments | 200 with a Bundle of size 1 | Operational |
| Rate-limit exceeded | 429 OperationOutcome with `code: throttled` | Caller backs off |

## Test surface

- Pure derivers: `tests/unit/fhir/derived.test.ts` (18 cases — id
  stability, dedup, sort, accepting-new-patients merge, status filter).
- CapabilityStatement contract: `tests/unit/fhir/capability-statement.test.ts`
  (5 cases — pins resource list + advertises `$everything` op).
- E2E (Wave 4.4 visual / Wave 4.3 ZAP active will exercise the route
  end-to-end).

## Last verified

2026-04-18 — Wave 3.3 introduction.
