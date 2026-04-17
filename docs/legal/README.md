# Legal & Policy Copy

> **Status:** DRAFT — pending Legal + Compliance review and sign-off.
> **Document version:** `v1.0-draft` (see [VERSION](#versioning)).
> **Last updated:** 2026-04-17.
>
> These pages are the **single source of truth** for the legal language
> rendered in the application. The codebase imports the same strings from
> [`src/lib/legal/copy.ts`](../../src/lib/legal/copy.ts), which is mechanically
> kept in sync with this folder.
>
> When Legal approves the language, change the `STATUS` line and bump
> `LEGAL_COPY_VERSION` in `src/lib/legal/copy.ts` to `v1.0` (drop the
> `-draft` suffix). Every provider attestation records the version number it
> agreed to, so historical attestations remain enforceable even after the
> language evolves.

## Why this folder exists

Blocker [B-007](../status/blocked.md) called out that the placeholder copy
in the application form, attestation page, privacy notice, and terms of
service must come from Legal. Rather than leave `// TODO(legal)` comments
scattered across the code, this folder collects every piece of provider-
facing legal language as draft documents that Legal can edit and approve in
one place. The code reads from a single canonical TypeScript module that
mirrors these documents.

## Documents in this folder

| Document | Purpose | Where it appears in the app |
|---|---|---|
| [Attestation](attestation.md) | The list of statements a provider must check before submitting an application | `/application/attestation` |
| [Privacy Notice](privacy-notice.md) | What data we collect, why, who sees it, retention, rights | `/legal/privacy` (linked from every page footer) |
| [Terms of Service](terms-of-service.md) | Acceptable use of the provider portal | `/legal/terms` (linked from every page footer) |
| [Consent for PSV & Data Use](consent-language.md) | Authorization to perform primary-source verification | embedded in the Personal Info section of the application |
| [Electronic Signature Disclosure (ESIGN)](electronic-signature-disclosure.md) | ESIGN Act + UETA disclosure shown immediately above the signature box | `/application/attestation` |
| [Cookie & Session Notice](cookie-notice.md) | Cookies + session tokens disclosure | `/legal/cookies` |
| [HIPAA Notice of Privacy Practices (link / summary)](hipaa-notice.md) | Pointer to ESSEN's full HIPAA NPP, summarized for portal context | `/legal/hipaa` |

## Versioning

- Each document declares a `Version:` and `Effective date:` at the top.
- The bundle version (`LEGAL_COPY_VERSION`) increments any time **any**
  document in this folder changes in a non-cosmetic way (typo fixes are
  cosmetic).
- The current version is **`v1.0-draft`**.
- Code reads the bundle version from `src/lib/legal/copy.ts` and **stores it
  on every attestation audit log entry** (`afterState.legalCopyVersion`).
  Historical attestations remain bound to the version they signed.

## Review checklist for Legal

Each document opens with a **Review checklist** section listing the specific
points Legal needs to confirm. When all checklist items are checked off and
the document's `Status:` is changed from `DRAFT` to `APPROVED`, the bundle
version can graduate from `v1.0-draft` to `v1.0`.

## How code consumes this content

```ts
import { LEGAL_COPY_VERSION, ATTESTATION_QUESTIONS, ESIGN_DISCLOSURE } from "@/lib/legal/copy";
```

`src/lib/legal/copy.ts` exports versioned constants for every piece of copy.
Components must NEVER hard-code legal text inline. CI lints for stray
"hereby attest" / "I certify" / "primary source verification" strings
outside `src/lib/legal/`.

## Change procedure

1. Edit the markdown in this folder.
2. Edit `src/lib/legal/copy.ts` to mirror the change.
3. Bump `LEGAL_COPY_VERSION` if the change is non-cosmetic.
4. Open a PR labeled `area:legal`. Reviewers: Legal + Compliance + Tech Lead.
5. Once approved, deploy. New attestations will be tagged with the new
   version automatically.

## Out of scope here

- Internal staff policies (handled by HR, not the application).
- Vendor contracts (handled by Procurement).
- BAA agreements (handled by Compliance separately).
- HIPAA Notice of Privacy Practices full text (the application links to
  ESSEN's published NPP; only a context-specific summary lives here).
