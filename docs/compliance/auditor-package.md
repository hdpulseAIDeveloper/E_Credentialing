# Auditor Package

The auditor package is a one-click export that produces the full set of artifacts an NCQA CVO auditor (or equivalent) typically requests.

## Generation

- **Where**: Reports → Compliance → Auditor Package.
- **Who**: Compliance Officer or Admin.
- **What triggers**: Manual (pre-audit) or scheduled (quarterly snapshot archives).

## Contents

```
auditor-package-YYYYMMDD.zip
├── README.md                      # What's in the package and how to interpret it
├── policies/                      # Current version of every P&P
├── provider-sample/               # Sampled provider files per NCQA sample-size rules
│   ├── <providerId>/
│   │   ├── summary.pdf            # One-page summary sheet
│   │   ├── application.pdf        # Full application, redacted PHI marked
│   │   ├── documents/             # Every uploaded document
│   │   ├── verifications/         # PSV evidence PDFs
│   │   └── audit-timeline.csv     # Every action on the file
├── committee/
│   ├── meetings.csv               # Every meeting in the period
│   ├── minutes/                   # Minutes PDFs
│   └── decisions.csv              # Decisions with outcomes
├── sanctions/
│   ├── weekly-sweeps.csv          # Date + providers-checked count
│   ├── flag-review.csv            # Every flag with disposition
│   └── sample-pdfs/               # Sample evidence PDFs
├── expirables/
│   ├── on-time-rate.csv
│   └── late-renewals.csv
├── recredentialing/
│   ├── cycle-status.csv
│   └── on-time-rate.csv
├── rosters/                       # Every roster submitted in the period
├── training-attestations.csv      # Staff training records
├── access-review.csv              # Quarterly access audit output
└── audit-log-signatures.csv       # HMAC chain segments proving integrity
```

## Sampling

Provider sampling follows NCQA rules:

- At least 30 files, or 5% of the active panel, whichever is greater.
- Proportional representation across provider types.
- Includes both recent credentialing and recredentialing files.
- Random seed recorded so an auditor can re-sample if needed.

## PHI handling

- PHI fields (SSN, DOB, home address, home phone) are redacted in exports by default.
- Auditors needing unredacted PHI receive a separate, tightly-scoped, encrypted package — by policy, not via the public UI.

## Integrity

Each ZIP is signed. The audit log segment included covers the reporting period and carries the HMAC chain so an auditor can verify the log has not been tampered with.

## Retention

Auditor packages are retained for 7 years. The most recent 3 years are available through the UI; older packages are accessible on request.

## Provenance

Every auditor package generation is itself an audited action:

- Who generated
- When
- What period covered
- What filters / samples applied
- Hash of the resulting ZIP

This lets an auditor verify they received exactly the package that was produced.
