# API Surface

**Audience:** Backend / integration engineers, external consumers.

The platform exposes three API surfaces.

| Surface | Auth | Intended consumer |
|---|---|---|
| tRPC v11 | Auth.js session | Internal (Next.js client + server components) |
| Public REST v1 | API key (Bearer) | External partners |
| FHIR R4 | API key (Bearer) | CMS-0057-F payer / partner integrations |

## 1. tRPC routers

Located at `src/server/api/routers/*.ts`. Each router is a tRPC `router({})`
with public, staff, and admin procedures. Shape per router below; refer to
the source for exact procedures and zod schemas.

| Router | Purpose |
|---|---|
| `admin` | User management, role assignment, system settings |
| `aiGovernance` | Model cards, decision-log review, override workflows |
| `apiKey` | API key CRUD, scope management, rotation |
| `behavioralHealth` | BH specialty data, fidelity checks, NCQA BH PSV |
| `bot` | Bot definitions, ad hoc execution, run history |
| `botOrchestrator` | Orchestrated multi-bot runs, scheduling |
| `cme` | CME requirements, exemptions, evidence |
| `committee` | Meetings, panel selection, decisions, minutes |
| `communication` | Inbox, email send, SMS send, templates |
| `compliance` | NCQA mapping, evidence pull, snapshots |
| `directory` | Provider directory search and filters |
| `document` | Upload metadata, OCR results, signed download |
| `enrollment` | Payer product enrollment lifecycle |
| `evaluation` | OPPE / FPPE submissions, scoring |
| `expirable` | Expiration tracking, renewal nudges |
| `fsmbPdc` | FSMB Practitioner Direct subscriptions and alerts |
| `malpractice` | Insurance carrier verification |
| `medicaid` | State Medicaid enrollment |
| `monitoring` | Continuous monitoring summary, dashboards |
| `ncqa` | Criterion catalog, snapshot generation |
| `npdb` | Initial query + Continuous Query |
| `peerReview` | Peer review intake, RCAs, CAPs |
| `privileging` | Hospital privilege list, OPPE / FPPE links |
| `provider` | Provider CRUD, status transitions, invite token |
| `recredentialing` | Cycle creation, item tracking, completion |
| `reference` | States, payers, specialties, license types |
| `report` | Report definitions, runs, exports |
| `roster` | Monthly roster generation, attestation, SFTP push |
| `sanctions` | Lists, matches, reviewer workflow |
| `task` | Task creation, assignment, completion |
| `telehealth` | Telehealth state coverage |
| `training` | Training plans, completions, NCQA staff training |
| `workHistory` | Work-history verification (manual / automated) |

Authoring convention: each procedure validates input with zod, calls into a
service module under `src/server/services/`, and returns either typed data or
`tRPCError` codes (`UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`, `NOT_FOUND`,
`CONFLICT`, `INTERNAL_SERVER_ERROR`).

## 2. Public REST v1

Base URL: `/api/v1/`. Documented in detail in
[../api/](../api/) (OpenAPI + Bruno collection).

| Endpoint | Method | Scope |
|---|---|---|
| `/api/v1/healthz` | GET | none (public liveness) |
| `/api/v1/providers` | GET | `provider:read` |
| `/api/v1/providers/{id}` | GET | `provider:read` |
| `/api/v1/providers/{id}/credentials/summary` | GET | `provider:read` |
| `/api/v1/providers/{id}/sanctions` | GET | `provider:read` |
| `/api/v1/enrollments` | GET | `enrollment:read` |
| `/api/v1/enrollments/{id}` | GET | `enrollment:read` |
| `/api/v1/rosters/{id}` | GET | `roster:read` |
| `/api/v1/keys/me` | GET | own key info |

All responses are JSON. Errors use the shape
`{ error: { code, message, requestId } }`. PHI fields are stripped server-side
(SSN, DOB, addresses).

Rate limit: 60 req / minute / key by default; configurable per key.

## 3. FHIR R4

Base URL: `/api/fhir/`. Implements selected CMS-0057-F resources.

| Resource | Operations | Notes |
|---|---|---|
| `Practitioner` | read, search | sourced from `Provider` |
| `PractitionerRole` | read, search | from `Specialty`, `HospitalAffiliation` |
| `Organization` | read, search | from `Hospital`, `Payer` |
| `Endpoint` | read | static directory metadata |

Pagination via `Bundle.link.next`. Search parameters: `_id`, `name`, `npi`,
`identifier`, `_lastUpdated`. Bulk export (`$export`) under design.

## 4. Webhooks (inbound)

| Endpoint | Source | Verification |
|---|---|---|
| `/api/integrations/icims/webhook` | iCIMS | shared secret + HMAC |
| `/api/integrations/sendgrid/inbound` | SendGrid Inbound Parse | HMAC + DKIM |
| `/api/integrations/sftp/callback` | internal SFTP runner | shared secret |

## 5. SDK / contract artifacts

- OpenAPI spec — `docs/api/openapi.yaml`.
- Bruno collection — `docs/api/bruno/`.
- Postman collection — `docs/api/postman/E-Credentialing.postman_collection.json`.

## 6. Versioning

- REST: URL-versioned (`/api/v1/`). New non-breaking fields are added freely;
  breaking changes require `/api/v2/` and a 90-day deprecation window.
- FHIR: schema follows official FHIR R4. Search parameter additions are
  non-breaking.
- tRPC: internal; breaking changes flow through code review only.

## 7. Authentication details

- API key generation: admin UI under **Admin → API Keys → New**.
- Plaintext key shown **once**; only the SHA-256 hash is stored.
- Format: `ck_<32-byte hex>`.
- Header: `Authorization: Bearer ck_…`.
- Scopes are additive; least privilege wins.
- Key audit: every call writes `ApiKeyAuditLog`.
