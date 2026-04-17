-- P1 Gap #14: CAQH ProView 2026 alignment

ALTER TABLE "provider_profiles"
  ADD COLUMN "caqh_profile_status" TEXT,
  ADD COLUMN "caqh_attestation_date" TIMESTAMP(3),
  ADD COLUMN "caqh_next_reattest_due" TIMESTAMP(3),
  ADD COLUMN "caqh_essen_active_site" BOOLEAN,
  ADD COLUMN "caqh_group_affiliations" JSONB,
  ADD COLUMN "caqh_last_reminder_sent_at" TIMESTAMP(3),
  ADD COLUMN "caqh_synced_at" TIMESTAMP(3);
