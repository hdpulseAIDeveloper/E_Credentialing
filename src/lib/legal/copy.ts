/**
 * Canonical source of legal / policy text used in the application.
 *
 * Every piece of provider-facing legal language renders from this
 * module — components must NEVER hard-code legal text inline. The
 * markdown documents under `docs/legal/` are the human-readable
 * authoring source for Legal + Compliance review; the constants here
 * are the authoritative runtime source for the code. The two are
 * kept mechanically in sync per the change procedure in
 * `docs/legal/README.md`.
 *
 * Versioning rule: `LEGAL_COPY_VERSION` is bumped any time **any**
 * document changes in a non-cosmetic way (typo fixes are cosmetic).
 * Every attestation audit log entry records the version the provider
 * agreed to (`afterState.legalCopyVersion`), so historical
 * attestations remain enforceable even after the language evolves.
 */

// ---------------------------------------------------------------------------
// Bundle metadata
// ---------------------------------------------------------------------------

export const LEGAL_COPY_VERSION = "v1.0-draft" as const;
export const LEGAL_COPY_STATUS = "DRAFT" as const;
export const LEGAL_COPY_LAST_REVIEWED_AT = "2026-04-17" as const;
/** Set when Legal stamps this bundle. While DRAFT, this stays null. */
export const LEGAL_COPY_EFFECTIVE_DATE: string | null = null;

export const LEGAL_CONTACTS = {
  privacyOfficer: "privacy@essenmed.com",
  security: "security@essenmed.com",
  credentialing: "cred_onboarding@essenmed.com",
} as const;

// ---------------------------------------------------------------------------
// Block primitives used by the public /legal/* pages
// ---------------------------------------------------------------------------

export type LegalBlock =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "list"; ordered?: boolean; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] };

export interface LegalDocument {
  /** Document title rendered as <h1>. */
  title: string;
  /** Optional one-line lead/summary rendered immediately under the title. */
  lead?: string;
  /** Document version (matches LEGAL_COPY_VERSION today). */
  version: string;
  /** Effective date — null while DRAFT, ISO date once approved. */
  effectiveDate: string | null;
  status: typeof LEGAL_COPY_STATUS;
  /** Document body, rendered top-to-bottom. */
  blocks: LegalBlock[];
}

// ---------------------------------------------------------------------------
// Attestation
// ---------------------------------------------------------------------------

export interface AttestationQuestion {
  /** 1-indexed display id; stable identifier referenced in the audit log. */
  id: number;
  text: string;
}

export const ATTESTATION_HEADING = "Attestation & Electronic Signature";

export const ATTESTATION_LEAD =
  "Please read each statement below carefully. By checking the box next " +
  "to each statement, you are certifying that the statement is true. You " +
  "must acknowledge every statement to submit your application. The date " +
  "and time of your signature, your IP address, and your browser " +
  "fingerprint will be recorded with the attestation in our audit log.";

export const ATTESTATION_QUESTIONS: readonly AttestationQuestion[] = [
  {
    id: 1,
    text:
      "I certify that all information I have provided in this application " +
      "— including identity, education, training, licensure, " +
      "certifications, work history, malpractice history, hospital " +
      "affiliations, sanctions history, and references — is complete, " +
      "accurate, and true to the best of my knowledge.",
  },
  {
    id: 2,
    text:
      "I understand that any misrepresentation, falsification, or " +
      "material omission in this application — whether discovered before " +
      "or after a credentialing decision — may result in denial, " +
      "suspension, or revocation of my credentials, privileges, or " +
      "participation, and may be reported to the National Practitioner " +
      "Data Bank, state licensing boards, and other authorities as " +
      "required by law.",
  },
  {
    id: 3,
    text:
      "I have disclosed every current or prior license, registration, DEA " +
      "registration, board certification, hospital affiliation, " +
      "malpractice claim, settlement, judgment, sanction, exclusion, " +
      "voluntary or involuntary surrender, restriction, suspension, " +
      "revocation, non-renewal, denial, investigation, or pending action " +
      "in any jurisdiction.",
  },
  {
    id: 4,
    text:
      "I am not currently excluded, suspended, or debarred from " +
      "participation in any federal or state health-care program, " +
      "including Medicare, Medicaid, TRICARE, the U.S. Department of " +
      "Veterans Affairs, the U.S. Department of Health and Human Services " +
      "Office of Inspector General (OIG-LEIE), the General Services " +
      "Administration System for Award Management (SAM.gov), or any state " +
      "Medicaid program.",
  },
  {
    id: 5,
    text:
      "I authorize ESSEN Health Care and its agents to perform " +
      "primary-source verification of every credential, license, " +
      "certification, education, training, work history, malpractice " +
      "insurance, hospital affiliation, and sanction history listed in " +
      "this application, and to query the National Practitioner Data " +
      "Bank, the Federation of State Medical Boards, the OIG-LEIE, " +
      "SAM.gov, applicable state Medicaid exclusion lists, and any other " +
      "primary source ESSEN deems appropriate, on an initial and " +
      "continuous basis for as long as I hold credentials with ESSEN.",
  },
  {
    id: 6,
    text:
      "I authorize the release of information by every person, hospital, " +
      "payer, professional society, school, training program, licensing " +
      "or certifying board, government agency, malpractice insurance " +
      "carrier, and other entity that has any record of my training, " +
      "qualifications, competence, performance, or conduct, directly to " +
      "ESSEN Health Care or its credentials verification agent, and I " +
      "release each such person or entity from any and all liability for " +
      "providing this information in good faith.",
  },
  {
    id: 7,
    text:
      "I understand that I have a continuing obligation to notify ESSEN " +
      "Health Care, in writing, within thirty (30) days of any change to " +
      "the information in this application, including but not limited to: " +
      "any new sanction, restriction, investigation, malpractice claim, " +
      "change in licensure or DEA status, change in board certification, " +
      "loss of hospital privileges, change in practice location, or " +
      "change in contact information.",
  },
  {
    id: 8,
    text:
      "I have read and agree to the Provider Portal Terms of Service, the " +
      "Privacy Notice, and the Electronic Signature Disclosure that " +
      "appear at the bottom of this page.",
  },
] as const;

