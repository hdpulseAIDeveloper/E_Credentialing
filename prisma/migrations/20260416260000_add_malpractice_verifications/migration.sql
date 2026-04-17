-- P1 Gap #12: Malpractice Carrier Verification + facility coverage minimums

CREATE TYPE "MalpracticeVerificationStatus" AS ENUM (
  'PENDING', 'SENT', 'REMINDER_SENT', 'RECEIVED', 'EXPIRED', 'DECLINED'
);

CREATE TABLE "malpractice_verifications" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "carrier_name" TEXT NOT NULL,
  "contact_name" TEXT,
  "contact_email" TEXT,
  "contact_phone" TEXT,
  "policy_number" TEXT,
  "expected_exp_date" TIMESTAMP(3),
  "status" "MalpracticeVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "response_token" TEXT NOT NULL,
  "request_sent_at" TIMESTAMP(3),
  "last_reminder_at" TIMESTAMP(3),
  "reminder_count" INTEGER NOT NULL DEFAULT 0,
  "received_at" TIMESTAMP(3),
  "reported_per_occurrence_cents" BIGINT,
  "reported_aggregate_cents" BIGINT,
  "reported_effective_date" TIMESTAMP(3),
  "reported_expiration_date" TIMESTAMP(3),
  "reported_claims_history" TEXT,
  "response_data" JSONB,
  "threshold_met" BOOLEAN,
  "threshold_notes" TEXT,
  "monitoring_alert_id" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "malpractice_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "malpractice_verifications_response_token_key"
  ON "malpractice_verifications"("response_token");

CREATE INDEX "malpractice_verifications_provider_id_idx"
  ON "malpractice_verifications"("provider_id");

CREATE INDEX "malpractice_verifications_status_idx"
  ON "malpractice_verifications"("status");

ALTER TABLE "malpractice_verifications"
  ADD CONSTRAINT "malpractice_verifications_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "facility_coverage_minimums" (
  "id" TEXT NOT NULL,
  "facility_name" TEXT NOT NULL,
  "state" TEXT,
  "min_per_occurrence_cents" BIGINT NOT NULL,
  "min_aggregate_cents" BIGINT NOT NULL,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "facility_coverage_minimums_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "facility_coverage_minimums_facility_name_key"
  ON "facility_coverage_minimums"("facility_name");

-- NCQA / Joint Commission baselines used by most NY hospital systems.
-- Staff can edit / add via the admin Facility Minimums page.
INSERT INTO "facility_coverage_minimums"
  ("id", "facility_name", "state", "min_per_occurrence_cents", "min_aggregate_cents", "notes", "is_active", "updated_at")
VALUES
  (gen_random_uuid()::text, 'Default (NY hospital baseline)',         'NY', 100000000, 300000000, '$1M / $3M — typical NY hospital minimum', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Default (NY outpatient baseline)',       'NY',  50000000, 100000000, '$500K / $1M — typical outpatient/clinic minimum', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Bronx Care Health System',               'NY', 100000000, 300000000, NULL, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'NYC Health + Hospitals',                 'NY', 100000000, 300000000, NULL, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Montefiore',                             'NY', 200000000, 600000000, '$2M / $6M — large academic medical center', true, CURRENT_TIMESTAMP);
