# Privacy Notice — Provider Credentialing Portal

**Status:** DRAFT — pending Legal + Compliance review.
**Version:** `v1.0-draft`
**Effective date:** to be set on approval
**Renders at:** `/legal/privacy` (linked from every page footer)
**Code reference:** `PRIVACY_NOTICE_SUMMARY` in `src/lib/legal/copy.ts` for
the inline summary; the full text below is rendered verbatim on the
`/legal/privacy` page.

---

## 1. Who we are

ESSEN Health Care, Inc. ("**ESSEN**", "**we**", "**us**", or "**our**")
operates this Provider Credentialing Portal (the "**Portal**") to verify,
credential, recredential, and enroll healthcare providers. ESSEN is the
**data controller** for information collected through the Portal.

For privacy questions, write to:

> ESSEN Health Care, Attn: Privacy Officer
> [privacy@essenmed.com](mailto:privacy@essenmed.com)
> *(physical address to be confirmed by Legal)*

## 2. What this notice covers

This notice describes the personal information we collect about
**healthcare providers** who use the Portal to submit a credentialing
application or otherwise interact with their credentialing record. It
**does not** apply to ESSEN patients (those are governed by ESSEN's HIPAA
Notice of Privacy Practices) or to ESSEN employees (governed by HR
policies).

## 3. Information we collect

We collect the following categories of personal information about you when
you complete an application or interact with the Portal:

- **Identifiers** — full legal name, date of birth, Social Security number,
  National Provider Identifier (NPI), Drug Enforcement Administration (DEA)
  registration number, CAQH ID, professional license numbers, hospital
  privileges identifiers.
- **Contact information** — email address, mailing address, telephone
  numbers, emergency contact details.
- **Education and training** — schools attended, degrees, dates,
  internships, residencies, fellowships, board certifications, and
  continuing medical education records.
- **Work history** — past and present employers, positions, dates, gaps,
  reasons for departure, references.
- **Credentialing history** — license actions, hospital privilege actions,
  malpractice claims, settlements, judgments, sanctions, exclusions, and
  any related documentation you upload or that we receive from primary
  sources.
- **Insurance and identifiers issued to you** — malpractice insurance
  policy numbers and certificates, payer identifiers, Medicare/Medicaid
  enrollment identifiers.
- **Health information related to credentialing** — only to the extent
  required to evaluate your fitness to practice (for example, attestations
  about physical and mental fitness if asked by a payer or hospital).
- **Authentication and audit data** — your IP address, browser type and
  version, device fingerprint, sign-in timestamps, page-view timestamps,
  and the contents of every change you make to your application.
- **Communications** — messages and documents you send to ESSEN through the
  Portal or in response to outreach about your file.

## 4. How we collect information

We collect information:

- Directly from you when you complete the application, upload documents,
  or respond to messages.
- From your employer or recruiter when they create your initial provider
  record (typically through our integration with iCIMS).
- From **primary sources** that we query on your behalf, including state
  medical boards, the American Medical Association Masterfile, the
  Educational Commission for Foreign Medical Graduates (ECFMG), the
  Accreditation Council for Graduate Medical Education (ACGME),
  certifying boards (e.g., ABMS, ABIM, ABFM, NCCPA), the Drug
  Enforcement Administration, the OIG List of Excluded Individuals and
  Entities (OIG-LEIE), the System for Award Management (SAM.gov), state
  Medicaid exclusion lists (including New York OMIG), the National
  Practitioner Data Bank (NPDB), the Federation of State Medical Boards
  Practitioner Data Center (FSMB-PDC), CAQH ProView, and your malpractice
  insurance carrier.
- From your hospital affiliations, training programs, and references that
  you list on your application.
- Automatically when you use the Portal (logs, cookies, audit data).

## 5. Why we collect information

We use your information to:

- Evaluate your application for credentialing or recredentialing.
- Perform initial and continuous **primary-source verification** of every
  credential you list, as required by NCQA Credentialing standards, the
  Joint Commission's Medical Staff standards, and applicable state and
  federal law.
- Enroll you with health plans, government payers, and clearinghouses.
- Generate monthly rosters required by payer contracts.
- Track expiration dates and notify you when documents need renewal.
- Monitor for new sanctions, exclusions, license actions, and NPDB reports
  that affect your credentials.
- Comply with our legal, regulatory, and accreditation obligations.
- Maintain a **tamper-evident audit log** of all credentialing decisions
  and the evidence supporting them.
- Investigate and respond to suspected fraud, abuse, or misuse of the
  Portal.

We do **not** sell your personal information.

## 6. Who we share information with

We share your information only with:

- **ESSEN credentialing, compliance, and committee personnel** with a
  legitimate business need.
- **Health plans, government payers, and clearinghouses** to which you
  have asked to be enrolled or which require roster reporting.
- **Hospitals and other facilities** at which you hold or seek
  privileges.
