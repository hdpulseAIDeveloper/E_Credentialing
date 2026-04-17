-- P2 Gap #18 — NCQA staff data-integrity training tracker.

-- 1. New enums
CREATE TYPE "TrainingCourseFrequency" AS ENUM (
  'ONE_TIME',
  'ANNUAL',
  'EVERY_TWO_YEARS',
  'EVERY_THREE_YEARS'
);

CREATE TYPE "TrainingAssignmentStatus" AS ENUM (
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
  'WAIVED'
);

-- 2. Course catalog
CREATE TABLE "training_courses" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'data_integrity',
  "duration_minutes" INTEGER,
  "frequency" "TrainingCourseFrequency" NOT NULL DEFAULT 'ANNUAL',
  "validity_days" INTEGER,
  "content_url" TEXT,
  "external_lms_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "required_for_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_courses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_courses_code_key" ON "training_courses"("code");

-- 3. Per-user assignments
CREATE TABLE "training_assignments" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_date" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "status" "TrainingAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "record_id" TEXT,
  "reminders_sent" INTEGER NOT NULL DEFAULT 0,
  "last_reminder_sent_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_assignments_user_id_course_id_key"
  ON "training_assignments"("user_id", "course_id");
CREATE INDEX "training_assignments_due_date_idx" ON "training_assignments"("due_date");
CREATE INDEX "training_assignments_status_idx" ON "training_assignments"("status");

ALTER TABLE "training_assignments"
  ADD CONSTRAINT "training_assignments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_assignments"
  ADD CONSTRAINT "training_assignments_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "training_courses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Extend StaffTrainingRecord with course link + score
ALTER TABLE "staff_training_records"
  ADD COLUMN "course_id" TEXT,
  ADD COLUMN "score_percent" INTEGER;

CREATE INDEX "staff_training_records_course_id_idx" ON "staff_training_records"("course_id");

ALTER TABLE "staff_training_records"
  ADD CONSTRAINT "staff_training_records_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "training_courses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Seed the canonical NCQA-required course catalog.
INSERT INTO "training_courses"
  ("id", "code", "title", "description", "category", "duration_minutes",
   "frequency", "validity_days", "is_active", "required_for_roles", "updated_at")
VALUES
  (gen_random_uuid(), 'NCQA-DI-101',
   'NCQA Credentialing Data Integrity 101',
   'Required NCQA training covering accurate documentation, source-of-truth practices, dual-keying / verification standards, and prohibited shortcuts.',
   'data_integrity', 60, 'ANNUAL', 365, true,
   ARRAY['CREDENTIALING_SPECIALIST','MANAGER','MEDICAL_DIRECTOR','ADMIN'],
   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'HIPAA-PRIVACY-101',
   'HIPAA Privacy & Security for Credentialing Staff',
   'HIPAA training on minimum-necessary access, PHI handling, breach reporting, and audit-log requirements specific to credentialing data.',
   'hipaa', 45, 'ANNUAL', 365, true,
   ARRAY['CREDENTIALING_SPECIALIST','MANAGER','MEDICAL_DIRECTOR','ADMIN','PROVIDER'],
   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NCQA-NONDISCRIM-101',
   'Non-Discrimination in Credentialing Decisions',
   'NCQA-required training on credentialing without regard to race, ethnicity, national origin, gender, sexual orientation, age, or types of patients served.',
   'non_discrimination', 30, 'ANNUAL', 365, true,
   ARRAY['CREDENTIALING_SPECIALIST','MANAGER','MEDICAL_DIRECTOR','COMMITTEE_MEMBER'],
   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NCQA-CONFIDENTIALITY-101',
   'Confidentiality of Credentialing & Peer-Review Information',
   'Confidentiality and peer-review-protected information handling per NCQA CR and Joint Commission standards.',
   'confidentiality', 30, 'ANNUAL', 365, true,
   ARRAY['CREDENTIALING_SPECIALIST','MANAGER','MEDICAL_DIRECTOR','COMMITTEE_MEMBER'],
   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NCQA-AI-GOV-101',
   'Responsible Use of AI in Credentialing',
   'Policy training on permitted vs. prohibited AI use, model-card review, decision-rationale logging, and no-training-on-customer-data contractual terms.',
   'ai_governance', 30, 'ANNUAL', 365, true,
   ARRAY['CREDENTIALING_SPECIALIST','MANAGER','MEDICAL_DIRECTOR','ADMIN'],
   CURRENT_TIMESTAMP);
