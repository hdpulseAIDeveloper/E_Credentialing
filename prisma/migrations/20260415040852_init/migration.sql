-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PROVIDER', 'SPECIALIST', 'MANAGER', 'COMMITTEE_MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('INVITED', 'ONBOARDING_IN_PROGRESS', 'DOCUMENTS_PENDING', 'VERIFICATION_IN_PROGRESS', 'COMMITTEE_READY', 'COMMITTEE_IN_REVIEW', 'APPROVED', 'DENIED', 'DEFERRED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "LicenseSource" AS ENUM ('CAQH', 'MANUAL', 'OCR');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PHOTO_ID', 'SSN_CARD', 'CV_RESUME', 'PROFESSIONAL_LIABILITY_INSURANCE', 'ORIGINAL_LICENSE', 'LICENSE_REGISTRATION', 'DEA_CERTIFICATE', 'MEDICAL_SCHOOL_DIPLOMA', 'GRADUATE_CERTIFICATE', 'ECFMG_CERTIFICATE', 'BOARD_CERTIFICATION', 'CME_CREDITS', 'BLS_CARD', 'ACLS_CARD', 'PALS_CARD', 'INFECTION_CONTROL_CERTIFICATE', 'CHILD_ABUSE_CERTIFICATE', 'PAIN_MANAGEMENT_CERTIFICATE', 'PHYSICAL_EXAM_MMR', 'PHYSICAL_EXAM_PPD', 'CHEST_XRAY', 'FLU_SHOT', 'HOSPITAL_APPOINTMENT_LETTER', 'HOSPITAL_REAPPOINTMENT_LETTER', 'INTERNSHIP_CERTIFICATE', 'RESIDENCY_CERTIFICATE', 'FELLOWSHIP_CERTIFICATE');

-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('REQUIRED', 'CONDITIONAL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('PROVIDER_UPLOAD', 'HR_INGESTION', 'EMAIL_INGESTION', 'BOT_OUTPUT');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('RECEIVED', 'PENDING', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "BotType" AS ENUM ('LICENSE_VERIFICATION', 'DEA_VERIFICATION', 'BOARD_NCCPA', 'BOARD_ABIM', 'BOARD_ABFM', 'OIG_SANCTIONS', 'SAM_SANCTIONS', 'NPDB', 'EMEDRAL_ETIN', 'EXPIRABLE_RENEWAL', 'ENROLLMENT_SUBMISSION');

-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'REQUIRES_MANUAL');

-- CreateEnum
CREATE TYPE "BotTriggeredBy" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('LICENSE', 'DEA', 'BOARD_NCCPA', 'BOARD_ABIM', 'BOARD_ABFM', 'BOARD_OTHER', 'OIG_SANCTIONS', 'SAM_SANCTIONS', 'NPDB', 'EMEDRAL', 'HOSPITAL_PRIVILEGE', 'EXPIRABLE_RENEWAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'FLAGGED', 'NOT_FOUND', 'EXPIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('OUTREACH_EMAIL', 'FOLLOW_UP_EMAIL', 'SMS', 'PHONE_LOG', 'INTERNAL_NOTE', 'COMMITTEE_AGENDA_EMAIL');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS', 'PHONE', 'INTERNAL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'LOGGED');

