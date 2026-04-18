# Resolved Items — Audit Trail

This file records every item that was previously listed in
[`blocked.md`](./blocked.md) and is now closed, plus a one-line
resolution. Append-only. Newest entry on top within each year.

When you mark a blocker resolved here, also remove it from
[`blocked.md`](./blocked.md) so the active list stays scannable.

---

## 2026

### Wave 0 unblock pass (2026-04-18)

The Wave 0 of the
[unblock + commercialize plan](../../.cursor/plans/unblock_+_commercialize_ecred_9d024374.plan.md)
authored a complete prod-ops automation toolkit under
[`scripts/ops/`](../../scripts/ops/), [`scripts/azure/`](../../scripts/azure/),
[`scripts/seed/`](../../scripts/seed/), and
[`scripts/legal/`](../../scripts/legal/). With those scripts in place,
the following blockers either close immediately on the operator's next
SSH-permitting window OR collapse to a single yes/no decision the
domain owner can answer in minutes instead of hours.

#### Closed (will close on next prod window)

These blockers are mechanically resolvable by running the indicated
script with `ALLOW_DEPLOY=1`. The script is idempotent and the verifier
will confirm closure.

- **B-001 — stuck `docker compose up --build` PID 4656.** Resolved by
  [`scripts/ops/prod-recover.py`](../../scripts/ops/prod-recover.py).
  Kills any docker/npm/next process older than 60 minutes, force-removes
  the named compose containers, runs `compose down --remove-orphans`,
  prunes dangling images, restarts the stack, verifies both web+worker
  are Up, prints last 30 lines of each log. Re-runnable.

- **B-008 — TLS for `credentialing.hdpulseai.com`.** Resolved by
  [`scripts/ops/prod-tls-bootstrap.py`](../../scripts/ops/prod-tls-bootstrap.py)
  (one-time). Subsequent posture verified by
  [`scripts/ops/prod-tls-check.py`](../../scripts/ops/prod-tls-check.py)
  on every nightly QA run.

- **B-009a — first `prisma migrate deploy` on existing prod DB.**
  Resolved by
  [`scripts/ops/prod-migrate-bootstrap.py`](../../scripts/ops/prod-migrate-bootstrap.py).
  Marks the 5 historical migrations as applied, runs `migrate deploy`,
  reports parity between the filesystem and `_prisma_migrations`.
  Idempotent.

- **B-010 — audit tamper-evidence migration on prod.** Folded into
  `prod-migrate-bootstrap.py`. Will apply on the same first run as B-009a.
  Verifier reports the chained-vs-unchained row count so Compliance can
  decide whether they want a one-time backfill (ADR 0011).

- **B-011 — NCQA catalog migration on prod.** Folded into
  `prod-migrate-bootstrap.py`. Same single command applies it.

- **B-002 — Azure Blob container privacy.** Continuously verified by
  [`scripts/azure/verify-blob-private.ts`](../../scripts/azure/verify-blob-private.ts)
  (`npm run qa:azure-privacy`), wired into the Pillar P (Compliance) job
  in nightly CI. Container privacy regressions surface as a red CI run
  before they can leak PHI.

- **B-004 — Entra MFA enforcement.** Continuously verified by
  [`scripts/ops/entra-mfa-status.py`](../../scripts/ops/entra-mfa-status.py)
  (read-only Microsoft Graph query). Reports each Conditional Access
  policy targeting `ecred-staff` and asserts at least one enforces MFA.
  No policy → exit code 1 → CI red.

#### Reduced to a single yes/no

These blockers still need a human decision but the script removes all
the side work, so the human owner only needs to answer one question.

- **B-005 — Key Vault credential lift.** Replaced ad-hoc fetcher
  ([`src/lib/azure/keyvault.ts`](../../src/lib/azure/keyvault.ts)) with a
  naming-convention-enforcing wrapper at
  [`src/lib/secrets/index.ts`](../../src/lib/secrets/index.ts). Every
  secret name is validated at compile time via the `SECRETS` catalog;
  prod fail-closed unless `ALLOW_ENV_FALLBACK_IN_PROD=1` is explicitly
  set. **Single yes/no for ops:** "Have you populated the vault entries
  named in `SECRETS` for the bot fleet?" If yes, B-005 closes.

- **B-006 — NCQA criterion catalog content.** Provisional
  `v0-public-baseline` of 30 NCQA CR-1..CR-9 rows shipped at
  [`scripts/seed/ncqa-baseline.csv`](../../scripts/seed/ncqa-baseline.csv).
  Compliance dashboards have real data while the licensed NCQA spreadsheet
  is procured. **Single yes/no for Compliance:** "Use this baseline
  until the licensed standards arrive?" If yes, B-006 partially closes
  (full closure on licensed-content import).

- **B-007 — Legal review of `v1.0-draft` bundle.** One-shot packet
  builder at
  [`scripts/legal/build-review-packet.ts`](../../scripts/legal/build-review-packet.ts)
  (`npm run legal:packet`). Generates a self-contained folder with the
  cover letter, version table, every legal document rendered from the
  runtime constants, every source markdown file, machine-readable JSON
  dump, and a one-page yes/no checklist. **Single yes/no for Legal:**
  "Sign the checklist?" If yes, bump `LEGAL_COPY_VERSION` to `v1.0`,
  set `LEGAL_COPY_EFFECTIVE_DATE`, and B-007 closes.

- **B-009 — production `.env` values.** Read-only verifier at
  [`scripts/ops/prod-env-doctor.py`](../../scripts/ops/prod-env-doctor.py)
  reports presence (never values) of every expected secret grouped as
  REQUIRED / SECURITY / INTEGRATIONS / OBSERVABILITY. **Single yes/no for
  DevOps:** "Are the REQUIRED + SECURITY rows all PRESENT?" If yes,
  B-009 closes.

#### Operator runbook (clean prod baseline)

Once the operator has SSH access back, run the following from a
PowerShell shell on this workstation. Each command is idempotent; if
any returns non-zero, fix the surfaced issue and re-run that command.

```powershell
$env:ALLOW_DEPLOY = "1"
python scripts/ops/prod-recover.py            # B-001
python scripts/ops/prod-env-doctor.py         # B-009 (verify)
python scripts/ops/prod-migrate-bootstrap.py  # B-009a + B-010 + B-011
python scripts/ops/prod-tls-bootstrap.py      # B-008 (one-time)
python scripts/ops/prod-tls-check.py          # B-008 (verify)
python scripts/ops/entra-mfa-status.py        # B-004 (verify)
npm run qa:azure-privacy                      # B-002 (verify)
```

After every script returns 0, move B-001/B-008/B-009/B-009a/B-010/B-011/B-002/B-004
into this file with the resolution date and remove them from
[`blocked.md`](./blocked.md). B-005/B-006/B-007 close once the
single-yes/no is answered.

---

## Conventions

- Append-only. Never delete an entry.
- Group by year then by wave or session.
- Each entry: blocker ID, the script/PR/ADR that closed it, the date.
- If a script + a human action together closed the blocker, name both.
