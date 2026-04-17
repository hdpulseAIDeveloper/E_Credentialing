-- P2 Gap #17 — Joint Commission NPG 12: peer-review meetings + minutes,
-- and trigger metadata on PracticeEvaluation.

ALTER TABLE "practice_evaluations"
  ADD COLUMN IF NOT EXISTS "trigger"        TEXT,
  ADD COLUMN IF NOT EXISTS "trigger_ref_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PeerReviewMeetingStatus') THEN
    CREATE TYPE "PeerReviewMeetingStatus" AS ENUM (
      'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PeerReviewMinuteOutcome') THEN
    CREATE TYPE "PeerReviewMinuteOutcome" AS ENUM (
      'NO_ACTION', 'CONTINUED_REVIEW', 'FOCUSED_REVIEW_REQUIRED',
      'PRIVILEGE_RESTRICTED', 'PRIVILEGE_SUSPENDED', 'PRIVILEGE_REVOKED',
      'REFER_TO_MEC', 'EXTERNAL_REVIEW_ORDERED'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "peer_review_meetings" (
  "id"                  TEXT PRIMARY KEY,
  "meeting_date"        TIMESTAMP(3) NOT NULL,
  "facility_name"       TEXT,
  "chair_id"            TEXT,
  "status"              "PeerReviewMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
  "attendees"           JSONB NOT NULL DEFAULT '[]',
  "agenda_url"          TEXT,
  "minutes_doc_blob_url" TEXT,
  "notes"               TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "peer_review_meetings_chair_fkey"
    FOREIGN KEY ("chair_id") REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "peer_review_meetings_meeting_date_idx" ON "peer_review_meetings" ("meeting_date");
CREATE INDEX IF NOT EXISTS "peer_review_meetings_status_idx" ON "peer_review_meetings" ("status");

CREATE TABLE IF NOT EXISTS "peer_review_minutes" (
  "id"                   TEXT PRIMARY KEY,
  "meeting_id"           TEXT NOT NULL,
  "provider_id"          TEXT NOT NULL,
  "evaluation_id"        TEXT,
  "case_summary"         TEXT NOT NULL,
  "case_date"            TIMESTAMP(3),
  "case_ref_number"      TEXT,
  "outcome"              "PeerReviewMinuteOutcome" NOT NULL,
  "rationale"            TEXT,
  "follow_up_required"   BOOLEAN NOT NULL DEFAULT false,
  "follow_up_due_date"   TIMESTAMP(3),
  "authored_by_id"       TEXT,
  "is_provider_blinded"  BOOLEAN NOT NULL DEFAULT false,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "peer_review_minutes_meeting_fkey"
    FOREIGN KEY ("meeting_id") REFERENCES "peer_review_meetings"("id") ON DELETE CASCADE,
  CONSTRAINT "peer_review_minutes_provider_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id"),
  CONSTRAINT "peer_review_minutes_evaluation_fkey"
    FOREIGN KEY ("evaluation_id") REFERENCES "practice_evaluations"("id"),
  CONSTRAINT "peer_review_minutes_authored_by_fkey"
    FOREIGN KEY ("authored_by_id") REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "peer_review_minutes_meeting_idx" ON "peer_review_minutes" ("meeting_id");
CREATE INDEX IF NOT EXISTS "peer_review_minutes_provider_idx" ON "peer_review_minutes" ("provider_id");
CREATE INDEX IF NOT EXISTS "peer_review_minutes_outcome_idx" ON "peer_review_minutes" ("outcome");
