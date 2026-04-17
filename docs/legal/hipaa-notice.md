# HIPAA Notice of Privacy Practices — Pointer

**Status:** DRAFT — pending Legal + Compliance review.
**Version:** `v1.0-draft`
**Effective date:** to be set on approval
**Renders at:** `/legal/hipaa` (linked from every page footer).
**Code reference:** `HIPAA_NOTICE_POINTER` in `src/lib/legal/copy.ts`.

> ESSEN Health Care's full HIPAA Notice of Privacy Practices (NPP) governs
> the use and disclosure of **patient** protected health information (PHI).
> This page is a pointer to that document, plus a short scope statement
> explaining how the Provider Credentialing Portal differs from a patient-
> facing HIPAA surface.

---

## Heading

> **HIPAA Notice of Privacy Practices**

## Body

> ESSEN Health Care's full HIPAA Notice of Privacy Practices (NPP)
> describes how patient health information is used and disclosed by
> ESSEN's clinical operations. The Provider Credentialing Portal does
> not collect patient health information; it collects information about
> providers in order to credential, recredential, and enroll them with
> payers and facilities. Provider information is governed by the
> [Privacy Notice](privacy-notice.md) on this site, not by the patient
> HIPAA NPP.

## Where to read the full HIPAA NPP

> The full HIPAA Notice of Privacy Practices is published at *(URL to
> be confirmed by Legal)*. In the meantime, request a copy by email at
> [privacy@essenmed.com](mailto:privacy@essenmed.com).

## Provider information vs. patient PHI

> The information ESSEN collects from you through this Portal —
> identifiers, education, training, licensure, sanctions history, and
> related credentialing evidence — is described in the
> [Privacy Notice](privacy-notice.md). That information is governed by
> ESSEN's provider-data privacy program, not by the patient HIPAA NPP.

## Contact

> Privacy questions:
> [privacy@essenmed.com](mailto:privacy@essenmed.com)

## Review checklist for Legal

- [ ] Confirm the canonical URL of the published patient HIPAA NPP and
      add it to `HIPAA_NOTICE_POINTER.fullNoticeUrl` in
      `src/lib/legal/copy.ts`.
- [ ] Confirm the framing that "the Portal does not collect patient
      PHI". (Provider attestations about fitness to practice may
      constitute provider PHI when collected at a payer's request — flag
      anywhere this could change the framing.)
- [ ] Confirm the contact for HIPAA-specific complaints (privacy
      officer vs. dedicated HIPAA officer).
