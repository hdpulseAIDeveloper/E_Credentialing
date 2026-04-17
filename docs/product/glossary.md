# Glossary

> Terms used across product, functional, and technical documentation. When
> a term has both a clinical meaning and a platform meaning, both are noted.

| Term | Meaning |
|---|---|
| **ABMS / ABIM / ABFM / NCCPA** | Specialty boards used for board-certification PSV |
| **ACGME** | Accreditation council for graduate medical education |
| **AMA Masterfile** | American Medical Association's master physician database |
| **API key** | Long-lived bearer token used by external systems to call the public REST / FHIR APIs |
| **Attestation** | Provider's signed statement that intake data is true and complete; required to revoke the invite token |
| **Audit log** | Append-only, HMAC-chained record of every meaningful action on the platform |
| **AUDIT_HMAC_KEY** | The HMAC secret that chains the audit log; required in production |
| **Auth.js** | Authentication library (formerly NextAuth) used for staff sign-in |
| **Availity** | Clearinghouse used for several payer enrollments |
| **BBQ / BullMQ** | Redis-backed job queue used by the worker container |
| **Behavioral health PSV** | NCQA-required PSV variant for BH practitioners |
| **Bot** | Headless-browser automation that performs PSV against a specific source |
| **Bot orchestrator** | Coordinator that fans out and gathers bot results for a provider |
| **CAQH ProView** | Universal provider data utility integrated for application data import/export |
| **CMS-0057-F** | CMS rule requiring FHIR Patient Access + Provider Directory APIs |
| **Committee** | Credentialing committee that votes on each file |
| **Continuous monitoring** | Daily / weekly checks for license, sanctions, NPDB changes |
| **CR 1–8** | NCQA credentialing standards |
| **CVO** | Credentials verification organization |
| **DEA** | Drug Enforcement Administration; controlled-substance registration |
| **Decision log** | Record of every AI suggestion + reviewer outcome |
| **ECFMG** | Educational commission for foreign medical graduates |
| **Enrollment** | Provider's status with a specific payer + product |
| **Entra ID** | Microsoft's IdP (formerly Azure AD); staff SSO |
| **Expirable** | Any credential with an expiration date that requires renewal tracking |
| **FHIR R4** | HL7's healthcare data interchange standard |
| **FPPE** | Focused Professional Practice Evaluation |
| **FSMB Practitioner Direct** | Continuous monitoring subscription from FSMB |
| **iCIMS** | HR platform that creates new-hire records consumed by the platform |
| **IDOR** | Insecure Direct Object Reference — class of authorization bug avoided by row-level checks |
| **Magic link** | One-time URL containing a JWT used by providers to sign in |
| **Master Test Plan** | The XLSX in `docs/testing/` that the QA team executes |
| **NCQA** | National Committee for Quality Assurance |
| **NPDB** | National Practitioner Data Bank |
| **NPDB CQ** | NPDB Continuous Query — subscription that alerts on new reports |
| **NPI** | National Provider Identifier (CMS) |
| **OPPE** | Ongoing Professional Practice Evaluation |
| **PARCS** | The legacy ESSEN credentialing system being replaced |
| **Payer product** | Specific plan / network within a payer (e.g., Aetna Medicare Advantage) |
| **PHI** | Protected Health Information |
| **Privilege** | Specific clinical activity a provider is authorized to perform at a hospital |
| **PSV** | Primary-Source Verification |
| **Recredentialing** | Periodic full re-verification (default: every 36 months) |
| **Roster** | Monthly file submitted to a payer listing active providers |
| **Sanctions match** | Hit on OIG, SAM, NY OMIG, or state list requiring review |
| **SLA** | Service-Level Agreement; turnaround targets per process step |
| **Telehealth state** | A US state in which a provider holds a telehealth-eligible license |
| **tRPC** | Type-safe RPC layer between Next.js client and server |
| **UPDS** | CAQH's universal provider data set |
| **VerityStream / CredentialStream / symplr** | Competing credentialing platforms |
| **Webhook** | Inbound HTTP callback (e.g., from iCIMS or SendGrid) |