- **Primary sources** (listed above) when we query them about you.
- **Our subprocessors**, who help us run the Portal under written contract
  and confidentiality obligations: Microsoft Azure (hosting, storage, key
  management, document AI), SendGrid (email delivery), Azure Communication
  Services (SMS), and the credential-verification automation we operate.
- **Auditors and regulators**, when required, to demonstrate that we
  perform credentialing in accordance with NCQA, the Joint Commission,
  CMS, state law, and our health-plan delegated agreements.
- **Law enforcement, courts, and other authorities**, when legally
  compelled to do so or when necessary to protect the rights, safety, or
  property of ESSEN, our patients, or others.

We require every subprocessor to execute appropriate Business Associate
Agreements (BAAs) and data-processing agreements, and we maintain a
current subprocessor list on request.

## 7. Where we store information; international transfers

The Portal runs in **Microsoft Azure data centers in the United States**.
Your information is processed and stored in the United States. If you
access the Portal from outside the United States, your information will
be transferred to and processed in the United States.

## 8. How long we keep information

We retain credentialing records, primary-source verification evidence, and
audit logs for at least the period required by:

- NCQA Credentialing standards (currently 10 years from the credentialing
  decision and from each recredentialing cycle),
- the Joint Commission Medical Staff standards,
- applicable state Medicaid retention rules (some states require longer
  retention; we follow the longest applicable requirement),
- and our delegated-credentialing agreements with health plans.

When the longest applicable retention period ends, we securely delete or
anonymize your information unless a legal hold or open inquiry requires
continued retention.

## 9. How we protect information

We protect your information with administrative, technical, and physical
safeguards appropriate to its sensitivity, including:

- **Encryption in transit** (TLS 1.2 or higher).
- **Application-layer encryption** for Social Security number, date of
  birth, home address, and other sensitive identifiers (AES-256-GCM).
- **Document storage** in an Azure Blob container with no public access;
  documents are downloaded only through short-lived signed URLs.
- **Authentication** using your work email and your employer's identity
  provider for staff, and a single-use signed magic-link token for
  providers; multi-factor authentication is enforced for staff.
- **Tamper-evident audit logs** with HMAC-SHA256 chaining; deletions and
  truncations are blocked at the database level.
- **Antivirus scanning** of every uploaded file before it is stored.
- **Role-based access controls** restricting visibility to staff who need
  it.
- **Annual penetration testing** and continuous vulnerability scanning.

No system is perfectly secure. If you suspect your account or data has
been compromised, contact us immediately at
[security@essenmed.com](mailto:security@essenmed.com).

## 10. Your rights

Depending on the laws that apply to you, you may have the right to:

- **Access** the personal information we hold about you;
- **Correct** inaccurate or incomplete information;
- **Receive a copy** of your information in a portable format;
- **Object to or restrict** certain uses of your information; and
- **File a complaint** with a privacy regulator if you believe we have
  violated your rights.

To exercise these rights, contact
[privacy@essenmed.com](mailto:privacy@essenmed.com). We will verify your
identity before responding and will respond within the timelines required
by law (generally 30 to 45 days). Some information must be retained to
satisfy our credentialing, accreditation, and legal obligations, and we
will explain any limits when we respond.

If you are a California resident, additional rights under the California
Consumer Privacy Act may apply; see our California Privacy Notice (link to
be added by Legal) for details.

## 11. Cookies and tracking

The Portal uses only **strictly necessary cookies and similar
technologies** to keep you signed in, remember your form progress, and
protect against fraud. We do not use third-party advertising cookies or
cross-site tracking. See our [Cookie & Session Notice](cookie-notice.md)
for details.

## 12. Children

The Portal is intended only for licensed healthcare providers and
authorized ESSEN personnel. We do not knowingly collect information from
children under 18.

## 13. Changes to this notice

We may update this notice from time to time. The version number and
effective date at the top of this notice will change when we do, and we
will record the change in our public change log. If a change materially
affects how we use your information, we will notify you by email and ask
you to acknowledge the new version the next time you sign in.

## 14. Contact us

- Privacy questions: [privacy@essenmed.com](mailto:privacy@essenmed.com)
- Security incidents: [security@essenmed.com](mailto:security@essenmed.com)
- Credentialing questions: [cred_onboarding@essenmed.com](mailto:cred_onboarding@essenmed.com)

## Review checklist for Legal

- [ ] Confirm controller / address for the Privacy Officer.
- [ ] Confirm the subprocessor list is complete and accurate.
- [ ] Confirm retention periods (10 years; consider longer for specific
      states).
- [ ] Confirm rights statement covers all jurisdictions where ESSEN
      operates (NY, plus any state with telehealth enrollment).
- [ ] Decide whether to add a separate California Privacy Notice link.
- [ ] Confirm the cookie statement (no third-party / advertising) reflects
      reality and stays accurate.
