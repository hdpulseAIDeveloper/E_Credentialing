-- Allow uploads from provider magic-link sessions (no linked User row required)
-- and tag the uploader source.
ALTER TABLE "documents" ALTER COLUMN "uploaded_by" DROP NOT NULL;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "uploader_type" TEXT;

-- Drop the strict FK and re-add as nullable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'documents'
      AND constraint_name = 'documents_uploaded_by_fkey'
  ) THEN
    ALTER TABLE "documents" DROP CONSTRAINT "documents_uploaded_by_fkey";
  END IF;
END $$;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_uploaded_by_fkey"
  FOREIGN KEY ("uploaded_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
