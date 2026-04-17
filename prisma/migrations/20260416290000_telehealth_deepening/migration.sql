-- P1 Gap #15 — Telehealth deepening: IMLC tracking + per-platform certs

-- 1. IMLC fields on provider_profiles
ALTER TABLE "provider_profiles"
  ADD COLUMN IF NOT EXISTS "imlc_eligible"               BOOLEAN,
  ADD COLUMN IF NOT EXISTS "imlc_spl"                    TEXT,
  ADD COLUMN IF NOT EXISTS "imlc_loq_issued_date"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "imlc_loq_expires_at"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "imlc_loq_document_blob_url"  TEXT,
  ADD COLUMN IF NOT EXISTS "imlc_member_states_granted"  TEXT[];

-- 2. New enum + table for per-platform certs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TelehealthPlatformCertStatus') THEN
    CREATE TYPE "TelehealthPlatformCertStatus" AS ENUM (
      'PENDING', 'IN_TRAINING', 'CERTIFIED', 'EXPIRED', 'REVOKED'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "telehealth_platform_certs" (
  "id"                   TEXT PRIMARY KEY,
  "provider_id"          TEXT NOT NULL,
  "platform_name"        TEXT NOT NULL,
  "certificate_number"   TEXT,
  "status"               "TelehealthPlatformCertStatus" NOT NULL DEFAULT 'PENDING',
  "training_started_at"  TIMESTAMP(3),
  "training_completed_at" TIMESTAMP(3),
  "certified_at"         TIMESTAMP(3),
  "expires_at"           TIMESTAMP(3),
  "document_blob_url"    TEXT,
  "notes"                TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "telehealth_platform_certs_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "telehealth_platform_certs_provider_id_idx"
  ON "telehealth_platform_certs" ("provider_id");
CREATE INDEX IF NOT EXISTS "telehealth_platform_certs_status_idx"
  ON "telehealth_platform_certs" ("status");
CREATE INDEX IF NOT EXISTS "telehealth_platform_certs_expires_at_idx"
  ON "telehealth_platform_certs" ("expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "telehealth_platform_certs_provider_platform_unique"
  ON "telehealth_platform_certs" ("provider_id", "platform_name");

-- 3. New monitoring alert types
ALTER TYPE "MonitoringAlertType" ADD VALUE IF NOT EXISTS 'TELEHEALTH_LICENSE_GAP';
ALTER TYPE "MonitoringAlertType" ADD VALUE IF NOT EXISTS 'TELEHEALTH_PLATFORM_CERT_EXPIRING';
ALTER TYPE "MonitoringAlertType" ADD VALUE IF NOT EXISTS 'IMLC_LOQ_EXPIRING';
