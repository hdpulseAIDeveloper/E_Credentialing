-- NCQA CVO catalog, per-period assessments, and compliance snapshots.
-- See docs/dev/adr/0012-ncqa-catalog.md for rationale.

-- Enums ----------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "NcqaCategory" AS ENUM (
    'CREDENTIALING',
    'RECREDENTIALING',
    'DELEGATION',
    'PRACTITIONER_RIGHTS',
    'CONFIDENTIALITY',
    'OPERATIONS',
    'QUALITY_MANAGEMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NcqaAssessmentStatus" AS ENUM (
    'NOT_ASSESSED',
    'COMPLIANT',
    'PARTIAL',
    'NON_COMPLIANT',
    'NOT_APPLICABLE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Catalog --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ncqa_criteria" (
  "id"                TEXT PRIMARY KEY,
  "code"              TEXT NOT NULL UNIQUE,
  "category"          "NcqaCategory" NOT NULL,
  "title"             TEXT NOT NULL,
  "description"       TEXT NOT NULL,
  "evidence_required" TEXT,
  "weight"            INTEGER NOT NULL DEFAULT 1,
  "is_active"         BOOLEAN NOT NULL DEFAULT true,
  "sort_order"        INTEGER NOT NULL DEFAULT 0,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "ncqa_criteria_category_idx" ON "ncqa_criteria" ("category");
CREATE INDEX IF NOT EXISTS "ncqa_criteria_is_active_idx" ON "ncqa_criteria" ("is_active");

-- Per-period assessments -----------------------------------------------------

CREATE TABLE IF NOT EXISTS "ncqa_criterion_assessments" (
  "id"            TEXT PRIMARY KEY,
  "criterion_id"  TEXT NOT NULL,
  "period_start"  TIMESTAMP(3) NOT NULL,
  "period_end"    TIMESTAMP(3) NOT NULL,
  "status"        "NcqaAssessmentStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
  "score"         INTEGER,
  "evidence"      JSONB NOT NULL DEFAULT '{}',
  "notes"         TEXT,
  "assessed_by"   TEXT,
  "assessed_at"   TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ncqa_assessments_criterion_fk"
    FOREIGN KEY ("criterion_id") REFERENCES "ncqa_criteria"("id") ON DELETE CASCADE,
  CONSTRAINT "ncqa_assessments_assessed_by_fk"
    FOREIGN KEY ("assessed_by") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ncqa_assessments_criterion_period_idx"
  ON "ncqa_criterion_assessments" ("criterion_id", "period_start");
CREATE INDEX IF NOT EXISTS "ncqa_assessments_status_idx"
  ON "ncqa_criterion_assessments" ("status");

-- Snapshots ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ncqa_compliance_snapshots" (
  "id"                   TEXT PRIMARY KEY,
  "taken_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "total_criteria"       INTEGER NOT NULL,
  "compliant_count"      INTEGER NOT NULL,
  "partial_count"        INTEGER NOT NULL,
  "non_compliant_count"  INTEGER NOT NULL,
  "not_applicable_count" INTEGER NOT NULL,
  "overall_score"        INTEGER NOT NULL,
  "breakdown"            JSONB NOT NULL DEFAULT '{}',
  "taken_by"             TEXT,
  "notes"                TEXT,

  CONSTRAINT "ncqa_snapshots_taken_by_fk"
    FOREIGN KEY ("taken_by") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ncqa_snapshots_taken_at_idx"
  ON "ncqa_compliance_snapshots" ("taken_at");
