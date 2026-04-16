-- CreateEnum
CREATE TYPE "RecredentialingStatus" AS ENUM ('PENDING', 'APPLICATION_SENT', 'IN_PROGRESS', 'PSV_RUNNING', 'COMMITTEE_READY', 'COMPLETED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ReferenceRequestStatus" AS ENUM ('PENDING', 'SENT', 'REMINDER_SENT', 'RECEIVED', 'EXPIRED', 'DECLINED');

-- CreateEnum
CREATE TYPE "RosterStatus" AS ENUM ('DRAFT', 'GENERATED', 'VALIDATED', 'SUBMITTED', 'ACKNOWLEDGED', 'ERROR');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('OPPE', 'FPPE');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BotType" ADD VALUE 'EDUCATION_AMA';
ALTER TYPE "BotType" ADD VALUE 'EDUCATION_ECFMG';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CredentialType" ADD VALUE 'EDUCATION_MEDICAL_SCHOOL';
ALTER TYPE "CredentialType" ADD VALUE 'EDUCATION_RESIDENCY';
ALTER TYPE "CredentialType" ADD VALUE 'EDUCATION_FELLOWSHIP';
ALTER TYPE "CredentialType" ADD VALUE 'ECFMG_CERTIFICATION';
ALTER TYPE "CredentialType" ADD VALUE 'WORK_HISTORY';
ALTER TYPE "CredentialType" ADD VALUE 'PROFESSIONAL_REFERENCE';
ALTER TYPE "CredentialType" ADD VALUE 'MALPRACTICE_CARRIER';

-- DropForeignKey
ALTER TABLE "communications" DROP CONSTRAINT "communications_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "ncqa_compliance_snapshots" DROP CONSTRAINT "ncqa_snapshots_taken_by_fk";

-- DropForeignKey
ALTER TABLE "ncqa_criterion_assessments" DROP CONSTRAINT "ncqa_assessments_assessed_by_fk";

-- DropForeignKey
ALTER TABLE "ncqa_criterion_assessments" DROP CONSTRAINT "ncqa_assessments_criterion_fk";

-- DropIndex
DROP INDEX "workflows_category_idx";

-- DropIndex
DROP INDEX "workflows_created_by_idx";

-- AlterTable
ALTER TABLE "communications" ALTER COLUMN "provider_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "eft_status" TEXT,
ADD COLUMN     "eft_submitted_at" TIMESTAMP(3),
ADD COLUMN     "era_status" TEXT,
ADD COLUMN     "era_submitted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "provider_profiles" ADD COLUMN     "carrier_verification_date" TIMESTAMP(3),
ADD COLUMN     "carrier_verification_status" TEXT,
ADD COLUMN     "ethnicity" TEXT,
ADD COLUMN     "malpractice_carrier" TEXT,
ADD COLUMN     "malpractice_coverage_amount" TEXT,
ADD COLUMN     "malpractice_exp_date" TIMESTAMP(3),
ADD COLUMN     "malpractice_policy_number" TEXT,
ADD COLUMN     "race" TEXT,
ADD COLUMN     "telehealth_certified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telehealth_platform" TEXT,
ADD COLUMN     "telehealth_states" TEXT[],
ADD COLUMN     "telehealth_training_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "initial_approval_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "recredentialing_cycles" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "cycle_number" INTEGER NOT NULL DEFAULT 1,
    "cycle_length_months" INTEGER NOT NULL DEFAULT 36,
    "due_date" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "RecredentialingStatus" NOT NULL DEFAULT 'PENDING',
    "committee_session_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recredentialing_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "schedule" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_history_verifications" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "employer_name" TEXT NOT NULL,
    "employer_email" TEXT,
    "employer_phone" TEXT,
    "contact_name" TEXT,
    "position" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" "ReferenceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "request_sent_at" TIMESTAMP(3),
    "last_reminder_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "response_token" TEXT NOT NULL,
    "response_data" JSONB,
    "received_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_history_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_references" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "reference_name" TEXT NOT NULL,
    "reference_title" TEXT,
    "reference_email" TEXT NOT NULL,
    "reference_phone" TEXT,
    "relationship" TEXT,
    "status" "ReferenceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "request_sent_at" TIMESTAMP(3),
    "last_reminder_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "response_token" TEXT NOT NULL,
    "response_data" JSONB,
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payer_rosters" (
    "id" TEXT NOT NULL,
    "payer_name" TEXT NOT NULL,
    "roster_format" TEXT NOT NULL DEFAULT 'csv',
    "template_config" JSONB NOT NULL DEFAULT '{}',
    "submission_method" TEXT,
    "last_generated_at" TIMESTAMP(3),
    "last_submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payer_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_submissions" (
    "id" TEXT NOT NULL,
    "roster_id" TEXT NOT NULL,
    "status" "RosterStatus" NOT NULL DEFAULT 'DRAFT',
    "provider_count" INTEGER NOT NULL DEFAULT 0,
    "blob_url" TEXT,
    "validation_errors" JSONB,
    "submitted_at" TIMESTAMP(3),
    "submitted_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_evaluations" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "evaluation_type" "EvaluationType" NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "privilege_id" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "evaluator_id" TEXT,
    "indicators" JSONB,
    "findings" TEXT,
    "recommendation" TEXT,
    "document_blob_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privilege_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privilege_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privilege_items" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpt_codes" TEXT[],
    "icd10_codes" TEXT[],
    "requires_fppe" BOOLEAN NOT NULL DEFAULT false,
    "is_core" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privilege_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cme_credits" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "activity_name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Category 1',
    "credits" DOUBLE PRECISION NOT NULL,
    "completed_date" TIMESTAMP(3) NOT NULL,
    "document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cme_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_training_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_name" TEXT NOT NULL,
    "course_category" TEXT NOT NULL DEFAULT 'general',
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "certificate_url" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_training_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recredentialing_cycles_provider_id_idx" ON "recredentialing_cycles"("provider_id");

-- CreateIndex
CREATE INDEX "recredentialing_cycles_due_date_idx" ON "recredentialing_cycles"("due_date");

-- CreateIndex
CREATE INDEX "recredentialing_cycles_status_idx" ON "recredentialing_cycles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "work_history_verifications_response_token_key" ON "work_history_verifications"("response_token");

-- CreateIndex
CREATE INDEX "work_history_verifications_provider_id_idx" ON "work_history_verifications"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "professional_references_response_token_key" ON "professional_references"("response_token");

-- CreateIndex
CREATE INDEX "professional_references_provider_id_idx" ON "professional_references"("provider_id");

-- CreateIndex
CREATE INDEX "roster_submissions_roster_id_idx" ON "roster_submissions"("roster_id");

-- CreateIndex
CREATE INDEX "practice_evaluations_provider_id_idx" ON "practice_evaluations"("provider_id");

-- CreateIndex
CREATE INDEX "practice_evaluations_due_date_idx" ON "practice_evaluations"("due_date");

-- CreateIndex
CREATE INDEX "practice_evaluations_status_idx" ON "practice_evaluations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "privilege_categories_name_key" ON "privilege_categories"("name");

-- CreateIndex
CREATE INDEX "cme_credits_provider_id_idx" ON "cme_credits"("provider_id");

-- CreateIndex
CREATE INDEX "staff_training_records_user_id_idx" ON "staff_training_records"("user_id");

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recredentialing_cycles" ADD CONSTRAINT "recredentialing_cycles_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recredentialing_cycles" ADD CONSTRAINT "recredentialing_cycles_committee_session_id_fkey" FOREIGN KEY ("committee_session_id") REFERENCES "committee_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_history_verifications" ADD CONSTRAINT "work_history_verifications_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_references" ADD CONSTRAINT "professional_references_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_submissions" ADD CONSTRAINT "roster_submissions_roster_id_fkey" FOREIGN KEY ("roster_id") REFERENCES "payer_rosters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_evaluations" ADD CONSTRAINT "practice_evaluations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_evaluations" ADD CONSTRAINT "practice_evaluations_privilege_id_fkey" FOREIGN KEY ("privilege_id") REFERENCES "hospital_privileges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_evaluations" ADD CONSTRAINT "practice_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privilege_items" ADD CONSTRAINT "privilege_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "privilege_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cme_credits" ADD CONSTRAINT "cme_credits_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cme_credits" ADD CONSTRAINT "cme_credits_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_training_records" ADD CONSTRAINT "staff_training_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncqa_criterion_assessments" ADD CONSTRAINT "ncqa_criterion_assessments_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "ncqa_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncqa_criterion_assessments" ADD CONSTRAINT "ncqa_criterion_assessments_assessed_by_fkey" FOREIGN KEY ("assessed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncqa_compliance_snapshots" ADD CONSTRAINT "ncqa_compliance_snapshots_taken_by_fkey" FOREIGN KEY ("taken_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ncqa_snapshots_taken_at_idx" RENAME TO "ncqa_compliance_snapshots_taken_at_idx";

-- RenameIndex
ALTER INDEX "ncqa_assessments_criterion_period_idx" RENAME TO "ncqa_criterion_assessments_criterion_id_period_start_idx";

-- RenameIndex
ALTER INDEX "ncqa_assessments_status_idx" RENAME TO "ncqa_criterion_assessments_status_idx";

