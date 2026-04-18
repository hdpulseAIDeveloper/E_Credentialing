-- Wave 5.3 — extend organizations with Stripe subscription mirror columns.
--
-- The /api/billing/webhook handler writes these columns whenever
-- Stripe sends a `customer.subscription.*` event so the application
-- can render the active plan without a live Stripe round-trip.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "billing_subscription_id" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_status" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_current_period_end" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "organizations_billing_status_idx"
  ON "organizations" ("billing_status");

CREATE INDEX IF NOT EXISTS "organizations_billing_subscription_id_idx"
  ON "organizations" ("billing_subscription_id");
