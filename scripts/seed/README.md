# scripts/seed — Demo + bootstrap seed data

## ncqa-baseline.csv (`v0-public-baseline`)

Partial closure of `B-006` (NCQA criterion catalog content). 30 rows
covering the 9 NCQA CR-Standard sections (CR-1 through CR-9) at a
**generic, public-knowledge** level. This is **not** a substitute for
the licensed NCQA CR Standards & Guidelines spreadsheet — it is a
working baseline so the compliance dashboard, snapshot algorithm, and
auditor-package export have something real to operate on while the
licensed content is being procured.

Each row carries the public knowledge of what NCQA CVO accreditation
covers; descriptions are paraphrased and intentionally non-verbatim so
no NCQA copyright is reproduced.

### Provenance

- Source category: `v0-public-baseline`
- Author: ECred platform team, 2026-04-18
- Replacement plan: when Compliance returns the licensed CR Standards
  CSV, run with `--replace` (when implemented in the importer) or
  manually retire each `v0-public-baseline` row by flipping
  `isActive = false` in the admin UI before importing the licensed set.

### Load

```bash
# Local dev
npx tsx scripts/import-ncqa-criteria.ts scripts/seed/ncqa-baseline.csv

# Production (after B-001 is cleared and migrations are applied)
python .claude/deploy.py "docker cp scripts/seed/ncqa-baseline.csv ecred-web-prod:/tmp/ncqa.csv && docker exec ecred-web-prod npx tsx scripts/import-ncqa-criteria.ts /tmp/ncqa.csv"
```

### Categories represented

| Section | NcqaCategory          | Rows |
|---------|------------------------|------|
| CR-1    | CREDENTIALING          | 3    |
| CR-2    | CREDENTIALING          | 2    |
| CR-3    | CREDENTIALING          | 9    |
| CR-4    | RECREDENTIALING        | 4    |
| CR-5    | DELEGATION             | 3    |
| CR-6    | PRACTITIONER_RIGHTS    | 3    |
| CR-7    | CONFIDENTIALITY        | 2    |
| CR-8    | OPERATIONS             | 2    |
| CR-9    | QUALITY_MANAGEMENT     | 2    |
| Total   |                        | 30   |
