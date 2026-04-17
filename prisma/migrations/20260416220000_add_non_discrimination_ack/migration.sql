-- P0 Gap #6: NCQA 2026 application standard requires the practitioner to
-- explicitly acknowledge the organization's non-discrimination disclosure
-- during initial credentialing and recredentialing. Capture the timestamp
-- and the disclosure version the provider saw at signing time.

ALTER TABLE "provider_profiles"
  ADD COLUMN IF NOT EXISTS "non_discrimination_ack_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "non_discrimination_ack_version" TEXT;
