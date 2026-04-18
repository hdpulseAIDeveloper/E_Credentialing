-- Wave 5.1 — Multi-tenancy shim (per ADR 0014).
--
-- Adds the Organization root table, plus an `organization_id` column to
-- the first slice of PHI/business-critical models (User, Provider,
-- Document, AuditLog, BotRun). Every existing row is backfilled with
-- the literal `org_essen` so the shim is invisible to single-tenant
-- deploys.
--
-- Subsequent sub-waves (5.1.b…g) will widen the column to the rest of
-- the PHI-bearing models and switch the column to NOT NULL without a
-- default.

-- ───────────────────────────────────────────────────────────────────────
-- 1. Organization table
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "organizations" (
    "id"                  TEXT        NOT NULL PRIMARY KEY,
    "name"                TEXT        NOT NULL,
    "slug"                TEXT        NOT NULL,
    "plan"                TEXT        NOT NULL DEFAULT 'starter',
    "billing_customer_id" TEXT,
    "is_active"           BOOLEAN     NOT NULL DEFAULT true,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "organizations"("slug");

-- Seed the single tenant for the existing Essen deployment so foreign
-- key parity with future referential constraints works out of the box.
INSERT INTO "organizations" ("id", "name", "slug", "plan", "is_active", "created_at", "updated_at")
SELECT 'org_essen', 'Essen Medical Services', 'essen', 'enterprise', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "organizations" WHERE "id" = 'org_essen');

-- ───────────────────────────────────────────────────────────────────────
-- 2. organization_id columns + backfill on the W5.1.a model set.
--    Adding with DEFAULT 'org_essen' both populates existing rows AND
--    keeps INSERTs from legacy code paths working unchanged.
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE "users"      ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_essen';
ALTER TABLE "providers"  ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_essen';
ALTER TABLE "documents"  ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_essen';
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_essen';
ALTER TABLE "bot_runs"   ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_essen';

-- Make sure every legacy row really did get a value (defensive — the
-- DEFAULT clause should cover this, but pre-existing NULLs in earlier
-- migrations have caught us before).
UPDATE "users"      SET "organization_id" = 'org_essen' WHERE "organization_id" IS NULL OR "organization_id" = '';
UPDATE "providers"  SET "organization_id" = 'org_essen' WHERE "organization_id" IS NULL OR "organization_id" = '';
UPDATE "documents"  SET "organization_id" = 'org_essen' WHERE "organization_id" IS NULL OR "organization_id" = '';
UPDATE "audit_logs" SET "organization_id" = 'org_essen' WHERE "organization_id" IS NULL OR "organization_id" = '';
UPDATE "bot_runs"   SET "organization_id" = 'org_essen' WHERE "organization_id" IS NULL OR "organization_id" = '';

-- ───────────────────────────────────────────────────────────────────────
-- 3. Indexes — the tenant Prisma extension issues a WHERE
--    organization_id = $1 on every read; without this index the shim
--    would turn every query into a full-table scan as tenant counts grow.
-- ───────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "users_organization_id_idx"      ON "users"("organization_id");
CREATE INDEX IF NOT EXISTS "providers_organization_id_idx"  ON "providers"("organization_id");
CREATE INDEX IF NOT EXISTS "documents_organization_id_idx"  ON "documents"("organization_id");
CREATE INDEX IF NOT EXISTS "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");
CREATE INDEX IF NOT EXISTS "bot_runs_organization_id_idx"   ON "bot_runs"("organization_id");
