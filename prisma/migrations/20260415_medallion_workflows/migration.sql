-- CreateEnum: CoiStatus
DO $$ BEGIN
  CREATE TYPE "CoiStatus" AS ENUM ('PENDING_OUTREACH', 'INFO_REQUESTED', 'SENT_TO_BROKER', 'OBTAINED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: OnsiteMeetingStatus
DO $$ BEGIN
  CREATE TYPE "OnsiteMeetingStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: MedicaidEnrollmentPath
DO $$ BEGIN
  CREATE TYPE "MedicaidEnrollmentPath" AS ENUM ('NEW_PSP', 'REINSTATEMENT', 'AFFILIATION_UPDATE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable: providers — add COI and onsite meeting fields
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "coi_status" "CoiStatus";
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "coi_broker_name" TEXT;
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "coi_requested_date" TIMESTAMP(3);
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "coi_obtained_date" TIMESTAMP(3);
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "coi_expiration_date" TIMESTAMP(3);
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "onsite_meeting_status" "OnsiteMeetingStatus";
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "onsite_meeting_date" TIMESTAMP(3);
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "onsite_meeting_notes" TEXT;

-- AlterTable: medicaid_enrollments — add 3-path tracking fields
ALTER TABLE "medicaid_enrollments" ADD COLUMN IF NOT EXISTS "enrollment_path" "MedicaidEnrollmentPath";
ALTER TABLE "medicaid_enrollments" ADD COLUMN IF NOT EXISTS "psp_registered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "medicaid_enrollments" ADD COLUMN IF NOT EXISTS "psp_login_provided" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "medicaid_enrollments" ADD COLUMN IF NOT EXISTS "maintenance_file_checked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "medicaid_enrollments" ADD COLUMN IF NOT EXISTS "is_in_maintenance_file" BOOLEAN;
ALTER TABLE "medicaid_enrollments" ADD COLUMN IF NOT EXISTS "prior_enrollment_active" BOOLEAN;
ALTER TABLE "medicaid_enrollments" ADD COLUMN IF NOT EXISTS "group_affiliation_updated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "medicaid_enrollments" ADD COLUMN IF NOT EXISTS "etin_confirmed_date" TIMESTAMP(3);
ALTER TABLE "medicaid_enrollments" ADD COLUMN IF NOT EXISTS "etin_confirmation_doc_url" TEXT;
ALTER TABLE "medicaid_enrollments" ADD COLUMN IF NOT EXISTS "etin_expiration_date" TIMESTAMP(3);
ALTER TABLE "medicaid_enrollments" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "medicaid_enrollments" ADD CONSTRAINT "medicaid_enrollments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