export const ATTESTATION_SIGNATURE_DISCLAIMER =
  "By typing your full legal name and clicking Submit Application, you " +
  "are signing this attestation electronically under the federal " +
  "Electronic Signatures in Global and National Commerce Act (E-SIGN) " +
  "and the Uniform Electronic Transactions Act (UETA). Your electronic " +
  "signature has the same legal effect as a handwritten signature.";

export const ATTESTATION_CONFIRMATION_HEADING = "Application Submitted";

export const ATTESTATION_CONFIRMATION_BODY =
  "Your credentialing application has been received and locked. You " +
  "will receive a confirmation email at the address on file within 15 " +
  "minutes. The ESSEN credentialing team will reach out if any " +
  "additional information is required. You can no longer edit this " +
  "application; if any information needs to change, please reply to " +
  "that email or contact " + LEGAL_CONTACTS.credentialing + ".";

// ---------------------------------------------------------------------------
// ESIGN Disclosure
// ---------------------------------------------------------------------------

export interface EsignSection {
  /** Section title (e.g. "Consent to electronic records"). */
  title: string;
  /** Body sentences — rendered as one or more paragraphs. */
  body: string[];
}

export const ESIGN_DISCLOSURE = {
  heading: "Electronic Signature Disclosure",
  intro:
    "This is your electronic signature disclosure as required by the " +
    "federal Electronic Signatures in Global and National Commerce Act " +
    "(E-SIGN), 15 U.S.C. § 7001 et seq., and the Uniform Electronic " +
    "Transactions Act (UETA) as adopted in your jurisdiction. Please " +
    "read it carefully before you sign.",
  sections: [
    {
      title: "Consent to electronic records.",
      body: [
        "You agree that ESSEN Health Care may provide you with all " +
          "communications, agreements, attestations, notices, " +
          "disclosures, and other records relating to the Provider " +
          "Credentialing Portal electronically rather than on paper. " +
          "This includes your attestation, this disclosure, the Privacy " +
          "Notice, the Terms of Service, the Consent for PSV & Data " +
          "Use, expiration reminders, and any subsequent amendments.",
      ],
    },
    {
      title: "System requirements.",
      body: [
        "To access and retain electronic records you need: a current " +
          "version of a major web browser (Chrome, Edge, Safari, or " +
          "Firefox) with JavaScript and cookies enabled, an internet " +
          "connection, a working email address that you check " +
          "regularly, and the ability to view and save PDF files.",
      ],
    },
    {
      title: "Your electronic signature.",
      body: [
        "When you type your full legal name in the signature box and " +
          "click Submit Application, you are signing the attestation " +
          "electronically. Your electronic signature has the same legal " +
          "effect as a handwritten signature on paper. The date, time, " +
          "IP address, browser fingerprint, and the version of each " +
          "legal document then in effect (currently " + LEGAL_COPY_VERSION +
          " of the attestation) will be recorded with your signature.",
      ],
    },
    {
      title: "Right to receive paper records.",
      body: [
        "You have the right to receive any record on paper instead. To " +
          "request a paper copy of any record, write to " +
          LEGAL_CONTACTS.credentialing + ". There is no fee for the " +
          "first paper copy of any record. We may charge a reasonable " +
          "fee for additional copies.",
      ],
    },
    {
      title: "Right to withdraw consent.",
      body: [
        "You may withdraw your consent to electronic records at any " +
          "time by writing to " + LEGAL_CONTACTS.credentialing + ". " +
          "Withdrawal applies only to future records — it does not " +
          "invalidate records you signed electronically before the " +
          "withdrawal. Because the Portal is electronic-only, " +
          "withdrawing your consent will end your use of the Portal; " +
          "further credentialing may need to proceed on paper or be " +
          "paused.",
      ],
    },
    {
      title: "Updates to your contact information.",
      body: [
        "You must keep your email address current with ESSEN. Update it " +
          "through the Portal or by writing to " +
          LEGAL_CONTACTS.credentialing + ".",
      ],
    },
    {
      title: "Acknowledgement.",
      body: [
        "By submitting your application, you confirm that you (a) have " +
          "read this disclosure, (b) consent to the use of electronic " +
          "records and electronic signatures, and (c) confirm that you " +
          "have the system requirements listed above.",
      ],
    },
  ] satisfies EsignSection[],
} as const;

