-- P1 Gap #8: AI document auto-classification.
-- Stores the classifier's independent suggestion alongside the
-- uploader-selected documentType. Staff UI surfaces mismatches so wrong
-- types are caught before they affect verification or NCQA evidence.

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "suggested_document_type" "DocumentType",
  ADD COLUMN IF NOT EXISTS "classifier_confidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "classifier_version" TEXT,
  ADD COLUMN IF NOT EXISTS "classifier_reason" TEXT;
