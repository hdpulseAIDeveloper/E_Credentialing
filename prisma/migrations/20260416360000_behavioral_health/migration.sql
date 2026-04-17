-- P3 Gap #22 — Behavioral health specialty path

ALTER TYPE "MonitoringAlertType" ADD VALUE IF NOT EXISTS 'SUPERVISION_ATTESTATION_OVERDUE';
ALTER TYPE "MonitoringAlertType" ADD VALUE IF NOT EXISTS 'PROVISIONAL_LICENSE_EXPIRING';

ALTER TABLE "provider_profiles"
  ADD COLUMN "nucc_taxonomy_primary"          TEXT,
  ADD COLUMN "nucc_taxonomy_secondary"        TEXT[]   NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN "is_behavioral_health"           BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN "is_provisionally_licensed"      BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN "provisional_license_expires"    TIMESTAMP(3),
  ADD COLUMN "bcbs_fast_track_eligible"       BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN "bcbs_fast_track_submitted_at"   TIMESTAMP(3),
  ADD COLUMN "bcbs_fast_track_status"         TEXT,
  ADD COLUMN "bcbs_fast_track_ref_id"         TEXT;

CREATE TYPE "SupervisionAttestationStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED'
);

CREATE TABLE "supervision_attestations" (
  "id"                       TEXT                            PRIMARY KEY,
  "provider_id"              TEXT                            NOT NULL,
  "supervisor_name"          TEXT                            NOT NULL,
  "supervisor_license_num"   TEXT                            NOT NULL,
  "supervisor_license_state" TEXT                            NOT NULL,
  "supervisor_email"         TEXT                            NOT NULL,
  "supervisor_license_type"  TEXT,
  "period_start"             TIMESTAMP(3)                    NOT NULL,
  "period_end"               TIMESTAMP(3)                    NOT NULL,
  "hours_direct"             DOUBLE PRECISION                NOT NULL DEFAULT 0,
  "hours_indirect"           DOUBLE PRECISION                NOT NULL DEFAULT 0,
  "attestation_date"         TIMESTAMP(3),
  "attestation_doc_blob_url" TEXT,
  "status"                   "SupervisionAttestationStatus"  NOT NULL DEFAULT 'DRAFT',
  "notes"                    TEXT,
  "created_at"               TIMESTAMP(3)                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3)                    NOT NULL,

  CONSTRAINT "supervision_attestations_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE
);

CREATE INDEX "supervision_attestations_provider_id_idx" ON "supervision_attestations"("provider_id");
CREATE INDEX "supervision_attestations_period_end_idx" ON "supervision_attestations"("period_end");
CREATE INDEX "supervision_attestations_status_idx" ON "supervision_attestations"("status");