// ---------------------------------------------------------------------------
// PSV consent (inline + full)
// ---------------------------------------------------------------------------

export const PSV_CONSENT_INLINE = {
  heading: "Before you start, please read this consent.",
  body:
    "By completing this application, you authorize ESSEN Health Care " +
    "and its agents to verify, on an initial and ongoing basis, every " +
    "credential you list — including identity, education, training, " +
    "license, DEA registration, board certification, hospital " +
    "affiliation, work history, malpractice history, and sanctions " +
    "history — directly with the primary sources for each. Continuous " +
    "monitoring includes daily checks against the National Practitioner " +
    "Data Bank Continuous Query, the Federation of State Medical Boards " +
    "Practitioner Data Center, the OIG List of Excluded Individuals " +
    "and Entities, the System for Award Management, applicable state " +
    "Medicaid exclusion lists, and your state medical board.",
  fullConsentLinkText: "Read the full consent.",
  fullConsentHref: "/legal/consent",
} as const;

export const PSV_CONSENT_FULL: LegalDocument = {
  title: "Consent for Primary-Source Verification & Data Use",
  lead:
    "I, the applicant, authorize and request ESSEN Health Care, Inc. " +
    "and its credentials verification agents (collectively, \"ESSEN\"):",
  version: LEGAL_COPY_VERSION,
  effectiveDate: LEGAL_COPY_EFFECTIVE_DATE,
  status: LEGAL_COPY_STATUS,
  blocks: [
    {
      kind: "heading",
      level: 2,
      text: "1. To verify",
    },
    {
      kind: "paragraph",
      text:
        "every credential, license, registration, certification, " +
        "education, training, work history, malpractice history, " +
        "hospital affiliation, and sanctions history I have listed in " +
        "this application, directly with the primary source for each, " +
        "including but not limited to:",
    },
    {
      kind: "list",
      items: [
        "state medical and other professional licensing boards in every jurisdiction where I hold or have held a license;",
        "the American Medical Association Masterfile;",
        "the Educational Commission for Foreign Medical Graduates (ECFMG);",
        "the Accreditation Council for Graduate Medical Education (ACGME);",
        "certifying boards (including ABMS, ABIM, ABFM, ABP, ABS, ABEM, ABPN, ABA, ABO, ABFP, ABU, NCCPA, AANP, ANCC, and any other board applicable to my practice);",
        "the U.S. Drug Enforcement Administration;",
        "the U.S. Department of Health and Human Services Office of Inspector General (OIG-LEIE);",
        "the U.S. General Services Administration System for Award Management (SAM.gov);",
        "state Medicaid exclusion lists, including the New York State Office of the Medicaid Inspector General (NY OMIG);",
        "the National Practitioner Data Bank (NPDB), including initial and Continuous Query;",
        "the Federation of State Medical Boards Practitioner Data Center (FSMB-PDC);",
        "CAQH ProView;",
        "my malpractice insurance carriers; and",
        "any hospital, health system, or training program at which I hold or have held privileges, employment, or training appointments.",
      ],
    },
    {
      kind: "heading",
      level: 2,
      text: "2. To monitor",
    },
    {
      kind: "paragraph",
      text:
        "these sources continuously for as long as I hold credentials " +
        "with ESSEN, in order to detect new sanctions, exclusions, " +
        "license actions, malpractice claims, NPDB reports, or other " +
        "credentialing-relevant events.",
    },
    {
      kind: "heading",
      level: 2,
      text: "3. To receive and store",
    },
    {
      kind: "paragraph",
      text:
        "the results of those verifications, including any documents " +
        "returned by the primary sources, and to use them to evaluate " +
        "my credentialing, recredentialing, hospital privileging, " +
        "payer enrollment, and continuous monitoring.",
    },
    {
      kind: "heading",
      level: 2,
      text: "4. To share",
    },
    {
      kind: "paragraph",
      text:
        "the results of those verifications with ESSEN's credentials " +
        "committee, ESSEN compliance and operations personnel, the " +
        "hospitals and health plans to which I have asked to be " +
        "enrolled, and regulators or auditors who require them.",
    },
    {
      kind: "heading",
      level: 2,
      text: "5. To retain",
    },
    {
      kind: "paragraph",
      text:
        "the results of those verifications for the longest of the " +
        "periods required by NCQA Credentialing standards, the Joint " +
        "Commission Medical Staff standards, applicable state and " +
        "federal law, and ESSEN's delegated-credentialing agreements " +
        "with health plans.",
    },
    {
      kind: "heading",
      level: 2,
      text: "Release of liability",
    },
    {
      kind: "paragraph",
      text:
        "I release every person, hospital, payer, professional society, " +
        "school, training program, licensing or certifying board, " +
        "government agency, malpractice insurance carrier, and other " +
        "entity from any and all liability for providing information " +
        "about me, in good faith, to ESSEN in response to ESSEN's " +
        "primary-source verification queries.",
    },
    {
      kind: "heading",
      level: 2,
      text: "Revocation",
    },
    {
      kind: "paragraph",
      text:
        "I understand that this consent is a condition of being " +
        "credentialed with ESSEN and that I may revoke it at any time " +
        "by sending a signed written notice to ESSEN's Privacy " +
        "Officer (" + LEGAL_CONTACTS.privacyOfficer + "). I understand " +
        "that revoking this consent will result in ESSEN being unable " +
        "to credential or enroll me, and may result in termination of " +
        "any existing credentials or enrollments, because ESSEN's " +
        "accreditation requires continuous verification.",
    },
    {
      kind: "paragraph",
      text:
        "This consent is effective when I submit the application and " +
        "remains in effect until I revoke it in writing or until ESSEN " +
        "no longer holds credentials for me, whichever is later.",
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Privacy Notice
// ---------------------------------------------------------------------------

export const PRIVACY_NOTICE_SUMMARY =
  "We collect the personal and credentialing information needed to " +
  "evaluate your application, perform initial and continuous " +
  "primary-source verification, enroll you with payers, and meet our " +
  "accreditation and legal obligations. We do not sell your data and " +
  "we use only strictly necessary cookies.";

export const PRIVACY_NOTICE: LegalDocument = {
  title: "Privacy Notice — Provider Credentialing Portal",
  lead: PRIVACY_NOTICE_SUMMARY,
  version: LEGAL_COPY_VERSION,
  effectiveDate: LEGAL_COPY_EFFECTIVE_DATE,
  status: LEGAL_COPY_STATUS,
  blocks: [
    { kind: "heading", level: 2, text: "1. Who we are" },
    {
      kind: "paragraph",
      text:
        "ESSEN Health Care, Inc. (\"ESSEN\", \"we\", \"us\", or " +
        "\"our\") operates this Provider Credentialing Portal (the " +
        "\"Portal\") to verify, credential, recredential, and enroll " +
        "healthcare providers. ESSEN is the data controller for " +
        "information collected through the Portal.",
    },
    {
      kind: "paragraph",
      text:
        "For privacy questions, write to: ESSEN Health Care, Attn: " +
        "Privacy Officer, " + LEGAL_CONTACTS.privacyOfficer +
        ". (Physical address to be confirmed by Legal.)",
    },

    { kind: "heading", level: 2, text: "2. What this notice covers" },
    {
      kind: "paragraph",
      text:
        "This notice describes the personal information we collect " +
        "about healthcare providers who use the Portal to submit a " +
        "credentialing application or otherwise interact with their " +
        "credentialing record. It does not apply to ESSEN patients " +
        "(those are governed by ESSEN's HIPAA Notice of Privacy " +
        "Practices) or to ESSEN employees (governed by HR policies).",
    },

    { kind: "heading", level: 2, text: "3. Information we collect" },
    {
      kind: "list",
      items: [
        "Identifiers — full legal name, date of birth, Social Security number, NPI, DEA, CAQH ID, professional license numbers, hospital privileges identifiers.",
        "Contact information — email address, mailing address, telephone numbers, emergency contact details.",
        "Education and training — schools, degrees, dates, internships, residencies, fellowships, board certifications, and CME records.",
        "Work history — past and present employers, positions, dates, gaps, reasons for departure, references.",
        "Credentialing history — license actions, hospital privilege actions, malpractice claims, settlements, judgments, sanctions, exclusions, and any related documentation you upload or that we receive from primary sources.",
        "Insurance and identifiers issued to you — malpractice policy numbers and certificates, payer identifiers, Medicare/Medicaid enrollment identifiers.",
        "Health information related to credentialing — only to the extent required to evaluate your fitness to practice (for example, attestations about physical and mental fitness if asked by a payer or hospital).",
        "Authentication and audit data — your IP address, browser type and version, device fingerprint, sign-in timestamps, page-view timestamps, and the contents of every change you make to your application.",
        "Communications — messages and documents you send to ESSEN through the Portal or in response to outreach about your file.",
      ],
    },

    { kind: "heading", level: 2, text: "4. How we collect information" },
    {
      kind: "list",
      items: [
        "Directly from you when you complete the application, upload documents, or respond to messages.",
        "From your employer or recruiter when they create your initial provider record (typically through our integration with iCIMS).",
        "From primary sources (state medical boards, AMA Masterfile, ECFMG, ACGME, certifying boards, the DEA, OIG-LEIE, SAM.gov, state Medicaid exclusion lists including NY OMIG, NPDB, FSMB-PDC, CAQH ProView, and your malpractice insurance carrier).",
        "From your hospital affiliations, training programs, and references that you list on your application.",
        "Automatically when you use the Portal (logs, cookies, audit data).",
      ],
    },

    { kind: "heading", level: 2, text: "5. Why we collect information" },
    {
      kind: "list",
      items: [
        "Evaluate your application for credentialing or recredentialing.",
        "Perform initial and continuous primary-source verification of every credential you list, as required by NCQA Credentialing standards, the Joint Commission's Medical Staff standards, and applicable state and federal law.",
        "Enroll you with health plans, government payers, and clearinghouses.",
        "Generate monthly rosters required by payer contracts.",
        "Track expiration dates and notify you when documents need renewal.",
        "Monitor for new sanctions, exclusions, license actions, and NPDB reports that affect your credentials.",
        "Comply with our legal, regulatory, and accreditation obligations.",
        "Maintain a tamper-evident audit log of all credentialing decisions and the evidence supporting them.",
        "Investigate and respond to suspected fraud, abuse, or misuse of the Portal.",
      ],
    },
    {
      kind: "callout",
      text: "We do not sell your personal information.",
    },

    { kind: "heading", level: 2, text: "6. Who we share information with" },
    {
      kind: "list",
      items: [
        "ESSEN credentialing, compliance, and committee personnel with a legitimate business need.",
        "Health plans, government payers, and clearinghouses to which you have asked to be enrolled or which require roster reporting.",
        "Hospitals and other facilities at which you hold or seek privileges.",
        "Primary sources (listed above) when we query them about you.",
        "Our subprocessors, who help us run the Portal under written contract and confidentiality obligations: Microsoft Azure (hosting, storage, key management, document AI), SendGrid (email delivery), Azure Communication Services (SMS), and the credential-verification automation we operate.",
        "Auditors and regulators when required to demonstrate that we perform credentialing in accordance with NCQA, the Joint Commission, CMS, state law, and our health-plan delegated agreements.",
        "Law enforcement, courts, and other authorities when legally compelled to do so or when necessary to protect the rights, safety, or property of ESSEN, our patients, or others.",
      ],
    },
    {
      kind: "paragraph",
      text:
        "We require every subprocessor to execute appropriate Business " +
        "Associate Agreements (BAAs) and data-processing agreements, " +
        "and we maintain a current subprocessor list on request.",
    },

    { kind: "heading", level: 2, text: "7. Where we store information" },
    {
      kind: "paragraph",
      text:
        "The Portal runs in Microsoft Azure data centers in the United " +
        "States. Your information is processed and stored in the United " +
        "States. If you access the Portal from outside the United " +
        "States, your information will be transferred to and processed " +
        "in the United States.",
    },

    { kind: "heading", level: 2, text: "8. How long we keep information" },
    {
      kind: "paragraph",
      text:
        "We retain credentialing records, primary-source verification " +
        "evidence, and audit logs for at least the period required by " +
        "NCQA Credentialing standards (currently 10 years from the " +
        "credentialing decision and from each recredentialing cycle), " +
        "the Joint Commission Medical Staff standards, applicable " +
        "state Medicaid retention rules (some states require longer " +
        "retention; we follow the longest applicable requirement), " +
        "and our delegated-credentialing agreements with health plans.",
    },
    {
      kind: "paragraph",
      text:
        "When the longest applicable retention period ends, we securely " +
        "delete or anonymize your information unless a legal hold or " +
        "open inquiry requires continued retention.",
    },

    { kind: "heading", level: 2, text: "9. How we protect information" },
    {
      kind: "list",
      items: [
        "Encryption in transit (TLS 1.2 or higher).",
        "Application-layer encryption for Social Security number, date of birth, home address, and other sensitive identifiers (AES-256-GCM).",
        "Document storage in an Azure Blob container with no public access; documents are downloaded only through short-lived signed URLs.",
        "Authentication using your work email and your employer's identity provider for staff, and a single-use signed magic-link token for providers; multi-factor authentication is enforced for staff.",
        "Tamper-evident audit logs with HMAC-SHA256 chaining; deletions and truncations are blocked at the database level.",
        "Antivirus scanning of every uploaded file before it is stored.",
        "Role-based access controls restricting visibility to staff who need it.",
        "Annual penetration testing and continuous vulnerability scanning.",
      ],
    },
    {
      kind: "paragraph",
      text:
        "No system is perfectly secure. If you suspect your account or " +
        "data has been compromised, contact us immediately at " +
        LEGAL_CONTACTS.security + ".",
    },

    { kind: "heading", level: 2, text: "10. Your rights" },
    {
      kind: "list",
      items: [
        "Access the personal information we hold about you.",
        "Correct inaccurate or incomplete information.",
        "Receive a copy of your information in a portable format.",
        "Object to or restrict certain uses of your information.",
        "File a complaint with a privacy regulator if you believe we have violated your rights.",
      ],
    },
    {
      kind: "paragraph",
      text:
        "To exercise these rights, contact " +
        LEGAL_CONTACTS.privacyOfficer + ". We will verify your identity " +
        "before responding and will respond within the timelines " +
        "required by law (generally 30 to 45 days). Some information " +
        "must be retained to satisfy our credentialing, accreditation, " +
        "and legal obligations, and we will explain any limits when we " +
        "respond.",
    },

    { kind: "heading", level: 2, text: "11. Cookies and tracking" },
    {
      kind: "paragraph",
      text:
        "The Portal uses only strictly necessary cookies and similar " +
        "technologies to keep you signed in, remember your form " +
        "progress, and protect against fraud. We do not use third-party " +
        "advertising cookies or cross-site tracking. See our Cookie " +
        "& Session Notice for details.",
    },

    { kind: "heading", level: 2, text: "12. Children" },
    {
      kind: "paragraph",
      text:
        "The Portal is intended only for licensed healthcare providers " +
        "and authorized ESSEN personnel. We do not knowingly collect " +
        "information from children under 18.",
    },

    { kind: "heading", level: 2, text: "13. Changes to this notice" },
    {
      kind: "paragraph",
      text:
        "We may update this notice from time to time. The version " +
        "number and effective date at the top of this notice will " +
        "change when we do, and we will record the change in our " +
        "public change log. If a change materially affects how we use " +
        "your information, we will notify you by email and ask you to " +
        "acknowledge the new version the next time you sign in.",
    },

    { kind: "heading", level: 2, text: "14. Contact us" },
    {
      kind: "list",
      items: [
        "Privacy questions: " + LEGAL_CONTACTS.privacyOfficer,
        "Security incidents: " + LEGAL_CONTACTS.security,
        "Credentialing questions: " + LEGAL_CONTACTS.credentialing,
      ],
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Terms of Service
// ---------------------------------------------------------------------------

export const TERMS_OF_SERVICE_SUMMARY =
  "These Terms govern your access to and use of the ESSEN Provider " +
  "Credentialing Portal. By signing in or using the Portal, you agree " +
  "to them. New York law applies, with venue in Bronx County.";

export const TERMS_OF_SERVICE: LegalDocument = {
  title: "Terms of Service — Provider Credentialing Portal",
  lead: TERMS_OF_SERVICE_SUMMARY,
  version: LEGAL_COPY_VERSION,
  effectiveDate: LEGAL_COPY_EFFECTIVE_DATE,
  status: LEGAL_COPY_STATUS,
  blocks: [
    { kind: "heading", level: 2, text: "1. Acceptance" },
    {
      kind: "paragraph",
      text:
        "These Terms of Service (the \"Terms\") govern your access to " +
        "and use of the ESSEN Health Care Provider Credentialing Portal " +
        "(the \"Portal\"). By clicking the magic-link invitation, " +
        "signing in, or using the Portal in any way, you agree to these " +
        "Terms. If you do not agree, do not use the Portal and contact " +
        "your credentialing specialist.",
    },

    { kind: "heading", level: 2, text: "2. Who may use the Portal" },
    {
      kind: "list",
      items: [
        "Healthcare providers who have been invited by ESSEN to submit a credentialing or recredentialing application.",
        "Authorized ESSEN personnel acting in the course of their duties.",
      ],
    },
    {
      kind: "paragraph",
      text:
        "You must be at least 18 years old and legally authorized to " +
        "practice in the jurisdictions for which you are seeking " +
        "credentials.",
    },

    { kind: "heading", level: 2, text: "3. Your account and access" },
    {
      kind: "list",
      items: [
        "Provider access is by single-use, time-limited magic-link. Do not share your invite link.",
        "Each magic link is valid for one session and is revoked once you submit your application. To resume an application, request a new link from your credentialing specialist.",
        "Staff access uses your work email and your employer's identity provider (Microsoft Entra ID), with multi-factor authentication.",
        "You are responsible for keeping your devices and credentials secure and for any activity carried out under your account.",
      ],
    },

    { kind: "heading", level: 2, text: "4. Acceptable use" },
    {
      kind: "paragraph",
      text: "You agree not to:",
    },
    {
      kind: "list",
      items: [
        "Submit information you know to be false, incomplete, or misleading.",
        "Submit information about another provider unless you are authorized in writing to do so.",
        "Upload malware, viruses, or content that is illegal, defamatory, or infringing.",
        "Probe, scan, or test the vulnerability of the Portal except under a written authorization from ESSEN's Security team (see responsible disclosure in §9).",
        "Attempt to access information or accounts that do not belong to you.",
        "Use any automated means to access the Portal except APIs that ESSEN has expressly made available and that you have been authorized to use.",
        "Resell, sublicense, or otherwise commercially exploit the Portal.",
      ],
    },

    {
      kind: "heading",
      level: 2,
      text: "5. Your application; primary-source verification",
    },
    {
      kind: "paragraph",
      text:
        "When you submit an application, you authorize ESSEN to verify " +
        "every credential you list with the relevant primary source on " +
        "an initial and ongoing basis, and you authorize each person " +
        "and institution holding records about you to release them " +
        "directly to ESSEN. Details of this authorization are in the " +
        "Attestation and the Consent for PSV & Data Use.",
    },

    { kind: "heading", level: 2, text: "6. Documents you upload" },
    {
      kind: "paragraph",
      text:
        "You retain ownership of the documents you upload, but you " +
        "grant ESSEN a non-exclusive, royalty-free license to store, " +
        "process, transmit, and share them with the entities described " +
        "in the Privacy Notice to the extent necessary to credential " +
        "and enroll you. ESSEN scans every upload for malware and may " +
        "reject or quarantine files we believe to be unsafe.",
    },

    { kind: "heading", level: 2, text: "7. Communications" },
    {
      kind: "list",
      items: [
        "The Portal will send you transactional email and SMS related to your application (invitations, reminders, confirmations, and renewal notices). These are not marketing communications.",
        "You may reply to those messages by replying to the original email or text — replies are routed to the credentialing team and recorded in your file.",
        "Outbound calls from credentialing staff may be recorded for quality and compliance purposes; if so, the staff member will tell you at the start of the call.",
      ],
    },

    { kind: "heading", level: 2, text: "8. Suspension and termination" },
    {
      kind: "paragraph",
      text:
        "ESSEN may suspend or terminate your access if you violate " +
        "these Terms, provide false information, or for any other " +
        "reason permitted by law. In most cases ESSEN will notify you " +
        "and give you an opportunity to respond, unless doing so would " +
        "risk safety, security, or compliance.",
    },

    {
      kind: "heading",
      level: 2,
      text: "9. Security and responsible disclosure",
    },
    {
      kind: "paragraph",
      text:
        "If you discover a security vulnerability in the Portal, " +
        "please report it to " + LEGAL_CONTACTS.security + ". Do not " +
        "exploit the vulnerability or share it publicly. We will " +
        "acknowledge receipt within two business days and keep you " +
        "informed of remediation.",
    },

    { kind: "heading", level: 2, text: "10. Disclaimers" },
    {
      kind: "paragraph",
      text:
        "The Portal is provided \"as is\" and \"as available\". To the " +
        "maximum extent permitted by law, ESSEN disclaims all " +
        "warranties, whether express, implied, statutory, or otherwise, " +
        "including warranties of merchantability, fitness for a " +
        "particular purpose, and non-infringement. ESSEN does not " +
        "guarantee that the Portal will be uninterrupted, error-free, " +
        "or free from harmful components.",
    },

    { kind: "heading", level: 2, text: "11. Limitation of liability" },
    {
      kind: "paragraph",
      text:
        "To the maximum extent permitted by law, ESSEN's total " +
        "liability for any claim arising out of or relating to the " +
        "Portal, however caused, will not exceed the greater of (a) " +
        "the fees you paid ESSEN in the 12 months preceding the claim " +
        "(which, for providers, is generally zero) or (b) one hundred " +
        "U.S. dollars. ESSEN will not be liable for indirect, " +
        "incidental, special, consequential, exemplary, or punitive " +
        "damages, lost profits, lost revenues, or loss of data, even " +
        "if ESSEN has been advised of the possibility of such damages.",
    },
    {
      kind: "paragraph",
      text:
        "These limitations do not apply to liability that cannot be " +
        "limited under applicable law (for example, intentional " +
        "misconduct, gross negligence, or violation of certain consumer " +
        "protection statutes), and they do not limit either party's " +
        "indemnification obligations under any separate written " +
        "agreement between you and ESSEN.",
    },

    { kind: "heading", level: 2, text: "12. Governing law and venue" },
    {
      kind: "paragraph",
      text:
        "These Terms are governed by the laws of the State of New " +
        "York, without regard to its conflict-of-laws rules. The " +
        "exclusive venue for any dispute arising out of or relating to " +
        "these Terms is the state and federal courts located in Bronx " +
        "County, New York, and you and ESSEN consent to the personal " +
        "jurisdiction of those courts.",
    },

    { kind: "heading", level: 2, text: "13. Changes to these Terms" },
    {
      kind: "paragraph",
      text:
        "ESSEN may update these Terms from time to time. The version " +
        "and effective date at the top of this page will change when " +
        "we do. If the changes are material, we will notify you by " +
        "email and ask you to acknowledge the new Terms the next time " +
        "you sign in.",
    },

    { kind: "heading", level: 2, text: "14. Entire agreement; precedence" },
    {
      kind: "paragraph",
      text:
        "These Terms, together with the Attestation, the Privacy " +
        "Notice, the Consent for PSV & Data Use, and any signed " +
        "delegated-credentialing agreement between ESSEN and your " +
        "employer, constitute the entire agreement between you and " +
        "ESSEN regarding the Portal. To the extent of any conflict, " +
        "the most specific document controls.",
    },

    { kind: "heading", level: 2, text: "15. Contact" },
    {
      kind: "list",
      items: [
        "Portal questions: " + LEGAL_CONTACTS.credentialing,
        "Privacy questions: " + LEGAL_CONTACTS.privacyOfficer,
        "Security incidents: " + LEGAL_CONTACTS.security,
      ],
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Cookie Notice
// ---------------------------------------------------------------------------

export const COOKIE_NOTICE_SUMMARY =
  "We use only strictly necessary cookies to keep you signed in, " +
  "preserve your form progress, and protect against fraud. No " +
  "analytics, advertising, or third-party tracking.";

export const COOKIE_NOTICE: LegalDocument = {
  title: "Cookie & Session Notice",
  lead: COOKIE_NOTICE_SUMMARY,
  version: LEGAL_COPY_VERSION,
  effectiveDate: LEGAL_COPY_EFFECTIVE_DATE,
  status: LEGAL_COPY_STATUS,
  blocks: [
    {
      kind: "paragraph",
      text:
        "The Provider Credentialing Portal uses only strictly " +
        "necessary cookies and similar technologies. We do not use " +
        "analytics or advertising cookies, and we do not allow " +
        "third-party tracking on the Portal.",
    },

    { kind: "heading", level: 2, text: "Cookies we set" },
    {
      kind: "table",
      headers: ["Cookie", "Purpose", "Lifetime", "Type"],
      rows: [
        [
          "next-auth.session-token (staff)",
          "Maintains your signed-in staff session",
          "session, max 30 days",
          "strictly necessary",
        ],
        [
          "next-auth.csrf-token (staff)",
          "CSRF protection during sign-in",
          "session",
          "strictly necessary",
        ],
        [
          "__Host-ecred-provider (provider)",
          "Maintains your provider portal session after magic-link sign-in",
          "1 hour",
          "strictly necessary",
        ],
        [
          "__Host-ecred-csrf (provider)",
          "CSRF protection on provider mutations",
          "session",
          "strictly necessary",
        ],
        [
          "ecred-app-progress (provider)",
          "Remembers the section of the application you are on",
          "24 hours",
          "strictly necessary",
        ],
      ],
    },

    { kind: "heading", level: 2, text: "Other technologies" },
    {
      kind: "list",
      items: [
        "Local storage is used to persist a draft of your application between page loads so you do not lose your work. The draft is encrypted in transit when synced to our server and is deleted from local storage once you submit the application.",
        "Audit beacons record sign-in, sign-out, and other significant events to our server for compliance. These do not set persistent cookies.",
      ],
    },

    { kind: "heading", level: 2, text: "What we do not do" },
    {
      kind: "list",
      items: [
        "We do not use Google Analytics, Adobe Analytics, Hotjar, Mixpanel, or similar.",
        "We do not use advertising or remarketing cookies.",
        "We do not allow social-media tracking pixels.",
        "We do not sell or share data collected via cookies.",
      ],
    },

    { kind: "heading", level: 2, text: "Your choices" },
    {
      kind: "paragraph",
      text:
        "Because all cookies are strictly necessary, the Portal does " +
        "not display a cookie consent banner. You can clear cookies in " +
        "your browser at any time; doing so will sign you out and may " +
        "interrupt an in-progress application.",
    },

    { kind: "heading", level: 2, text: "Changes" },
    {
      kind: "paragraph",
      text:
        "If we ever introduce non-essential cookies, we will update " +
        "this notice and provide a clear opt-in choice. The version " +
        "and effective date at the top of this page will change when " +
        "we do.",
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// HIPAA Notice (pointer)
// ---------------------------------------------------------------------------

export const HIPAA_NOTICE_POINTER = {
  heading: "HIPAA Notice of Privacy Practices",
  body:
    "ESSEN Health Care's full HIPAA Notice of Privacy Practices " +
    "(NPP) describes how patient health information is used and " +
    "disclosed by ESSEN's clinical operations. The Provider " +
    "Credentialing Portal does not collect patient health information; " +
    "it collects information about providers in order to credential, " +
    "recredential, and enroll them with payers and facilities. " +
    "Provider information is governed by the Privacy Notice on this " +
    "site, not by the patient HIPAA NPP.",
  fullNoticeUrl: null as string | null, // set when Legal publishes the URL
  fullNoticeUrlLabel: "ESSEN HIPAA Notice of Privacy Practices",
  contact: LEGAL_CONTACTS.privacyOfficer,
} as const;

// ---------------------------------------------------------------------------
// Footer summary block (used by every public + provider page)
// ---------------------------------------------------------------------------

export interface FooterLink {
  href: string;
  label: string;
}

export const LEGAL_FOOTER_LINKS: readonly FooterLink[] = [
  { href: "/legal/privacy", label: "Privacy Notice" },
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/cookies", label: "Cookie Notice" },
  { href: "/legal/hipaa", label: "HIPAA Notice" },
] as const;