-- CreateEnum
CREATE TYPE "CommitteeSessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommitteeDecision" AS ENUM ('APPROVED', 'DENIED', 'DEFERRED', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('DELEGATED', 'FACILITY_BTC', 'DIRECT');

-- CreateEnum
CREATE TYPE "SubmissionMethod" AS ENUM ('PORTAL_MPP', 'PORTAL_AVAILITY', 'PORTAL_VERITY', 'PORTAL_EYEMED', 'PORTAL_VNS', 'EMAIL', 'FTP');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_PAYER', 'ENROLLED', 'DENIED', 'ERROR', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ExpirableType" AS ENUM ('ACLS', 'BLS', 'PALS', 'INFECTION_CONTROL', 'PAIN_MGMT_HCS', 'PAIN_MGMT_PART1', 'PAIN_MGMT_PART2', 'FLU_SHOT', 'PHYSICAL_EXAM', 'PPD', 'QUANTIFERON', 'CHEST_XRAY', 'IDENTIFICATION', 'HOSPITAL_PRIVILEGE', 'CAQH_ATTESTATION', 'MEDICAID_ETIN', 'MEDICAID_REVALIDATION_PROVIDER', 'MEDICAID_REVALIDATION_GROUP', 'MEDICARE_REVALIDATION_PROVIDER', 'MEDICARE_REVALIDATION_GROUP', 'STATE_LICENSE', 'DEA', 'BOARD_CERTIFICATION', 'MALPRACTICE_INSURANCE');

-- CreateEnum
CREATE TYPE "ExpirableStatus" AS ENUM ('CURRENT', 'EXPIRING_SOON', 'EXPIRED', 'PENDING_RENEWAL', 'RENEWED');

-- CreateEnum
CREATE TYPE "SanctionsSource" AS ENUM ('OIG', 'SAM_GOV');

-- CreateEnum
CREATE TYPE "SanctionsTriggeredBy" AS ENUM ('AUTOMATIC_INITIAL', 'AUTOMATIC_MONTHLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "SanctionsResult" AS ENUM ('CLEAR', 'FLAGGED');

-- CreateEnum
CREATE TYPE "NpdbQueryType" AS ENUM ('INITIAL', 'CONTINUOUS_ALERT', 'ON_DEMAND');

-- CreateEnum
CREATE TYPE "NpdbResult" AS ENUM ('NO_REPORTS', 'REPORTS_FOUND');

-- CreateEnum
CREATE TYPE "HospitalPrivilegeStatus" AS ENUM ('APPLIED', 'PENDING_REVIEW', 'APPROVED', 'DENIED', 'EXPIRED', 'REAPPOINTMENT_DUE');

-- CreateEnum
CREATE TYPE "MedicaidEnrollmentSubtype" AS ENUM ('INDIVIDUAL', 'GROUP');

-- CreateEnum
CREATE TYPE "MedicaidAffiliationStatus" AS ENUM ('PENDING', 'IN_PROCESS', 'ENROLLED', 'REVALIDATION_DUE', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "azure_ad_oid" TEXT,
    "provider_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "notification_preferences" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "requires_ecfmg" BOOLEAN NOT NULL DEFAULT false,
    "requires_dea" BOOLEAN NOT NULL DEFAULT false,
    "requires_boards" BOOLEAN NOT NULL DEFAULT false,
    "board_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'INVITED',
    "provider_type_id" TEXT NOT NULL,
    "assigned_specialist_id" TEXT,
    "legal_first_name" TEXT NOT NULL,
    "legal_middle_name" TEXT,
    "legal_last_name" TEXT NOT NULL,
    "preferred_name" TEXT,
    "date_of_birth" TEXT,
    "ssn" TEXT,
    "gender" TEXT,
    "languages_spoken" TEXT[],
    "npi" TEXT,
    "dea_number" TEXT,
    "caqh_id" TEXT,
    "icims_id" TEXT,
    "medicare_ptan" TEXT,
    "medicaid_id" TEXT,
    "invite_sent_at" TIMESTAMP(3),
    "invite_token" TEXT,
    "invite_token_expires_at" TIMESTAMP(3),
    "application_started_at" TIMESTAMP(3),
    "application_submitted_at" TIMESTAMP(3),
    "committee_ready_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approval_session_id" TEXT,
    "approved_by" TEXT,
    "denial_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_profiles" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "home_address_line1" TEXT,
    "home_address_line2" TEXT,
    "home_city" TEXT,
    "home_state" TEXT,
    "home_zip" TEXT,
    "home_phone" TEXT,
    "mobile_phone" TEXT,
    "personal_email" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "ecfmg_number" TEXT,
    "medical_school_name" TEXT,
    "medical_school_country" TEXT,
    "graduation_year" INTEGER,
    "specialty_primary" TEXT,
    "specialty_secondary" TEXT,
    "hire_date" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "facility_assignment" TEXT,
    "department" TEXT,
    "job_title" TEXT,
    "caqh_data_snapshot" JSONB,
    "icims_data_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_requirements" (
    "id" TEXT NOT NULL,
    "provider_type_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "requirement" "RequirementType" NOT NULL,
    "condition_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "license_number" TEXT NOT NULL,
    "license_type" TEXT NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "issue_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "source" "LicenseSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "original_filename" TEXT NOT NULL,
    "blob_url" TEXT NOT NULL,
    "blob_container" TEXT NOT NULL,
    "blob_path" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "source" "DocumentSource" NOT NULL,
    "ocr_status" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "ocr_data" JSONB,
    "ocr_confidence" DOUBLE PRECISION,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_record_id" TEXT,
    "expiration_date" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "document_id" TEXT,
    "manually_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT,
    "flagged_by" TEXT,
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_runs" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "bot_type" "BotType" NOT NULL,
    "triggered_by" "BotTriggeredBy" NOT NULL,
    "triggered_by_user_id" TEXT,
    "status" "BotStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "input_data" JSONB NOT NULL,
    "output_data" JSONB,
    "error_message" TEXT,
    "log_blob_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_records" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "bot_run_id" TEXT NOT NULL,
    "credential_type" "CredentialType" NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "verified_date" TIMESTAMP(3) NOT NULL,
    "expiration_date" TIMESTAMP(3),
    "source_website" TEXT NOT NULL,
    "result_details" JSONB NOT NULL,
    "pdf_blob_url" TEXT,
    "output_filename" TEXT,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT,
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigned_to" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentioned_user_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "communication_type" "CommunicationType" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL DEFAULT 'OUTBOUND',
    "channel" "CommunicationChannel" NOT NULL,
    "from_user_id" TEXT,
    "to_address" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "template_id" TEXT,
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'SENT',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivery_confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_sessions" (
    "id" TEXT NOT NULL,
    "session_date" TIMESTAMP(3) NOT NULL,
    "session_time" TEXT,
    "location" TEXT,
    "status" "CommitteeSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "agenda_blob_url" TEXT,
    "agenda_sent_at" TIMESTAMP(3),
    "agenda_version" INTEGER NOT NULL DEFAULT 0,
    "committee_member_ids" TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committee_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_providers" (
    "id" TEXT NOT NULL,
    "committee_session_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "agenda_order" INTEGER NOT NULL DEFAULT 0,
    "summary_blob_url" TEXT,
    "summary_version" INTEGER NOT NULL DEFAULT 0,
    "decision" "CommitteeDecision",
    "decision_date" TIMESTAMP(3),
    "decision_by" TEXT,
    "denial_reason" TEXT,
    "conditional_items" TEXT,
    "committee_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committee_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "payer_name" TEXT NOT NULL,
    "enrollment_type" "EnrollmentType" NOT NULL,
    "submission_method" "SubmissionMethod" NOT NULL,
    "portal_name" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "submitted_by" TEXT,
    "submission_file_blob_url" TEXT,
    "payer_confirmation_number" TEXT,
    "effective_date" TIMESTAMP(3),
    "payer_response_date" TIMESTAMP(3),
    "payer_response_notes" TEXT,
    "denial_reason" TEXT,
    "follow_up_due_date" TIMESTAMP(3),
    "follow_up_cadence_days" INTEGER NOT NULL DEFAULT 14,
    "assigned_to" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_follow_ups" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "follow_up_date" TIMESTAMP(3) NOT NULL,
    "performed_by" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "next_follow_up_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollment_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expirables" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "expirable_type" "ExpirableType" NOT NULL,
    "status" "ExpirableStatus" NOT NULL DEFAULT 'CURRENT',
    "expiration_date" TIMESTAMP(3) NOT NULL,
    "renewal_confirmed_date" TIMESTAMP(3),
    "new_expiration_date" TIMESTAMP(3),
    "document_id" TEXT,
    "screenshot_blob_url" TEXT,
    "last_verified_date" TIMESTAMP(3),
    "next_check_date" TIMESTAMP(3) NOT NULL,
    "outreach_sent_at" TIMESTAMP(3),
    "renewal_cadence_days" INTEGER NOT NULL DEFAULT 365,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expirables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sanctions_checks" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "source" "SanctionsSource" NOT NULL,
    "run_date" TIMESTAMP(3) NOT NULL,
    "triggered_by" "SanctionsTriggeredBy" NOT NULL,
    "triggered_by_user_id" TEXT,
    "result" "SanctionsResult" NOT NULL,
    "exclusion_type" TEXT,
    "exclusion_effective_date" TIMESTAMP(3),
    "exclusion_basis" TEXT,
    "pdf_blob_url" TEXT,
    "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "bot_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sanctions_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "npdb_records" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "query_date" TIMESTAMP(3) NOT NULL,
    "query_type" "NpdbQueryType" NOT NULL,
    "continuous_query_enrolled" BOOLEAN NOT NULL DEFAULT false,
    "continuous_query_enrollment_date" TIMESTAMP(3),
    "result" "NpdbResult" NOT NULL,
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "reports" JSONB NOT NULL DEFAULT '[]',
    "query_confirmation_number" TEXT,
    "report_blob_url" TEXT,
    "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "bot_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "npdb_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_privileges" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "facility_name" TEXT NOT NULL,
    "facility_address" TEXT,
    "privilege_type" TEXT NOT NULL,
    "status" "HospitalPrivilegeStatus" NOT NULL DEFAULT 'APPLIED',
    "applied_date" TIMESTAMP(3),
    "approved_date" TIMESTAMP(3),
    "effective_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "appointment_letter_doc_id" TEXT,
    "reappointment_letter_doc_id" TEXT,
    "submitted_by" TEXT,
    "denial_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_privileges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicaid_enrollments" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "enrollment_subtype" "MedicaidEnrollmentSubtype" NOT NULL,
    "payer" TEXT NOT NULL,
    "etin_number" TEXT,
    "affiliation_status" "MedicaidAffiliationStatus" NOT NULL DEFAULT 'PENDING',
    "application_populated_at" TIMESTAMP(3),
    "provider_signature_required" BOOLEAN NOT NULL DEFAULT true,
    "provider_signature_received_at" TIMESTAMP(3),
    "submission_date" TIMESTAMP(3),
    "enrollment_effective_date" TIMESTAMP(3),
    "revalidation_due_date" TIMESTAMP(3),
    "last_follow_up_date" TIMESTAMP(3),
    "notes" TEXT,
    "bot_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicaid_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "metadata" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_azure_ad_oid_key" ON "users"("azure_ad_oid");

-- CreateIndex
CREATE UNIQUE INDEX "provider_types_name_key" ON "provider_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "provider_types_abbreviation_key" ON "provider_types"("abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "providers_npi_key" ON "providers"("npi");

-- CreateIndex
CREATE UNIQUE INDEX "provider_profiles_provider_id_key" ON "provider_profiles"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_requirements_provider_type_id_document_type_key" ON "document_requirements"("provider_type_id", "document_type");

-- CreateIndex
CREATE INDEX "licenses_provider_id_idx" ON "licenses"("provider_id");

-- CreateIndex
CREATE INDEX "licenses_state_license_number_idx" ON "licenses"("state", "license_number");

-- CreateIndex
CREATE INDEX "documents_provider_id_idx" ON "documents"("provider_id");

-- CreateIndex
CREATE INDEX "documents_document_type_idx" ON "documents"("document_type");

-- CreateIndex
CREATE INDEX "checklist_items_provider_id_idx" ON "checklist_items"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_items_provider_id_document_type_key" ON "checklist_items"("provider_id", "document_type");

-- CreateIndex
CREATE INDEX "bot_runs_provider_id_idx" ON "bot_runs"("provider_id");

-- CreateIndex
CREATE INDEX "bot_runs_status_idx" ON "bot_runs"("status");

-- CreateIndex
CREATE INDEX "verification_records_provider_id_idx" ON "verification_records"("provider_id");

-- CreateIndex
CREATE INDEX "verification_records_credential_type_idx" ON "verification_records"("credential_type");

-- CreateIndex
CREATE INDEX "tasks_provider_id_idx" ON "tasks"("provider_id");

-- CreateIndex
CREATE INDEX "tasks_assigned_to_idx" ON "tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "task_comments_task_id_idx" ON "task_comments"("task_id");

-- CreateIndex
CREATE INDEX "communications_provider_id_idx" ON "communications"("provider_id");

-- CreateIndex
CREATE INDEX "communications_sent_at_idx" ON "communications"("sent_at");

-- CreateIndex
CREATE INDEX "committee_sessions_session_date_idx" ON "committee_sessions"("session_date");

-- CreateIndex
CREATE INDEX "committee_providers_committee_session_id_idx" ON "committee_providers"("committee_session_id");

-- CreateIndex
CREATE INDEX "committee_providers_provider_id_idx" ON "committee_providers"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "committee_providers_committee_session_id_provider_id_key" ON "committee_providers"("committee_session_id", "provider_id");

-- CreateIndex
CREATE INDEX "enrollments_provider_id_idx" ON "enrollments"("provider_id");

-- CreateIndex
CREATE INDEX "enrollments_status_idx" ON "enrollments"("status");

-- CreateIndex
CREATE INDEX "enrollments_payer_name_idx" ON "enrollments"("payer_name");

-- CreateIndex
CREATE INDEX "enrollment_follow_ups_enrollment_id_idx" ON "enrollment_follow_ups"("enrollment_id");

-- CreateIndex
CREATE INDEX "expirables_provider_id_idx" ON "expirables"("provider_id");

-- CreateIndex
CREATE INDEX "expirables_expiration_date_idx" ON "expirables"("expiration_date");

-- CreateIndex
CREATE INDEX "expirables_status_idx" ON "expirables"("status");

-- CreateIndex
CREATE INDEX "sanctions_checks_provider_id_idx" ON "sanctions_checks"("provider_id");

-- CreateIndex
CREATE INDEX "sanctions_checks_run_date_idx" ON "sanctions_checks"("run_date");

-- CreateIndex
CREATE INDEX "npdb_records_provider_id_idx" ON "npdb_records"("provider_id");

-- CreateIndex
CREATE INDEX "npdb_records_query_date_idx" ON "npdb_records"("query_date");

-- CreateIndex
CREATE INDEX "hospital_privileges_provider_id_idx" ON "hospital_privileges"("provider_id");

-- CreateIndex
CREATE INDEX "medicaid_enrollments_provider_id_idx" ON "medicaid_enrollments"("provider_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_provider_id_idx" ON "audit_logs"("provider_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_provider_type_id_fkey" FOREIGN KEY ("provider_type_id") REFERENCES "provider_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_assigned_specialist_id_fkey" FOREIGN KEY ("assigned_specialist_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_approval_session_id_fkey" FOREIGN KEY ("approval_session_id") REFERENCES "committee_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_provider_type_id_fkey" FOREIGN KEY ("provider_type_id") REFERENCES "provider_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_verification_record_id_fkey" FOREIGN KEY ("verification_record_id") REFERENCES "verification_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_flagged_by_fkey" FOREIGN KEY ("flagged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_runs" ADD CONSTRAINT "bot_runs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_runs" ADD CONSTRAINT "bot_runs_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_providers" ADD CONSTRAINT "committee_providers_committee_session_id_fkey" FOREIGN KEY ("committee_session_id") REFERENCES "committee_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_providers" ADD CONSTRAINT "committee_providers_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_providers" ADD CONSTRAINT "committee_providers_decision_by_fkey" FOREIGN KEY ("decision_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_follow_ups" ADD CONSTRAINT "enrollment_follow_ups_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_follow_ups" ADD CONSTRAINT "enrollment_follow_ups_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expirables" ADD CONSTRAINT "expirables_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expirables" ADD CONSTRAINT "expirables_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions_checks" ADD CONSTRAINT "sanctions_checks_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions_checks" ADD CONSTRAINT "sanctions_checks_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions_checks" ADD CONSTRAINT "sanctions_checks_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions_checks" ADD CONSTRAINT "sanctions_checks_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npdb_records" ADD CONSTRAINT "npdb_records_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npdb_records" ADD CONSTRAINT "npdb_records_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npdb_records" ADD CONSTRAINT "npdb_records_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_privileges" ADD CONSTRAINT "hospital_privileges_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_privileges" ADD CONSTRAINT "hospital_privileges_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_privileges" ADD CONSTRAINT "hospital_privileges_appointment_letter_doc_id_fkey" FOREIGN KEY ("appointment_letter_doc_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_privileges" ADD CONSTRAINT "hospital_privileges_reappointment_letter_doc_id_fkey" FOREIGN KEY ("reappointment_letter_doc_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicaid_enrollments" ADD CONSTRAINT "medicaid_enrollments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicaid_enrollments" ADD CONSTRAINT "medicaid_enrollments_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
