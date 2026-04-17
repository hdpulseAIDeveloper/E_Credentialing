# Electronic Signature Disclosure (ESIGN / UETA)

**Status:** DRAFT — pending Legal + Compliance review.
**Version:** `v1.0-draft`
**Effective date:** to be set on approval
**Renders at:** Immediately above the signature box on `/application/attestation`.
**Code reference:** `ESIGN_DISCLOSURE` in `src/lib/legal/copy.ts`.

---

## Heading

> **Electronic Signature Disclosure**

## Body

> This is your electronic signature disclosure as required by the federal
> Electronic Signatures in Global and National Commerce Act (E-SIGN), 15
> U.S.C. § 7001 *et seq.*, and the Uniform Electronic Transactions Act
> (UETA) as adopted in your jurisdiction. **Please read it carefully**
> before you sign.
>
> 1. **Consent to electronic records.** You agree that ESSEN Health Care
>    may provide you with all communications, agreements, attestations,
>    notices, disclosures, and other records relating to the Provider
>    Credentialing Portal **electronically** rather than on paper. This
>    includes your attestation, this disclosure, the Privacy Notice, the
>    Terms of Service, the Consent for PSV & Data Use, expiration
>    reminders, and any subsequent amendments.
>
> 2. **System requirements.** To access and retain electronic records,
>    you need:
>    - a current version of a major web browser (Chrome, Edge, Safari, or
>      Firefox) with JavaScript and cookies enabled,
>    - an internet connection,
>    - a working email address that you check regularly, and
>    - the ability to view and save PDF files.
>
> 3. **Your electronic signature.** When you type your full legal name in
>    the signature box and click **Submit Application**, you are signing
>    the attestation electronically. Your electronic signature has the
>    **same legal effect** as a handwritten signature on paper. The date,
>    time, IP address, browser fingerprint, and the version of each legal
>    document then in effect (currently **`v1.0-draft`** of the
>    attestation) will be recorded with your signature.
>
> 4. **Right to receive paper records.** You have the right to receive
>    any record on paper instead. To request a paper copy of any record,
>    write to
>    [cred_onboarding@essenmed.com](mailto:cred_onboarding@essenmed.com).
>    There is no fee for the first paper copy of any record. We may
>    charge a reasonable fee for additional copies.
>
> 5. **Right to withdraw consent.** You may withdraw your consent to
>    electronic records at any time by writing to
>    [cred_onboarding@essenmed.com](mailto:cred_onboarding@essenmed.com).
>    Withdrawal applies only to future records — it does not invalidate
>    records you signed electronically before the withdrawal. Because the
>    Portal is electronic-only, withdrawing your consent will end your
>    use of the Portal; further credentialing may need to proceed on
>    paper or be paused.
>
> 6. **Updates to your contact information.** You must keep your email
>    address current with ESSEN. Update it through the Portal or by
>    writing to
>    [cred_onboarding@essenmed.com](mailto:cred_onboarding@essenmed.com).
>
> 7. **Acknowledgement.** By submitting your application, you confirm
>    that you (a) have read this disclosure, (b) consent to the use of
>    electronic records and electronic signatures, and (c) confirm that
>    you have the system requirements listed above.

## Review checklist for Legal

- [ ] Confirm ESIGN + UETA citations are current.
- [ ] Confirm the system requirements list reflects what we actually
      support (browser versions, screen reader support if applicable).
- [ ] Confirm fee policy for paper copies (first copy free).
- [ ] Decide whether to require a separate "I consent to electronic
      records" checkbox in addition to the attestation acknowledgements
      (some jurisdictions require this).
