# Pillar T — Auditor package + SOC 2 gap analysis

> **Wave:** 5.4
> **ADR:** [0017 — Auditor package](../../dev/adr/0017-auditor-package.md)

## Surface

| Surface | Path | Auth | Output |
| ------- | ---- | ---- | ------ |
| Admin settings page | `/settings/compliance` | ADMIN/SUPER_ADMIN/COMPLIANCE_OFFICER | Download button + gap analysis grid |
| HTTP export | `GET /api/compliance/auditor-package` | same | `application/zip` |
| CLI export | `npm run compliance:auditor-package` | shell | `./out/*.zip` (default) |

## Package contents

```
auditor-package-<org>-<timestamp>.zip
├── manifest.json                      # SHA-256 of every file, sorted
├── README.md                          # anti-weakening notes
├── cover.md                           # human summary
├── audit-log.csv                      # chained log entries (sequence + hash)
├── ncqa-snapshots.csv                 # all NCQA quarterly scores
├── gap-analysis.md                    # SOC 2 implemented / partial / gap
└── controls/
    ├── CC6.1-implemented.md
    ├── CC6.2-partial.md
    └── …                              # one .md per control
```

## Pure helpers (covered by unit tests)

| Module | Tests |
| ------ | ----- |
| `src/lib/auditor/sections.ts` | `tests/unit/lib/auditor/sections.test.ts` (6 tests) |
| `src/lib/auditor/soc2-controls.ts` | `tests/unit/lib/auditor/soc2-controls.test.ts` (8 tests) |
| `src/lib/auditor/manifest.ts` | `tests/unit/lib/auditor/manifest.test.ts` (3 tests) |

## Anti-weakening rules

1. **Byte-stability**. Same `(organizationId, reportPeriod)` MUST
   produce the same zip SHA-256 across runs. Any drift = history
   moved = investigate via the chained audit log.
2. **No new bypass callers**. The builder runs inside
   `withTenant({ organizationId })` and uses the standard
   tenant-extended Prisma client.
3. **Honest control statuses**. `implemented` means the implementation
   exists in code and produces an evidence file. `partial` and `gap`
   are required to populate `notes` explaining the delta.
4. **Manifest is append-only**. Field renames break every auditor's
   downstream tooling.
5. **CSV header order is frozen**. Add new columns at the end with
   default values; never reorder.

## Failure modes covered

| Scenario | Expected response |
| -------- | ----------------- |
| Unauthenticated GET | `401 { error: "unauthenticated" }` |
| Non-admin role GET | `403 { error: "forbidden" }` |
| Unknown organizationId | `500` with `Organization not found:` message |
| Audit chain broken | Cover sheet shows "INTEGRITY FAILURE"; export still succeeds so auditor sees the evidence |

## Future work

- Worker-queue + signed-URL flow for very large tenants (> 500 MB).
- Per-control evidence files generated dynamically (e.g. CC6.1 mfa
  status pulled from `entra-mfa-status.py` output).
- Type II evidence collection over a 6-month rolling window.
